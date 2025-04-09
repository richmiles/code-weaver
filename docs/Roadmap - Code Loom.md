# Context Manager Implementation Roadmap

## Core Architecture

The Context Manager will be the central component in the Code Loom architecture, responsible for maintaining representations of various context sources and their relationships. It will operate on a client-server model, where clients (VS Code, browser extension, etc.) will communicate with a WebSocket server that interacts with the Context Manager.

## Phase 1: Core Data Model (2-3 days)

### Define Base Interfaces in the Core Package

The types should be defined in the Core package with each type in its own file:

- `/packages/core/src/types/SourceType.ts`
- `/packages/core/src/types/ContextSource.ts`
- `/packages/core/src/types/FileSource.ts`
- `/packages/core/src/types/DirectorySource.ts`
- `/packages/core/src/types/SnippetSource.ts`
- `/packages/core/src/types/GroupSource.ts`
- `/packages/core/src/types/index.ts` (export all types)

Example implementation of `SourceType.ts`:
```typescript
export enum SourceType {
  FILE = 'file',
  DIRECTORY = 'directory',
  SNIPPET = 'snippet',
  GROUP = 'group'
}
```

Example implementation of `ContextSource.ts`:
```typescript
import { SourceType } from './SourceType';

export interface ContextSource {
  id: string;
  type: SourceType;
  label: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Refactor Context Manager
1. Import types from Core package
2. Implement source type handling
3. Convert methods to use the new types
4. Add source type validation

### Tests
- Add a FileSource and retrieve it
- Add a DirectorySource and retrieve it
- Add a SnippetSource and retrieve it
- Add a GroupSource and retrieve it
- Verify type safety is maintained
- Implement and test `getSourcesByType(type: SourceType)` method

## Phase 2: Relationship Management (2-3 days)

### Implement Group Relationship Logic
1. Add validation to ensure group members exist
2. Create a method to resolve group members
3. Add tests for relationship integrity

### Implement Snippet Relationship Logic
1. Add validation to ensure parent file exists
2. Create methods to find snippets by file ID
3. Add tests for snippet-file relationships

### Tests
- Test adding a GroupSource with valid member IDs
- Test adding a GroupSource with invalid member IDs
- Test resolving group members recursively
- Test adding a SnippetSource with a valid parent file
- Test adding a SnippetSource with an invalid parent file
- Test retrieving all snippets for a specific file

## Phase 3: Event System (1-2 days)

### Implement Event Emitter
1. Define event types (source added, updated, deleted, etc.)
2. Create subscription system for events
3. Add event emission to all state-changing methods

```typescript
// src/events.ts
export enum EventType {
  SOURCE_ADDED = 'source_added',
  SOURCE_UPDATED = 'source_updated',
  SOURCE_DELETED = 'source_deleted',
  ACTIVE_CONTEXT_CHANGED = 'active_context_changed'
}

export interface ContextEvent {
  type: EventType;
  sourceId?: string;
  data?: any;
}

export type EventListener = (event: ContextEvent) => void;
```

### Tests
- Subscribe to events and verify they fire correctly
- Test event data contains correct information
- Verify all operations emit appropriate events

## Phase 4: Active Context Management (1-2 days)

### Implement Active Context Selection
1. Add state to track active context sources
2. Create methods for managing active sources
3. Add events for active context changes

```typescript
// Methods to add to ContextManager
setActiveContext(sourceIds: string[]): void;
addToActiveContext(sourceId: string): void;
removeFromActiveContext(sourceId: string): void;
getActiveContextSources(): ContextSource[];
clearActiveContext(): void;
```

### Tests
- Test setting the active context
- Test adding to/removing from active context
- Test retrieving active context sources
- Test clearing the active context
- Test events for active context changes

## Phase 5: Content Caching Strategy (2-3 days)

### Design Caching Mechanism
1. Implement methods to update source content
2. Add content validation and size limits
3. Add caching policies (TTL, eviction)

```typescript
// Methods to add to ContextManager
updateSourceContent(sourceId: string, content: string): boolean;
getSourceContent(sourceId: string): string | undefined;
clearSourceContent(sourceId: string): boolean;
```

### Tests
- Test updating content for different source types
- Test content retrieval
- Test content clearing
- Test cache size limits and eviction policies

## Phase 6: Serialization & Persistence (2-3 days)

### Implement State Persistence
1. Create serialization format for context sources
2. Implement save/load functionality
3. Add methods for importing/exporting state

```typescript
// Methods to add to ContextManager
exportState(): string;
importState(state: string): boolean;
saveToFile(filePath: string): Promise<void>;
loadFromFile(filePath: string): Promise<void>;
```

### Tests
- Test state serialization and deserialization
- Test importing invalid state
- Test round-trip serialization
- Test persistence of relationships

## Phase 7: WebSocket Integration (3-4 days)

### Create Protocol Messages
1. Define message types for WebSocket communication
2. Implement handlers for different message types
3. Create connection management

```typescript
// src/protocol.ts
export enum MessageType {
  GET_SOURCES = 'get_sources',
  ADD_SOURCE = 'add_source',
  UPDATE_SOURCE = 'update_source',
  DELETE_SOURCE = 'delete_source',
  GET_ACTIVE_CONTEXT = 'get_active_context',
  SET_ACTIVE_CONTEXT = 'set_active_context',
  UPDATE_SOURCE_CONTENT = 'update_source_content'
  // etc.
}

export interface Message {
  type: MessageType;
  id: string; // Message ID for correlating requests and responses
  payload?: any;
}
```

### Tests
- Test protocol message serialization
- Test message handling and responses
- Test reconnection behavior
- Test concurrent client scenarios

## Milestones and Dependencies

1. **Core Data Model** - Foundation for everything else
2. **Relationship Management** - Depends on Core Data Model
3. **Event System** - Independent, but interacts with all other parts
4. **Active Context Management** - Depends on Core Data Model
5. **Content Caching Strategy** - Depends on Core Data Model
6. **Serialization & Persistence** - Depends on all previous phases
7. **WebSocket Integration** - Depends on serialization and core functionality

## Implementation Task List

### Phase 1: Core Data Model
1. **Define Types in Core Package** (1 day)
   - [ ] Create `/packages/core/src/types/SourceType.ts`
   - [ ] Create `/packages/core/src/types/ContextSource.ts`
   - [ ] Create `/packages/core/src/types/FileSource.ts`
   - [ ] Create `/packages/core/src/types/DirectorySource.ts`
   - [ ] Create `/packages/core/src/types/SnippetSource.ts`
   - [ ] Create `/packages/core/src/types/GroupSource.ts`
   - [ ] Create `/packages/core/src/types/index.ts` (export all types)
   - [ ] Write unit tests for type validation functions

2. **Update Context Manager** (2 days)
   - [ ] Write test for adding a FileSource
   - [ ] Modify ContextManager to support FileSource
   - [ ] Write test for adding a DirectorySource
   - [ ] Implement support for DirectorySource
   - [ ] Write test for adding a SnippetSource
   - [ ] Implement support for SnippetSource
   - [ ] Write test for adding a GroupSource
   - [ ] Implement support for GroupSource
   - [ ] Write test for getSourcesByType method
   - [ ] Implement getSourcesByType method

### Phase 2: Relationship Management
3. **Group Relationships** (1.5 days)
   - [ ] Write test for validating group member references
   - [ ] Implement group member validation
   - [ ] Write test for resolveGroupMembers method
   - [ ] Implement resolveGroupMembers method
   - [ ] Write test for handling circular references
   - [ ] Implement circular reference detection

4. **Snippet Relationships** (1.5 days)
   - [ ] Write test for validating snippet parent file
   - [ ] Implement snippet parent validation
   - [ ] Write test for getSnippetsForFile method
   - [ ] Implement getSnippetsForFile method
   - [ ] Write test for updating snippets when parent file changes
   - [ ] Implement snippet update propagation

### Phase 3: Event System
5. **Event System Core** (1 day)
   - [ ] Create `/packages/core/src/types/EventType.ts`
   - [ ] Create `/packages/core/src/types/ContextEvent.ts`
   - [ ] Write test for EventEmitter implementation
   - [ ] Implement EventEmitter class

6. **Event Integration** (1 day)
   - [ ] Write tests for source addition events
   - [ ] Implement event emission for source addition
   - [ ] Write tests for source update events
   - [ ] Implement event emission for source updates
   - [ ] Write tests for source deletion events
   - [ ] Implement event emission for source deletion

### Phase 4: Active Context Management
7. **Active Context Tracking** (1 day)
   - [ ] Write test for setActiveContext method
   - [ ] Implement setActiveContext method
   - [ ] Write test for addToActiveContext method
   - [ ] Implement addToActiveContext method
   - [ ] Write test for removeFromActiveContext method
   - [ ] Implement removeFromActiveContext method
   - [ ] Write test for getActiveContextSources method
   - [ ] Implement getActiveContextSources method

8. **Active Context Events** (0.5 days)
   - [ ] Write test for active context change events
   - [ ] Implement event emission for active context changes
   - [ ] Write test for active context validation
   - [ ] Implement active context validation

### Phase 5: Content Caching Strategy
9. **Basic Content Management** (1 day)
   - [ ] Write test for updateSourceContent method
   - [ ] Implement updateSourceContent method
   - [ ] Write test for getSourceContent method
   - [ ] Implement getSourceContent method
   - [ ] Write test for clearSourceContent method
   - [ ] Implement clearSourceContent method

10. **Advanced Caching** (1.5 days)
    - [ ] Write test for content size validation
    - [ ] Implement content size limits
    - [ ] Write test for TTL-based cache expiration
    - [ ] Implement cache expiration
    - [ ] Write test for cache eviction policy
    - [ ] Implement cache eviction strategy

### Phase 6: Serialization & Persistence
11. **State Serialization** (1 day)
    - [ ] Write test for exportState method
    - [ ] Implement exportState method
    - [ ] Write test for importState method
    - [ ] Implement importState method
    - [ ] Write test for validating imported state
    - [ ] Implement import validation

12. **File Persistence** (1 day)
    - [ ] Write test for saveToFile method
    - [ ] Implement saveToFile method
    - [ ] Write test for loadFromFile method
    - [ ] Implement loadFromFile method
    - [ ] Write test for handling corrupted files
    - [ ] Implement error handling for file operations

### Phase 7: WebSocket Integration
13. **Protocol Definition** (1 day)
    - [ ] Create `/packages/core/src/types/MessageType.ts`
    - [ ] Create `/packages/core/src/types/Message.ts`
    - [ ] Write tests for message serialization/deserialization
    - [ ] Implement serialization utilities

14. **Message Handlers** (2 days)
    - [ ] Write tests for handling GET_SOURCES messages
    - [ ] Implement GET_SOURCES handler
    - [ ] Write tests for handling ADD_SOURCE messages
    - [ ] Implement ADD_SOURCE handler
    - [ ] Write tests for other message types
    - [ ] Implement remaining message handlers

15. **Connection Management** (1 day)
    - [ ] Write test for client connection handling
    - [ ] Implement client connection manager
    - [ ] Write test for reconnection logic
    - [ ] Implement reconnection handling
    - [ ] Write test for broadcasting updates
    - [ ] Implement update broadcasting

## Future Considerations (Post-MVP)

- **Versioning & History**: Track versions of context states for undo/redo
- **Advanced Filtering**: Query sources by metadata or content
- **Smart Context Suggestions**: Recommend relevant sources based on context
- **Multi-User Support**: Add user ownership and permissions
- **Conflict Resolution**: Handle concurrent modifications
- **Advanced Caching**: More sophisticated caching strategies for large projects