// validators.ts
import {
    SnippetSource,
    SubstructureSource,
    SourceType,
    ContextSource
  } from '@codeweaver/core';
  
  /**
   * Validates that a snippet has a valid parent file.
   * 
   * @param snippetData Data for a snippet source being added or updated
   * @param getSource Function to retrieve a source by ID
   * @returns True if the snippet has a valid parent file, false otherwise
   */
  export function validateSnippetSource(
    snippetData: Omit<SnippetSource, 'id' | 'createdAt' | 'updatedAt'>,
    getSource: (id: string) => ContextSource | undefined
  ): boolean {
    // Check if the parent file exists
    const parentFile = getSource(snippetData.sourceFileId);
    
    // Validate that the parent exists and is a file
    if (!parentFile || parentFile.type !== SourceType.FILE) {
      return false;
    }
    
    // Validate line numbers
    if (snippetData.startLine < 0 || snippetData.endLine < snippetData.startLine) {
      return false;
    }
    
    return true;
  }

  /**
   * Validates that a substructure has a valid parent file.
   * 
   * @param substructureData Data for a substructure source being added or updated
   * @param getSource Function to retrieve a source by ID
   * @returns True if the substructure has a valid parent file, false otherwise
   */
  export function validateSubstructureSource(
    substructureData: Omit<SubstructureSource, 'id' | 'createdAt' | 'updatedAt'>,
    getSource: (id: string) => ContextSource | undefined
  ): boolean {
    // Check if the parent file exists
    const parentFile = getSource(substructureData.sourceFileId);
    
    // Validate that the parent exists and is a file
    if (!parentFile || parentFile.type !== SourceType.FILE) {
      return false;
    }
    
    // Validate location coordinates
    const loc = substructureData.location;
    if (loc.startLine < 0 || loc.endLine < loc.startLine) {
      return false;
    }
    
    // Validate column numbers if provided
    if (loc.startColumn !== undefined && loc.endColumn !== undefined) {
      if (loc.startColumn < 0 || 
          (loc.startLine === loc.endLine && loc.endColumn < loc.startColumn)) {
        return false;
      }
    }
    
    // Validate metadata
    if (!substructureData.structureMetadata.name || substructureData.structureMetadata.name.trim() === '') {
      return false;
    }
    
    return true;
  }