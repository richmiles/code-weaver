# Codeweaver: Context Management Tool for LLMs

## Overview

Codeweaver is designed to streamline the process of gathering, managing, and delivering context from a user's codebase to large language models (LLMs) for assistance with tasks like coding, debugging, and documentation. The core goal is to allow users to rapidly build tailored contexts that can be efficiently packaged and sent to LLMs.  

While initially optimized for **single-user** workflows, Codeweaver’s architecture is flexible enough to accommodate **multi-user collaboration** in the future if desired.

---

## Architecture Overview

### High-Level Components

- **Client Applications**  
  - VS Code Extension  
  - Browser Extension  
  - Electron Application (planned)  
  - Standalone Webview (development/testing)

- **Core Services**  
  - WebSocket Server (state management, file operations)  
  - MCP Server (integration with Claude Desktop)

- **External Services**  
  - Claude Desktop  
  - VS Code API  
  - Web Browser

---

## Core Functionality

### 1. Context Collection

- Aggregate context from various sources:
  - Open files within VS Code workspace  
  - Project directory structure  
  - User-defined context groups (specific files, glob patterns)  
- Extract and save reusable code snippets (potentially with **language- or heading-based structure**, see below)  
- **Substructure-Aware Collection** (Planned Enhancement):  
  - Parse code files into functions, classes, or methods for more granular snippet extraction  
  - Parse Markdown files into heading-based sections  
  - Provide fallback or regex-based “best-effort” extraction for file types that lack formal parsing

- Collect and include metadata (file sizes, modification dates, language types)

### 2. Context Management

- User interface to:
  - Organize contexts into logical groups  
  - Save and reload context configurations  
  - Preview selected contexts  
  - Include/exclude specific file segments or substructures (e.g., a single function in a large file)  
  - Extract and label code snippets for reuse  
  - Create new context groups from selected items
- Centralized state management via WebSocket Server
- Real-time connection state display (connected, disconnected, syncing, etc.)
- Ability to view other connected clients for collaborative scenarios (future feature)
- **Optional Collaboration Support** (Future):
  - Multi-user access to the same context or snippet library
  - Role-based permissions (e.g., read-only vs. edit)
  - Real-time editing indicators if multiple users are modifying the same context

### 3. Context Delivery

- Export aggregated context as:
  - Plain text (for copy-paste into LLM interfaces)  
  - Zip archives (for larger contexts)  
  - Directly via MCP server integration to Claude Desktop  
  - Browser extension for web-based LLMs
- **Token/Character Budgeting**: Provide a running estimate of context size to avoid exceeding common LLM limits.

### 4. Future: Bidirectional Interaction

- Enable LLM-driven file modifications via MCP
- Support advanced debugging workflows where the LLM can propose and apply fixes

---

## Component Interaction

### WebSocket Server (Core State Management)

- Acts as a centralized state store and manager of context data
- Broadcasts updates to all connected clients
- Handles file system read operations (initially read-only)
- Tracks and shares real-time client connections
- Communicates with MCP server to send contexts
- **Potential Multi-User Awareness** (Future):
  - Could store snippet ownership or context ownership by user
  - Provide a list of active users or sessions for collaboration

### Client Applications

- **VS Code Extension**  
  - Provides direct file access via VS Code APIs  
  - Hosts webview for context management UI

- **Browser Extension**  
  - Captures and injects browser context  
  - Communicates context interactions to WebSocket Server

- **Electron Application (planned)**  
  - Uses WebSocket Server for file system interactions  
  - Hosts unified webview interface

- **Standalone Webview**  
  - Development and testing environment for UI

### MCP Server

- Interfaces directly with Claude Desktop
- Sends aggregated context data to LLM
- Receives and forwards LLM responses

---

## Implementation Strategy

### Unified File System Access

- All file interactions are routed through the WebSocket Server
- VS Code Extension maintains local synchronization via VS Code APIs
- Electron and browser extensions depend entirely on WebSocket Server

### Context Data Structures

- Utilize clearly defined, versioned TypeScript interfaces
- Ensure compatibility and extensibility for future features
- **Multi-User Ready**: Consider storing ownership or permissions attributes in each context/snippet data structure, even if only used by a single user initially

### Performance Considerations

- Handle large files and extensive project trees efficiently
- Use virtualized rendering for UI components
- Background processing for heavy file operations
- **Structured Parsing**: If implementing function- or heading-based parsing, handle large files by loading only partial ASTs or summarizing large sections

### User Interface Descriptions

#### Overall Layout

- **Left Pane (Context Sources)**:
  - Lists available context sources grouped by type:
    - Smart Sources (open files, git diffs, linter errors)
    - Custom Groups (user-created collections)
    - Files & folders (project structure)
  - May display substructures (e.g., functions, classes, or headings) beneath file entries
  - Interactive elements allow users to select or drag items (files, substructures, or snippets) into the main context composition pane

- **Main Pane (Context Composer)**:
  - Central workspace for constructing context using a rich-text mention system
  - Action buttons for exporting contexts (copy, download, send to MCP)
  - Support for toggling preview of each inserted item

#### Rich-Text @Mention Box

- Located centrally in the main pane, this interactive text box allows users to construct context dynamically.
- Typing '@' triggers an autocomplete dropdown featuring:
  - Smart Sources (e.g., open files, git diffs, linter errors)
  - Files & folders
  - **File Substructures** (functions, classes, Markdown headings)
  - Custom snippets
  - Saved context groups
- Selected items are inserted as interactive tokens that can be previewed or removed individually
- Tokens can be color-coded or icon-labeled by type

#### Extract Snippet Interface

- Users select text within file previews or within substructure previews
- A context menu or button labeled "Extract Snippet" prompts users to name and optionally describe the snippet
- Snippets are saved for reuse and accessible via the rich-text @mention box and context sidebar
- **Structured Extraction**:  
  - If the system recognizes a function or heading boundary, it can auto-suggest that snippet’s name or heading as the snippet title  
  - Users can override or refine that name

#### New Context Group Creation

- Users select multiple files, snippets, or sources from the sidebar or via the rich-text box
- A button labeled "Create New Group" opens a dialog to name and optionally describe the group
- Newly created groups appear immediately under the "Custom Groups" in the sidebar

#### Connection State and Client Presence Display

- Status indicator visible at the top of the UI (green for connected, yellow for syncing, red for disconnected)
- Hovering over or clicking the indicator displays a dropdown listing connected clients (e.g., VS Code Extension, Browser Extension, MCP Server)
- **Multi-User Future**: If multiple human users are connected, display their names or avatars and any relevant permissions or roles

---

## Additional Considerations

### Multi-User Architecture (Optional / Future)

- **User-Based Context Ownership**: Each snippet or context group can be linked to a user or team
- **Permissions**: Read-only vs. edit roles for sensitive code contexts
- **Collaboration**: Real-time edits (like Google Docs) or “shared context library” that multiple developers can access

### Structured Substructure Parsing

- **Language Parsers**: For TypeScript, Python, etc., parse files into their AST to identify functions, classes, methods
- **Markdown Parsing**: Create sections based on headings to enable partial documentation snippets
- **Fallback Methods**: If a file type is unrecognized, allow line-range selections for snippet creation
- **UI Outline**: Present a tree or outline view for each file, letting users see and pick substructures directly without manually scrolling

### Large Context Management

- Offer a “summarize large file” feature to keep context sizes manageable
- Allow partial or progressive loading of very large files
- Provide a live token usage estimate to avoid exceeding LLM limits

### Security and Permissions Model

- Tools for redacting sensitive information (keys, tokens) from context
- Potential automated detection of secrets
- Secure communication channels (WebSocket, MCP)
- Separate modules or flags for multi-user vs. single-user modes

### User Experience

- Clear, intuitive UI flows for context selection and management
- Provide helpful defaults and suggestions (e.g., recognized function names)
- Display token-count estimates for contexts
- Show live WebSocket connection state and connected client info

---

## Conclusion

Codeweaver’s design aims to offer flexible, powerful tools for building and sharing code contexts with LLMs. By planning for **structured snippet extraction** (functions, classes, Markdown headings) and optionally **multi-user collaboration**, you ensure that Codeweaver can scale from the simplest single-developer use cases to more complex team-based workflows. The result is a more robust and user-friendly environment, making it easier to manage large codebases, share critical snippets, and leverage LLM insights effectively.