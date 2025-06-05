import { ResolvedContext } from '../types/ResolvedContext.js';
import { ExportManager } from './ExportManager.js';

export interface ClipboardExportOptions {
  format: 'markdown' | 'claude' | 'cursor' | 'json';
  includeMetadata: boolean;
  includeTokenCount: boolean;
  maxLength?: number;
}

export class ClipboardManager {
  private exportManager: ExportManager;

  constructor() {
    this.exportManager = new ExportManager();
  }

  /**
   * Export context to clipboard with specified format
   */
  async exportToClipboard(
    context: ResolvedContext, 
    options: ClipboardExportOptions = {
      format: 'markdown',
      includeMetadata: true,
      includeTokenCount: true
    }
  ): Promise<boolean> {
    try {
      const exported = await this.exportManager.export(context, options.format);
      
      // Truncate if needed
      let content = exported.content;
      if (options.maxLength && content.length > options.maxLength) {
        content = content.substring(0, options.maxLength) + '\n\n[Content truncated due to length...]';
      }
      
      // Use the Clipboard API if available (browser environment)
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(content);
        return true;
      }
      
      // Fallback for Node.js environment - use external clipboard utility
      return await this.fallbackClipboardWrite(content);
    } catch (error) {
      console.error('Failed to export to clipboard:', error);
      return false;
    }
  }

  /**
   * Get a preview of what would be exported to clipboard
   */
  async getExportPreview(
    context: ResolvedContext, 
    options: ClipboardExportOptions,
    previewLength: number = 500
  ): Promise<string> {
    try {
      const exported = await this.exportManager.export(context, options.format);
      
      if (exported.content.length <= previewLength) {
        return exported.content;
      }
      
      return exported.content.substring(0, previewLength) + '...\n\n[Preview truncated]';
    } catch (error) {
      return `Error generating preview: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Get export statistics
   */
  getExportStats(context: ResolvedContext): {
    fileCount: number;
    symbolCount: number;
    diagnosticCount: number;
    estimatedTokens: number;
    estimatedLines: number;
    estimatedSize: string;
  } {
    const totalLines = context.files.reduce((sum, file) => 
      sum + file.content.split('\n').length, 0
    );
    
    const totalChars = context.files.reduce((sum, file) => 
      sum + file.content.length, 0
    );

    return {
      fileCount: context.files.length,
      symbolCount: context.symbols.length,
      diagnosticCount: context.diagnostics.length,
      estimatedTokens: context.metadata.tokenCount,
      estimatedLines: totalLines,
      estimatedSize: this.formatFileSize(totalChars)
    };
  }

  /**
   * Check if export size is reasonable for clipboard
   */
  checkExportSize(context: ResolvedContext): {
    isReasonable: boolean;
    warnings: string[];
    recommendations: string[];
  } {
    const stats = this.getExportStats(context);
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Check token count (assume 4 chars per token average)
    if (stats.estimatedTokens > 100000) {
      warnings.push('Very large context may exceed AI model limits');
      recommendations.push('Consider reducing file count or using snippets instead of full files');
    } else if (stats.estimatedTokens > 50000) {
      warnings.push('Large context may approach AI model limits');
      recommendations.push('Monitor token usage in your AI tool');
    }

    // Check file count
    if (stats.fileCount > 20) {
      warnings.push('Many files included - context may be overwhelming');
      recommendations.push('Consider grouping related files or using more specific mentions');
    }

    // Check individual file sizes
    const largeFiles = context.files.filter(file => file.content.length > 10000);
    if (largeFiles.length > 0) {
      warnings.push(`${largeFiles.length} large files detected`);
      recommendations.push('Consider using line ranges (@file:path:start-end) for large files');
    }

    return {
      isReasonable: warnings.length === 0,
      warnings,
      recommendations
    };
  }

  /**
   * Create export with size optimization
   */
  async createOptimizedExport(
    context: ResolvedContext,
    targetTokenLimit: number = 50000
  ): Promise<{ content: string; applied_optimizations: string[] }> {
    const optimizations: string[] = [];
    let optimizedContext = { ...context };

    // If we're over the limit, apply optimizations
    if (context.metadata.tokenCount > targetTokenLimit) {
      // 1. Truncate very long files
      optimizedContext.files = optimizedContext.files.map(file => {
        if (file.content.length > 5000) {
          optimizations.push(`Truncated ${file.path} (was ${file.content.length} chars)`);
          return {
            ...file,
            content: file.content.substring(0, 5000) + '\n\n[... file truncated for size ...]'
          };
        }
        return file;
      });

      // 2. Remove less important diagnostics (keep only errors)
      if (optimizedContext.diagnostics.length > 10) {
        const errors = optimizedContext.diagnostics.filter(d => d.severity === 'error');
        optimizedContext.diagnostics = errors.slice(0, 10);
        optimizations.push(`Kept only top 10 error diagnostics (was ${context.diagnostics.length})`);
      }

      // 3. Limit symbols to most important ones
      if (optimizedContext.symbols.length > 15) {
        optimizedContext.symbols = optimizedContext.symbols.slice(0, 15);
        optimizations.push(`Limited to 15 most relevant symbols (was ${context.symbols.length})`);
      }

      // Recalculate metadata
      this.recalculateMetadata(optimizedContext);
    }

    const exported = await this.exportManager.export(optimizedContext, 'markdown');
    
    return {
      content: exported.content,
      applied_optimizations: optimizations
    };
  }

  /**
   * Fallback clipboard write for Node.js environments
   */
  private async fallbackClipboardWrite(content: string): Promise<boolean> {
    try {
      // Try to use platform-specific clipboard utilities
      const { execSync } = require('child_process');
      
      if (process.platform === 'darwin') {
        // macOS
        execSync('pbcopy', { input: content });
      } else if (process.platform === 'win32') {
        // Windows
        execSync('clip', { input: content });
      } else {
        // Linux - try xclip or xsel
        try {
          execSync('xclip -selection clipboard', { input: content });
        } catch {
          execSync('xsel --clipboard --input', { input: content });
        }
      }
      
      return true;
    } catch (error) {
      console.error('Fallback clipboard write failed:', error);
      return false;
    }
  }

  /**
   * Format file size in human-readable format
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  /**
   * Recalculate metadata for optimized context
   */
  private recalculateMetadata(context: ResolvedContext): void {
    let totalTokens = 0;
    let totalLines = 0;

    for (const file of context.files) {
      const tokens = Math.ceil(file.content.length / 4);
      totalTokens += tokens;
      totalLines += file.content.split('\n').length;
    }

    context.metadata.tokenCount = totalTokens;
    context.metadata.fileCount = context.files.length;
    context.metadata.symbolCount = context.symbols.length;
    context.metadata.diagnosticCount = context.diagnostics.length;
    context.metadata.estimatedReadingTime = Math.ceil(totalLines / 50);
  }
}