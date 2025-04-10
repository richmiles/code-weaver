// packages/context-manager/src/sourceTypeOperations.ts
import { ContextSource } from '@codeweaver/core';

/**
 * Filters sources by a specific type.
 * 
 * @param sources Array of all source entries
 * @param type The type to filter by
 * @returns Array of sources matching the specified type
 */
export function filterSourcesByType<T extends ContextSource>(
  sources: ContextSource[],
  type: T['type']
): T[] {
  return sources.filter(source => source.type === type) as T[];
}

/**
 * Validates if a source exists in the sources map.
 * 
 * @param sourceId The ID of the source to check
 * @param sources The map of all sources
 * @returns True if the source exists, false otherwise
 */
export function validateSourceExists(
  sourceId: string,
  sources: Map<string, ContextSource>
): boolean {
  return sources.has(sourceId);
}

/**
 * Validates if all sources exist in the sources map.
 * 
 * @param sourceIds Array of source IDs to check
 * @param sources The map of all sources
 * @returns True if all sources exist, false otherwise
 */
export function validateAllSourcesExist(
  sourceIds: string[],
  sources: Map<string, ContextSource>
): boolean {
  return sourceIds.every(id => sources.has(id));
}