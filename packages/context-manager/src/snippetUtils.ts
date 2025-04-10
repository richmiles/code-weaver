// snippetUtils.ts
import {
    SnippetSource,
    SourceType,
    ContextSource
  } from '@codeweaver/core';
  
  /**
   * Gets all snippets associated with a specific file.
   * 
   * @param fileId The ID of the file to get snippets for
   * @param getSource Function to retrieve a source by ID
   * @param getAllSources Function to get all sources
   * @returns Array of snippet sources for the file, or undefined if the file doesn't exist or isn't a file
   */
  export function getSnippetsForFile(
    fileId: string,
    getSource: (id: string) => ContextSource | undefined,
    getAllSources: () => ContextSource[]
  ): SnippetSource[] | undefined {
    // Get the file source
    const fileSource = getSource(fileId);
    
    // Check if it exists and is a file
    if (!fileSource || fileSource.type !== SourceType.FILE) {
      return undefined;
    }
    
    // Get all snippets and filter by the parent file ID
    const snippets = getAllSources()
      .filter(source => source.type === SourceType.SNIPPET) as SnippetSource[];
    
    return snippets.filter(snippet => snippet.sourceFileId === fileId);
  }