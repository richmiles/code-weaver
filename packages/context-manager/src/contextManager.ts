// packages/context-manager/src/contextManager.ts
import {
  ContextSource,
  FileSource,
  DirectorySource,
  SnippetSource,
  GroupSource
} from '@codeweaver/core';
import { v4 as uuidv4 } from 'uuid';

// Import functionality from modular files
import { resolveGroupMembers } from './groupOperations';
import { 
  filterSourcesByType, 
  validateSourceExists, 
  validateAllSourcesExist 
} from './sourceTypeOperations';

// Define the type for creatable sources (specific types without generated fields)
export type CreatableSource =
  | Omit<FileSource, 'id' | 'createdAt' | 'updatedAt'>
  | Omit<DirectorySource, 'id' | 'createdAt' | 'updatedAt'>
  | Omit<SnippetSource, 'id' | 'createdAt' | 'updatedAt'>
  | Omit<GroupSource, 'id' | 'createdAt' | 'updatedAt'>;

// Define the type for updatable source data
export type UpdatableSourceData =
  | Partial<Omit<FileSource, 'id' | 'type' | 'createdAt' | 'updatedAt'>>
  | Partial<Omit<DirectorySource, 'id' | 'type' | 'createdAt' | 'updatedAt'>>
  | Partial<Omit<SnippetSource, 'id' | 'type' | 'createdAt' | 'updatedAt'>>
  | Partial<Omit<GroupSource, 'id' | 'type' | 'createdAt' | 'updatedAt'>>;

/**
 * ContextManager provides functionality to store, retrieve, and manage context sources.
 */
export class ContextManager {
  private sources: Map<string, ContextSource>;
  private activeSourceIds: Set<string>;

  constructor() {
    this.sources = new Map<string, ContextSource>();
    this.activeSourceIds = new Set<string>();
  }

  /**
   * Validates that a snippet has a valid parent file.
   * 
   * @param snippetData Data for a snippet source being added or updated
   * @returns True if the snippet has a valid parent file, false otherwise
   */
  validateSnippetSource(snippetData: Omit<SnippetSource, 'id' | 'createdAt' | 'updatedAt'>): boolean {
    // Check if the parent file exists
    const parentFile = this.getSource(snippetData.sourceFileId);
    
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
   * Gets all snippets associated with a specific file.
   * 
   * @param fileId The ID of the file to get snippets for
   * @returns Array of snippet sources for the file, or undefined if the file doesn't exist or isn't a file
   */
  getSnippetsForFile(fileId: string): SnippetSource[] | undefined {
    // Get the file source
    const fileSource = this.getSource(fileId);
    
    // Check if it exists and is a file
    if (!fileSource || fileSource.type !== SourceType.FILE) {
      return undefined;
    }
    
    // Get all snippets from the sources map and filter by the parent file ID
    const snippets = this.getSourcesByType<SnippetSource>(SourceType.SNIPPET);
    return snippets.filter(snippet => snippet.sourceFileId === fileId);
  }

  /**
   * Adds a new source to the context manager.
   *
   * @param sourceData The source data to store
   * @returns The ID of the created source
   */
  addSource(sourceData: CreatableSource): string {
    const id = uuidv4();
    const now = new Date();

    const entry: ContextSource = {
      ...sourceData,
      id,
      createdAt: now,
      updatedAt: now
    };

    this.sources.set(id, entry);
    return id;
  }

  /**
   * Retrieves a source by its ID.
   *
   * @param id The ID of the source to retrieve
   * @returns The source entry or undefined if not found
   */
  getSource(id: string): ContextSource | undefined {
    return this.sources.get(id);
  }

  /**
   * Updates an existing source with new data.
   *
   * @param id The ID of the source to update
   * @param data The new data to store
   * @returns True if the update was successful, false if the source doesn't exist
   */
  updateSource(id: string, data: UpdatableSourceData): boolean {
    const source = this.sources.get(id);

    if (!source) {
      return false;
    }
    
    // If updating a snippet's parent file, validate the new parent
    if (source.type === SourceType.SNIPPET && ('sourceFileId' in data || 'startLine' in data || 'endLine' in data)) {
      const updatedData = {
        ...source,
        ...data
      } as Omit<SnippetSource, 'id' | 'createdAt' | 'updatedAt'>;
      
      if (!this.validateSnippetSource(updatedData)) {
        return false;
      }
    }

    const updatedSource: ContextSource = {
      ...source,
      ...data,
      id: source.id,
      type: source.type,
      createdAt: source.createdAt,
      updatedAt: new Date()
    };

    this.sources.set(id, updatedSource);
    return true;
  }

  /**
   * Deletes a source by its ID.
   *
   * @param id The ID of the source to delete
   * @returns True if the deletion was successful, false if the source doesn't exist
   */
  deleteSource(id: string): boolean {
    const result = this.sources.delete(id);
    if (result) {
      this.activeSourceIds.delete(id);
    }
    return result;
  }

  /**
   * Gets all source entries.
   *
   * @returns Array of all source entries
   */
  getAllSources(): ContextSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * Gets sources filtered by a specific type.
   *
   * @param type The SourceType enum value to filter by
   * @returns Array of sources matching the specified type
   */
  getSourcesByType<T extends ContextSource>(type: T['type']): T[] {
    // Use the utility function instead of inline filtering
    return filterSourcesByType<T>(this.getAllSources(), type);
  }

  /**
   * Clears all sources from the manager.
   */
  clearAllSources(): void {
    this.sources.clear();
    this.activeSourceIds.clear();
  }

  /**
   * Sets the active context sources, replacing the current active set.
   *
   * @param sourceIds Array of source IDs to set as active
   * @returns True if all provided source IDs exist, false otherwise
   */
  setActiveContext(sourceIds: string[]): boolean {
    // Use the utility function for validation
    const allExist = validateAllSourcesExist(sourceIds, this.sources);

    if (!allExist) {
      console.warn("setActiveContext: One or more source IDs not found.");
      return false;
    }

    this.activeSourceIds.clear();
    sourceIds.forEach(id => this.activeSourceIds.add(id));
    return true;
  }

  /**
   * Adds a source to the active context.
   *
   * @param sourceId The ID of the source to add to the active context
   * @returns True if the source exists and was added, false otherwise
   */
  addToActiveContext(sourceId: string): boolean {
    // Use the utility function for validation
    if (!validateSourceExists(sourceId, this.sources)) {
      console.warn(`addToActiveContext: Source ID "${sourceId}" not found.`);
      return false;
    }

    this.activeSourceIds.add(sourceId);
    return true;
  }

  /**
   * Removes a source from the active context.
   *
   * @param sourceId The ID of the source to remove from the active context
   * @returns True if the source was in the active context and was removed, false otherwise
   */
  removeFromActiveContext(sourceId: string): boolean {
    return this.activeSourceIds.delete(sourceId);
  }

  /**
   * Gets all sources currently in the active context.
   *
   * @returns Array of active source entries
   */
  getActiveContextSources(): ContextSource[] {
    return Array.from(this.activeSourceIds)
      .map(id => this.sources.get(id))
      .filter((source): source is ContextSource => source !== undefined);
  }

  /**
   * Clears the active context (removes all sources from the active set).
   */
  clearActiveContext(): void {
    this.activeSourceIds.clear();
  }

  /**
   * Resolves all member sources for a group, including nested groups.
   * 
   * @param groupId The ID of the group to resolve members for
   * @param processedGroups Optional set of group IDs already processed (used to detect circular references)
   * @returns Array of all member sources, or undefined if the group doesn't exist or isn't a group
   */
  resolveGroupMembers(groupId: string, processedGroups: Set<string> = new Set()): ContextSource[] | undefined {
    // Delegate to the dedicated module, passing the sources map for lookups
    return resolveGroupMembers(groupId, this.sources, processedGroups);
  }
}