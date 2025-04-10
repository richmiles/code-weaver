// validators.ts
import {
    SnippetSource,
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