// packages/context-manager/src/groupOperations.ts
import {
    ContextSource,
    GroupSource,
    SourceType
  } from '@codeweaver/core';
  
  /**
   * Resolves all member sources for a group, including nested groups.
   * 
   * @param groupId The ID of the group to resolve members for
   * @param sources The map of all available sources
   * @param processedGroups Optional set of group IDs already processed (used to detect circular references)
   * @returns Array of all member sources, or undefined if the group doesn't exist or isn't a group
   */
  export function resolveGroupMembers(
    groupId: string, 
    sources: Map<string, ContextSource>, 
    processedGroups: Set<string> = new Set()
  ): ContextSource[] | undefined {
    // Get the group source
    const groupSource = sources.get(groupId);
    
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
      const memberSource = sources.get(memberId);
      
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
          const nestedMembers = resolveGroupMembers(memberId, sources, nestedProcessedGroups);
          
          // Add the nested members to the result if they exist
          if (nestedMembers) {
            resolvedMembers.push(...nestedMembers);
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