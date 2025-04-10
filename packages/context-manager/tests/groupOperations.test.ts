// packages/context-manager/tests/groupOperations.test.ts
import {
    FileSource,
    GroupSource,
    SourceType
  } from '@codeweaver/core';
  
  import { ContextManager } from '../src/contextManager';
  
  describe('Context Manager: Group Operations', () => {
    let contextManager: ContextManager;
  
    beforeEach(() => {
      contextManager = new ContextManager();
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
  
      it('should handle empty groups', () => {
        // Create an empty group
        const groupId = contextManager.addSource({
          type: SourceType.GROUP,
          label: 'Empty Group',
          name: 'Empty Group',
          memberSourceIds: []
        });
        
        // Resolve members
        const resolvedMembers = contextManager.resolveGroupMembers(groupId);
        
        // Verify an empty array is returned
        expect(resolvedMembers).toBeDefined();
        expect(resolvedMembers?.length).toBe(0);
      });
    });
  });