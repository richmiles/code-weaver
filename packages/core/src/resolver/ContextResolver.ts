import { MentionToken } from '../types/MentionToken.js';
import { ResolvedContext, FileContext, DiagnosticContext, SymbolContext, GitContext } from '../types/ResolvedContext.js';

export interface ContextProvider {
  getType(): string;
  resolve(token: MentionToken): Promise<Partial<ResolvedContext>>;
}

export interface FileSystemProvider {
  readFile(path: string): Promise<string>;
  listFiles(pattern: string): Promise<string[]>;
  getFileMetadata(path: string): Promise<{ size: number; lastModified: Date }>;
}

export interface GitProvider {
  getDiff(options?: { staged?: boolean; file?: string }): Promise<string>;
  getChangedFiles(): Promise<Array<{ path: string; status: 'M' | 'A' | 'D' | 'R'; additions: number; deletions: number }>>;
  getCurrentBranch(): Promise<string>;
  getCommitFiles(commit: string): Promise<string[]>;
}

export interface DiagnosticsProvider {
  getDiagnostics(file?: string): Promise<DiagnosticContext[]>;
}

export interface SymbolProvider {
  findSymbol(name: string, kind?: string): Promise<SymbolContext[]>;
  getSymbolDefinition(file: string, line: number, character: number): Promise<SymbolContext | null>;
  getSymbolReferences(file: string, line: number, character: number): Promise<Array<{ file: string; line: number; column: number }>>;
}

export class ContextResolver {
  private providers: Map<string, ContextProvider> = new Map();
  private fileSystem?: FileSystemProvider;
  private git?: GitProvider;
  private diagnostics?: DiagnosticsProvider;
  private symbols?: SymbolProvider;

  constructor(
    fileSystem?: FileSystemProvider,
    git?: GitProvider,
    diagnostics?: DiagnosticsProvider,
    symbols?: SymbolProvider
  ) {
    this.fileSystem = fileSystem;
    this.git = git;
    this.diagnostics = diagnostics;
    this.symbols = symbols;
  }

  /**
   * Register a context provider for a specific mention type
   */
  registerProvider(provider: ContextProvider): void {
    this.providers.set(provider.getType(), provider);
  }

  /**
   * Resolve multiple mention tokens into a complete context
   */
  async resolve(tokens: MentionToken[]): Promise<ResolvedContext> {
    const context: ResolvedContext = {
      files: [],
      diagnostics: [],
      symbols: [],
      metadata: {
        tokenCount: 0,
        fileCount: 0,
        symbolCount: 0,
        diagnosticCount: 0,
        generatedAt: new Date(),
        estimatedReadingTime: 0
      }
    };

    // Resolve each token
    for (const token of tokens) {
      try {
        const partialContext = await this.resolveToken(token);
        this.mergeContext(context, partialContext);
      } catch (error) {
        console.error(`Error resolving token ${token.raw}:`, error);
      }
    }

    // Apply auto-expansion and deduplication
    await this.expandDependencies(context);
    this.deduplicateContext(context);
    this.calculateMetadata(context);

    return context;
  }

  /**
   * Resolve a single mention token
   */
  private async resolveToken(token: MentionToken): Promise<Partial<ResolvedContext>> {
    // Try registered providers first
    const provider = this.providers.get(token.type);
    if (provider) {
      return await provider.resolve(token);
    }

    // Built-in resolvers
    switch (token.type) {
      case 'file':
        return await this.resolveFile(token);
      case 'error':
        return await this.resolveErrors(token);
      case 'diff':
        return await this.resolveDiff(token);
      case 'folder':
      case 'directory':
        return await this.resolveFolder(token);
      case 'recent':
        return await this.resolveRecent(token);
      case 'open':
        return await this.resolveOpen(token);
      case 'modified':
        return await this.resolveModified(token);
      case 'function':
      case 'class':
      case 'method':
      case 'type':
      case 'interface':
      case 'variable':
        return await this.resolveSymbol(token);
      default:
        console.warn(`No resolver for mention type: ${token.type}`);
        return {};
    }
  }

  private async resolveFile(token: MentionToken): Promise<Partial<ResolvedContext>> {
    if (!this.fileSystem || !token.value) {
      return {};
    }

    try {
      const content = await this.fileSystem.readFile(token.value);
      const metadata = await this.fileSystem.getFileMetadata(token.value);

      // Handle line ranges
      let processedContent = content;
      let lineRange: [number, number] | undefined;

      if (token.params?.lines) {
        const [start, end] = token.params.lines.split('-').map(n => parseInt(n, 10));
        if (!isNaN(start)) {
          const lines = content.split('\n');
          const startIdx = Math.max(0, start - 1);
          const endIdx = isNaN(end) ? startIdx + 1 : Math.min(lines.length, end);
          processedContent = lines.slice(startIdx, endIdx).join('\n');
          lineRange = [start, endIdx];
        }
      }

      const fileContext: FileContext = {
        path: token.value,
        content: processedContent,
        lineRange,
        language: this.detectLanguage(token.value),
        metadata: {
          size: metadata.size,
          lastModified: metadata.lastModified
        }
      };

      return { files: [fileContext] };
    } catch (error) {
      console.error(`Failed to resolve file ${token.value}:`, error);
      return {};
    }
  }

  private async resolveErrors(token: MentionToken): Promise<Partial<ResolvedContext>> {
    if (!this.diagnostics) {
      return {};
    }

    try {
      const diagnostics = await this.diagnostics.getDiagnostics(token.value);
      return { diagnostics };
    } catch (error) {
      console.error('Failed to resolve errors:', error);
      return {};
    }
  }

  private async resolveDiff(token: MentionToken): Promise<Partial<ResolvedContext>> {
    if (!this.git) {
      return {};
    }

    try {
      const options: { staged?: boolean; file?: string } = {};
      
      if (token.params?.staged === 'true') {
        options.staged = true;
      }
      
      if (token.value) {
        options.file = token.value;
      }

      const diff = await this.git.getDiff(options);
      const changedFiles = await this.git.getChangedFiles();
      const branch = await this.git.getCurrentBranch();

      const git: GitContext = {
        diff,
        branch,
        changedFiles
      };

      return { git };
    } catch (error) {
      console.error('Failed to resolve diff:', error);
      return {};
    }
  }

  private async resolveFolder(token: MentionToken): Promise<Partial<ResolvedContext>> {
    if (!this.fileSystem || !token.value) {
      return {};
    }

    try {
      const pattern = token.params?.recursive === 'true' 
        ? `${token.value}/**/*`
        : `${token.value}/*`;
      
      const files = await this.fileSystem.listFiles(pattern);
      const fileContexts: FileContext[] = [];

      // Limit to prevent overwhelming context
      const maxFiles = parseInt(token.params?.limit || '10', 10);
      const limitedFiles = files.slice(0, maxFiles);

      for (const filePath of limitedFiles) {
        try {
          const content = await this.fileSystem.readFile(filePath);
          const metadata = await this.fileSystem.getFileMetadata(filePath);

          fileContexts.push({
            path: filePath,
            content,
            language: this.detectLanguage(filePath),
            metadata: {
              size: metadata.size,
              lastModified: metadata.lastModified
            }
          });
        } catch (error) {
          console.error(`Failed to read file ${filePath}:`, error);
        }
      }

      return { files: fileContexts };
    } catch (error) {
      console.error(`Failed to resolve folder ${token.value}:`, error);
      return {};
    }
  }

  private async resolveRecent(_token: MentionToken): Promise<Partial<ResolvedContext>> {
    // This would need integration with editor/IDE to get recently opened files
    // For now, return empty context
    console.warn('Recent files resolution not implemented yet');
    return {};
  }

  private async resolveOpen(_token: MentionToken): Promise<Partial<ResolvedContext>> {
    // This would need integration with editor/IDE to get currently open files
    // For now, return empty context
    console.warn('Open files resolution not implemented yet');
    return {};
  }

  private async resolveModified(_token: MentionToken): Promise<Partial<ResolvedContext>> {
    if (!this.git || !this.fileSystem) {
      return {};
    }

    try {
      const changedFiles = await this.git.getChangedFiles();
      const fileContexts: FileContext[] = [];

      for (const file of changedFiles) {
        try {
          const content = await this.fileSystem.readFile(file.path);
          const metadata = await this.fileSystem.getFileMetadata(file.path);

          fileContexts.push({
            path: file.path,
            content,
            language: this.detectLanguage(file.path),
            metadata: {
              size: metadata.size,
              lastModified: metadata.lastModified,
              gitStatus: file.status
            }
          });
        } catch (error) {
          console.error(`Failed to read modified file ${file.path}:`, error);
        }
      }

      return { files: fileContexts };
    } catch (error) {
      console.error('Failed to resolve modified files:', error);
      return {};
    }
  }

  private async resolveSymbol(token: MentionToken): Promise<Partial<ResolvedContext>> {
    if (!this.symbols || !token.value) {
      return {};
    }

    try {
      const symbols = await this.symbols.findSymbol(token.value, token.type);
      return { symbols };
    } catch (error) {
      console.error(`Failed to resolve symbol ${token.value}:`, error);
      return {};
    }
  }

  /**
   * Expand context with related dependencies
   */
  private async expandDependencies(context: ResolvedContext): Promise<void> {
    // For now, implement basic expansion
    // Future: Add TypeScript AST analysis, import resolution, etc.
    
    if (this.symbols) {
      // Expand symbols with their dependencies
      for (const symbol of context.symbols) {
        if (symbol.dependencies) {
          for (const dep of symbol.dependencies) {
            try {
              const depSymbols = await this.symbols.findSymbol(dep);
              for (const depSymbol of depSymbols) {
                if (!context.symbols.find(s => s.name === depSymbol.name && s.file === depSymbol.file)) {
                  context.symbols.push(depSymbol);
                }
              }
            } catch (error) {
              console.error(`Failed to expand dependency ${dep}:`, error);
            }
          }
        }
      }
    }
  }

  /**
   * Remove duplicate files and merge overlapping content
   */
  private deduplicateContext(context: ResolvedContext): void {
    // Deduplicate files by path
    const uniqueFiles = new Map<string, FileContext>();
    
    for (const file of context.files) {
      const existing = uniqueFiles.get(file.path);
      if (existing) {
        // Merge line ranges if they overlap or are adjacent
        if (file.lineRange && existing.lineRange) {
          const [start1, end1] = existing.lineRange;
          const [start2, end2] = file.lineRange;
          
          if (start2 <= end1 + 1 && end2 >= start1 - 1) {
            // Overlapping or adjacent ranges
            const mergedStart = Math.min(start1, start2);
            const mergedEnd = Math.max(end1, end2);
            
            // Re-read the merged content if needed
            existing.lineRange = [mergedStart, mergedEnd];
            // Note: In a real implementation, we'd re-read the file content for the merged range
          }
        } else if (!existing.lineRange && file.lineRange) {
          // Full file already included, keep it
          continue;
        } else if (existing.lineRange && !file.lineRange) {
          // Replace range with full file
          uniqueFiles.set(file.path, file);
        }
      } else {
        uniqueFiles.set(file.path, file);
      }
    }
    
    context.files = Array.from(uniqueFiles.values());
    
    // Deduplicate symbols
    const uniqueSymbols = new Map<string, SymbolContext>();
    for (const symbol of context.symbols) {
      const key = `${symbol.name}:${symbol.file}:${symbol.line}`;
      uniqueSymbols.set(key, symbol);
    }
    context.symbols = Array.from(uniqueSymbols.values());
  }

  /**
   * Calculate metadata for the resolved context
   */
  private calculateMetadata(context: ResolvedContext): void {
    let totalTokens = 0;
    let totalLines = 0;

    for (const file of context.files) {
      // Rough token estimation: ~4 characters per token
      const tokens = Math.ceil(file.content.length / 4);
      totalTokens += tokens;
      totalLines += file.content.split('\n').length;
    }

    context.metadata.tokenCount = totalTokens;
    context.metadata.fileCount = context.files.length;
    context.metadata.symbolCount = context.symbols.length;
    context.metadata.diagnosticCount = context.diagnostics.length;
    context.metadata.estimatedReadingTime = Math.ceil(totalLines / 50); // ~50 lines per minute reading
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'go': 'go',
      'rs': 'rust',
      'rb': 'ruby',
      'php': 'php',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml'
    };
    
    return languageMap[ext] || 'text';
  }

  /**
   * Merge partial context into main context
   */
  private mergeContext(main: ResolvedContext, partial: Partial<ResolvedContext>): void {
    if (partial.files) {
      main.files.push(...partial.files);
    }
    if (partial.diagnostics) {
      main.diagnostics.push(...partial.diagnostics);
    }
    if (partial.symbols) {
      main.symbols.push(...partial.symbols);
    }
    if (partial.git) {
      main.git = partial.git;
    }
    if (partial.rawText) {
      main.rawText = (main.rawText || '') + '\n' + partial.rawText;
    }
  }
}