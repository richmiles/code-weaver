// packages/core/src/types/index.ts
export * from './types/SourceType.js';
export * from './types/ContextSource.js';
export * from './types/FileSource.js';
export * from './types/DirectorySource.js';
export * from './types/SnippetSource.js';
export * from './types/GroupSource.js';
export * from './types/EventType.js';
export * from './types/ContextEvent.js';
export * from './types/MessageType.js';
export * from './types/Message.js';
export * from './types/MessageResponse.js';
export * from './types/ExportFormat.js';
export * from './types/GitDiffSource.js';
export * from './types/LinterErrorSource.js';
export * from './types/OpenFileSource.js';
export * from './types/SizeMetrics.js';
export * from './types/SubstructureSource.js';

// @Mention system types
export * from './types/MentionToken.js';
export * from './types/ResolvedContext.js';

// @Mention system components
export * from './parser/MentionParser.js';
export * from './autocomplete/AutocompleteEngine.js';
export * from './resolver/ContextResolver.js';
export * from './export/ExportManager.js';

// LLM integration
export * from './llm/LLMProvider.js';
export * from './llm/ClaudeProvider.js';
export * from './llm/OpenAIProvider.js';

// Context optimization
export * from './optimizer/ContextOptimizer.js';

// Main mention engine
export * from './integration/MentionEngine.js';

// File system and git providers
export * from './providers/NodeFileSystemProvider.js';
export * from './providers/NodeGitProvider.js';

// Validation system
export * from './validation/index.js';

// Performance optimization system
export * from './performance/index.js';

// Security and audit system - disabled due to corrupted files
// export * from './security/index.js';

// Workspace management (types only for browser compatibility)
export * from './types/Workspace.js';
// Note: WorkspaceManager is server-side only due to Node.js dependencies
// export * from './workspace/WorkspaceManager.js';