import { ExportManager, ContextExportOptions } from '../src/export/ExportManager.js';
import { ResolvedContext } from '../src/types/ResolvedContext.js';

describe('ExportManager', () => {
  let exportManager: ExportManager;
  let sampleContext: ResolvedContext;

  beforeEach(() => {
    exportManager = new ExportManager();

    // Create sample context for testing
    sampleContext = {
      files: [
        {
          path: 'src/app.ts',
          content: 'console.log("Hello World");',
          language: 'typescript',
          metadata: {
            size: 27,
            lastModified: new Date('2024-01-01')
          }
        },
        {
          path: 'src/utils.js',
          content: 'export function helper() { return "help"; }',
          language: 'javascript',
          lineRange: [5, 10],
          metadata: {
            size: 43,
            lastModified: new Date('2024-01-02'),
            gitStatus: 'M'
          }
        }
      ],
      diagnostics: [
        {
          file: 'src/app.ts',
          line: 1,
          column: 13,
          severity: 'error',
          message: 'Missing semicolon',
          source: 'eslint',
          code: 'semi'
        }
      ],
      symbols: [],
      git: {
        diff: `diff --git a/src/app.ts b/src/app.ts
index 1234567..abcdefg 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1 +1 @@
-console.log("Hello");
+console.log("Hello World");`,
        branch: 'feature-branch',
        changedFiles: [
          { path: 'src/app.ts', status: 'M', additions: 1, deletions: 1 }
        ]
      },
      metadata: {
        tokenCount: 17,
        fileCount: 2,
        symbolCount: 0,
        diagnosticCount: 1,
        generatedAt: new Date('2024-01-01T12:00:00Z'),
        estimatedReadingTime: 1
      }
    };
  });

  describe('format registration', () => {
    it('should have built-in formats registered', () => {
      const formats = exportManager.getFormats();
      const formatNames = formats.map(f => f.name);

      expect(formatNames).toContain('markdown');
      expect(formatNames).toContain('claude-code');
      expect(formatNames).toContain('cursor');
      expect(formatNames).toContain('json');
    });

    it('should allow registering custom formats', () => {
      const customFormat = {
        name: 'custom',
        mimeType: 'text/plain',
        fileExtension: 'txt',
        format: jest.fn().mockResolvedValue('custom output')
      };

      exportManager.registerFormat(customFormat);

      const formats = exportManager.getFormats();
      expect(formats.map(f => f.name)).toContain('custom');
    });
  });

  describe('markdown export', () => {
    it('should export context in markdown format', async () => {
      const result = await exportManager.export(sampleContext, 'markdown');

      expect(result.content).toContain('# Context for AI Assistant');
      expect(result.content).toContain('## Current Errors');
      expect(result.content).toContain('Missing semicolon');
      expect(result.content).toContain('## Recent Changes (Git Diff)');
      expect(result.content).toContain('## Relevant Files');
      expect(result.content).toContain('### src/app.ts');
      expect(result.content).toContain('```typescript');
      expect(result.content).toContain('console.log("Hello World");');

      expect(result.mimeType).toBe('text/markdown');
      expect(result.filename).toMatch(/context_\d+\.md/);
    });

    it('should include metadata when requested', async () => {
      const options: ContextExportOptions = {
        includeMetadata: true
      };

      const result = await exportManager.export(sampleContext, 'markdown', options);

      expect(result.content).toContain('## Context Metadata');
      expect(result.content).toContain('Files: 2');
      expect(result.content).toContain('Estimated tokens: 17');
    });

    it('should include problem description when provided', async () => {
      const options: ContextExportOptions = {
        problemDescription: 'Help me debug this login issue'
      };

      const result = await exportManager.export(sampleContext, 'markdown', options);

      expect(result.content).toContain('## Problem Description');
      expect(result.content).toContain('Help me debug this login issue');
    });

    it('should handle line ranges correctly', async () => {
      const result = await exportManager.export(sampleContext, 'markdown');

      expect(result.content).toContain('### src/utils.js (lines 5-10)');
    });
  });

  describe('claude-code export', () => {
    it('should export in Claude Code format', async () => {
      const result = await exportManager.export(sampleContext, 'claude-code');

      expect(result.content).toContain('# Context for Claude Code');
      expect(result.content).toContain('*This context is optimized for Claude Code with file editing capabilities.*');
      expect(result.content).toContain('## Issues to Address');
      expect(result.content).toContain('### src/app.ts');
      expect(result.content).toContain('Line 1: Missing semicolon');
      expect(result.content).toContain('`src/app.ts`');
    });

    it('should group errors by file', async () => {
      const contextWithMultipleErrors: ResolvedContext = {
        ...sampleContext,
        diagnostics: [
          {
            file: 'src/app.ts',
            line: 1,
            column: 1,
            severity: 'error',
            message: 'First error'
          },
          {
            file: 'src/app.ts',
            line: 2,
            column: 1,
            severity: 'warning',
            message: 'Second error'
          },
          {
            file: 'src/utils.js',
            line: 5,
            column: 1,
            severity: 'error',
            message: 'Third error'
          }
        ]
      };

      const result = await exportManager.export(contextWithMultipleErrors, 'claude-code');

      expect(result.content).toContain('### src/app.ts');
      expect(result.content).toContain('### src/utils.js');
      expect(result.content).toContain('Line 1: First error');
      expect(result.content).toContain('Line 2: Second error');
      expect(result.content).toContain('Line 5: Third error');
    });
  });

  describe('cursor export', () => {
    it('should export in Cursor format', async () => {
      const result = await exportManager.export(sampleContext, 'cursor');

      expect(result.content).toContain('**Current Issues:**');
      expect(result.content).toContain('**Relevant Files:**');
      expect(result.content).toContain('`src/app.ts`:');
      expect(result.content).toContain('src/app.ts:1 - Missing semicolon');
    });

    it('should limit errors to top 5', async () => {
      const contextWithManyErrors: ResolvedContext = {
        ...sampleContext,
        diagnostics: Array.from({ length: 10 }, (_, i) => ({
          file: `file${i}.ts`,
          line: i + 1,
          column: 1,
          severity: 'error' as const,
          message: `Error ${i + 1}`
        }))
      };

      const result = await exportManager.export(contextWithManyErrors, 'cursor');

      const errorLines = result.content.split('\n').filter(line => line.includes(' - Error '));
      expect(errorLines.length).toBeLessThanOrEqual(5);
    });
  });

  describe('json export', () => {
    it('should export in JSON format', async () => {
      const result = await exportManager.export(sampleContext, 'json');

      expect(result.mimeType).toBe('application/json');
      
      const parsed = JSON.parse(result.content);
      expect(parsed).toHaveProperty('context');
      expect(parsed).toHaveProperty('metadata');
      expect(parsed.context.files).toHaveLength(2);
      expect(parsed.context.diagnostics).toHaveLength(1);
      expect(parsed.metadata.tokenCount).toBe(17);
    });

    it('should include export options in metadata', async () => {
      const options: ContextExportOptions = {
        includeMetadata: true,
        maxFileSize: 5000,
        aiTool: 'claude'
      };

      const result = await exportManager.export(sampleContext, 'json', options);
      
      const parsed = JSON.parse(result.content);
      expect(parsed.metadata.exportOptions).toEqual(options);
    });
  });

  describe('size limitations', () => {
    it('should truncate large files', async () => {
      const largeContent = 'x'.repeat(20000);
      const contextWithLargeFile: ResolvedContext = {
        ...sampleContext,
        files: [{
          path: 'large.ts',
          content: largeContent,
          language: 'typescript',
          metadata: {
            size: 20000,
            lastModified: new Date()
          }
        }]
      };

      const options: ContextExportOptions = {
        maxFileSize: 1000
      };

      const result = await exportManager.export(contextWithLargeFile, 'markdown', options);

      expect(result.content).toContain('// ... (file truncated');
      expect(result.content.length).toBeLessThan(largeContent.length + 1000);
    });

    it('should preserve line breaks when truncating', async () => {
      const largeContent = Array.from({ length: 200 }, (_, i) => `Line ${i + 1}`).join('\n');
      const contextWithLargeFile: ResolvedContext = {
        ...sampleContext,
        files: [{
          path: 'large.ts',
          content: largeContent,
          language: 'typescript',
          metadata: {
            size: largeContent.length,
            lastModified: new Date()
          }
        }]
      };

      const options: ContextExportOptions = {
        maxFileSize: 500
      };

      const result = await exportManager.export(contextWithLargeFile, 'markdown', options);

      // Should truncate at a line boundary
      const truncatedContent = result.content.substring(
        result.content.indexOf('```typescript') + 13,
        result.content.indexOf('// ... (file truncated')
      );
      
      // Should end with a complete line
      expect(truncatedContent.trim()).toMatch(/Line \d+$/);
    });
  });

  describe('metadata calculation', () => {
    it('should calculate export metadata correctly', async () => {
      const result = await exportManager.export(sampleContext, 'markdown');

      expect(result.metadata.characterCount).toBe(result.content.length);
      expect(result.metadata.estimatedTokens).toBe(Math.ceil(result.content.length / 4));
      expect(result.metadata.fileCount).toBe(2);
      expect(result.metadata.contextQuality).toBeGreaterThan(0);
      expect(result.metadata.contextQuality).toBeLessThanOrEqual(1);
    });

    it('should calculate context quality score', async () => {
      // Context with good variety of content should have high quality
      const highQualityResult = await exportManager.export(sampleContext, 'markdown');
      expect(highQualityResult.metadata.contextQuality).toBeGreaterThan(0.7);

      // Empty context should have lower quality
      const emptyContext: ResolvedContext = {
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

      const lowQualityResult = await exportManager.export(emptyContext, 'markdown');
      expect(lowQualityResult.metadata.contextQuality).toBeLessThan(0.6);
    });

    it('should penalize overly large contexts', async () => {
      const largeContext: ResolvedContext = {
        ...sampleContext,
        metadata: {
          ...sampleContext.metadata,
          tokenCount: 60000 // Very large context
        }
      };

      const result = await exportManager.export(largeContext, 'markdown');
      expect(result.metadata.contextQuality).toBeLessThan(0.8);
    });
  });

  describe('export preview', () => {
    it('should provide export preview', async () => {
      const preview = await exportManager.getExportPreview(sampleContext, 'markdown');

      expect(preview.preview.length).toBeLessThanOrEqual(503); // 500 chars + "..."
      expect(preview.preview).toContain('# Context for AI Assistant');
      expect(preview.metadata.fileCount).toBe(2);
      expect(preview.metadata.estimatedTokens).toBeGreaterThan(0);
    });

    it('should not add ellipsis for short content', async () => {
      const shortContext: ResolvedContext = {
        files: [{
          path: 'short.ts',
          content: 'console.log("hi");',
          language: 'typescript',
          metadata: { size: 18, lastModified: new Date() }
        }],
        diagnostics: [],
        symbols: [],
        metadata: {
          tokenCount: 5,
          fileCount: 1,
          symbolCount: 0,
          diagnosticCount: 0,
          generatedAt: new Date(),
          estimatedReadingTime: 0
        }
      };

      const preview = await exportManager.getExportPreview(shortContext, 'markdown');
      expect(preview.preview).not.toContain('...');
    });
  });

  describe('error handling', () => {
    it('should throw error for unknown export format', async () => {
      await expect(
        exportManager.export(sampleContext, 'unknown-format')
      ).rejects.toThrow('Unknown export format: unknown-format');
    });

    it('should handle format errors gracefully', async () => {
      const errorFormat = {
        name: 'error-format',
        mimeType: 'text/plain',
        fileExtension: 'txt',
        format: jest.fn().mockRejectedValue(new Error('Format error'))
      };

      exportManager.registerFormat(errorFormat);

      await expect(
        exportManager.export(sampleContext, 'error-format')
      ).rejects.toThrow('Format error');
    });
  });
});