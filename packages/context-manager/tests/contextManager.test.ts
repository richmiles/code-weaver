// contextManager.test.ts
import {
  FileSource,
  DirectorySource,
  SnippetSource,
  GroupSource,
  SourceType
} from '@codeweaver/core';

import { ContextManager } from '../src/contextManager';

// Helper function to create a small delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('ContextManager with Source Types', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
  });

  describe('File Sources', () => {
    it('should add a FileSource and retrieve it by id', () => {
      // Create file source data (matches CreatableSource type)
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

      // Retrieve the source - we need to handle the case where id might be undefined
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
      expect(id).toBeDefined(); // Ensure the ID is defined

      if (!id) {
        fail('Source ID should be defined');
        return;
      }
      
      // Add a small delay to ensure timestamps will be different
      await delay(5);

      // Define the update data (matches UpdatableSourceData type)
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
  });

  describe('Source Type Filtering', () => {
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
  });

  describe('Group Relationships', () => {
    it('should resolve group members including nested groups', () => {
      // Create some file sources
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

      const fileId3 = contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 3',
        filePath: '/path/to/file3.ts'
      });
      expect(fileId3).toBeDefined();

      if (!fileId1 || !fileId2 || !fileId3) {
        fail('All file IDs should be defined');
        return;
      }
      
      // Create a nested group
      const nestedGroupId = contextManager.addSource({
        type: SourceType.GROUP,
        label: 'Nested Group',
        name: 'Nested Group',
        memberSourceIds: [fileId2, fileId3]
      });
      expect(nestedGroupId).toBeDefined();

      if (!nestedGroupId) {
        fail('Nested group ID should be defined');
        return;
      }
      
      // Create a parent group that includes the nested group
      const parentGroupId = contextManager.addSource({
        type: SourceType.GROUP,
        label: 'Parent Group',
        name: 'Parent Group',
        memberSourceIds: [fileId1, nestedGroupId]
      });
      expect(parentGroupId).toBeDefined();

      if (!parentGroupId) {
        fail('Parent group ID should be defined');
        return;
      }
      
      // Resolve members of the parent group
      const resolvedMembers = contextManager.resolveGroupMembers(parentGroupId);
      
      // Verify all members are resolved
      expect(resolvedMembers).toBeDefined();
      expect(resolvedMembers?.length).toBe(3);
      
      // Verify the source IDs of resolved members
      const resolvedIds = resolvedMembers?.map(source => source.id);
      expect(resolvedIds).toContain(fileId1);
      expect(resolvedIds).toContain(fileId2);
      expect(resolvedIds).toContain(fileId3);
    });
    
    it('should handle circular references in groups', () => {
      // Create two groups with circular references
      const groupId1 = contextManager.addSource({
        type: SourceType.GROUP,
        label: 'Group 1',
        name: 'Group 1',
        memberSourceIds: []
      });
      expect(groupId1).toBeDefined();
      
      if (!groupId1) {
        fail('Group 1 ID should be defined');
        return;
      }

      const groupId2 = contextManager.addSource({
        type: SourceType.GROUP,
        label: 'Group 2',
        name: 'Group 2',
        memberSourceIds: [groupId1]
      });
      expect(groupId2).toBeDefined();
      
      if (!groupId2) {
        fail('Group 2 ID should be defined');
        return;
      }
      
      // Update group 1 to reference group 2, creating a circular reference
      contextManager.updateSource(groupId1, {
        memberSourceIds: [groupId2]
      });
      
      // Create a file source
      const fileId = contextManager.addSource({
        type: SourceType.FILE,
        label: 'Test File',
        filePath: '/path/to/test.ts'
      });
      expect(fileId).toBeDefined();
      
      if (!fileId) {
        fail('File ID should be defined');
        return;
      }
      
      // Add the file to group 2
      const group2 = contextManager.getSource(groupId2) as GroupSource;
      contextManager.updateSource(groupId2, {
        memberSourceIds: [...group2.memberSourceIds, fileId]
      });
      
      // Resolve members
      const resolvedMembers = contextManager.resolveGroupMembers(groupId1);
      
      // Verify the file is included but no infinite recursion occurred
      expect(resolvedMembers).toBeDefined();
      expect(resolvedMembers?.length).toBe(1);
      expect(resolvedMembers?.[0].id).toBe(fileId);
    });
    
    it('should return undefined for non-existent groups', () => {
      const result = contextManager.resolveGroupMembers('non-existent-id');
      expect(result).toBeUndefined();
    });
    
    it('should return undefined for non-group sources', () => {
      // Create a file source
      const fileId = contextManager.addSource({
        type: SourceType.FILE,
        label: 'Test File',
        filePath: '/path/to/test.ts'
      });
      expect(fileId).toBeDefined();
      
      if (!fileId) {
        fail('File ID should be defined');
        return;
      }
      
      // Try to resolve it as if it were a group
      const result = contextManager.resolveGroupMembers(fileId);
      expect(result).toBeUndefined();
    });
  });

  describe('Snippet Relationships', () => {
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
});