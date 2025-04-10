// packages/context-manager/src/index.ts

// Export the main ContextManager class and its types
export { ContextManager, CreatableSource, UpdatableSourceData } from './contextManager';

// Export group operations functionality
export { resolveGroupMembers } from './groupOperations';

// Export source type operations
export { 
  filterSourcesByType, 
  validateSourceExists, 
  validateAllSourcesExist 
} from './sourceTypeOperations';