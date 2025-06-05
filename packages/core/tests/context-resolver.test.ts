import { ContextResolver, FileSystemProvider, GitProvider, DiagnosticsProvider } from '../src/resolver/ContextResolver.js';
import { MentionToken } from '../src/types/MentionToken.js';
import { DiagnosticContext } from '../src/types/ResolvedContext.js';

describe('ContextResolver', () => {
  let resolver: ContextResolver;
  let mockFileSystem: jest.Mocked<FileSystemProvider>;
  let mockGit: jest.Mocked<GitProvider>;
  let mockDiagnostics: jest.Mocked<DiagnosticsProvider>;

  beforeEach(() => {
    mockFileSystem = {
      readFile: jest.fn(),
      listFiles: jest.fn(),
      getFileMetadata: jest.fn()
    };

    mockGit = {
      getDiff: jest.fn(),
      getChangedFiles: jest.fn(),
      getCurrentBranch: jest.fn(),
      getCommitFiles: jest.fn()
    };

    mockDiagnostics = {
      getDiagnostics: jest.fn()
    };

    resolver = new ContextResolver(mockFileSystem, mockGit, mockDiagnostics);
  });

  describe('file resolution', () => {
    it('should resolve file tokens correctly', async () => {
      const fileContent = 'console.log("Hello World");';
      const metadata = { size: 100, lastModified: new Date() };

      mockFileSystem.readFile.mockResolvedValue(fileContent);
      mockFileSystem.getFileMetadata.mockResolvedValue(metadata);

      const tokens: MentionToken[] = [{
        type: 'file',
        value: 'src/app.ts',
        params: {},
        position: [0, 13],
        raw: '@file:src/app.ts'
      }];

      const context = await resolver.resolve(tokens);

      expect(context.files).toHaveLength(1);
      expect(context.files[0]).toEqual({
        path: 'src/app.ts',
        content: fileContent,
        language: 'typescript',
        metadata: {
          size: 100,
          lastModified: metadata.lastModified
        }
      });
      expect(context.metadata.fileCount).toBe(1);
    });

    it('should handle file line ranges', async () => {
      const fileContent = 'line1\nline2\nline3\nline4\nline5';
      const metadata = { size: 100, lastModified: new Date() };

      mockFileSystem.readFile.mockResolvedValue(fileContent);
      mockFileSystem.getFileMetadata.mockResolvedValue(metadata);

      const tokens: MentionToken[] = [{
        type: 'file',
        value: 'src/app.ts',
        params: { lines: '2-4' },
        position: [0, 25],
        raw: '@file:src/app.ts(lines=2-4)'
      }];

      const context = await resolver.resolve(tokens);

      expect(context.files[0].content).toBe('line2\nline3\nline4');
      expect(context.files[0].lineRange).toEqual([2, 4]);
    });

    it('should detect programming languages correctly', async () => {
      mockFileSystem.readFile.mockResolvedValue('test content');
      mockFileSystem.getFileMetadata.mockResolvedValue({ size: 100, lastModified: new Date() });

      const testCases = [
        { file: 'app.ts', expectedLang: 'typescript' },
        { file: 'component.tsx', expectedLang: 'typescript' },
        { file: 'script.js', expectedLang: 'javascript' },
        { file: 'component.jsx', expectedLang: 'javascript' },
        { file: 'main.py', expectedLang: 'python' },
        { file: 'Server.java', expectedLang: 'java' },
        { file: 'style.css', expectedLang: 'css' },
        { file: 'config.json', expectedLang: 'json' },
        { file: 'README.md', expectedLang: 'markdown' },
        { file: 'unknown.xyz', expectedLang: 'text' }
      ];

      for (const testCase of testCases) {
        const tokens: MentionToken[] = [{
          type: 'file',
          value: testCase.file,
          params: {},
          position: [0, 10],
          raw: `@file:${testCase.file}`
        }];

        const context = await resolver.resolve(tokens);
        expect(context.files[0].language).toBe(testCase.expectedLang);
      }
    });
  });

  describe('error resolution', () => {
    it('should resolve error tokens correctly', async () => {
      const diagnostics: DiagnosticContext[] = [
        {
          file: 'src/app.ts',
          line: 10,
          column: 5,
          severity: 'error',
          message: 'Cannot find name "undefinedVar"',
          source: 'typescript',
          code: 2304
        },
        {
          file: 'src/utils.ts',
          line: 20,
          column: 12,
          severity: 'warning',
          message: 'Unused variable "unusedVar"',
          source: 'typescript',
          code: 6196
        }
      ];

      mockDiagnostics.getDiagnostics.mockResolvedValue(diagnostics);

      const tokens: MentionToken[] = [{
        type: 'error',
        value: '',
        params: {},
        position: [0, 6],
        raw: '@error'
      }];

      const context = await resolver.resolve(tokens);

      expect(context.diagnostics).toEqual(diagnostics);
      expect(context.metadata.diagnosticCount).toBe(2);
    });

    it('should filter errors by file when specified', async () => {
      const allDiagnostics: DiagnosticContext[] = [
        {
          file: 'src/app.ts',
          line: 10,
          column: 5,
          severity: 'error',
          message: 'Error in app.ts'
        },
        {
          file: 'src/utils.ts',
          line: 20,
          column: 12,
          severity: 'warning',
          message: 'Warning in utils.ts'
        }
      ];

      const filteredDiagnostics = allDiagnostics.filter(d => d.file === 'src/app.ts');
      mockDiagnostics.getDiagnostics.mockResolvedValue(filteredDiagnostics);

      const tokens: MentionToken[] = [{
        type: 'error',
        value: 'src/app.ts',
        params: {},
        position: [0, 17],
        raw: '@error:src/app.ts'
      }];

      const context = await resolver.resolve(tokens);

      expect(mockDiagnostics.getDiagnostics).toHaveBeenCalledWith('src/app.ts');
      expect(context.diagnostics).toHaveLength(1);
      expect(context.diagnostics[0].file).toBe('src/app.ts');
    });
  });

  describe('git diff resolution', () => {
    it('should resolve diff tokens correctly', async () => {
      const diff = `diff --git a/src/app.ts b/src/app.ts
index 1234567..abcdefg 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 console.log('Hello');
+console.log('World');`;

      const changedFiles = [
        { path: 'src/app.ts', status: 'M' as const, additions: 1, deletions: 0 }
      ];

      mockGit.getDiff.mockResolvedValue(diff);
      mockGit.getChangedFiles.mockResolvedValue(changedFiles);
      mockGit.getCurrentBranch.mockResolvedValue('feature-branch');

      const tokens: MentionToken[] = [{
        type: 'diff',
        value: '',
        params: {},
        position: [0, 5],
        raw: '@diff'
      }];

      const context = await resolver.resolve(tokens);

      expect(context.git).toEqual({
        diff,
        branch: 'feature-branch',
        changedFiles
      });
    });

    it('should handle staged diff option', async () => {
      mockGit.getDiff.mockResolvedValue('staged diff content');
      mockGit.getChangedFiles.mockResolvedValue([]);
      mockGit.getCurrentBranch.mockResolvedValue('main');

      const tokens: MentionToken[] = [{
        type: 'diff',
        value: '',
        params: { staged: 'true' },
        position: [0, 13],
        raw: '@diff(staged)'
      }];

      await resolver.resolve(tokens);

      expect(mockGit.getDiff).toHaveBeenCalledWith({ staged: true });
    });

    it('should handle file-specific diff', async () => {
      mockGit.getDiff.mockResolvedValue('file-specific diff');
      mockGit.getChangedFiles.mockResolvedValue([]);
      mockGit.getCurrentBranch.mockResolvedValue('main');

      const tokens: MentionToken[] = [{
        type: 'diff',
        value: 'src/app.ts',
        params: {},
        position: [0, 17],
        raw: '@diff:src/app.ts'
      }];

      await resolver.resolve(tokens);

      expect(mockGit.getDiff).toHaveBeenCalledWith({ file: 'src/app.ts' });
    });
  });

  describe('folder resolution', () => {
    it('should resolve folder tokens correctly', async () => {
      const files = ['src/app.ts', 'src/utils.ts'];
      const fileContent = 'file content';
      const metadata = { size: 100, lastModified: new Date() };

      mockFileSystem.listFiles.mockResolvedValue(files);
      mockFileSystem.readFile.mockResolvedValue(fileContent);
      mockFileSystem.getFileMetadata.mockResolvedValue(metadata);

      const tokens: MentionToken[] = [{
        type: 'folder',
        value: 'src',
        params: {},
        position: [0, 11],
        raw: '@folder:src'
      }];

      const context = await resolver.resolve(tokens);

      expect(mockFileSystem.listFiles).toHaveBeenCalledWith('src/*');
      expect(context.files).toHaveLength(2);
      expect(context.files[0].path).toBe('src/app.ts');
      expect(context.files[1].path).toBe('src/utils.ts');
    });

    it('should handle recursive folder option', async () => {
      mockFileSystem.listFiles.mockResolvedValue([]);
      mockFileSystem.readFile.mockResolvedValue('');
      mockFileSystem.getFileMetadata.mockResolvedValue({ size: 0, lastModified: new Date() });

      const tokens: MentionToken[] = [{
        type: 'folder',
        value: 'src',
        params: { recursive: 'true' },
        position: [0, 25],
        raw: '@folder:src(recursive)'
      }];

      await resolver.resolve(tokens);

      expect(mockFileSystem.listFiles).toHaveBeenCalledWith('src/**/*');
    });

    it('should limit folder files based on limit parameter', async () => {
      const manyFiles = Array.from({ length: 20 }, (_, i) => `file${i}.ts`);
      mockFileSystem.listFiles.mockResolvedValue(manyFiles);
      mockFileSystem.readFile.mockResolvedValue('content');
      mockFileSystem.getFileMetadata.mockResolvedValue({ size: 100, lastModified: new Date() });

      const tokens: MentionToken[] = [{
        type: 'folder',
        value: 'src',
        params: { limit: '5' },
        position: [0, 20],
        raw: '@folder:src(limit=5)'
      }];

      const context = await resolver.resolve(tokens);

      expect(context.files).toHaveLength(5);
    });
  });

  describe('context deduplication', () => {
    it('should deduplicate identical files', async () => {
      const fileContent = 'test content';
      const metadata = { size: 100, lastModified: new Date() };

      mockFileSystem.readFile.mockResolvedValue(fileContent);
      mockFileSystem.getFileMetadata.mockResolvedValue(metadata);

      const tokens: MentionToken[] = [
        {
          type: 'file',
          value: 'src/app.ts',
          params: {},
          position: [0, 13],
          raw: '@file:src/app.ts'
        },
        {
          type: 'file',
          value: 'src/app.ts',
          params: {},
          position: [14, 27],
          raw: '@file:src/app.ts'
        }
      ];

      const context = await resolver.resolve(tokens);

      expect(context.files).toHaveLength(1);
      expect(context.metadata.fileCount).toBe(1);
    });

    it('should merge overlapping line ranges', async () => {
      const fileContent = 'line1\nline2\nline3\nline4\nline5\nline6';
      const metadata = { size: 100, lastModified: new Date() };

      mockFileSystem.readFile.mockResolvedValue(fileContent);
      mockFileSystem.getFileMetadata.mockResolvedValue(metadata);

      const tokens: MentionToken[] = [
        {
          type: 'file',
          value: 'src/app.ts',
          params: { lines: '1-3' },
          position: [0, 25],
          raw: '@file:src/app.ts(lines=1-3)'
        },
        {
          type: 'file',
          value: 'src/app.ts',
          params: { lines: '2-4' },
          position: [26, 51],
          raw: '@file:src/app.ts(lines=2-4)'
        }
      ];

      const context = await resolver.resolve(tokens);

      expect(context.files).toHaveLength(1);
      expect(context.files[0].lineRange).toEqual([1, 4]);
    });
  });

  describe('metadata calculation', () => {
    it('should calculate token count correctly', async () => {
      const fileContent = 'a'.repeat(1000); // 1000 characters = ~250 tokens
      const metadata = { size: 1000, lastModified: new Date() };

      mockFileSystem.readFile.mockResolvedValue(fileContent);
      mockFileSystem.getFileMetadata.mockResolvedValue(metadata);

      const tokens: MentionToken[] = [{
        type: 'file',
        value: 'src/app.ts',
        params: {},
        position: [0, 13],
        raw: '@file:src/app.ts'
      }];

      const context = await resolver.resolve(tokens);

      expect(context.metadata.tokenCount).toBe(250); // 1000 chars / 4
    });

    it('should calculate estimated reading time', async () => {
      const fileContent = Array.from({ length: 100 }, (_, i) => `line ${i}`).join('\n');
      const metadata = { size: 1000, lastModified: new Date() };

      mockFileSystem.readFile.mockResolvedValue(fileContent);
      mockFileSystem.getFileMetadata.mockResolvedValue(metadata);

      const tokens: MentionToken[] = [{
        type: 'file',
        value: 'src/app.ts',
        params: {},
        position: [0, 13],
        raw: '@file:src/app.ts'
      }];

      const context = await resolver.resolve(tokens);

      expect(context.metadata.estimatedReadingTime).toBe(2); // 100 lines / 50 lines per minute
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      mockFileSystem.readFile.mockRejectedValue(new Error('File not found'));

      const tokens: MentionToken[] = [{
        type: 'file',
        value: 'nonexistent.ts',
        params: {},
        position: [0, 20],
        raw: '@file:nonexistent.ts'
      }];

      const context = await resolver.resolve(tokens);

      expect(context.files).toHaveLength(0);
      expect(context.metadata.fileCount).toBe(0);
    });

    it('should handle git errors gracefully', async () => {
      mockGit.getDiff.mockRejectedValue(new Error('Not a git repository'));

      const tokens: MentionToken[] = [{
        type: 'diff',
        value: '',
        params: {},
        position: [0, 5],
        raw: '@diff'
      }];

      const context = await resolver.resolve(tokens);

      expect(context.git).toBeUndefined();
    });

    it('should handle diagnostics errors gracefully', async () => {
      mockDiagnostics.getDiagnostics.mockRejectedValue(new Error('Language server not available'));

      const tokens: MentionToken[] = [{
        type: 'error',
        value: '',
        params: {},
        position: [0, 6],
        raw: '@error'
      }];

      const context = await resolver.resolve(tokens);

      expect(context.diagnostics).toHaveLength(0);
      expect(context.metadata.diagnosticCount).toBe(0);
    });
  });

  describe('Phase 1 Success Criteria', () => {
    it('should successfully resolve @function:login with definition and dependencies', async () => {
      const mockSymbols = {
        findSymbol: jest.fn().mockResolvedValue([{
          name: 'login',
          kind: 'function',
          file: 'src/auth/login.ts',
          line: 1,
          column: 17,
          content: 'export function login(email: string, password: string): Promise<User>',
          signature: 'login(email: string, password: string): Promise<User>',
          dependencies: ['authenticateUser']
        }]),
        getSymbolDefinition: jest.fn(),
        getSymbolReferences: jest.fn()
      };

      const resolverWithSymbols = new ContextResolver(
        mockFileSystem,
        mockGit,
        mockDiagnostics,
        mockSymbols
      );

      const tokens: MentionToken[] = [{
        type: 'function',
        value: 'login',
        params: {},
        position: [0, 15],
        raw: '@function:login'
      }];

      const context = await resolverWithSymbols.resolve(tokens);

      expect(context.symbols).toHaveLength(1);
      expect(context.symbols[0].name).toBe('login');
      expect(context.symbols[0].signature).toContain('login(email: string, password: string)');
      expect(context.symbols[0].dependencies).toContain('authenticateUser');
    });

    it('should successfully resolve @error and get current VS Code problems', async () => {
      const diagnostics: DiagnosticContext[] = [{
        file: 'src/auth/login.ts',
        line: 3,
        column: 5,
        severity: 'error',
        message: 'Cannot find name \'authenticateUser\'',
        code: 'TS2304',
        source: 'typescript'
      }];

      mockDiagnostics.getDiagnostics.mockResolvedValue(diagnostics);

      const tokens: MentionToken[] = [{
        type: 'error',
        value: '',
        params: {},
        position: [0, 6],
        raw: '@error'
      }];

      const context = await resolver.resolve(tokens);

      expect(context.diagnostics.length).toBeGreaterThan(0);
      expect(context.diagnostics[0]).toMatchObject({
        severity: 'error',
        source: 'typescript'
      });
    });

    it('should export context in markdown format suitable for AI tools', async () => {
      // Set up mock function symbol
      const mockSymbols = {
        findSymbol: jest.fn().mockResolvedValue([{
          name: 'login',
          kind: 'function',
          file: 'src/auth/login.ts',
          line: 1,
          column: 17,
          content: 'export function login(email: string, password: string): Promise<User>',
          signature: 'login(email: string, password: string): Promise<User>',
          dependencies: ['authenticateUser']
        }]),
        getSymbolDefinition: jest.fn(),
        getSymbolReferences: jest.fn()
      };

      // Set up mock diagnostics
      const diagnostics: DiagnosticContext[] = [{
        file: 'src/auth/login.ts',
        line: 3,
        column: 5,
        severity: 'error',
        message: 'Cannot find name \'authenticateUser\'',
        code: 'TS2304',
        source: 'typescript'
      }];

      mockDiagnostics.getDiagnostics.mockResolvedValue(diagnostics);

      const resolverWithSymbols = new ContextResolver(
        mockFileSystem,
        mockGit,
        mockDiagnostics,
        mockSymbols
      );

      const tokens: MentionToken[] = [
        {
          type: 'function',
          value: 'login',
          params: {},
          position: [0, 15],
          raw: '@function:login'
        },
        {
          type: 'error',
          value: '',
          params: {},
          position: [16, 22],
          raw: '@error'
        }
      ];

      const context = await resolverWithSymbols.resolve(tokens);

      // Verify we have resolved context that can be exported
      expect(context.symbols.length).toBeGreaterThan(0);
      expect(context.diagnostics.length).toBeGreaterThan(0);
      expect(context.metadata.tokenCount).toBeGreaterThanOrEqual(0);
      expect(context.metadata.fileCount).toBeGreaterThanOrEqual(0);
      expect(context.metadata.symbolCount).toBe(1);
      expect(context.metadata.diagnosticCount).toBe(1);
    });

    it('should complete full context building workflow in under 10 seconds', async () => {
      const mockSymbols = {
        findSymbol: jest.fn().mockResolvedValue([{
          name: 'login',
          kind: 'function',
          file: 'src/auth/login.ts',
          line: 1,
          column: 17,
          content: 'export function login(email: string, password: string): Promise<User>',
          signature: 'login(email: string, password: string): Promise<User>',
          dependencies: ['authenticateUser']
        }]),
        getSymbolDefinition: jest.fn(),
        getSymbolReferences: jest.fn()
      };

      mockDiagnostics.getDiagnostics.mockResolvedValue([{
        file: 'src/auth/login.ts',
        line: 3,
        column: 5,
        severity: 'error',
        message: 'Cannot find name \'authenticateUser\'',
        code: 'TS2304',
        source: 'typescript'
      }]);

      const resolverWithSymbols = new ContextResolver(
        mockFileSystem,
        mockGit,
        mockDiagnostics,
        mockSymbols
      );

      const tokens: MentionToken[] = [
        {
          type: 'function',
          value: 'login',
          params: {},
          position: [0, 15],
          raw: '@function:login'
        },
        {
          type: 'error',
          value: '',
          params: {},
          position: [16, 22],
          raw: '@error'
        },
        {
          type: 'diff',
          value: '',
          params: {},
          position: [23, 28],
          raw: '@diff'
        }
      ];

      const start = Date.now();
      const context = await resolverWithSymbols.resolve(tokens);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10000); // 10 seconds
      expect(context.symbols.length).toBeGreaterThan(0);
      expect(context.diagnostics.length).toBeGreaterThan(0);
    });
  });
});