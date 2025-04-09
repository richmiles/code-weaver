// contextManager.ts
import {
  ContextSource,
  FileSource,
  DirectorySource,
  SnippetSource,
  GroupSource,
  SourceType
} from '@codeweaver/core';
import { v4 as uuidv4 } from 'uuid';

// Define the type for creatable sources (specific types without generated fields)
// This union represents the data needed to create any type of source.
type CreatableSource =
  | Omit<FileSource, 'id' | 'createdAt' | 'updatedAt'>
  | Omit<DirectorySource, 'id' | 'createdAt' | 'updatedAt'>
  | Omit<SnippetSource, 'id' | 'createdAt' | 'updatedAt'>
  | Omit<GroupSource, 'id' | 'createdAt' | 'updatedAt'>;

// Define the type for updatable source data
// This union represents the possible partial updates for any source type.
// It prevents updating 'id', 'type', and 'createdAt'.
type UpdatableSourceData =
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
   * @param sourceData The source data to store (specific type without id, createdAt, updatedAt)
   * @returns The ID of the created source, or undefined if validation fails
   */
  addSource(sourceData: CreatableSource): string | undefined {
    // Perform validation based on source type
    if (sourceData.type === SourceType.SNIPPET) {
      // Validate that the snippet has a valid parent file
      if (!this.validateSnippetSource(sourceData as Omit<SnippetSource, 'id' | 'createdAt' | 'updatedAt'>)) {
        return undefined;
      }
    } else if (sourceData.type === SourceType.GROUP) {
      // Additional validation for group sources could be added here
      // For example, validating that all member sources exist
    }

    // If validation passes, proceed with adding the source
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
   * Only allows updating fields relevant to the source's type.
   * Does not allow changing 'id', 'type', or 'createdAt'.
   *
   * @param id The ID of the source to update
   * @param data The new data to store (partial update matching one of the specific source types)
   * @returns True if the update was successful, false if the source doesn't exist or validation fails
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

    // The spread operator correctly merges the partial data.
    // TypeScript ensures 'data' only contains valid fields for *some*
    // source type (excluding id, type, createdAt, updatedAt).
    // We rely on the caller to provide data relevant to the *actual* type
    // of the source being updated.
    const updatedSource: ContextSource = {
      ...source,
      ...data,
      // Explicitly ensure id and type are not changed by the partial data
      id: source.id,
      type: source.type,
      createdAt: source.createdAt, // Keep original creation time
      updatedAt: new Date()        // Update modification time
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
      this.activeSourceIds.delete(id); // Also remove from active context if present
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
   * Returns an array typed to the specific source subtype.
   *
   * @param type The SourceType enum value to filter by.
   * @returns Array of sources matching the specified type.
   */
  getSourcesByType<T extends ContextSource>(type: T['type']): T[] {
    // Filter sources by type and use a type assertion for the correct return type.
    return this.getAllSources().filter(source => source.type === type) as T[];
  }

  /**
   * Resolves all member sources for a group, including nested groups.
   * 
   * @param groupId The ID of the group to resolve members for
   * @param processedGroups Optional set of group IDs already processed (used to detect circular references)
   * @returns Array of all member sources, or undefined if the group doesn't exist or isn't a group
   */
  resolveGroupMembers(groupId: string, processedGroups: Set<string> = new Set()): ContextSource[] | undefined {
    // Get the group source
    const groupSource = this.getSource(groupId);
    
    // Check if it exists and is a group
    if (!groupSource || groupSource.type !== SourceType.GROUP) {
      return undefined;
    }
    
    // Cast to GroupSource to access memberSourceIds
    const group = groupSource as GroupSource;
    
    // Initialize the result array (will only contain non-group sources)
    const resolvedMembers: ContextSource[] = [];
    
    // Add this group to the set of processed groups to detect circular references
    processedGroups.add(groupId);
    
    // Process each member
    for (const memberId of group.memberSourceIds) {
      // Get the member source
      const memberSource = this.getSource(memberId);
      
      // Skip if member doesn't exist
      if (!memberSource) {
        continue;
      }
      
      // If the member is a group and hasn't been processed already
      if (memberSource.type === SourceType.GROUP) {
        if (!processedGroups.has(memberId)) {
          // Create a new set to track processed groups to avoid modifying the shared set
          const nestedProcessedGroups = new Set(processedGroups);
          
          // Recursively resolve members of the nested group
          const nestedMembers = this.resolveGroupMembers(memberId, nestedProcessedGroups);
          
          // Add the nested members to the result if they exist
          if (nestedMembers) {
            for (const member of nestedMembers) {
              resolvedMembers.push(member);
            }
          }
        }
      } 
      // Only add non-group sources directly
      else {
        resolvedMembers.push(memberSource);
      }
    }
    
    return resolvedMembers;
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
   * @param sourceIds Array of source IDs to set as active.
   * @returns True if all provided source IDs exist, false otherwise.
   */
  setActiveContext(sourceIds: string[]): boolean {
    // Verify all sources exist before updating the active set.
    const allExist = sourceIds.every(id => this.sources.has(id));

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
   * @param sourceId The ID of the source to add to the active context.
   * @returns True if the source exists and was added, false otherwise.
   */
  addToActiveContext(sourceId: string): boolean {
    if (!this.sources.has(sourceId)) {
      console.warn(`addToActiveContext: Source ID "${sourceId}" not found.`);
      return false;
    }

    this.activeSourceIds.add(sourceId);
    return true;
  }

  /**
   * Removes a source from the active context.
   *
   * @param sourceId The ID of the source to remove from the active context.
   * @returns True if the source was in the active context and was removed, false otherwise.
   */
  removeFromActiveContext(sourceId: string): boolean {
    return this.activeSourceIds.delete(sourceId);
  }

  /**
   * Gets all sources currently in the active context.
   *
   * @returns Array of active source entries.
   */
  getActiveContextSources(): ContextSource[] {
    // Map active IDs to actual source objects, filtering out any potential undefined if IDs become stale (shouldn't happen with current logic).
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
}