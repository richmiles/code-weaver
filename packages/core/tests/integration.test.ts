import { describe, it, expect, beforeEach } from '@jest/globals';
import { MentionEngine } from '../src/integration/MentionEngine.js';
import { NodeFileSystemProvider } from '../src/providers/NodeFileSystemProvider.js';
import { NodeGitProvider } from '../src/providers/NodeGitProvider.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock LLM provider for testing
class MockLLMProvider {
  async chat(messages: any[]) {
    return {
      content: 'Mock LLM response based on the provided context.',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150
      },
      model: 'mock-model'
    };
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  getMaxContextTokens(): number {
    return 100000;
  }
}

describe('MentionEngine Integration Tests', () => {
  let tempDir: string;
  let engine: MentionEngine;

  beforeEach(async () => {
    // Create temporary workspace
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeweaver-test-'));
    
    // Create test files
    await fs.writeFile(
      path.join(tempDir, 'auth.ts'),
      `export function login(username: string, password: string): boolean {
  // TODO: Add proper authentication logic
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  
  // Simulate authentication
  return username === 'admin' && password === 'secret';
}

export function logout(): void {
  // Clear session
  console.log('User logged out');
}`
    );

    await fs.mkdir(path.join(tempDir, 'utils'));
    await fs.writeFile(
      path.join(tempDir, 'utils', 'validation.ts'),
      `export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): boolean {
  return password.length >= 8;
}`
    );

    // Mock the engine to use our mock LLM provider
    const mockConfig = {
      llm: {
        provider: 'claude' as const,
        apiKey: 'mock-key'
      }
    };

    const fileSystem = new NodeFileSystemProvider(tempDir);
    const git = new NodeGitProvider(tempDir);
    
    engine = new (class extends MentionEngine {
      constructor() {
        super(mockConfig, fileSystem, git);
        // Replace the LLM provider with our mock
        (this as any).llmProvider = new MockLLMProvider();
      }
    })();
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Mention parsing and resolution', () => {
    it('should parse file mentions correctly', () => {
      const mentions = engine.parseMentions('@file:auth.ts and @file:utils/validation.ts');
      
      expect(mentions).toHaveLength(2);
      expect(mentions[0]).toMatchObject({
        type: 'file',
        value: 'auth.ts'
      });
      expect(mentions[1]).toMatchObject({
        type: 'file',
        value: 'utils/validation.ts'
      });
    });

    it('should parse function mentions correctly', () => {
      const mentions = engine.parseMentions('Help with @function:login method');
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        type: 'function',
        value: 'login'
      });
    });

    it('should parse directory mentions correctly', () => {
      const mentions = engine.parseMentions('Review @directory:utils folder');
      
      expect(mentions).toHaveLength(1);
      expect(mentions[0]).toMatchObject({
        type: 'directory',
        value: 'utils'
      });
    });

    it('should parse mixed mentions correctly', () => {
      const text = 'Help me add error handling to @file:auth.ts, specifically the @function:login method. Consider the patterns used in @directory:utils';
      const mentions = engine.parseMentions(text);
      
      expect(mentions).toHaveLength(3);
      expect(mentions[0].type).toBe('file');
      expect(mentions[0].value).toBe('auth.ts');
      expect(mentions[1].type).toBe('function');
      expect(mentions[1].value).toBe('login');
      expect(mentions[2].type).toBe('directory');
      expect(mentions[2].value).toBe('utils');
    });
  });

  describe('End-to-end query processing', () => {
    it('should process a simple file query', async () => {
      const result = await engine.query('What does @file:auth.ts do?');
      
      expect(result.response).toBeTruthy();
      expect(result.context.files).toHaveLength(1);
      expect(result.context.files[0].path).toBe('auth.ts');
      expect(result.context.files[0].content).toContain('function login');
      expect(result.usage).toBeDefined();
      expect(result.model).toBe('mock-model');
    });

    it('should process multiple file query', async () => {
      const result = await engine.query('Compare @file:auth.ts and @file:utils/validation.ts');
      
      expect(result.response).toBeTruthy();
      expect(result.context.files).toHaveLength(2);
      
      const filePaths = result.context.files.map(f => f.path);
      expect(filePaths).toContain('auth.ts');
      expect(filePaths).toContain('utils/validation.ts');
    });

    it('should process directory query', async () => {
      const result = await engine.query('What validation functions are in @directory:utils?');
      
      expect(result.response).toBeTruthy();
      expect(result.context.files).toHaveLength(1);
      expect(result.context.files[0].path).toBe('utils/validation.ts');
      expect(result.context.files[0].content).toContain('validateEmail');
      expect(result.context.files[0].content).toContain('validatePassword');
    });

    it('should handle the exact example from requirements', async () => {
      const query = 'Help me add error handling to @file:auth.ts, specifically the @function:login method. Consider the patterns used in @directory:utils';
      const result = await engine.query(query);
      
      expect(result.response).toBeTruthy();
      expect(result.context.files.length).toBeGreaterThan(0);
      
      // Should include auth.ts file
      const authFile = result.context.files.find(f => f.path === 'auth.ts');
      expect(authFile).toBeTruthy();
      expect(authFile?.content).toContain('function login');
      
      // Should include utils directory files
      const utilsFile = result.context.files.find(f => f.path.includes('utils'));
      expect(utilsFile).toBeTruthy();
    });
  });

  describe('Context optimization', () => {
    it('should optimize context when it exceeds token limits', async () => {
      // Create a large file that would exceed our mock token limits
      const largeContent = 'console.log("test");\n'.repeat(10000);
      await fs.writeFile(path.join(tempDir, 'large.ts'), largeContent);
      
      const result = await engine.query('Analyze @file:large.ts');
      
      expect(result.response).toBeTruthy();
      expect(result.context.files).toHaveLength(1);
      // Content should be optimized/truncated if it was too large
      expect(result.context.metadata.tokenCount).toBeLessThan(100000);
    });
  });

  describe('Error handling', () => {
    it('should handle non-existent file gracefully', async () => {
      const result = await engine.query('What is in @file:nonexistent.ts?');
      
      // Should still return a response, just with empty context
      expect(result.response).toBeTruthy();
      expect(result.context.files).toHaveLength(0);
    });

    it('should handle invalid mention types gracefully', async () => {
      const mentions = engine.parseMentions('@invalid:something');
      expect(mentions).toHaveLength(0);
    });
  });
});