// src/contextManager.ts
import { v4 as uuidv4 } from 'uuid';

/**
 * Represents the structure of context data
 */
export interface ContextData {
  [key: string]: unknown;
}

/**
 * Context entry storing information for a specific context.
 */
export interface ContextEntry {
  id: string;
  data: ContextData;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ContextManager provides functionality to store, retrieve, and manage context data.
 */
export class ContextManager {
  private contexts: Map<string, ContextEntry>;
  
  constructor() {
    this.contexts = new Map<string, ContextEntry>();
  }
  
  /**
   * Creates a new context with the provided data.
   * 
   * @param data The data to store in the context
   * @returns The ID of the created context
   */
  createContext(data: ContextData): string {
    const id = uuidv4();
    const now = new Date();
    
    const entry: ContextEntry = {
      id,
      data,
      createdAt: now,
      updatedAt: now
    };
    
    this.contexts.set(id, entry);
    return id;
  }
  
  /**
   * Retrieves a context by its ID.
   * 
   * @param id The ID of the context to retrieve
   * @returns The context entry or undefined if not found
   */
  getContext(id: string): ContextEntry | undefined {
    return this.contexts.get(id);
  }
  
  /**
   * Updates an existing context with new data.
   * 
   * @param id The ID of the context to update
   * @param data The new data to store
   * @returns True if the update was successful, false if the context doesn't exist
   */
  updateContext(id: string, data: ContextData): boolean {
    const context = this.contexts.get(id);
    
    if (!context) {
      return false;
    }
    
    const updatedContext: ContextEntry = {
      ...context,
      data,
      updatedAt: new Date()
    };
    
    this.contexts.set(id, updatedContext);
    return true;
  }
  
  /**
   * Deletes a context by its ID.
   * 
   * @param id The ID of the context to delete
   * @returns True if the deletion was successful, false if the context doesn't exist
   */
  deleteContext(id: string): boolean {
    return this.contexts.delete(id);
  }
  
  /**
   * Gets all context entries.
   * 
   * @returns Array of all context entries
   */
  getAllContexts(): ContextEntry[] {
    return Array.from(this.contexts.values());
  }
  
  /**
   * Clears all contexts.
   */
  clearAllContexts(): void {
    this.contexts.clear();
  }
}