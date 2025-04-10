// snippets.test.ts
import {
    FileSource,
    SnippetSource,
    SourceType
  } from '@codeweaver/core';
  
  import { ContextManager } from '../src/contextManager';
  
  describe('ContextManager Snippet Operations', () => {
    let contextManager: ContextManager;
  
    beforeEach(() => {
      contextManager = new ContextManager();
    });
  
    it('should validate a snippet has a valid parent file', () => {
      // Create a file source
      const fileId = contextManager.addSource({
        type: SourceType.FILE,
        label: 'Parent File',
        filePath: '/path/to/file.ts',
        languageId: 'typescript'
      });
      expect(fileId).toBeDefined();
      
      if (!fileId) {
        fail('File ID should be defined');
        return;
      }
      
      // Create a valid snippet source
      const snippetId = contextManager.addSource({
        type: SourceType.SNIPPET,
        label: 'Valid Snippet',
        sourceFileId: fileId,
        startLine: 10,
        endLine: 20
      });
      
      // Verify the snippet was added successfully
      expect(snippetId).toBeDefined();
      expect(typeof snippetId).toBe('string');
      
      // Try to create a snippet with an invalid parent file ID
      const invalidSnippetId = contextManager.addSource({
        type: SourceType.SNIPPET,
        label: 'Invalid Snippet',
        sourceFileId: 'nonexistent-id',
        startLine: 10,
        endLine: 20
      });
      
      // Verify the invalid snippet was not added
      expect(invalidSnippetId).toBeUndefined();
      
      // Try to create a snippet with invalid line numbers
      const invalidLineSnippetId = contextManager.addSource({
        type: SourceType.SNIPPET,
        label: 'Invalid Line Snippet',
        sourceFileId: fileId,
        startLine: 20,
        endLine: 10 // End line before start line
      });
      
      // Verify the invalid line snippet was not added
      expect(invalidLineSnippetId).toBeUndefined();
    });
    
    it('should get all snippets for a file', () => {
      // Create a file source
      const fileId = contextManager.addSource({
        type: SourceType.FILE,
        label: 'Parent File',
        filePath: '/path/to/file.ts',
        languageId: 'typescript'
      });
      expect(fileId).toBeDefined();
      
      if (!fileId) {
        fail('File ID should be defined');
        return;
      }
      
      // Create another file source
      const otherFileId = contextManager.addSource({
        type: SourceType.FILE,
        label: 'Other File',
        filePath: '/path/to/other.ts',
        languageId: 'typescript'
      });
      expect(otherFileId).toBeDefined();
      
      if (!otherFileId) {
        fail('Other file ID should be defined');
        return;
      }
      
      // Create snippets for the first file
      const snippetId1 = contextManager.addSource({
        type: SourceType.SNIPPET,
        label: 'Snippet 1',
        sourceFileId: fileId,
        startLine: 10,
        endLine: 20
      });
      expect(snippetId1).toBeDefined();
      
      const snippetId2 = contextManager.addSource({
        type: SourceType.SNIPPET,
        label: 'Snippet 2',
        sourceFileId: fileId,
        startLine: 30,
        endLine: 40
      });
      expect(snippetId2).toBeDefined();
      
      // Create a snippet for the other file
      const otherSnippetId = contextManager.addSource({
        type: SourceType.SNIPPET,
        label: 'Other Snippet',
        sourceFileId: otherFileId,
        startLine: 5,
        endLine: 15
      });
      expect(otherSnippetId).toBeDefined();
      
      // Get snippets for the first file
      const fileSnippets = contextManager.getSnippetsForFile(fileId);
      
      // Verify that only snippets for the first file are returned
      expect(fileSnippets).toBeDefined();
      expect(fileSnippets?.length).toBe(2);
      
      if (snippetId1 && snippetId2 && otherSnippetId) {
        const snippetIds = fileSnippets?.map(s => s.id);
        expect(snippetIds).toContain(snippetId1);
        expect(snippetIds).toContain(snippetId2);
        expect(snippetIds).not.toContain(otherSnippetId);
      }
      
      // Verify that getting snippets for a non-existent file returns undefined
      const nonExistentSnippets = contextManager.getSnippetsForFile('nonexistent-id');
      expect(nonExistentSnippets).toBeUndefined();
      
      if (snippetId1) {
        // Verify that getting snippets for a non-file source returns undefined
        const nonFileSnippets = contextManager.getSnippetsForFile(snippetId1);
        expect(nonFileSnippets).toBeUndefined();
      }
    });
    
    it('should update a snippet with validation', () => {
      // Create file sources
      const fileId1 = contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 1',
        filePath: '/path/to/file1.ts',
        languageId: 'typescript'
      });
      expect(fileId1).toBeDefined();
      
      const fileId2 = contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 2',
        filePath: '/path/to/file2.ts',
        languageId: 'typescript'
      });
      expect(fileId2).toBeDefined();
      
      if (!fileId1 || !fileId2) {
        fail('File IDs should be defined');
        return;
      }
      
      // Create a snippet
      const snippetId = contextManager.addSource({
        type: SourceType.SNIPPET,
        label: 'Test Snippet',
        sourceFileId: fileId1,
        startLine: 10,
        endLine: 20
      });
      expect(snippetId).toBeDefined();
      
      if (!snippetId) {
        fail('Snippet ID should be defined');
        return;
      }
      
      // Update the snippet with a valid parent file
      const validUpdate = contextManager.updateSource(snippetId, {
        sourceFileId: fileId2,
        startLine: 15,
        endLine: 25
      });
      
      // Verify the update was successful
      expect(validUpdate).toBe(true);
      
      // Get the updated snippet
      const updatedSnippet = contextManager.getSource(snippetId) as SnippetSource;
      expect(updatedSnippet.sourceFileId).toBe(fileId2);
      expect(updatedSnippet.startLine).toBe(15);
      expect(updatedSnippet.endLine).toBe(25);
      
      // Try to update with an invalid parent file
      const invalidUpdate = contextManager.updateSource(snippetId, {
        sourceFileId: 'nonexistent-id'
      });
      
      // Verify the invalid update was rejected
      expect(invalidUpdate).toBe(false);
      
      // Try to update with invalid line numbers
      const invalidLineUpdate = contextManager.updateSource(snippetId, {
        startLine: 30,
        endLine: 20 // End line before start line
      });
      
      // Verify the invalid line update was rejected
      expect(invalidLineUpdate).toBe(false);
    });
  });