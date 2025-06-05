import { ValidationError, ValidationResult } from './MessageValidator.js';

export class SecurityValidator {
  // Common file extensions that should be treated with caution
  private static readonly RESTRICTED_EXTENSIONS = new Set([
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.vbe', '.js', '.jse',
    '.wsf', '.wsh', '.msi', '.dll', '.app', '.deb', '.rpm', '.dmg', '.pkg',
    '.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1'
  ]);
  
  // Directories that should never be accessed
  private static readonly FORBIDDEN_DIRECTORIES = new Set([
    '/etc/passwd', '/etc/shadow', '/etc/hosts', '/proc', '/sys', '/dev',
    '/.ssh', '/.aws', '/.config', '/root', '/boot', '/var/log',
    'C:\\Windows\\System32', 'C:\\Windows\\SysWOW64', 'C:\\Program Files',
    '%SYSTEMROOT%', '%PROGRAMFILES%', '%WINDIR%'
  ]);
  
  // Maximum file size that can be processed (in bytes)
  private static readonly MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  
  // Maximum number of files that can be processed in a single operation
  private static readonly MAX_FILES_PER_OPERATION = 1000;
  
  /**
   * Validates file access security
   */
  static validateFileAccess(filePath: string): ValidationResult<string> {
    const errors: ValidationError[] = [];
    
    // Normalize path
    const normalizedPath = this.normalizePath(filePath);
    
    // Check for path traversal
    if (this.hasPathTraversal(normalizedPath)) {
      errors.push(new ValidationError('Path traversal attempt detected', 'path', 'PATH_TRAVERSAL'));
    }
    
    // Check against forbidden directories
    if (this.isForbiddenDirectory(normalizedPath)) {
      errors.push(new ValidationError('Access to system directory forbidden', 'path', 'FORBIDDEN_DIRECTORY'));
    }
    
    // Check file extension
    if (this.hasRestrictedExtension(normalizedPath)) {
      errors.push(new ValidationError('File type not allowed for security reasons', 'path', 'RESTRICTED_EXTENSION'));
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = this.detectSuspiciousPatterns(normalizedPath);
    if (suspiciousPatterns.length > 0) {
      errors.push(new ValidationError(
        `Suspicious patterns detected: ${suspiciousPatterns.join(', ')}`,
        'path',
        'SUSPICIOUS_PATTERN'
      ));
    }
    
    return {
      isValid: errors.length === 0,
      data: normalizedPath,
      errors
    };
  }
  
  /**
   * Validates directory access security
   */
  static validateDirectoryAccess(directoryPath: string): ValidationResult<string> {
    const errors: ValidationError[] = [];
    
    // Use file access validation as base
    const fileValidation = this.validateFileAccess(directoryPath);
    errors.push(...fileValidation.errors);
    
    // Additional directory-specific checks
    const normalizedPath = this.normalizePath(directoryPath);
    
    // Check if trying to access root directories
    if (normalizedPath === '/' || normalizedPath === 'C:\\' || normalizedPath === '') {
      errors.push(new ValidationError('Root directory access not allowed', 'path', 'ROOT_ACCESS'));
    }
    
    return {
      isValid: errors.length === 0,
      data: normalizedPath,
      errors
    };
  }
  
  /**
   * Validates file content for security issues
   */
  static validateFileContent(content: string, filename?: string): ValidationResult<string> {
    const errors: ValidationError[] = [];
    
    // Check file size
    const contentSize = Buffer.byteLength(content, 'utf8');
    if (contentSize > this.MAX_FILE_SIZE) {
      errors.push(new ValidationError(
        `File too large: ${contentSize} bytes (max: ${this.MAX_FILE_SIZE})`,
        'content',
        'FILE_TOO_LARGE'
      ));
    }
    
    // Check for potential security issues in content
    const securityIssues = this.scanContentForSecurityIssues(content, filename);
    errors.push(...securityIssues);
    
    return {
      isValid: errors.length === 0,
      data: content,
      errors
    };
  }
  
  /**
   * Validates search query for security issues
   */
  static validateSearchQuery(query: string): ValidationResult<string> {
    const errors: ValidationError[] = [];
    
    // Check query length
    if (query.length > 256) {
      errors.push(new ValidationError('Search query too long (max 256 characters)', 'query', 'QUERY_TOO_LONG'));
    }
    
    // Check for regex injection attempts
    if (this.hasRegexInjection(query)) {
      errors.push(new ValidationError('Potential regex injection detected', 'query', 'REGEX_INJECTION'));
    }
    
    // Check for command injection attempts
    if (this.hasCommandInjection(query)) {
      errors.push(new ValidationError('Potential command injection detected', 'query', 'COMMAND_INJECTION'));
    }
    
    return {
      isValid: errors.length === 0,
      data: query,
      errors
    };
  }
  
  /**
   * Validates operation limits to prevent DoS attacks
   */
  static validateOperationLimits(operation: {
    fileCount?: number;
    maxDepth?: number;
    maxResults?: number;
  }): ValidationResult<typeof operation> {
    const errors: ValidationError[] = [];
    
    if (operation.fileCount !== undefined && operation.fileCount > this.MAX_FILES_PER_OPERATION) {
      errors.push(new ValidationError(
        `Too many files in operation: ${operation.fileCount} (max: ${this.MAX_FILES_PER_OPERATION})`,
        'fileCount',
        'TOO_MANY_FILES'
      ));
    }
    
    if (operation.maxDepth !== undefined && operation.maxDepth > 20) {
      errors.push(new ValidationError('Directory depth too high (max: 20)', 'maxDepth', 'DEPTH_TOO_HIGH'));
    }
    
    if (operation.maxResults !== undefined && operation.maxResults > 10000) {
      errors.push(new ValidationError('Too many results requested (max: 10000)', 'maxResults', 'TOO_MANY_RESULTS'));
    }
    
    return {
      isValid: errors.length === 0,
      data: operation,
      errors
    };
  }
  
  /**
   * Normalizes a file path for consistent security checking
   */
  private static normalizePath(path: string): string {
    // Convert backslashes to forward slashes
    let normalized = path.replace(/\\/g, '/');
    
    // Remove double slashes
    normalized = normalized.replace(/\/+/g, '/');
    
    // Remove trailing slash unless it's root
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    return normalized;
  }
  
  /**
   * Checks for path traversal attempts
   */
  private static hasPathTraversal(path: string): boolean {
    const traversalPatterns = [
      '../', '..\\', '%2e%2e%2f', '%2e%2e%5c', '..%2f', '..%5c',
      '%252e%252e%252f', '%252e%252e%255c', '....//....\\\\'
    ];
    
    const lowerPath = path.toLowerCase();
    return traversalPatterns.some(pattern => lowerPath.includes(pattern.toLowerCase()));
  }
  
  /**
   * Checks if path accesses forbidden directories
   */
  private static isForbiddenDirectory(path: string): boolean {
    const lowerPath = path.toLowerCase();
    
    return Array.from(this.FORBIDDEN_DIRECTORIES).some(forbidden => 
      lowerPath.startsWith(forbidden.toLowerCase()) || 
      lowerPath === forbidden.toLowerCase()
    );
  }
  
  /**
   * Checks if file has restricted extension
   */
  private static hasRestrictedExtension(path: string): boolean {
    const extension = path.substring(path.lastIndexOf('.')).toLowerCase();
    return this.RESTRICTED_EXTENSIONS.has(extension);
  }
  
  /**
   * Detects suspicious patterns in file paths
   */
  private static detectSuspiciousPatterns(path: string): string[] {
    const suspicious: string[] = [];
    const lowerPath = path.toLowerCase();
    
    // Check for environment variable access
    if (lowerPath.includes('%') || lowerPath.includes('$')) {
      suspicious.push('environment_variables');
    }
    
    // Check for URL schemes
    if (/^[a-z]+:\/\//.test(lowerPath)) {
      suspicious.push('url_scheme');
    }
    
    // Check for hidden files (except common ones)
    if (path.includes('/.') && !path.includes('/.git') && !path.includes('/.vscode')) {
      suspicious.push('hidden_files');
    }
    
    // Check for temporary file patterns
    if (/\.(tmp|temp|bak|old|orig)$/i.test(path)) {
      suspicious.push('temporary_files');
    }
    
    return suspicious;
  }
  
  /**
   * Scans file content for security issues
   */
  private static scanContentForSecurityIssues(content: string, filename?: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check for potential secrets (basic patterns)
    const secretPatterns = [
      /(?:password|passwd|pwd)\s*[:=]\s*[\"']?([^\s\"']+)[\"']?/gi,
      /(?:api[_\-]?key|apikey)\s*[:=]\s*[\"']?([^\s\"']+)[\"']?/gi,
      /(?:secret|token)\s*[:=]\s*[\"']?([^\s\"']+)[\"']?/gi,
      /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi,
      /sk_[a-zA-Z0-9]{24,}/g, // Stripe secret keys
      /AKIA[0-9A-Z]{16}/g, // AWS access keys
    ];
    
    secretPatterns.forEach((pattern, index) => {
      if (pattern.test(content)) {
        errors.push(new ValidationError(
          `Potential secret detected (pattern ${index + 1})`,
          'content',
          'POTENTIAL_SECRET'
        ));
      }
    });
    
    // Check for suspicious code patterns
    if (filename && /\.(js|ts|py|sh|bat|ps1)$/i.test(filename)) {
      const suspiciousCodePatterns = [
        /eval\s*\(/gi,
        /exec\s*\(/gi,
        /system\s*\(/gi,
        /shell_exec\s*\(/gi,
        /child_process/gi,
        /document\.write\s*\(/gi,
        /innerHTML\s*=/gi,
      ];
      
      suspiciousCodePatterns.forEach((pattern, index) => {
        if (pattern.test(content)) {
          errors.push(new ValidationError(
            `Suspicious code pattern detected (pattern ${index + 1})`,
            'content',
            'SUSPICIOUS_CODE'
          ));
        }
      });
    }
    
    return errors;
  }
  
  /**
   * Checks for regex injection attempts
   */
  private static hasRegexInjection(query: string): boolean {
    // Look for potentially dangerous regex patterns
    const dangerousPatterns = [
      /\(\?\#/,  // Regex comments
      /\(\?\=/,  // Positive lookahead
      /\(\?\!/,  // Negative lookahead
      /\(\?\<\=/,  // Positive lookbehind
      /\(\?\<\!/,  // Negative lookbehind
      /\(\?\>/,  // Atomic groups
      /\(\*[A-Z_]+\)/,  // PCRE verbs
      /\\g\d+/,  // Back-references
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(query));
  }
  
  /**
   * Checks for command injection attempts
   */
  private static hasCommandInjection(query: string): boolean {
    const injectionPatterns = [
      /[;&|`$]/,  // Command separators and variable expansion
      /\$\(/,     // Command substitution
      /`[^`]*`/,  // Backtick command execution
      /\|\s*\w+/, // Pipe to commands
      />\s*\/\w+/, // Redirect to files
    ];
    
    return injectionPatterns.some(pattern => pattern.test(query));
  }
}