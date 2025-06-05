# @Mention Prompt Builder Design Document

## Executive Summary

Code Weaver's killer feature is a sophisticated @mention prompt builder that enables developers to rapidly assemble intelligent context for AI coding tools. This document outlines the design for a chat-like interface with smart autocomplete that can understand code relationships and deliver perfectly curated context in seconds.

## Vision Statement

**"Make context selection 10x faster than manual, not 10% smarter than manual."**

The @mention prompt builder transforms Code Weaver from a context management tool into an "AI Development Intelligence Platform" - the missing layer between codebases and AI assistants.

## Core Value Propositions

1. **Universal AI Tool Integration**: Export to Claude Code, Cursor, GitHub Copilot, or any chat interface
2. **Intelligent Context Assembly**: Smart dependency resolution without unreliable ML
3. **Developer-Powered Intelligence**: Leverage existing tools (Language Server, Git, TypeScript AST)
4. **Instant Magic Moments**: 3-second context building for debugging, features, reviews

## Architecture Overview

### Components
- **@Mention Parser**: Tokenizes and interprets mention syntax
- **Context Resolver**: Expands mentions into file contents and metadata
- **Smart Autocomplete Engine**: Provides intelligent suggestion based on project state
- **Export Manager**: Formats context for different AI tools and platforms
- **Dependency Analyzer**: Uses TypeScript AST and Language Server for relationships

### Data Flow
```
User Input (@mention) → Parser → Context Resolver → Dependency Analyzer → Export Manager → Output
                                     ↑
                               Language Server API
                                     ↑
                                TypeScript AST
                                     ↑
                                 Git Integration
```

## @Mention Types and Syntax

### File and Code References
```
@file:path/to/file.ts          // Single file with full content
@file:path/to/file.ts:10-20    // Specific line range
@function:functionName         // Function definition + all calls + dependencies
@class:ClassName              // Class definition + methods + usages + inheritance
@method:ClassName.methodName   // Specific method + overrides + calls
@type:TypeName                // Type definition + all usages
@interface:InterfaceName      // Interface + implementations
@variable:varName             // Variable definition + all references
```

### Smart Context Aggregators
```
@error                        // All current VS Code problems/diagnostics
@error:file.ts               // Errors specific to a file
@diff                         // Current Git diff (staged + unstaged)
@diff:staged                 // Only staged changes
@diff:file.ts                // Diff for specific file
@stack                        // Last terminal/console output (last 50 lines)
@test:testName               // Test file + source files it tests + related mocks
@test:failing                // All currently failing tests
@deps:packageName            // How external package is used in project
@imports:file.ts             // All files that import from this file
@exports:file.ts             // All exports from this file
```

### Project Structure and Groupings
```
@folder:src/components        // All files in folder (with size limits)
@folder:src/components/**     // Recursive folder inclusion
@recent                       // Recently edited files (last 2 hours)
@recent:1h                   // Recently edited files (last 1 hour)
@open                         // All currently open editor tabs
@modified                     // All modified files (git status)
@branch:feature-name         // All files changed in branch vs main
@commit:abc123               // Files changed in specific commit
```

### User-Defined Context
```
@group:auth                   // User-defined context group
@recipe:debug-auth           // Saved context recipe
@template:bug-report         // Pre-built context template
```

### Smart Combinations and Filters
```
@function:login @deps         // Function + its dependencies
@error @diff                  // Current errors + recent changes
@test:failing @function:*     // Failing tests + related functions
@class:UserService @test      // Class + all its tests
```

## Autocomplete Intelligence

### Trigger Behavior
- Type `@` → Show categorized dropdown with recent/relevant items first
- Type `@f` → Filter to files, functions, folders
- Type `@error` → Show current error descriptions as completions
- Type `@test` → Show failing tests first, then passing tests
- Type `@class:` → Show all classes in project with fuzzy search

### Smart Suggestions
- **Context-Aware**: Show different suggestions based on current file/cursor position
- **Problem-Driven**: If errors exist, prioritize @error, @stack, @diff
- **Recency-Weighted**: Recently accessed files/functions appear first
- **Relationship-Aware**: Suggest related files based on imports/usage
- **Git-Aware**: Show branch-specific, modified, or staged files when relevant

### Visual Indicators
- **File Icons**: Show language-specific icons, git status (M, A, D)
- **Problem Counts**: Show error/warning counts next to files
- **Size Indicators**: Token/line count estimates
- **Relationship Hints**: Show "3 dependencies", "Used in 5 files"

## Context Resolution Intelligence

### Auto-Expansion Rules
When `@function:login` is mentioned:
1. Include function definition
2. Include imported types/interfaces used in signature
3. Include utility functions called within the function
4. Include related types for parameters/return values
5. Optionally include calling functions (if context is small)

### Smart Grouping
- **Related Files**: Group imports, exports, and usage together
- **Test Relationships**: Group test files with source files
- **Component Families**: Group React components with their styles/tests
- **Module Boundaries**: Respect module/package boundaries for context

### Size Management
- **Token Counting**: Real-time estimation for different AI models
- **Auto-Summarization**: For large files, include structure/signatures only
- **Priority Ordering**: Most relevant content first, supporting content last
- **Size Warnings**: Alert when approaching model limits

### Duplicate Detection
- **File Deduplication**: Don't include same file multiple times
- **Function Overlap**: If @file includes a function, don't duplicate with @function
- **Smart Merging**: Combine overlapping line ranges from same file

## Export Formats and Integration

### Universal Clipboard Format
```markdown
# Context for [AI Tool]

## Problem Description
[User's description/question]

## Relevant Files

### src/auth/login.ts (lines 1-45)
```typescript
[file content]
```

### Current Errors
- TypeError at line 23: Cannot read property 'user' of undefined
- ESLint warning: unused variable 'token'

### Recent Changes (git diff)
```diff
[diff content]
```

### Stack Trace
```
[console output]
```
```

### AI Tool-Specific Exports

#### Claude Code Integration
- **Direct Handoff**: Open Claude Code with context pre-loaded via protocol handler
- **MCP Enhancement**: Structured context delivery via MCP protocol
- **File References**: Maintain file references for Claude Code's file editing

#### Cursor Integration
- **Chat Import**: Format compatible with Cursor's chat interface
- **File Attachments**: Use Cursor's file attachment system
- **Prompt Templates**: Pre-built prompts for common Cursor workflows

#### Generic API Format
```json
{
  "context": {
    "files": [{"path": "...", "content": "...", "lineRange": [1, 45]}],
    "errors": [...],
    "diff": "...",
    "metadata": {"tokenCount": 1234, "projectType": "typescript"}
  }
}
```

## User Interface Design

### Main Chat Interface
```
┌─────────────────────────────────────────────────────────────┐
│ 🎯 Smart Context Builder                          [Export ▼] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ I need help debugging the login function that's failing     │
│ @error @function:login @test:login @diff                    │
│                                                             │
│ ┌─ Context Preview (estimated 1,234 tokens) ──────────────┐ │
│ │ ✓ 3 errors from Problems panel                          │ │
│ │ ✓ login() function + 2 dependencies                     │ │
│ │ ✓ 2 failing login tests                                 │ │
│ │ ✓ Recent changes in auth module                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Copy to Clipboard] [Send to Claude Code] [Save Template]   │
└─────────────────────────────────────────────────────────────┘
```

### Autocomplete Dropdown
```
Type: @f
┌─────────────────────────────────────────┐
│ 📁 Files                                │
│   📄 src/auth/login.ts (3 errors)       │
│   📄 src/auth/signup.ts                 │
│ 🔧 Functions                            │
│   ⚡ login() - 5 usages                 │
│   ⚡ authenticate() - 2 usages          │
│ 📁 Folders                              │
│   📁 src/auth/                          │
└─────────────────────────────────────────┘
```

### Context Groups Panel
```
┌─ Smart Sources ────────────────────────┐
│ 🔴 @error (3 items)                    │
│ 📝 @diff (5 files changed)             │
│ 🧪 @test:failing (2 tests)             │
│ 📂 @recent (8 files)                   │
├─ Custom Groups ───────────────────────┤
│ 🔐 @group:auth                         │
│ 💾 @group:database                     │
│ 🎨 @group:ui-components                │
├─ Templates ───────────────────────────┤
│ 🐛 @template:bug-report                │
│ ✨ @template:feature-request           │
│ 🔍 @template:code-review               │
└────────────────────────────────────────┘
```

## Implementation Strategy

### Phase 1: Core @Mention Builder (Week 1-2)
**Goal**: Ship the basic @mention interface with file/function resolution

**Components to Build**:
- Basic @mention parser for files and functions
- Simple autocomplete with fuzzy search
- TypeScript AST integration for function/class extraction
- VS Code Language Server integration for definitions/references
- Basic export to clipboard format

**Success Criteria**:
- Type `@function:login` and get function definition + immediate dependencies
- Type `@error` and get current VS Code problems
- Export context in markdown format suitable for any chat interface

### Phase 2: Smart Context Intelligence (Week 3-4)
**Goal**: Add dependency analysis and smart grouping

**Components to Build**:
- Dependency analyzer using TypeScript compiler API
- Smart auto-expansion rules for related code
- Git integration for @diff, @branch, @modified
- Context size management and token counting
- Template system for common context patterns

**Success Criteria**:
- `@function:login` automatically includes imported types and utilities
- Context size stays within model limits with smart summarization
- Git-based context (@diff, @branch) works reliably

### Phase 3: Advanced Integration (Week 5-6)
**Goal**: Direct integration with AI tools and advanced features

**Components to Build**:
- Claude Code protocol handler integration
- Cursor-compatible export formats
- Context quality scoring and optimization
- User-defined groups and templates
- Context analytics and learning

**Success Criteria**:
- One-click export to Claude Code with context pre-loaded
- Context templates for common debugging/development scenarios
- User can create and share context recipes

## Technical Implementation Details

### @Mention Parser
```typescript
interface MentionToken {
  type: 'file' | 'function' | 'class' | 'error' | 'diff' | 'group';
  value: string;
  params?: Record<string, string>; // e.g., line ranges, filters
  position: [number, number]; // start/end in text
}

class MentionParser {
  parse(text: string): MentionToken[]
  autocomplete(text: string, position: number): Suggestion[]
}
```

### Context Resolver
```typescript
interface ResolvedContext {
  files: FileContext[];
  errors: DiagnosticContext[];
  metadata: ContextMetadata;
  tokenCount: number;
}

class ContextResolver {
  resolve(mentions: MentionToken[]): Promise<ResolvedContext>
  expandDependencies(context: ResolvedContext): Promise<ResolvedContext>
}
```

### Language Server Integration
```typescript
class LanguageServerClient {
  getDefinition(file: string, position: Position): Promise<Location[]>
  getReferences(file: string, position: Position): Promise<Location[]>
  getSymbols(file: string): Promise<SymbolInformation[]>
  getDiagnostics(file: string): Promise<Diagnostic[]>
}
```

### Export Manager
```typescript
interface ExportFormat {
  name: string;
  format(context: ResolvedContext): string | Buffer;
  mimeType: string;
}

class ExportManager {
  formats: Map<string, ExportFormat>;
  export(context: ResolvedContext, format: string): Promise<ExportResult>
}
```

## Success Metrics

### User Experience Metrics
- **Time to Context**: Average time from @mention start to usable context (target: <10 seconds)
- **Context Quality**: Success rate of AI responses using generated context (target: >80%)
- **Adoption Rate**: Daily active users building contexts (target: 75% of install base)

### Technical Metrics
- **Parse Speed**: @mention parsing and autocomplete response time (target: <200ms)
- **Context Size**: Average token count and model compatibility (target: 90% under limits)
- **Export Success**: Successful exports to different AI tools (target: >95%)

### Competitive Metrics
- **Speed vs Manual**: Context building speed compared to manual selection (target: 10x faster)
- **Quality vs Manual**: Context completeness compared to manual selection (target: equal or better)
- **Integration Coverage**: Number of AI tools supported (target: 5+ major tools)

## Risk Mitigation

### Technical Risks
- **Language Server Reliability**: Fall back to simple text parsing if LS unavailable
- **Large Codebase Performance**: Implement lazy loading and caching strategies
- **Git Integration Complexity**: Start with simple git commands, avoid complex scenarios

### Product Risks
- **Feature Creep**: Focus on core @mention functionality before advanced features
- **AI Tool Changes**: Design export formats to be adaptable to API changes
- **User Adoption**: Ensure immediate value in first session, avoid complex setup

### Market Risks
- **Fast-Moving Space**: Ship MVP quickly, iterate based on user feedback
- **Competition**: Focus on unique value prop (context intelligence) vs direct competition
- **Platform Dependencies**: Maintain platform-agnostic core with platform-specific adapters

## Future Enhancements

### Advanced Context Intelligence
- **Code Quality Analysis**: Include lint/coverage data in context decisions
- **Historical Context**: Learn from successful AI interactions to improve suggestions
- **Cross-Project Context**: Share context patterns across related projects

### Collaboration Features
- **Team Context Libraries**: Shared context templates and groups
- **Context Review**: Approval workflows for sensitive code contexts
- **Onboarding Contexts**: Pre-built context packages for new team members

### AI Integration
- **Context Quality Scoring**: ML models to rate context completeness
- **Auto-Context Generation**: AI-powered context suggestions based on user intent
- **Feedback Loops**: Learn from AI tool responses to improve context selection

---

## Conclusion

The @mention prompt builder represents Code Weaver's path to becoming an indispensable tool in the AI-powered development workflow. By focusing on speed, intelligence, and universal compatibility, we can create a product that enhances rather than competes with existing AI coding tools.

The key insight is that context curation is the bottleneck in AI-assisted development, and solving this problem well positions Code Weaver as the intelligence layer that makes all AI tools more effective.