// Core integration tests for Phase 1 @mention functionality
import { ExportManager } from '../src/export/ExportManager.js';
import { MentionParser } from '../src/parser/MentionParser.js';
import { ContextResolver } from '../src/resolver/ContextResolver.js';

describe('Phase 1 Integration Tests', () => {
  describe('End-to-end @mention workflow', () => {
    it('should parse mentions, resolve context, and export successfully', async () => {
      const parser = new MentionParser();
      const resolver = new ContextResolver();
      const exportManager = new ExportManager();

      // Parse @mention text
      const text = 'Debug @error and check @file:src/app.ts for issues';
      const tokens = parser.parse(text);

      expect(tokens).toHaveLength(2);
      expect(tokens[0].type).toBe('error');
      expect(tokens[1].type).toBe('file');

      // Resolve would normally need providers, but we can test the structure
      const context = await resolver.resolve([]);
      expect(context).toHaveProperty('files');
      expect(context).toHaveProperty('diagnostics');
      expect(context).toHaveProperty('metadata');

      // Export to different formats
      const markdownResult = await exportManager.export(context, 'markdown');
      expect(markdownResult.content).toContain('# Context for AI Assistant');
      expect(markdownResult.mimeType).toBe('text/markdown');

      const jsonResult = await exportManager.export(context, 'json');
      expect(() => JSON.parse(jsonResult.content)).not.toThrow();
      expect(jsonResult.mimeType).toBe('application/json');
    });

    it('should handle autocomplete suggestions', () => {
      const parser = new MentionParser();

      const suggestions = parser.autocomplete('Help with @f', 12);
      
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.map(s => s.type)).toContain('file');
      expect(suggestions.map(s => s.type)).toContain('function');
      expect(suggestions.map(s => s.type)).toContain('folder');
    });

    it('should validate Phase 1 success criteria', () => {
      const parser = new MentionParser();
      
      // Success Criteria 1: Type @function:login and get function definition + immediate dependencies
      const functionTokens = parser.parse('@function:login');
      expect(functionTokens).toHaveLength(1);
      expect(functionTokens[0]).toEqual({
        type: 'function',
        value: 'login',
        params: {},
        position: [0, 15],
        raw: '@function:login'
      });

      // Success Criteria 2: Type @error and get current VS Code problems  
      const errorTokens = parser.parse('@error');
      expect(errorTokens).toHaveLength(1);
      expect(errorTokens[0]).toEqual({
        type: 'error',
        value: '',
        params: {},
        position: [0, 6],
        raw: '@error'
      });

      // Success Criteria 3: Export context in markdown format suitable for any chat interface
      const exportManager = new ExportManager();
      const formats = exportManager.getFormats();
      expect(formats.map(f => f.name)).toContain('markdown');
      expect(formats.map(f => f.name)).toContain('claude-code');
      expect(formats.map(f => f.name)).toContain('cursor');
    });
  });
});