// basic.test.ts
import {
    FileSource,
    SourceType
  } from '@codeweaver/core';
  
  import { ContextManager } from '../src/contextManager';
  
  // Helper function to create a small delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  describe('ContextManager Basic Operations', () => {
    let contextManager: ContextManager;
  
    beforeEach(() => {
      contextManager = new ContextManager();
    });
  
    it('should add a FileSource and retrieve it by id', () => {
      // Create file source data
      const fileSourceData: Omit<FileSource, 'id' | 'createdAt' | 'updatedAt'> = {
        type: SourceType.FILE,
        label: 'Test File',
        filePath: '/path/to/file.ts',
        languageId: 'typescript'
      };
  
      // Add the source
      const id = contextManager.addSource(fileSourceData);
  
      // Verify the id is returned
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
  
      // Retrieve the source
      if (id) {
        const retrievedSource = contextManager.getSource(id) as FileSource;
  
        // Verify the source is retrieved correctly
        expect(retrievedSource).toBeDefined();
        expect(retrievedSource.id).toBe(id);
        expect(retrievedSource.type).toBe(SourceType.FILE);
        expect(retrievedSource.label).toBe('Test File');
        expect(retrievedSource.filePath).toBe('/path/to/file.ts');
        expect(retrievedSource.languageId).toBe('typescript');
        expect(retrievedSource.createdAt).toBeInstanceOf(Date);
        expect(retrievedSource.updatedAt).toBeInstanceOf(Date);
      } else {
        fail('Source ID should be defined');
      }
    });
  
    it('should update a FileSource', async () => {
      // Create initial file source data
      const fileSourceData: Omit<FileSource, 'id' | 'createdAt' | 'updatedAt'> = {
        type: SourceType.FILE,
        label: 'Test File',
        filePath: '/path/to/file.ts',
        languageId: 'typescript'
      };
  
      // Add the source
      const id = contextManager.addSource(fileSourceData);
      expect(id).toBeDefined();
  
      if (!id) {
        fail('Source ID should be defined');
        return;
      }
      
      // Add a small delay to ensure timestamps will be different
      await delay(5);
  
      // Define the update data
      const updateData: Partial<Omit<FileSource, 'id' | 'type' | 'createdAt' | 'updatedAt'>> = {
        label: 'Updated File',
        filePath: '/new/path/to/file.ts'
      };
  
      // Update the source
      const updateResult = contextManager.updateSource(id, updateData);
  
      // Verify update was successful
      expect(updateResult).toBe(true);
  
      // Retrieve the updated source
      const updatedSource = contextManager.getSource(id) as FileSource;
  
      // Verify the source was updated correctly
      expect(updatedSource.label).toBe('Updated File');
      expect(updatedSource.filePath).toBe('/new/path/to/file.ts');
      expect(updatedSource.languageId).toBe('typescript');
      expect(updatedSource.updatedAt.getTime()).toBeGreaterThan(updatedSource.createdAt.getTime());
    });
  
    it('should delete a source', () => {
      // Add a file source
      const fileSourceData: Omit<FileSource, 'id' | 'createdAt' | 'updatedAt'> = {
        type: SourceType.FILE,
        label: 'Test File',
        filePath: '/path/to/file.ts',
        languageId: 'typescript'
      };
  
      const id = contextManager.addSource(fileSourceData);
      expect(id).toBeDefined();
  
      if (!id) {
        fail('Source ID should be defined');
        return;
      }
  
      // Delete the source
      const deleteResult = contextManager.deleteSource(id);
      expect(deleteResult).toBe(true);
  
      // Verify source is gone
      const retrievedSource = contextManager.getSource(id);
      expect(retrievedSource).toBeUndefined();
    });
  
    it('should manage active context sources', () => {
      // Add file sources
      const fileId1 = contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 1',
        filePath: '/path/to/file1.ts'
      });
  
      const fileId2 = contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 2',
        filePath: '/path/to/file2.ts'
      });
  
      expect(fileId1).toBeDefined();
      expect(fileId2).toBeDefined();
  
      if (!fileId1 || !fileId2) {
        fail('File IDs should be defined');
        return;
      }
  
      // Set active context
      const setResult = contextManager.setActiveContext([fileId1, fileId2]);
      expect(setResult).toBe(true);
  
      // Get active sources
      const activeSources = contextManager.getActiveContextSources();
      expect(activeSources.length).toBe(2);
      
      // Remove one from active context
      contextManager.removeFromActiveContext(fileId1);
      
      // Verify active sources updated
      const updatedActiveSources = contextManager.getActiveContextSources();
      expect(updatedActiveSources.length).toBe(1);
      expect(updatedActiveSources[0].id).toBe(fileId2);
      
      // Clear active context
      contextManager.clearActiveContext();
      expect(contextManager.getActiveContextSources().length).toBe(0);
    });
  
    it('should get all sources', () => {
      // Add multiple sources
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
  
      // Get all sources
      const allSources = contextManager.getAllSources();
      expect(allSources.length).toBe(2);
    });
  
    it('should clear all sources', () => {
      // Add multiple sources
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
  
      // Set some active sources
      const fileId3 = contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 3',
        filePath: '/path/to/file3.ts'
      });
  
      if (fileId3) {
        contextManager.addToActiveContext(fileId3);
      }
  
      // Clear all sources
      contextManager.clearAllSources();
  
      // Verify all sources and active context are cleared
      expect(contextManager.getAllSources().length).toBe(0);
      expect(contextManager.getActiveContextSources().length).toBe(0);
    });
  });