// tests/contextManager.test.ts
import { ContextManager } from '../src/contextManager';

describe('ContextManager', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
  });

  it('should create a new context and return an ID', () => {
    const data = { text: 'Hello World' };
    const id = contextManager.createContext(data);
    
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });

  it('should retrieve a context by ID', () => {
    const data = { text: 'Hello World' };
    const id = contextManager.createContext(data);
    
    const context = contextManager.getContext(id);
    
    expect(context).toBeDefined();
    expect(context?.id).toBe(id);
    expect(context?.data).toEqual(data);
    expect(context?.createdAt).toBeInstanceOf(Date);
    expect(context?.updatedAt).toBeInstanceOf(Date);
  });

  it('should return undefined when getting a non-existent context', () => {
    const context = contextManager.getContext('non-existent-id');
    expect(context).toBeUndefined();
  });

  it('should update an existing context', () => {
    const initialData = { text: 'Hello World' };
    const id = contextManager.createContext(initialData);
    
    const updatedData = { text: 'Updated Text' };
    const updateResult = contextManager.updateContext(id, updatedData);
    
    expect(updateResult).toBe(true);
    
    const updatedContext = contextManager.getContext(id);
    expect(updatedContext?.data).toEqual(updatedData);
  });

  it('should return false when updating a non-existent context', () => {
    const updateResult = contextManager.updateContext('non-existent-id', { text: 'Updated Text' });
    expect(updateResult).toBe(false);
  });

  it('should delete a context by ID', () => {
    const data = { text: 'Hello World' };
    const id = contextManager.createContext(data);
    
    const deleteResult = contextManager.deleteContext(id);
    expect(deleteResult).toBe(true);
    
    const deletedContext = contextManager.getContext(id);
    expect(deletedContext).toBeUndefined();
  });

  it('should return false when deleting a non-existent context', () => {
    const deleteResult = contextManager.deleteContext('non-existent-id');
    expect(deleteResult).toBe(false);
  });

  it('should get all contexts', () => {
    contextManager.createContext({ text: 'First' });
    contextManager.createContext({ text: 'Second' });
    contextManager.createContext({ text: 'Third' });
    
    const allContexts = contextManager.getAllContexts();
    
    expect(allContexts).toBeInstanceOf(Array);
    expect(allContexts.length).toBe(3);
    expect(allContexts[0].data.text).toBe('First');
    expect(allContexts[1].data.text).toBe('Second');
    expect(allContexts[2].data.text).toBe('Third');
  });

  it('should clear all contexts', () => {
    contextManager.createContext({ text: 'First' });
    contextManager.createContext({ text: 'Second' });
    
    contextManager.clearAllContexts();
    
    const allContexts = contextManager.getAllContexts();
    expect(allContexts.length).toBe(0);
  });
});