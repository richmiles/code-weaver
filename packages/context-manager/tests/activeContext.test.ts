// packages/context-manager/tests/activeContext.test.ts
import {  
    SourceType
  } from '@codeweaver/core';
  
  import { ContextManager } from '../src/contextManager';
  
  describe('Context Manager: Active Context Operations', () => {
    let contextManager: ContextManager;
    let sourceId1: string;
    let sourceId2: string;
  
    beforeEach(() => {
      contextManager = new ContextManager();
      
      // Create test sources
      sourceId1 = contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 1',
        filePath: '/path/to/file1.ts'
      });
      
      sourceId2 = contextManager.addSource({
        type: SourceType.FILE,
        label: 'File 2',
        filePath: '/path/to/file2.ts'
      });
    });
  
    it('should set active context with valid source IDs', () => {
      // Set active context
      const result = contextManager.setActiveContext([sourceId1, sourceId2]);
      
      // Verify operation was successful
      expect(result).toBe(true);
      
      // Verify active context sources
      const activeSources = contextManager.getActiveContextSources();
      expect(activeSources.length).toBe(2);
      expect(activeSources.map(source => source.id).sort()).toEqual([sourceId1, sourceId2].sort());
    });
    
    it('should return false when setting active context with invalid source IDs', () => {
      // Set active context with an invalid ID
      const result = contextManager.setActiveContext([sourceId1, 'invalid-id']);
      
      // Verify operation failed
      expect(result).toBe(false);
      
      // Verify active context is empty
      const activeSources = contextManager.getActiveContextSources();
      expect(activeSources.length).toBe(0);
    });
    
    it('should add a source to active context', () => {
      // Add first source to active context
      let result = contextManager.addToActiveContext(sourceId1);
      expect(result).toBe(true);
      
      // Verify active context contains only the first source
      let activeSources = contextManager.getActiveContextSources();
      expect(activeSources.length).toBe(1);
      expect(activeSources[0].id).toBe(sourceId1);
      
      // Add second source to active context
      result = contextManager.addToActiveContext(sourceId2);
      expect(result).toBe(true);
      
      // Verify active context contains both sources
      activeSources = contextManager.getActiveContextSources();
      expect(activeSources.length).toBe(2);
      expect(activeSources.map(source => source.id).sort()).toEqual([sourceId1, sourceId2].sort());
    });
    
    it('should return false when adding an invalid source to active context', () => {
      const result = contextManager.addToActiveContext('invalid-id');
      expect(result).toBe(false);
    });
    
    it('should remove a source from active context', () => {
      // Set active context to both sources
      contextManager.setActiveContext([sourceId1, sourceId2]);
      
      // Remove the first source
      const result = contextManager.removeFromActiveContext(sourceId1);
      expect(result).toBe(true);
      
      // Verify active context contains only the second source
      const activeSources = contextManager.getActiveContextSources();
      expect(activeSources.length).toBe(1);
      expect(activeSources[0].id).toBe(sourceId2);
    });
    
    it('should return false when removing a source that is not in active context', () => {
      // Set active context to only the first source
      contextManager.setActiveContext([sourceId1]);
      
      // Try to remove the second source (not in active context)
      const result = contextManager.removeFromActiveContext(sourceId2);
      expect(result).toBe(false);
    });
    
    it('should clear active context', () => {
      // Set active context
      contextManager.setActiveContext([sourceId1, sourceId2]);
      
      // Verify active context contains both sources
      expect(contextManager.getActiveContextSources().length).toBe(2);
      
      // Clear active context
      contextManager.clearActiveContext();
      
      // Verify active context is empty
      expect(contextManager.getActiveContextSources().length).toBe(0);
    });
    
    it('should remove a source from active context when the source is deleted', () => {
      // Set active context
      contextManager.setActiveContext([sourceId1, sourceId2]);
      
      // Verify active context contains both sources
      expect(contextManager.getActiveContextSources().length).toBe(2);
      
      // Delete the first source
      contextManager.deleteSource(sourceId1);
      
      // Verify active context contains only the second source
      const activeSources = contextManager.getActiveContextSources();
      expect(activeSources.length).toBe(1);
      expect(activeSources[0].id).toBe(sourceId2);
    });
  });