// groupUtils.ts
import {
    GroupSource,
    SourceType,
    ContextSource
  } from '@codeweaver/core';
  
  /**
   * Resolves all member sources for a group, including nested groups.
   * 
   * @param groupId The ID of the group to resolve members for
   * @param getSource Function to retrieve a source by ID
   * @param processedGroups Optional set of group IDs already processed (used to detect circular references)
   * @returns Array of all member sources, or undefined if the group doesn't exist or isn't a group
   */
  export function resolveGroupMembers(
    groupId: string, 
    getSource: (id: string) => ContextSource | undefined,
    processedGroups: Set<string> = new Set()
  ): ContextSource[] | undefined {
    // Get the group source
    const groupSource = getSource(groupId);
    
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
      const memberSource = getSource(memberId);
      
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
          const nestedMembers = resolveGroupMembers(memberId, getSource, nestedProcessedGroups);
          
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