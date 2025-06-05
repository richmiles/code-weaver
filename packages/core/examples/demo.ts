#!/usr/bin/env node

/**
 * Demo script showing Code Weaver mention parsing and LLM integration
 * 
 * This demonstrates the core MVP functionality:
 * 1. Parse mentions from text
 * 2. Resolve mentions to actual code content  
 * 3. Send context to LLM for analysis
 * 4. Get back intelligent responses
 */

import { MentionEngine } from '../src/integration/MentionEngine.js';
import { NodeFileSystemProvider } from '../src/providers/NodeFileSystemProvider.js';
import { NodeGitProvider } from '../src/providers/NodeGitProvider.js';

async function demo() {
  console.log('🧵 Code Weaver Demo - Mention Parsing and LLM Integration\n');

  // Initialize with current workspace
  const config = {
    llm: {
      provider: 'claude' as const,
      apiKey: process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '',
      model: 'claude-3-5-sonnet-20241022'
    }
  };

  if (!config.llm.apiKey) {
    console.log('❌ No Claude API key found. Set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.');
    console.log('📝 Demo will show mention parsing without LLM integration.\n');
  }

  const workspaceRoot = process.cwd();
  const fileSystem = new NodeFileSystemProvider(workspaceRoot);
  const git = new NodeGitProvider(workspaceRoot);
  
  const engine = new MentionEngine(config, fileSystem, git);

  // Demo 1: Parse mentions from text
  console.log('🔍 Demo 1: Mention Parsing');
  console.log('─'.repeat(50));
  
  const exampleQueries = [
    'Help me add error handling to @file:src/auth.ts, specifically the @function:login method',
    'What does @file:package.json contain and what are the dependencies?',
    'Review the recent @diff changes and @error messages',
    'Analyze all files in @directory:src/components for React best practices'
  ];

  for (const query of exampleQueries) {
    console.log(`Query: "${query}"`);
    const mentions = engine.parseMentions(query);
    console.log(`Found ${mentions.length} mentions:`, mentions.map(m => `${m.type}:${m.value || '(empty)'}`));
    console.log('');
  }

  // Demo 2: Context resolution (without LLM call if no API key)
  console.log('📁 Demo 2: Context Resolution');
  console.log('─'.repeat(50));
  
  const testQuery = 'What does @file:package.json contain?';
  console.log(`Query: "${testQuery}"`);
  
  try {
    if (config.llm.apiKey) {
      console.log('🤖 Sending to LLM...');
      const result = await engine.query(testQuery);
      
      console.log('✅ Response received!');
      console.log(`📊 Context: ${result.context.files.length} files, ${result.context.metadata.tokenCount} tokens`);
      console.log(`🔧 Model: ${result.model}`);
      
      if (result.usage) {
        console.log(`💰 Usage: ${result.usage.totalTokens} tokens`);
      }
      
      console.log('\n🤖 AI Response:');
      console.log('─'.repeat(30));
      console.log(result.response);
      console.log('─'.repeat(30));
      
    } else {
      // Just show context resolution without LLM call
      const mentions = engine.parseMentions(testQuery);
      console.log(`Found mentions: ${mentions.map(m => m.raw).join(', ')}`);
      console.log('(Skipping LLM call - no API key provided)');
    }
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
  }

  console.log('\n✨ Demo complete!');
  console.log('\nTo try the interactive CLI:');
  console.log('  export CLAUDE_API_KEY="your-api-key"');
  console.log('  npm run cli');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  demo().catch(console.error);
}