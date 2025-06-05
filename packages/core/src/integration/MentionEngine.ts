import { MentionParser } from '../parser/MentionParser.js';
import { ContextResolver, FileSystemProvider, GitProvider, DiagnosticsProvider, SymbolProvider } from '../resolver/ContextResolver.js';
import { LLMProvider, LLMMessage } from '../llm/LLMProvider.js';
import { ClaudeProvider } from '../llm/ClaudeProvider.js';
import { OpenAIProvider } from '../llm/OpenAIProvider.js';
import { ContextOptimizer, OptimizationStrategy } from '../optimizer/ContextOptimizer.js';
import { ResolvedContext } from '../types/ResolvedContext.js';

export interface MentionEngineConfig {
  llm: {
    provider: 'claude' | 'openai';
    apiKey: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
  optimization?: {
    maxContextTokens?: number;
    prioritizeRecentFiles?: boolean;
    includeFileMetadata?: boolean;
    truncateContent?: boolean;
    preserveSymbols?: boolean;
  };
}

export interface QueryResult {
  response: string;
  context: ResolvedContext;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export class MentionEngine {
  private parser: MentionParser;
  private resolver: ContextResolver;
  private llmProvider: LLMProvider;
  private optimizer: ContextOptimizer;
  private config: MentionEngineConfig;

  constructor(
    config: MentionEngineConfig,
    fileSystem?: FileSystemProvider,
    git?: GitProvider,
    diagnostics?: DiagnosticsProvider,
    symbols?: SymbolProvider
  ) {
    this.config = config;
    this.parser = new MentionParser();
    this.resolver = new ContextResolver(fileSystem, git, diagnostics, symbols);
    
    // Initialize LLM provider
    this.llmProvider = this.createLLMProvider(config.llm);
    this.optimizer = new ContextOptimizer(this.llmProvider);
  }

  /**
   * Process a query with mentions and return AI response with context
   */
  async query(prompt: string, systemPrompt?: string): Promise<QueryResult> {
    console.log('Processing query:', prompt);
    
    // Step 1: Parse mentions from the prompt
    const mentions = this.parser.parse(prompt);
    console.log(`Found ${mentions.length} mentions:`, mentions.map(m => m.raw));
    
    // Step 2: Resolve mentions to context
    const context = await this.resolver.resolve(mentions);
    console.log(`Resolved context: ${context.files.length} files, ${context.symbols.length} symbols, ${context.diagnostics.length} diagnostics`);
    
    // Step 3: Optimize context for token limits
    const optimizationStrategy: OptimizationStrategy = {
      maxTokens: this.config.optimization?.maxContextTokens || Math.floor(this.llmProvider.getMaxContextTokens() * 0.7),
      prioritizeRecentFiles: this.config.optimization?.prioritizeRecentFiles ?? true,
      includeFileMetadata: this.config.optimization?.includeFileMetadata ?? true,
      truncateContent: this.config.optimization?.truncateContent ?? true,
      preserveSymbols: this.config.optimization?.preserveSymbols ?? true
    };
    
    const optimizedContext = this.optimizer.optimize(context, optimizationStrategy);
    console.log(`Optimized context: ${optimizedContext.metadata.tokenCount} tokens`);
    
    // Step 4: Build messages for LLM
    const messages = this.buildMessages(prompt, optimizedContext, systemPrompt);
    
    // Step 5: Send to LLM and get response
    console.log('Sending to LLM...');
    const response = await this.llmProvider.chat(messages);
    
    return {
      response: response.content,
      context: optimizedContext,
      usage: response.usage,
      model: response.model
    };
  }

  /**
   * Build messages for LLM including context and user prompt
   */
  private buildMessages(userPrompt: string, context: ResolvedContext, systemPrompt?: string): LLMMessage[] {
    const messages: LLMMessage[] = [];
    
    // System message
    const contextualSystemPrompt = this.buildSystemPrompt(context, systemPrompt);
    messages.push({
      role: 'system',
      content: contextualSystemPrompt
    });
    
    // User message with context
    const contextualUserPrompt = this.buildUserPrompt(userPrompt, context);
    messages.push({
      role: 'user',
      content: contextualUserPrompt
    });
    
    return messages;
  }

  /**
   * Build system prompt that includes context information
   */
  private buildSystemPrompt(context: ResolvedContext, customSystemPrompt?: string): string {
    let systemPrompt = customSystemPrompt || 'You are a helpful AI assistant that analyzes code and answers questions about it.';
    
    systemPrompt += '\n\nContext Summary:\n';
    systemPrompt += `- ${context.files.length} files provided\n`;
    systemPrompt += `- ${context.symbols.length} symbols/functions provided\n`;
    systemPrompt += `- ${context.diagnostics.length} diagnostics/errors provided\n`;
    
    if (context.git) {
      systemPrompt += '- Git changes and diff information provided\n';
    }
    
    systemPrompt += '\nPlease use this context to provide accurate, specific answers. Reference file names, line numbers, and function names when relevant.';
    
    return systemPrompt;
  }

  /**
   * Build user prompt that includes all resolved context
   */
  private buildUserPrompt(userPrompt: string, context: ResolvedContext): string {
    let prompt = 'Context:\n\n';
    
    // Add file contents
    if (context.files.length > 0) {
      prompt += '=== FILES ===\n\n';
      for (const file of context.files) {
        prompt += `## ${file.path}\n`;
        if (file.language) {
          prompt += `Language: ${file.language}\n`;
        }
        if (file.lineRange) {
          prompt += `Lines: ${file.lineRange[0]}-${file.lineRange[1]}\n`;
        }
        prompt += '```\n';
        prompt += file.content;
        prompt += '\n```\n\n';
      }
    }
    
    // Add symbols
    if (context.symbols.length > 0) {
      prompt += '=== SYMBOLS/FUNCTIONS ===\n\n';
      for (const symbol of context.symbols) {
        prompt += `## ${symbol.name} (${symbol.kind})\n`;
        prompt += `File: ${symbol.file}:${symbol.line}\n`;
        if (symbol.signature) {
          prompt += `Signature: ${symbol.signature}\n`;
        }
        if (symbol.documentation) {
          prompt += `Documentation: ${symbol.documentation}\n`;
        }
        if (symbol.content) {
          prompt += '```\n';
          prompt += symbol.content;
          prompt += '\n```\n';
        }
        prompt += '\n';
      }
    }
    
    // Add diagnostics/errors
    if (context.diagnostics.length > 0) {
      prompt += '=== DIAGNOSTICS/ERRORS ===\n\n';
      for (const diagnostic of context.diagnostics) {
        prompt += `${diagnostic.severity.toUpperCase()}: ${diagnostic.message}\n`;
        prompt += `File: ${diagnostic.file}:${diagnostic.line}:${diagnostic.column}\n`;
        if (diagnostic.source) {
          prompt += `Source: ${diagnostic.source}\n`;
        }
        prompt += '\n';
      }
    }
    
    // Add git information
    if (context.git) {
      prompt += '=== GIT CHANGES ===\n\n';
      if (context.git.branch) {
        prompt += `Current branch: ${context.git.branch}\n`;
      }
      if (context.git.diff) {
        prompt += '```diff\n';
        prompt += context.git.diff;
        prompt += '\n```\n';
      }
      prompt += '\n';
    }
    
    // Add the user's actual question
    prompt += '=== QUESTION ===\n\n';
    prompt += userPrompt;
    
    return prompt;
  }

  /**
   * Create LLM provider based on configuration
   */
  private createLLMProvider(llmConfig: MentionEngineConfig['llm']): LLMProvider {
    switch (llmConfig.provider) {
      case 'claude':
        return new ClaudeProvider(llmConfig);
      case 'openai':
        return new OpenAIProvider(llmConfig);
      default:
        throw new Error(`Unsupported LLM provider: ${llmConfig.provider}`);
    }
  }

  /**
   * Get autocomplete suggestions for mentions
   */
  getMentionSuggestions(text: string, position: number): any[] {
    return this.parser.autocomplete(text, position);
  }

  /**
   * Parse mentions from text without resolving them
   */
  parseMentions(text: string) {
    return this.parser.parse(text);
  }
}