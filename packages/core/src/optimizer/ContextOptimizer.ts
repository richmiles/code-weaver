import { ResolvedContext, FileContext, SymbolContext } from '../types/ResolvedContext.js';
import { LLMProvider } from '../llm/LLMProvider.js';

export interface OptimizationStrategy {
  maxTokens: number;
  prioritizeRecentFiles?: boolean;
  includeFileMetadata?: boolean;
  truncateContent?: boolean;
  preserveSymbols?: boolean;
}

export class ContextOptimizer {
  private llmProvider: LLMProvider;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
  }

  /**
   * Optimize context to fit within token limits while preserving most relevant information
   */
  optimize(context: ResolvedContext, strategy: OptimizationStrategy): ResolvedContext {
    const optimized = JSON.parse(JSON.stringify(context)) as ResolvedContext; // Deep clone
    
    // Calculate current token usage
    let currentTokens = this.estimateContextTokens(optimized);
    
    if (currentTokens <= strategy.maxTokens) {
      return optimized; // Already within limits
    }

    console.log(`Context exceeds token limit: ${currentTokens} > ${strategy.maxTokens}. Optimizing...`);

    // Step 1: Remove file metadata if not required
    if (!strategy.includeFileMetadata) {
      optimized.files.forEach(file => {
        delete file.metadata;
      });
      currentTokens = this.estimateContextTokens(optimized);
      if (currentTokens <= strategy.maxTokens) return optimized;
    }

    // Step 2: Prioritize files by relevance
    optimized.files = this.prioritizeFiles(optimized.files, strategy);

    // Step 3: Truncate or remove files until we fit
    while (currentTokens > strategy.maxTokens && optimized.files.length > 0) {
      if (strategy.truncateContent) {
        // Try truncating the largest file first
        const largestFileIndex = this.findLargestFile(optimized.files);
        if (largestFileIndex >= 0) {
          const truncated = this.truncateFileContent(optimized.files[largestFileIndex], 0.7);
          if (truncated.content.length < optimized.files[largestFileIndex].content.length) {
            optimized.files[largestFileIndex] = truncated;
            currentTokens = this.estimateContextTokens(optimized);
            continue;
          }
        }
      }
      
      // Remove the least important file
      optimized.files.pop();
      currentTokens = this.estimateContextTokens(optimized);
    }

    // Step 4: If still over limit, truncate symbols
    if (currentTokens > strategy.maxTokens && !strategy.preserveSymbols) {
      const symbolTokenBudget = Math.floor(strategy.maxTokens * 0.2); // 20% for symbols
      optimized.symbols = this.truncateSymbols(optimized.symbols, symbolTokenBudget);
      currentTokens = this.estimateContextTokens(optimized);
    }

    // Update metadata
    this.recalculateMetadata(optimized);

    console.log(`Context optimized: ${currentTokens} tokens, ${optimized.files.length} files, ${optimized.symbols.length} symbols`);
    
    return optimized;
  }

  /**
   * Estimate token count for the entire context
   */
  private estimateContextTokens(context: ResolvedContext): number {
    let tokens = 0;
    
    // File content tokens
    for (const file of context.files) {
      tokens += this.llmProvider.estimateTokens(file.content);
      tokens += this.llmProvider.estimateTokens(file.path); // File path
      if (file.metadata) {
        tokens += 50; // Rough estimate for metadata
      }
    }
    
    // Symbol tokens
    for (const symbol of context.symbols) {
      tokens += this.llmProvider.estimateTokens(symbol.name);
      if (symbol.content) tokens += this.llmProvider.estimateTokens(symbol.content);
      if (symbol.signature) tokens += this.llmProvider.estimateTokens(symbol.signature);
      if (symbol.documentation) tokens += this.llmProvider.estimateTokens(symbol.documentation);
      tokens += 20; // Overhead for symbol metadata
    }
    
    // Diagnostics tokens
    for (const diagnostic of context.diagnostics) {
      tokens += this.llmProvider.estimateTokens(diagnostic.message);
      tokens += 10; // Overhead
    }
    
    // Git context tokens
    if (context.git) {
      tokens += this.llmProvider.estimateTokens(context.git.diff);
      tokens += context.git.changedFiles.length * 10; // File list overhead
    }
    
    return tokens;
  }

  /**
   * Prioritize files by relevance and recency
   */
  private prioritizeFiles(files: FileContext[], strategy: OptimizationStrategy): FileContext[] {
    return files.sort((a, b) => {
      // Prioritize by file size (smaller files first, more likely to be relevant)
      const sizeScore = (a.content.length || 0) - (b.content.length || 0);
      
      // Prioritize by recency if available
      let recencyScore = 0;
      if (strategy.prioritizeRecentFiles && a.metadata?.lastModified && b.metadata?.lastModified) {
        recencyScore = b.metadata.lastModified.getTime() - a.metadata.lastModified.getTime();
      }
      
      // Prioritize TypeScript/JavaScript files
      const langScore = this.getLanguagePriority(b.language) - this.getLanguagePriority(a.language);
      
      return langScore * 1000 + recencyScore * 0.001 + sizeScore * 0.0001;
    });
  }

  /**
   * Get language priority score
   */
  private getLanguagePriority(language?: string): number {
    const priorities: Record<string, number> = {
      'typescript': 10,
      'javascript': 9,
      'python': 8,
      'java': 7,
      'cpp': 6,
      'c': 6,
      'go': 6,
      'rust': 6,
      'json': 5,
      'yaml': 4,
      'markdown': 3,
      'text': 1
    };
    
    return priorities[language || 'text'] || 1;
  }

  /**
   * Find the index of the largest file by content length
   */
  private findLargestFile(files: FileContext[]): number {
    let largestIndex = -1;
    let largestSize = 0;
    
    files.forEach((file, index) => {
      if (file.content.length > largestSize) {
        largestSize = file.content.length;
        largestIndex = index;
      }
    });
    
    return largestIndex;
  }

  /**
   * Truncate file content by keeping the most relevant parts
   */
  private truncateFileContent(file: FileContext, ratio: number): FileContext {
    const lines = file.content.split('\n');
    const targetLines = Math.floor(lines.length * ratio);
    
    if (targetLines >= lines.length) return file;
    
    // Keep the beginning and end of the file, skip the middle
    const keepStart = Math.floor(targetLines * 0.6);
    const keepEnd = targetLines - keepStart;
    
    const truncatedLines = [
      ...lines.slice(0, keepStart),
      '// ... [content truncated by context optimizer] ...',
      ...lines.slice(lines.length - keepEnd)
    ];
    
    return {
      ...file,
      content: truncatedLines.join('\n')
    };
  }

  /**
   * Truncate symbols to fit within token budget
   */
  private truncateSymbols(symbols: SymbolContext[], tokenBudget: number): SymbolContext[] {
    const truncated: SymbolContext[] = [];
    let currentTokens = 0;
    
    // Sort symbols by importance (functions and classes first)
    const sortedSymbols = symbols.sort((a, b) => {
      const kindPriority: Record<string, number> = {
        'function': 10,
        'class': 9,
        'method': 8,
        'interface': 7,
        'type': 6,
        'variable': 5,
        'constant': 4,
        'enum': 3
      };
      
      return (kindPriority[b.kind] || 0) - (kindPriority[a.kind] || 0);
    });
    
    for (const symbol of sortedSymbols) {
      const symbolTokens = this.estimateSymbolTokens(symbol);
      if (currentTokens + symbolTokens <= tokenBudget) {
        truncated.push(symbol);
        currentTokens += symbolTokens;
      } else {
        break;
      }
    }
    
    return truncated;
  }

  /**
   * Estimate tokens for a single symbol
   */
  private estimateSymbolTokens(symbol: SymbolContext): number {
    let tokens = this.llmProvider.estimateTokens(symbol.name);
    if (symbol.content) tokens += this.llmProvider.estimateTokens(symbol.content);
    if (symbol.signature) tokens += this.llmProvider.estimateTokens(symbol.signature);
    if (symbol.documentation) tokens += this.llmProvider.estimateTokens(symbol.documentation);
    return tokens + 20; // Overhead
  }

  /**
   * Recalculate metadata after optimization
   */
  private recalculateMetadata(context: ResolvedContext): void {
    context.metadata.tokenCount = this.estimateContextTokens(context);
    context.metadata.fileCount = context.files.length;
    context.metadata.symbolCount = context.symbols.length;
    context.metadata.diagnosticCount = context.diagnostics.length;
    context.metadata.generatedAt = new Date();
    
    // Recalculate reading time
    const totalLines = context.files.reduce((acc, file) => acc + file.content.split('\n').length, 0);
    context.metadata.estimatedReadingTime = Math.ceil(totalLines / 50);
  }
}