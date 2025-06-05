# Code Weaver CLI 🧵

AI-powered code analysis tool that lets you query your codebase using @mention syntax with Claude or OpenAI GPT models.

Query your code naturally: *"Help me refactor @file:src/auth.ts"* or *"What does @function:login do?"*

## 🚀 Quick Start

### Installation

```bash
npm install -g @codeweaver/core
```

### Set up API Keys

```bash
# For Claude (recommended)
export CLAUDE_API_KEY="sk-ant-..."
# or
export ANTHROPIC_API_KEY="sk-ant-..."

# For OpenAI GPT models  
export OPENAI_API_KEY="sk-..."
```

### Start the CLI

```bash
code-weaver
# or
codeweaver
```

Example session:
```
🧵 Code Weaver> Help me add error handling to @file:src/auth.ts, specifically the @function:login method

🤖 Response:
Based on the code in src/auth.ts, I can see the login function currently throws...
```

### Demo Script

```bash
npm run demo
```

## 📝 Mention Syntax

Code Weaver supports these mention types:

### Files and Directories
- `@file:src/auth.ts` - Include specific file
- `@directory:src/components` - Include all files in directory  
- `@folder:src/utils` - Alias for @directory

### Code Symbols
- `@function:login` - Find and include function definition
- `@class:UserManager` - Find and include class definition
- `@type:User` - Find and include type definition
- `@interface:ApiResponse` - Find and include interface

### Context Aggregators
- `@error` - Include current errors and diagnostics
- `@diff` - Include git changes
- `@recent` - Recently edited files  
- `@open` - Currently open files

## 🔧 Usage Examples

### Basic File Analysis
```javascript
import { MentionEngine } from '@codeweaver/core';

const engine = new MentionEngine({
  llm: {
    provider: 'claude',
    apiKey: process.env.CLAUDE_API_KEY
  }
});

const result = await engine.query('What does @file:package.json contain?');
console.log(result.response);
```

### Complex Context Building
```javascript
const query = `
Help me debug @function:authenticate in @file:src/auth.ts. 
Consider the error patterns in @directory:src/utils and 
recent @diff changes.
`;

const result = await engine.query(query);
console.log(result.response);
console.log(`Context included ${result.context.files.length} files`);
```

### Custom File System Provider
```javascript
import { MentionEngine, NodeFileSystemProvider, NodeGitProvider } from '@codeweaver/core';

const fileSystem = new NodeFileSystemProvider('/path/to/project');
const git = new NodeGitProvider('/path/to/project');

const engine = new MentionEngine(config, fileSystem, git);
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm test -- --testPathPattern=mention-parser.test.ts
npm test -- --testPathPattern=integration.test.ts
```

## 🎯 MVP Feature Set

This implementation provides the core MVP functionality:

✅ **Mention Parsing**: Extract @mentions from plain text  
✅ **Context Resolution**: Map mentions to actual code content  
✅ **LLM Integration**: Send context to Claude/OpenAI APIs  
✅ **Smart Optimization**: Fit context within token limits  
✅ **CLI Interface**: Interactive command-line tool  
✅ **End-to-End Workflow**: Complete mention → context → AI response  

### Example End-to-End Workflow

Input:
```
Help me add error handling to @file:src/auth.ts, specifically the @function:login method. Consider the patterns used in @directory:src/utils
```

Processing:
1. **Parse**: Extracts `@file:src/auth.ts`, `@function:login`, `@directory:src/utils`
2. **Resolve**: Reads auth.ts file, finds login function, scans utils directory  
3. **Optimize**: Fits context within token limits while preserving relevance
4. **Query**: Sends structured context to LLM with user question
5. **Response**: Returns AI analysis with full context understanding

Output:
```
Based on the auth.ts file and the error handling patterns in your utils directory, 
I recommend adding these improvements to the login function:

1. Input validation using the validateEmail pattern from utils/validation.ts
2. Try-catch blocks following the error handling in utils/errorHandler.ts
3. Specific error types for different failure scenarios...
```

## 🔧 Configuration

### LLM Providers

```javascript
// Claude (recommended)
{
  llm: {
    provider: 'claude',
    apiKey: 'sk-ant-...',
    model: 'claude-3-5-sonnet-20241022', // optional
    maxTokens: 4096, // optional
    temperature: 0.7 // optional
  }
}

// OpenAI GPT
{
  llm: {
    provider: 'openai', 
    apiKey: 'sk-...',
    model: 'gpt-4o', // optional
    maxTokens: 4096, // optional  
    temperature: 0.7 // optional
  }
}
```

### Context Optimization

```javascript
{
  optimization: {
    maxContextTokens: 50000, // Token limit for context
    prioritizeRecentFiles: true, // Prefer recently modified files
    includeFileMetadata: true, // Include file size, dates etc
    truncateContent: true, // Truncate large files if needed
    preserveSymbols: true // Keep function/class definitions
  }
}
```

## 🏗️ Architecture

- **MentionParser**: Regex-based parsing of @mention syntax
- **ContextResolver**: Maps mentions to file system content
- **LLMProvider**: Abstracts Claude/OpenAI API calls  
- **ContextOptimizer**: Smart truncation to fit token limits
- **MentionEngine**: Main orchestrator tying everything together

## 🎯 Next Steps

This MVP demonstrates the core value proposition. Future enhancements:

- Symbol search (find functions/classes across codebase)
- IDE integrations (VS Code, IntelliJ)  
- Web interface for non-CLI usage
- Advanced context optimization (AST analysis)
- Custom mention types and providers
- Workspace-aware context management