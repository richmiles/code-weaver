import { ResolvedContext, FileContext, DiagnosticContext, GitContext } from '../types/ResolvedContext.js';

export interface ContextExportFormat {
  name: string;
  mimeType: string;
  fileExtension: string;
  format(context: ResolvedContext, options?: ContextExportOptions): Promise<string>;
}

export interface ContextExportOptions {
  includeMetadata?: boolean;
  includeLineNumbers?: boolean;
  maxFileSize?: number; // in characters
  problemDescription?: string;
  aiTool?: 'claude' | 'cursor' | 'copilot' | 'generic';
  templateType?: 'debug' | 'feature' | 'review' | 'generic';
}

export interface ContextExportResult {
  content: string;
  mimeType: string;
  filename: string;
  metadata: {
    characterCount: number;
    estimatedTokens: number;
    fileCount: number;
    contextQuality: number; // 0-1 score
  };
}

export class ExportManager {
  private formats: Map<string, ContextExportFormat> = new Map();

  constructor() {
    // Register built-in formats
    this.registerFormat(new MarkdownExportFormat());
    this.registerFormat(new ClaudeCodeExportFormat());
    this.registerFormat(new CursorExportFormat());
    this.registerFormat(new JSONExportFormat());
  }

  /**
   * Register a new export format
   */
  registerFormat(format: ContextExportFormat): void {
    this.formats.set(format.name, format);
  }

  /**
   * Get all available export formats
   */
  getFormats(): ContextExportFormat[] {
    return Array.from(this.formats.values());
  }

  /**
   * Export context using the specified format
   */
  async export(
    context: ResolvedContext,
    formatName: string,
    options: ContextExportOptions = {}
  ): Promise<ContextExportResult> {
    const format = this.formats.get(formatName);
    if (!format) {
      throw new Error(`Unknown export format: ${formatName}`);
    }

    // Apply size limits
    const limitedContext = this.applySizeLimits(context, options);

    const content = await format.format(limitedContext, options);
    const characterCount = content.length;
    const estimatedTokens = Math.ceil(characterCount / 4); // rough estimate

    return {
      content,
      mimeType: format.mimeType,
      filename: `context_${Date.now()}.${format.fileExtension}`,
      metadata: {
        characterCount,
        estimatedTokens,
        fileCount: limitedContext.files.length,
        contextQuality: this.calculateContextQuality(limitedContext)
      }
    };
  }

  /**
   * Get a quick preview of what would be exported
   */
  async getExportPreview(
    context: ResolvedContext,
    formatName: string,
    options: ContextExportOptions = {}
  ): Promise<{ preview: string; metadata: ContextExportResult['metadata'] }> {
    const result = await this.export(context, formatName, options);
    const preview = result.content.substring(0, 500) + (result.content.length > 500 ? '...' : '');
    
    return {
      preview,
      metadata: result.metadata
    };
  }

  private applySizeLimits(context: ResolvedContext, options: ContextExportOptions): ResolvedContext {
    const maxFileSize = options.maxFileSize || 10000; // 10k chars default
    
    const limitedFiles = context.files.map(file => {
      if (file.content.length <= maxFileSize) {
        return file;
      }

      // Truncate large files with a summary
      const truncated = file.content.substring(0, maxFileSize);
      const lastNewline = truncated.lastIndexOf('\n');
      const safeContent = lastNewline > maxFileSize * 0.8 ? truncated.substring(0, lastNewline) : truncated;
      
      return {
        ...file,
        content: safeContent + `\n\n// ... (file truncated, ${file.content.length - safeContent.length} characters omitted)`
      };
    });

    return {
      ...context,
      files: limitedFiles
    };
  }

  private calculateContextQuality(context: ResolvedContext): number {
    let score = 0.5; // base score

    // Having files increases quality
    if (context.files.length > 0) {
      score += 0.2;
      
      // More files (up to a point) improve quality
      score += Math.min(context.files.length * 0.05, 0.2);
    }

    // Having symbols/functions increases quality
    if (context.symbols.length > 0) {
      score += 0.1;
    }

    // Having diagnostics helps with debugging contexts
    if (context.diagnostics.length > 0) {
      score += 0.1;
    }

    // Having git context helps
    if (context.git) {
      score += 0.1;
    }

    // Penalize if context is too large (overwhelming)
    if (context.metadata.tokenCount > 50000) {
      score -= 0.2;
    } else if (context.metadata.tokenCount > 20000) {
      score -= 0.1;
    }

    return Math.max(0, Math.min(1, score));
  }
}

/**
 * Standard markdown format for universal AI tool compatibility
 */
class MarkdownExportFormat implements ContextExportFormat {
  name = 'markdown';
  mimeType = 'text/markdown';
  fileExtension = 'md';

  async format(context: ResolvedContext, options: ContextExportOptions = {}): Promise<string> {
    const sections: string[] = [];

    // Header
    sections.push('# Context for AI Assistant\n');

    // Problem description if provided
    if (options.problemDescription) {
      sections.push('## Problem Description\n');
      sections.push(options.problemDescription + '\n');
    }

    // Current errors (high priority)
    if (context.diagnostics.length > 0) {
      sections.push('## Current Errors\n');
      context.diagnostics.forEach(diag => {
        sections.push(`- **${diag.severity.toUpperCase()}** in \`${diag.file}:${diag.line}\`: ${diag.message}`);
      });
      sections.push('');
    }

    // Git changes
    if (context.git?.diff) {
      sections.push('## Recent Changes (Git Diff)\n');
      sections.push('```diff');
      sections.push(context.git.diff);
      sections.push('```\n');
    }

    // Files
    if (context.files.length > 0) {
      sections.push('## Relevant Files\n');
      
      for (const file of context.files) {
        const header = file.lineRange 
          ? `### ${file.path} (lines ${file.lineRange[0]}-${file.lineRange[1]})`
          : `### ${file.path}`;
        
        sections.push(header);
        
        if (options.includeMetadata && file.metadata) {
          sections.push(`*Size: ${file.metadata.size} bytes, Modified: ${file.metadata.lastModified?.toLocaleString()}*`);
        }
        
        sections.push('```' + (file.language || ''));
        sections.push(file.content);
        sections.push('```\n');
      }
    }

    // Symbols/Functions
    if (context.symbols.length > 0) {
      sections.push('## Symbols and Functions\n');
      context.symbols.forEach(symbol => {
        sections.push(`- **${symbol.kind}** \`${symbol.name}\` in \`${symbol.file}:${symbol.line}\``);
        if (symbol.content) {
          sections.push(`  \`\`\`${this.detectLanguage(symbol.file)}`);
          sections.push(`  ${symbol.content}`);
          sections.push('  ```');
        }
      });
      sections.push('');
    }

    // Metadata
    if (options.includeMetadata) {
      sections.push('## Context Metadata\n');
      sections.push(`- Files: ${context.metadata.fileCount}`);
      sections.push(`- Estimated tokens: ${context.metadata.tokenCount}`);
      sections.push(`- Generated: ${context.metadata.generatedAt.toLocaleString()}`);
      if (context.metadata.projectType) {
        sections.push(`- Project type: ${context.metadata.projectType}`);
      }
    }

    return sections.join('\n');
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const languageMap: Record<string, string> = {
      'ts': 'typescript', 'tsx': 'typescript', 'js': 'javascript', 'jsx': 'javascript',
      'py': 'python', 'java': 'java', 'cpp': 'cpp', 'c': 'c', 'go': 'go', 'rs': 'rust'
    };
    return languageMap[ext] || '';
  }
}

/**
 * Claude Code specific format with enhanced file references
 */
class ClaudeCodeExportFormat implements ContextExportFormat {
  name = 'claude-code';
  mimeType = 'text/markdown';
  fileExtension = 'md';

  async format(context: ResolvedContext, options: ContextExportOptions = {}): Promise<string> {
    const sections: string[] = [];

    // Claude Code header with protocol hints
    sections.push('# Context for Claude Code\n');
    sections.push('*This context is optimized for Claude Code with file editing capabilities.*\n');

    if (options.problemDescription) {
      sections.push('## Task Description\n');
      sections.push(options.problemDescription + '\n');
    }

    // Prioritize errors for debugging
    if (context.diagnostics.length > 0) {
      sections.push('## Issues to Address\n');
      const errorsByFile = new Map<string, DiagnosticContext[]>();
      
      context.diagnostics.forEach(diag => {
        if (!errorsByFile.has(diag.file)) {
          errorsByFile.set(diag.file, []);
        }
        errorsByFile.get(diag.file)!.push(diag);
      });

      for (const [file, diags] of errorsByFile) {
        sections.push(`### ${file}\n`);
        diags.forEach(diag => {
          sections.push(`- Line ${diag.line}: ${diag.message} \`[${diag.severity}]\``);
        });
        sections.push('');
      }
    }

    // Files with Claude Code references
    if (context.files.length > 0) {
      sections.push('## Project Files\n');
      
      for (const file of context.files) {
        const lineRef = file.lineRange ? `:${file.lineRange[0]}-${file.lineRange[1]}` : '';
        sections.push(`### \`${file.path}${lineRef}\`\n`);
        
        sections.push('```' + (file.language || ''));
        sections.push(file.content);
        sections.push('```\n');
      }
    }

    return sections.join('\n');
  }
}

/**
 * Cursor IDE compatible format
 */
class CursorExportFormat implements ContextExportFormat {
  name = 'cursor';
  mimeType = 'text/markdown';
  fileExtension = 'md';

  async format(context: ResolvedContext, options: ContextExportOptions = {}): Promise<string> {
    const sections: string[] = [];

    if (options.problemDescription) {
      sections.push(options.problemDescription + '\n');
    }

    // Cursor prefers concise, action-oriented context
    if (context.diagnostics.length > 0) {
      sections.push('**Current Issues:**');
      context.diagnostics.slice(0, 5).forEach(diag => { // Limit to top 5
        sections.push(`- ${diag.file}:${diag.line} - ${diag.message}`);
      });
      sections.push('');
    }

    // Files (Cursor handles file attachments well)
    if (context.files.length > 0) {
      sections.push('**Relevant Files:**');
      sections.push('');
      
      for (const file of context.files) {
        sections.push(`\`${file.path}\`:`);
        sections.push('```' + (file.language || ''));
        sections.push(file.content);
        sections.push('```\n');
      }
    }

    return sections.join('\n');
  }
}

/**
 * JSON format for API integrations
 */
class JSONExportFormat implements ContextExportFormat {
  name = 'json';
  mimeType = 'application/json';
  fileExtension = 'json';

  async format(context: ResolvedContext, options: ContextExportOptions = {}): Promise<string> {
    const exportData = {
      context: {
        files: context.files.map(file => ({
          path: file.path,
          content: file.content,
          lineRange: file.lineRange,
          language: file.language,
          metadata: file.metadata
        })),
        diagnostics: context.diagnostics,
        symbols: context.symbols,
        git: context.git,
        rawText: context.rawText
      },
      metadata: {
        ...context.metadata,
        exportOptions: options
      },
      generatedAt: new Date().toISOString()
    };

    return JSON.stringify(exportData, null, 2);
  }
}