import { ContextSource } from '../types/ContextSource.js';
import { SourceType } from '../types/SourceType.js';
import { ValidationError, ValidationResult } from './MessageValidator.js';

export class ContextSourceValidator {
  /**
   * Validates a context source object
   */
  static validateContextSource(data: unknown): ValidationResult<ContextSource> {
    const errors: ValidationError[] = [];
    
    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        errors: [new ValidationError('Context source must be an object', 'root')]
      };
    }
    
    const source = data as Record<string, unknown>;
    
    // Validate id
    if (source.id !== undefined) {
      if (typeof source.id !== 'string' || source.id.length < 1 || source.id.length > 256) {
        errors.push(new ValidationError('Source ID must be a string between 1-256 characters', 'id'));
      }
    }
    
    // Validate type
    if (!source.type || typeof source.type !== 'string') {
      errors.push(new ValidationError('Source type is required and must be a string', 'type'));
    } else if (!Object.values(SourceType).includes(source.type as SourceType)) {
      errors.push(new ValidationError(`Invalid source type: ${source.type}`, 'type', 'INVALID_TYPE'));
    }
    
    // Validate name
    if (!source.name || typeof source.name !== 'string') {
      errors.push(new ValidationError('Source name is required and must be a string', 'name'));
    } else if (source.name.length < 1 || source.name.length > 256) {
      errors.push(new ValidationError('Source name must be between 1-256 characters', 'name'));
    }
    
    // Validate path if present
    if (source.path !== undefined) {
      if (typeof source.path !== 'string') {
        errors.push(new ValidationError('Source path must be a string', 'path'));
      } else {
        // Basic security validation for path
        const pathValidation = this.validatePath(source.path);
        if (!pathValidation.isValid) {
          errors.push(...pathValidation.errors.map(e => new ValidationError(e.message, `path.${e.field}`, e.code)));
        }
      }
    }
    
    // Validate enabled flag
    if (source.enabled !== undefined && typeof source.enabled !== 'boolean') {
      errors.push(new ValidationError('Source enabled flag must be a boolean', 'enabled'));
    }
    
    // Validate timestamps
    if (source.createdAt !== undefined) {
      const createdAt = new Date(source.createdAt as string | number | Date);
      if (isNaN(createdAt.getTime())) {
        errors.push(new ValidationError('Invalid createdAt timestamp', 'createdAt'));
      }
    }
    
    if (source.updatedAt !== undefined) {
      const updatedAt = new Date(source.updatedAt as string | number | Date);
      if (isNaN(updatedAt.getTime())) {
        errors.push(new ValidationError('Invalid updatedAt timestamp', 'updatedAt'));
      }
    }
    
    // Validate metadata if present
    if (source.metadata !== undefined) {
      if (typeof source.metadata !== 'object' || source.metadata === null) {
        errors.push(new ValidationError('Source metadata must be an object', 'metadata'));
      } else {
        const metadataValidation = this.validateMetadata(source.metadata);
        if (!metadataValidation.isValid) {
          errors.push(...metadataValidation.errors.map(e => new ValidationError(e.message, `metadata.${e.field}`, e.code)));
        }
      }
    }
    
    // Type-specific validation
    if (source.type && typeof source.type === 'string') {
      const typeValidation = this.validateByType(source.type as SourceType, source);
      if (!typeValidation.isValid) {
        errors.push(...typeValidation.errors);
      }
    }
    
    if (errors.length > 0) {
      return { isValid: false, errors };
    }
    
    return {
      isValid: true,
      data: source as unknown as ContextSource,
      errors: []
    };
  }
  
  /**
   * Validates a file/directory path for security issues
   */
  static validatePath(path: string): ValidationResult<string> {
    const errors: ValidationError[] = [];
    
    // Check for path traversal attempts
    if (path.includes('..')) {
      errors.push(new ValidationError('Path traversal detected', 'traversal', 'PATH_TRAVERSAL'));
    }
    
    // Check for absolute paths outside allowed directories
    if (path.startsWith('/') && !path.startsWith('/workspace/') && !path.startsWith('/tmp/')) {
      errors.push(new ValidationError('Absolute paths outside workspace not allowed', 'absolute', 'INVALID_ABSOLUTE_PATH'));
    }
    
    // Check for null bytes
    if (path.includes('\0')) {
      errors.push(new ValidationError('Null bytes not allowed in path', 'nullbyte', 'NULL_BYTE'));
    }
    
    // Check path length
    if (path.length > 4096) {
      errors.push(new ValidationError('Path too long (max 4096 characters)', 'length', 'PATH_TOO_LONG'));
    }
    
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /\/proc\//,
      /\/sys\//,
      /\/dev\//,
      /\/etc\/passwd/,
      /\/etc\/shadow/,
      /\.ssh\//,
      /\.git\/config/,
      /\.env/
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(path)) {
        errors.push(new ValidationError(`Suspicious path pattern detected: ${pattern.source}`, 'suspicious', 'SUSPICIOUS_PATH'));
        break;
      }
    }
    
    return {
      isValid: errors.length === 0,
      data: path,
      errors
    };
  }
  
  /**
   * Validates metadata object
   */
  private static validateMetadata(metadata: unknown): ValidationResult<Record<string, unknown>> {
    const errors: ValidationError[] = [];
    
    if (typeof metadata !== 'object' || metadata === null) {
      return {
        isValid: false,
        errors: [new ValidationError('Metadata must be an object', 'root')]
      };
    }
    
    const obj = metadata as Record<string, unknown>;
    
    // Check metadata size (prevent DoS)
    const metadataString = JSON.stringify(obj);
    if (metadataString.length > 10 * 1024) { // 10KB limit
      errors.push(new ValidationError('Metadata too large (max 10KB)', 'size', 'METADATA_TOO_LARGE'));
    }
    
    // Validate common metadata fields
    if (obj.size !== undefined) {
      if (typeof obj.size !== 'number' || obj.size < 0) {
        errors.push(new ValidationError('Metadata size must be a non-negative number', 'size'));
      }
    }
    
    if (obj.lastModified !== undefined) {
      const lastModified = new Date(obj.lastModified as string | number | Date);
      if (isNaN(lastModified.getTime())) {
        errors.push(new ValidationError('Invalid lastModified timestamp in metadata', 'lastModified'));
      }
    }
    
    if (obj.encoding !== undefined) {
      if (typeof obj.encoding !== 'string') {
        errors.push(new ValidationError('Metadata encoding must be a string', 'encoding'));
      } else {
        const validEncodings = ['utf8', 'utf-8', 'ascii', 'latin1', 'base64', 'hex'];
        if (!validEncodings.includes(obj.encoding.toLowerCase())) {
          errors.push(new ValidationError(`Invalid encoding: ${obj.encoding}`, 'encoding', 'INVALID_ENCODING'));
        }
      }
    }
    
    return {
      isValid: errors.length === 0,
      data: obj,
      errors
    };
  }
  
  /**
   * Validates source based on its type
   */
  private static validateByType(type: SourceType, source: Record<string, unknown>): ValidationResult<unknown> {
    const errors: ValidationError[] = [];
    
    switch (type) {
      case SourceType.FILE:
        if (!source.path || typeof source.path !== 'string') {
          errors.push(new ValidationError('File source requires a valid path', 'path'));
        }
        break;
        
      case SourceType.DIRECTORY:
        if (!source.path || typeof source.path !== 'string') {
          errors.push(new ValidationError('Directory source requires a valid path', 'path'));
        }
        break;
        
      case SourceType.SNIPPET:
        if (!source.content || typeof source.content !== 'string') {
          errors.push(new ValidationError('Snippet source requires content', 'content'));
        }
        if (source.content && (source.content as string).length > 100 * 1024) { // 100KB limit
          errors.push(new ValidationError('Snippet content too large (max 100KB)', 'content', 'CONTENT_TOO_LARGE'));
        }
        break;
        
      case SourceType.GROUP:
        if (!Array.isArray(source.sourceIds)) {
          errors.push(new ValidationError('Group source requires sourceIds array', 'sourceIds'));
        } else {
          if (source.sourceIds.length === 0) {
            errors.push(new ValidationError('Group source cannot be empty', 'sourceIds'));
          }
          if (source.sourceIds.length > 100) {
            errors.push(new ValidationError('Group source too large (max 100 sources)', 'sourceIds', 'GROUP_TOO_LARGE'));
          }
          
          source.sourceIds.forEach((id, index) => {
            if (typeof id !== 'string') {
              errors.push(new ValidationError(`sourceIds[${index}] must be a string`, `sourceIds[${index}]`));
            }
          });
        }
        break;
        
      default:
        // For extensibility, don't error on unknown types but log a warning
        console.warn(`Unknown source type for validation: ${type}`);
    }
    
    return {
      isValid: errors.length === 0,
      data: source,
      errors
    };
  }
  
  /**
   * Type guard for ContextSource
   */
  static isValidContextSource(data: unknown): data is ContextSource {
    return this.validateContextSource(data).isValid;
  }
  
  /**
   * Validates an array of context sources
   */
  static validateContextSources(data: unknown): ValidationResult<ContextSource[]> {
    const errors: ValidationError[] = [];
    
    if (!Array.isArray(data)) {
      return {
        isValid: false,
        errors: [new ValidationError('Context sources must be an array', 'root')]
      };
    }
    
    const validSources: ContextSource[] = [];
    
    data.forEach((source, index) => {
      const validation = this.validateContextSource(source);
      if (validation.isValid && validation.data) {
        validSources.push(validation.data);
      } else {
        validation.errors.forEach(error => {
          errors.push(new ValidationError(error.message, `[${index}].${error.field}`, error.code));
        });
      }
    });
    
    return {
      isValid: errors.length === 0,
      data: validSources,
      errors
    };
  }
}