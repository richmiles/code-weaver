// packages/context-manager/tests/sourceTypeOperations.test.ts
import {
    FileSource,
    DirectorySource,
    SnippetSource,
    SourceType
  } from '@codeweaver/core';
  
  import { ContextManager } from '../src/contextManager';
  
  describe('Context Manager: Source Type Operations', () => {
    let contextManager: ContextManager;
  
    beforeEach(() => {
      contextManager = new ContextManager();
    });
  
    it('should get sources by type', () => {
      // Add file sources
      contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 1',
        filePath: '/path/to/file1.ts'
      });
  
      contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 2',
        filePath: '/path/to/file2.ts'
      });
  
      // Add directory source
      contextManager.addSource({
        type: SourceType.DIRECTORY,
        label: 'Dir 1',
        dirPath: '/path/to/dir',
        recursive: true,
        respectGitignore: true
      });
  
      // Add snippet source
      contextManager.addSource({
        type: SourceType.SNIPPET,
        label: 'Snippet 1',
        sourceFileId: 'dummy-file-id',
        startLine: 10,
        endLine: 20
      });
  
      // Get file sources using getSourcesByType
      const fileSources = contextManager.getSourcesByType<FileSource>(SourceType.FILE);
  
      // Verify file sources are returned correctly typed
      expect(fileSources).toBeInstanceOf(Array);
      expect(fileSources.length).toBe(2);
      expect(fileSources[0].type).toBe(SourceType.FILE);
      expect(fileSources[1].type).toBe(SourceType.FILE);
      expect(fileSources[0].filePath).toBeDefined();
      expect(fileSources[1].filePath).toBeDefined();
  
      // Get directory sources
      const dirSources = contextManager.getSourcesByType<DirectorySource>(SourceType.DIRECTORY);
  
      // Verify directory sources are returned correctly typed
      expect(dirSources).toBeInstanceOf(Array);
      expect(dirSources.length).toBe(1);
      expect(dirSources[0].type).toBe(SourceType.DIRECTORY);
      expect(dirSources[0].dirPath).toBe('/path/to/dir');
      expect(dirSources[0].recursive).toBe(true);
  
      // Get snippet sources
      const snippetSources = contextManager.getSourcesByType<SnippetSource>(SourceType.SNIPPET);
  
      // Verify snippet sources are returned correctly typed
      expect(snippetSources).toBeInstanceOf(Array);
      expect(snippetSources.length).toBe(1);
      expect(snippetSources[0].type).toBe(SourceType.SNIPPET);
      expect(snippetSources[0].sourceFileId).toBe('dummy-file-id');
    });
  
    it('should return an empty array when no sources of the specified type exist', () => {
      // Only add a file source
      contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 1',
        filePath: '/path/to/file1.ts'
      });
  
      // Try to get directory sources
      const dirSources = contextManager.getSourcesByType<DirectorySource>(SourceType.DIRECTORY);
  
      // Verify an empty array is returned
      expect(dirSources).toBeInstanceOf(Array);
      expect(dirSources.length).toBe(0);
    });
  
    it('should get all sources regardless of type', () => {
      // Add sources of different types
      contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 1',
        filePath: '/path/to/file1.ts'
      });
  
      contextManager.addSource({
        type: SourceType.DIRECTORY,
        label: 'Dir 1',
        dirPath: '/path/to/dir',
        recursive: true,
        respectGitignore: true
      });
  
      // Get all sources
      const allSources = contextManager.getAllSources();
  
      // Verify all sources are returned
      expect(allSources).toBeInstanceOf(Array);
      expect(allSources.length).toBe(2);
      
      // Verify the types are preserved
      expect(allSources.map(source => source.type).sort()).toEqual(
        [SourceType.DIRECTORY, SourceType.FILE].sort()
      );
    });
  });