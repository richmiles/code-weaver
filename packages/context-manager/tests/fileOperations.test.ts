// packages/context-manager/tests/fileOperations.test.ts
import {
    FileSource,
    SourceType
  } from '@codeweaver/core';
  
  import { ContextManager } from '../src/contextManager';
  
  // Helper function to create a small delay
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  describe('Context Manager: File Operations', () => {
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
      expect(updatedSource.languageId).toBe('typescript'); // Should be unchanged
      expect(updatedSource.updatedAt.getTime()).toBeGreaterThan(updatedSource.createdAt.getTime());
    });
  
    it('should delete a source', () => {
      // Add a source
      const fileSourceData: Omit<FileSource, 'id' | 'createdAt' | 'updatedAt'> = {
        type: SourceType.FILE,
        label: 'Test File',
        filePath: '/path/to/file.ts',
        languageId: 'typescript'
      };
      
      const id = contextManager.addSource(fileSourceData);
      
      // Verify it exists
      expect(contextManager.getSource(id)).toBeDefined();
      
      // Delete the source
      const deleteResult = contextManager.deleteSource(id);
      
      // Verify deletion was successful
      expect(deleteResult).toBe(true);
      
      // Verify the source no longer exists
      expect(contextManager.getSource(id)).toBeUndefined();
    });
    
    it('should return false when trying to update a non-existent source', () => {
      const updateResult = contextManager.updateSource('non-existent-id', {
        label: 'Updated Label'
      });
      
      expect(updateResult).toBe(false);
    });
    
    it('should return false when trying to delete a non-existent source', () => {
      const deleteResult = contextManager.deleteSource('non-existent-id');
      
      expect(deleteResult).toBe(false);
    });
  });