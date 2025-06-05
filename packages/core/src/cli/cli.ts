#!/usr/bin/env node

import { MentionEngine, MentionEngineConfig } from '../integration/MentionEngine.js';
import { NodeFileSystemProvider } from '../providers/NodeFileSystemProvider.js';
import { NodeGitProvider } from '../providers/NodeGitProvider.js';
import * as readline from 'readline';
import * as process from 'process';

interface CLIConfig {
  llm: {
    provider: 'claude' | 'openai';
    apiKey: string;
    model?: string;
  };
  workspace?: string;
}

class CodeWeaverCLI {
  private engine: MentionEngine;
  private rl: readline.Interface;

  constructor(config: CLIConfig) {
    const workspaceRoot = config.workspace || process.cwd();
    
    const engineConfig: MentionEngineConfig = {
      llm: config.llm,
      optimization: {
        maxContextTokens: 50000, // Conservative limit for CLI
        prioritizeRecentFiles: true,
        includeFileMetadata: true,
        truncateContent: true,
        preserveSymbols: true
      }
    };

    const fileSystem = new NodeFileSystemProvider(workspaceRoot);
    const git = new NodeGitProvider(workspaceRoot);

    this.engine = new MentionEngine(engineConfig, fileSystem, git);
    
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '🧵 Code Weaver> '
    });
  }

  async start() {
    console.log('🧵 Code Weaver CLI - AI-powered code analysis with mentions');
    console.log('');
    console.log('Examples:');
    console.log('  Help me add error handling to @file:src/auth.ts');
    console.log('  What does @function:login do and how can I improve it?');
    console.log('  Analyze the recent @diff changes');
    console.log('  Review all files in @directory:src/components');
    console.log('');
    console.log('Type "help" for more commands, "exit" to quit');
    console.log('');

    this.rl.prompt();

    this.rl.on('line', async (input) => {
      const line = input.trim();
      
      if (line === 'exit' || line === 'quit') {
        console.log('Goodbye! 👋');
        this.rl.close();
        return;
      }
      
      if (line === 'help') {
        this.showHelp();
        this.rl.prompt();
        return;
      }
      
      if (line === 'clear') {
        console.clear();
        this.rl.prompt();
        return;
      }
      
      if (!line) {
        this.rl.prompt();
        return;
      }

      try {
        await this.processQuery(line);
      } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      }
      
      this.rl.prompt();
    });

    this.rl.on('close', () => {
      process.exit(0);
    });
  }

  private async processQuery(query: string) {
    console.log('🔍 Processing query...');
    
    const startTime = Date.now();
    
    try {
      const result = await this.engine.query(query);
      
      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(1);
      
      console.log('');
      console.log('🤖 Response:');
      console.log('─'.repeat(50));
      console.log(result.response);
      console.log('─'.repeat(50));
      console.log('');
      console.log(`📊 Context: ${result.context.files.length} files, ${result.context.symbols.length} symbols, ${result.context.metadata.tokenCount} tokens`);
      console.log(`⏱️  Duration: ${duration}s`);
      
      if (result.usage) {
        console.log(`💰 Tokens: ${result.usage.promptTokens} prompt + ${result.usage.completionTokens} completion = ${result.usage.totalTokens} total`);
      }
      
      console.log(`🔧 Model: ${result.model}`);
      console.log('');
      
    } catch (error) {
      console.error('❌ Failed to process query:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private showHelp() {
    console.log('');
    console.log('🧵 Code Weaver CLI Help');
    console.log('');
    console.log('Mention Types:');
    console.log('  @file:path/to/file.ts           - Include specific file');
    console.log('  @function:functionName          - Find and include function');
    console.log('  @directory:src/components       - Include all files in directory');
    console.log('  @folder:src/utils               - Alias for @directory');
    console.log('  @error                          - Include current errors/diagnostics');
    console.log('  @diff                           - Include git changes');
    console.log('  @class:ClassName                - Find and include class');
    console.log('  @type:TypeName                  - Find and include type definition');
    console.log('');
    console.log('Commands:');
    console.log('  help                            - Show this help');
    console.log('  clear                           - Clear screen');
    console.log('  exit, quit                      - Exit CLI');
    console.log('');
    console.log('Examples:');
    console.log('  "Help me refactor @file:src/auth.ts to use modern async/await"');
    console.log('  "What security issues might exist in @directory:src/api?"');
    console.log('  "Explain the @function:handleLogin method and suggest improvements"');
    console.log('  "Review my recent @diff changes for potential bugs"');
    console.log('');
  }
}

// CLI entry point
async function main() {
  const config: CLIConfig = {
    llm: {
      provider: 'claude', // Default to Claude
      apiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '',
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'
    }
  };

  // Check for OpenAI configuration
  if (process.env.OPENAI_API_KEY) {
    config.llm.provider = 'openai';
    config.llm.apiKey = process.env.OPENAI_API_KEY;
    config.llm.model = process.env.OPENAI_MODEL || 'gpt-4o';
  }

  if (!config.llm.apiKey) {
    console.error('❌ Error: No API key found!');
    console.error('');
    console.error('Please set one of these environment variables:');
    console.error('  CLAUDE_API_KEY or ANTHROPIC_API_KEY for Claude');
    console.error('  OPENAI_API_KEY for OpenAI GPT models');
    console.error('');
    console.error('Example:');
    console.error('  export CLAUDE_API_KEY="sk-ant-..."');
    console.error('  npm run cli');
    process.exit(1);
  }

  // Override workspace if provided as argument
  if (process.argv[2]) {
    config.workspace = process.argv[2];
  }

  console.log(`🚀 Starting with ${config.llm.provider.toUpperCase()} (${config.llm.model})`);
  console.log(`📁 Workspace: ${config.workspace || process.cwd()}`);
  
  const cli = new CodeWeaverCLI(config);
  await cli.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { CodeWeaverCLI };