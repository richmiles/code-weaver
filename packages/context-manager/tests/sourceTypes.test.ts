// sourceTypes.test.ts
import {
    FileSource,
    DirectorySource,
    SourceType
  } from '@codeweaver/core';
  
  import { ContextManager } from '../src/contextManager';
  
  describe('ContextManager Source Type Operations', () => {
    let contextManager: ContextManager;
  
    beforeEach(() => {
      contextManager = new ContextManager();
    });
  
    it('should get sources by type', () => {
      // Add file sources
      const fileId1 = contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 1',
        filePath: '/path/to/file1.ts'
      });
      expect(fileId1).toBeDefined();
  
      const fileId2 = contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 2',
        filePath: '/path/to/file2.ts'
      });
      expect(fileId2).toBeDefined();
  
      // Add directory source
      const dirId = contextManager.addSource({
        type: SourceType.DIRECTORY,
        label: 'Dir 1',
        dirPath: '/path/to/dir',
        recursive: true,
        respectGitignore: true
      });
      expect(dirId).toBeDefined();
  
      // Get file sources using the updated getSourcesByType
      const fileSources = contextManager.getSourcesByType<FileSource>(SourceType.FILE);
  
      // Verify file sources are returned correctly typed
      expect(fileSources).toBeInstanceOf(Array);
      expect(fileSources.length).toBe(2);
      expect(fileSources[0].type).toBe(SourceType.FILE);
      expect(fileSources[1].type).toBe(SourceType.FILE);
      
      // Create a set of filePaths to check
      const filePaths = new Set(fileSources.map(source => source.filePath));
      expect(filePaths.has('/path/to/file1.ts')).toBe(true);
      expect(filePaths.has('/path/to/file2.ts')).toBe(true);
  
      // Get directory sources using the updated getSourcesByType
      const dirSources = contextManager.getSourcesByType<DirectorySource>(SourceType.DIRECTORY);
  
      // Verify directory sources are returned correctly typed
      expect(dirSources).toBeInstanceOf(Array);
      expect(dirSources.length).toBe(1);
      expect(dirSources[0].type).toBe(SourceType.DIRECTORY);
      expect(dirSources[0].dirPath).toBe('/path/to/dir');
      expect(dirSources[0].recursive).toBe(true);
    });
  
    it('should handle different source types appropriately', () => {
      // Test with directory source
      const dirId = contextManager.addSource({
        type: SourceType.DIRECTORY,
        label: 'Test Directory',
        dirPath: '/path/to/dir',
        recursive: false,
        respectGitignore: true,
        excludePatterns: ['*.log']
      });
      expect(dirId).toBeDefined();
  
      if (dirId) {
        const dirSource = contextManager.getSource(dirId) as DirectorySource;
        expect(dirSource.type).toBe(SourceType.DIRECTORY);
        expect(dirSource.dirPath).toBe('/path/to/dir');
        expect(dirSource.recursive).toBe(false);
        expect(dirSource.excludePatterns).toEqual(['*.log']);
      }
  
      // Update the directory source
      if (dirId) {
        const updateResult = contextManager.updateSource(dirId, {
          recursive: true,
          includePatterns: ['*.ts']
        });
        expect(updateResult).toBe(true);
  
        const updatedDir = contextManager.getSource(dirId) as DirectorySource;
        expect(updatedDir.recursive).toBe(true);
        expect(updatedDir.includePatterns).toEqual(['*.ts']);
        expect(updatedDir.excludePatterns).toEqual(['*.log']); // Original value preserved
      }
    });
  });