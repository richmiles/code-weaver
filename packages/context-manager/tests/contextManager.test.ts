// contextManager.test.ts
import {
  FileSource,
  DirectorySource,
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
      const id = contextManager.addSource(fileSourceData); // Should now accept filePath

      // Verify the id is returned
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');

      // Retrieve the source
      const retrievedSource = contextManager.getSource(id) as FileSource; // Cast for specific property access

      // Verify the source is retrieved correctly
      expect(retrievedSource).toBeDefined();
      expect(retrievedSource.id).toBe(id);
      expect(retrievedSource.type).toBe(SourceType.FILE);
      expect(retrievedSource.label).toBe('Test File');
      expect(retrievedSource.filePath).toBe('/path/to/file.ts'); // Access specific property
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

      // Define the update data (matches UpdatableSourceData type)
      const updateData: Partial<Omit<FileSource, 'id' | 'type' | 'createdAt' | 'updatedAt'>> = {
        label: 'Updated File',
        filePath: '/new/path/to/file.ts' // Should now be allowed in update
      };

      // Update the source
      const updateResult = contextManager.updateSource(id, updateData);

      // Verify update was successful
      expect(updateResult).toBe(true);

      // Retrieve the updated source
      const updatedSource = contextManager.getSource(id) as FileSource; // Cast for specific property access

      // Verify the source was updated correctly
      expect(updatedSource.label).toBe('Updated File');
      expect(updatedSource.filePath).toBe('/new/path/to/file.ts'); // Check updated specific property
      expect(updatedSource.languageId).toBe('typescript'); // Should be unchanged
      expect(updatedSource.updatedAt.getTime()).toBeGreaterThan(updatedSource.createdAt.getTime());
    });
  });

  describe('Source Type Filtering', () => {
    it('should get sources by type', () => {
      // Add file sources
      contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 1',
        filePath: '/path/to/file1.ts' // Allowed by CreatableSource
      });

      contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 2',
        filePath: '/path/to/file2.ts' // Allowed by CreatableSource
      });

      // Add directory source
      contextManager.addSource({
        type: SourceType.DIRECTORY,
        label: 'Dir 1',
        dirPath: '/path/to/dir', // Allowed by CreatableSource
        recursive: true,
        respectGitignore: true
      });

      // Get file sources using the updated getSourcesByType
      const fileSources = contextManager.getSourcesByType<FileSource>(SourceType.FILE);

      // Verify file sources are returned correctly typed
      expect(fileSources).toBeInstanceOf(Array);
      expect(fileSources.length).toBe(2);
      expect(fileSources[0].type).toBe(SourceType.FILE);
      expect(fileSources[1].type).toBe(SourceType.FILE);
      // Can now safely access filePath
      expect(fileSources[0].filePath).toBe('/path/to/file1.ts');
      expect(fileSources[1].filePath).toBe('/path/to/file2.ts');


      // Get directory sources using the updated getSourcesByType
      const dirSources = contextManager.getSourcesByType<DirectorySource>(SourceType.DIRECTORY);

      // Verify directory sources are returned correctly typed
      expect(dirSources).toBeInstanceOf(Array);
      expect(dirSources.length).toBe(1);
      expect(dirSources[0].type).toBe(SourceType.DIRECTORY);
      // Can now safely access dirPath
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
      
      const fileId2 = contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 2',
        filePath: '/path/to/file2.ts'
      });
      
      const fileId3 = contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 3',
        filePath: '/path/to/file3.ts'
      });
      
      // Create a nested group
      const nestedGroupId = contextManager.addSource({
        type: SourceType.GROUP,
        label: 'Nested Group',
        name: 'Nested Group',
        memberSourceIds: [fileId2, fileId3]
      });
      
      // Create a parent group that includes the nested group
      const parentGroupId = contextManager.addSource({
        type: SourceType.GROUP,
        label: 'Parent Group',
        name: 'Parent Group',
        memberSourceIds: [fileId1, nestedGroupId]
      });
      
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
      
      const groupId2 = contextManager.addSource({
        type: SourceType.GROUP,
        label: 'Group 2',
        name: 'Group 2',
        memberSourceIds: [groupId1]
      });
      
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
      
      // Try to resolve it as if it were a group
      const result = contextManager.resolveGroupMembers(fileId);
      expect(result).toBeUndefined();
    });
  });

});

