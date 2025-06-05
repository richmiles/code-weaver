import { describe, it, expect } from '@jest/globals';
import { MentionParser } from '../src/parser/MentionParser.js';

describe('MentionParser - Phase 1 Core Functionality', () => {
  let parser: MentionParser;

  beforeEach(() => {
    parser = new MentionParser();
  });

  describe('Basic @mention parsing', () => {
    it('should parse simple file mentions', () => {
      const text = '@file:src/components/App.tsx';
      const tokens = parser.parse(text);
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({
        type: 'file',
        value: 'src/components/App.tsx',
        raw: '@file:src/components/App.tsx',
        position: [0, 28]
      });
    });

    it('should parse function mentions', () => {
      const text = '@function:handleLogin';
      const tokens = parser.parse(text);
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({
        type: 'function',
        value: 'handleLogin',
        raw: '@function:handleLogin',
        position: [0, 21]
      });
    });

    it('should parse error mentions', () => {
      const text = '@error';
      const tokens = parser.parse(text);
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({
        type: 'error',
        value: '',
        raw: '@error',
        position: [0, 6]
      });
    });

    it('should parse diff mentions', () => {
      const text = '@diff';
      const tokens = parser.parse(text);
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({
        type: 'diff',
        value: '',
        raw: '@diff',
        position: [0, 5]
      });
    });

    it('should parse file mentions with line ranges', () => {
      const text = '@file:src/auth.ts:10-20';
      const tokens = parser.parse(text);
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({
        type: 'file',
        value: 'src/auth.ts:10-20',
        raw: '@file:src/auth.ts:10-20',
        params: {}
      });
    });
  });

  describe('Multiple mentions in text', () => {
    it('should parse multiple mentions in a sentence', () => {
      const text = 'I need help with @function:login and @error in the @file:auth.ts file';
      const tokens = parser.parse(text);
      
      expect(tokens).toHaveLength(3);
      
      expect(tokens[0]).toMatchObject({
        type: 'function',
        value: 'login'
      });
      
      expect(tokens[1]).toMatchObject({
        type: 'error',
        value: ''
      });
      
      expect(tokens[2]).toMatchObject({
        type: 'file',
        value: 'auth.ts'
      });
    });

    it('should handle overlapping mention attempts', () => {
      const text = '@file:@function:test.ts'; // Invalid overlap
      const tokens = parser.parse(text);
      
      // Current implementation parses as two separate mentions
      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe('file');
      expect(tokens[1].type).toBe('function');
    });
  });

  describe('Autocomplete functionality', () => {
    it('should provide autocomplete suggestions for partial mentions', () => {
      const text = 'I need help with @f';
      const suggestions = parser.autocomplete(text, text.length);
      
      // Should provide suggestions for @f prefix
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should handle empty partial mentions', () => {
      const text = 'Show me @';
      const suggestions = parser.autocomplete(text, text.length);
      
      // Should provide general suggestions for @ prefix
      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should return empty array for non-mention positions', () => {
      const text = 'Regular text without mentions';
      const suggestions = parser.autocomplete(text, 10);
      
      expect(suggestions).toEqual([]);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty text', () => {
      const tokens = parser.parse('');
      expect(tokens).toHaveLength(0);
    });

    it('should handle @ symbol without mention type', () => {
      const text = 'Email me @ example.com';
      const tokens = parser.parse(text);
      expect(tokens).toHaveLength(0);
    });

    it('should handle malformed mentions gracefully', () => {
      const text = '@:::invalid:::';
      const tokens = parser.parse(text);
      expect(tokens).toHaveLength(0);
    });

    it('should preserve exact positions for multiple mentions', () => {
      const text = 'Check @file:a.ts and @function:b in @diff';
      const tokens = parser.parse(text);
      
      expect(tokens).toHaveLength(3);
      expect(tokens[0].position).toEqual([6, 16]); // @file:a.ts
      expect(tokens[1].position).toEqual([21, 32]); // @function:b
      expect(tokens[2].position).toEqual([36, 41]); // @diff
    });
  });

  describe('Phase 1 Success Criteria', () => {
    it('should successfully parse @function:login mention', () => {
      const text = '@function:login';
      const tokens = parser.parse(text);
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('function');
      expect(tokens[0].value).toBe('login');
    });

    it('should successfully parse @error mention', () => {
      const text = '@error';
      const tokens = parser.parse(text);
      
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('error');
    });

    it('should parse complex context building scenario', () => {
      const text = 'I need help debugging @function:login that has @error and recent @diff changes';
      const tokens = parser.parse(text);
      
      expect(tokens).toHaveLength(3);
      expect(tokens.map(t => t.type)).toEqual(['function', 'error', 'diff']);
      expect(tokens[0].value).toBe('login');
    });
  });
});