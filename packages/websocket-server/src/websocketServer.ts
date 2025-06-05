// packages/websocket-server/src/websocketServer.ts
import * as fs from 'fs';
import * as path from 'path';
import { ContextManager, CreatableSource, UpdatableSourceData } from '@codeweaver/context-manager';
import { 
  Message, 
  MessageType, 
  ContextEvent, 
  EventType, 
  FileSource,
  SourceType,
  ContextSource,
  Workspace,
  WorkspaceMetadata
} from '@codeweaver/core';
import { WorkspaceManager } from '@codeweaver/core/dist/workspace/WorkspaceManager.js';
import { v4 as uuidv4 } from 'uuid';
import { WebSocket, WebSocketServer as WSServer } from 'ws';

// Server configuration
export interface ServerConfig {
  port: number;
  pingInterval?: number;
  enableLogging?: boolean;
  workspaceRoot?: string;
}

// Default configuration
const DEFAULT_CONFIG: ServerConfig = {
  port: 8080,
  pingInterval: 30000,
  enableLogging: false,
  workspaceRoot: process.cwd()
};

// Extended WebSocket type with our custom properties
export interface CodeWeaverWebSocket extends WebSocket {
  clientId: string;
  isAlive: boolean;
  subscribedToEvents: boolean;
}

// Response interface for message handling
interface MessageResponse {
  id: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

// File system interfaces
interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  lastModified?: Date;
  children?: FileTreeNode[];
}

interface DirectoryItem {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  lastModified?: Date;
}

interface SearchResult {
  path: string;
  name: string;
  isDirectory: boolean;
  score: number;
}

export class WebSocketServer {
  private server: WSServer | null = null;
  private clients: Map<string, CodeWeaverWebSocket> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private config: ServerConfig;
  private contextManager: ContextManager;
  private workspaceManager: WorkspaceManager;
  private currentWorkspace: Workspace | null = null;
  private workspaceManagerReady: boolean = false;
  
  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.contextManager = new ContextManager();
    this.workspaceManager = new WorkspaceManager();
  }
  
  /**
   * Starts the WebSocket server
   */
  async start(): Promise<void> {
    if (this.server) {
      this.stop();
    }
    
    // Initialize WorkspaceManager
    console.log('Initializing WorkspaceManager...');
    try {
      await this.workspaceManager.initialize();
      console.log('WorkspaceManager initialized successfully');
      this.workspaceManagerReady = true;
    } catch (error) {
      console.error('Failed to initialize WorkspaceManager:', error);
      console.error('Error details:', error instanceof Error ? error.stack : String(error));
      // Don't throw - let server start without workspace functionality for now
      console.log('Continuing without WorkspaceManager...');
      this.workspaceManagerReady = false;
    }
    
    this.server = new WSServer({ port: this.config.port });
    
    this.server.on('connection', this.handleConnection.bind(this));
    this.server.on('error', this.handleError.bind(this));
    this.server.on('close', () => {
      this.clearPingInterval();
    });
    
    this.setupPingInterval();
    
    if (this.config.enableLogging) {
      console.error(`WebSocket server started on port ${this.config.port}`);
    }
  }
  
  /**
   * Stops the WebSocket server
   */
  stop(): void {
    if (!this.server) {
      return;
    }
    
    this.clearPingInterval();
    this.server.close();
    this.server = null;
    this.clients.clear();
    
    if (this.config.enableLogging) {
      console.error('WebSocket server stopped');
    }
  }
  
  /**
   * Broadcasts an event to all subscribed clients
   */
  private broadcastEvent(event: ContextEvent, excludeClientId?: string): void {
    const eventMessage: Message = {
      type: MessageType.EVENT,
      id: uuidv4(),
      timestamp: new Date(),
      payload: event
    };
    
    this.clients.forEach((client, clientId) => {
      if (excludeClientId && clientId === excludeClientId) {
        return;
      }
      
      if (client.readyState === WebSocket.OPEN && client.subscribedToEvents) {
        client.send(JSON.stringify(eventMessage));
      }
    });
  }
  
  /**
   * Sends a response message to a specific client
   */
  private sendResponse(client: CodeWeaverWebSocket, response: MessageResponse): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(response));
    }
  }
  
  /**
   * Gets the number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
  
  /**
   * Checks if the server is running
   */
  isRunning(): boolean {
    return this.server !== null;
  }
  
  /**
   * Handles new WebSocket connections
   */
  private handleConnection(ws: WebSocket): void {
    const client = ws as CodeWeaverWebSocket;
    client.isAlive = true;
    client.clientId = uuidv4();
    client.subscribedToEvents = false;
    
    this.clients.set(client.clientId, client);
    
    if (this.config.enableLogging) {
      console.error(`Client connected: ${client.clientId}`);
    }
    
    // Set up message handler
    client.on('message', (data) => {
      try {
        const message: Message = JSON.parse(data.toString());
        this.handleMessage(client, message);
      } catch {
        this.sendResponse(client, {
          id: 'unknown',
          success: false,
          error: 'Invalid JSON message format'
        });
      }
    });
    
    // Set up close handler
    client.on('close', () => {
      this.clients.delete(client.clientId);
      
      if (this.config.enableLogging) {
        console.error(`Client disconnected: ${client.clientId}`);
      }
    });
    
    // Set up pong handler to track connection health
    client.on('pong', () => {
      client.isAlive = true;
    });
    
    // Send welcome message
    if (this.config.enableLogging) {
      console.log(`Client connected: ${client.clientId}`);
    }
    this.sendResponse(client, {
      id: 'welcome',
      success: true,
      data: { message: 'Connected to CodeWeaver WebSocket Server', clientId: client.clientId }
    });
  }
  
  /**
   * Handles incoming messages from clients
   */
  private async handleMessage(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    if (this.config.enableLogging) {
      console.log(`Message from ${client.clientId}:`, message.type);
    }

    try {
      switch (message.type) {
        case MessageType.GET_SOURCES:
          await this.handleGetSources(client, message);
          break;
          
        case MessageType.ADD_SOURCE:
          await this.handleAddSource(client, message);
          break;
          
        case MessageType.UPDATE_SOURCE:
          await this.handleUpdateSource(client, message);
          break;
          
        case MessageType.DELETE_SOURCE:
          await this.handleDeleteSource(client, message);
          break;
          
        case MessageType.GET_ACTIVE_CONTEXT:
          await this.handleGetActiveContext(client, message);
          break;
          
        case MessageType.SET_ACTIVE_CONTEXT:
          await this.handleSetActiveContext(client, message);
          break;
          
        case MessageType.GET_SOURCE_CONTENT:
          await this.handleGetSourceContent(client, message);
          break;
          
        case MessageType.UPDATE_SOURCE_CONTENT:
          await this.handleUpdateSourceContent(client, message);
          break;
          
        case MessageType.CLEAR_SOURCE_CONTENT:
          await this.handleClearSourceContent(client, message);
          break;
          
        case MessageType.SUBSCRIBE_EVENTS:
          await this.handleSubscribeEvents(client, message);
          break;
          
        case MessageType.BROWSE_DIRECTORY:
          await this.handleBrowseDirectory(client, message);
          break;
          
        case MessageType.GET_WORKSPACE_TREE:
          await this.handleGetWorkspaceTree(client, message);
          break;
          
        case MessageType.SEARCH_FILES:
          await this.handleSearchFiles(client, message);
          break;
          
        // @Mention prompt builder handlers
        case MessageType.READ_FILE:
          await this.handleReadFile(client, message);
          break;
          
        case MessageType.LIST_FILES:
          await this.handleListFiles(client, message);
          break;
          
        case MessageType.GET_FILE_METADATA:
          await this.handleGetFileMetadata(client, message);
          break;
          
        case MessageType.GET_RECENT_FILES:
          await this.handleGetRecentFiles(client, message);
          break;
          
        case MessageType.GET_OPEN_FILES:
          await this.handleGetOpenFiles(client, message);
          break;
          
        case MessageType.GET_DIAGNOSTICS:
          await this.handleGetDiagnostics(client, message);
          break;
          
        case MessageType.GET_DIAGNOSTIC_SUMMARY:
          await this.handleGetDiagnosticSummary(client, message);
          break;
          
        case MessageType.GET_GIT_DIFF:
          await this.handleGetGitDiff(client, message);
          break;
          
        case MessageType.GET_GIT_STATUS:
          await this.handleGetGitStatus(client, message);
          break;
          
        case MessageType.GET_GIT_BRANCH:
          await this.handleGetGitBranch(client, message);
          break;
          
        case MessageType.GET_COMMIT_FILES:
          await this.handleGetCommitFiles(client, message);
          break;
          
        case MessageType.GET_BRANCH_FILES:
          await this.handleGetBranchFiles(client, message);
          break;
          
        case MessageType.GET_COMMIT_HISTORY:
          await this.handleGetCommitHistory(client, message);
          break;
          
        case MessageType.FIND_SYMBOL:
          await this.handleFindSymbol(client, message);
          break;
          
        case MessageType.GET_SYMBOL_DEFINITION:
          await this.handleGetSymbolDefinition(client, message);
          break;
          
        case MessageType.GET_SYMBOL_REFERENCES:
          await this.handleGetSymbolReferences(client, message);
          break;
          
        case MessageType.GET_FILE_SYMBOLS:
          await this.handleGetFileSymbols(client, message);
          break;
          
        case MessageType.SEARCH_SYMBOLS:
          await this.handleSearchSymbols(client, message);
          break;
          
        case MessageType.GET_TYPE_DEFINITION:
          await this.handleGetTypeDefinition(client, message);
          break;
          
        case MessageType.GET_IMPLEMENTATION:
          await this.handleGetImplementation(client, message);
          break;
          
        case MessageType.GET_TYPESCRIPT_CONFIG:
          await this.handleGetTypeScriptConfig(client, message);
          break;
          
        // Workspace management handlers
        case MessageType.CREATE_WORKSPACE:
          await this.handleCreateWorkspace(client, message);
          break;
          
        case MessageType.LOAD_WORKSPACE:
          await this.handleLoadWorkspace(client, message);
          break;
          
        case MessageType.SAVE_WORKSPACE:
          await this.handleSaveWorkspace(client, message);
          break;
          
        case MessageType.DELETE_WORKSPACE:
          await this.handleDeleteWorkspace(client, message);
          break;
          
        case MessageType.GET_RECENT_WORKSPACES:
          await this.handleGetRecentWorkspaces(client, message);
          break;
          
        case MessageType.FIND_WORKSPACE_BY_PATH:
          await this.handleFindWorkspaceByPath(client, message);
          break;
          
        case MessageType.UPDATE_WORKSPACE_SETTINGS:
          await this.handleUpdateWorkspaceSettings(client, message);
          break;
          
        case MessageType.ADD_WORKSPACE_CONTEXT_SOURCE:
          await this.handleAddWorkspaceContextSource(client, message);
          break;
          
        case MessageType.REMOVE_WORKSPACE_CONTEXT_SOURCE:
          await this.handleRemoveWorkspaceContextSource(client, message);
          break;
          
        case MessageType.ADD_RECENT_MENTION:
          await this.handleAddRecentMention(client, message);
          break;
          
        default:
          this.sendResponse(client, {
            id: message.id,
            success: false,
            error: `Unknown message type: ${message.type}`
          });
      }
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }
  
  /**
   * Handle GET_SOURCES message
   */
  private async handleGetSources(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const sources = this.contextManager.getAllSources();
    
    this.sendResponse(client, {
      id: message.id,
      success: true,
      data: sources
    });
  }
  
  /**
   * Handle ADD_SOURCE message
   */
  private async handleAddSource(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const sourceData = message.payload as CreatableSource;
    
    if (!sourceData) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Source data is required'
      });
      return;
    }
    
    const sourceId = this.contextManager.addSource(sourceData);
    
    if (!sourceId) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Failed to add source (validation failed)'
      });
      return;
    }
    
    const addedSource = this.contextManager.getSource(sourceId);
    
    this.sendResponse(client, {
      id: message.id,
      success: true,
      data: { sourceId, source: addedSource }
    });
    
    // Broadcast event
    this.broadcastEvent({
      type: EventType.SOURCE_ADDED,
      sourceId,
      sourceType: sourceData.type,
      timestamp: new Date(),
      data: addedSource
    }, client.clientId);
  }
  
  /**
   * Handle UPDATE_SOURCE message
   */
  private async handleUpdateSource(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { sourceId, data } = message.payload as { sourceId: string; data: UpdatableSourceData };
    
    if (!sourceId || !data) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Source ID and update data are required'
      });
      return;
    }
    
    const success = this.contextManager.updateSource(sourceId, data);
    
    if (!success) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Failed to update source (not found or validation failed)'
      });
      return;
    }
    
    const updatedSource = this.contextManager.getSource(sourceId);
    
    this.sendResponse(client, {
      id: message.id,
      success: true,
      data: updatedSource
    });
    
    // Broadcast event
    this.broadcastEvent({
      type: EventType.SOURCE_UPDATED,
      sourceId,
      sourceType: updatedSource?.type,
      timestamp: new Date(),
      data: updatedSource
    }, client.clientId);
  }
  
  /**
   * Handle DELETE_SOURCE message
   */
  private async handleDeleteSource(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { sourceId } = message.payload as { sourceId: string };
    
    if (!sourceId) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Source ID is required'
      });
      return;
    }
    
    const sourceToDelete = this.contextManager.getSource(sourceId);
    const success = this.contextManager.deleteSource(sourceId);
    
    this.sendResponse(client, {
      id: message.id,
      success,
      data: { sourceId }
    });
    
    if (success && sourceToDelete) {
      // Broadcast event
      this.broadcastEvent({
        type: EventType.SOURCE_DELETED,
        sourceId,
        sourceType: sourceToDelete.type,
        timestamp: new Date()
      }, client.clientId);
    }
  }
  
  /**
   * Handle GET_ACTIVE_CONTEXT message
   */
  private async handleGetActiveContext(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const activeSources = this.contextManager.getActiveContextSources();
    
    this.sendResponse(client, {
      id: message.id,
      success: true,
      data: activeSources
    });
  }
  
  /**
   * Handle SET_ACTIVE_CONTEXT message
   */
  private async handleSetActiveContext(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { sourceIds } = message.payload as { sourceIds: string[] };
    
    if (!Array.isArray(sourceIds)) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Source IDs array is required'
      });
      return;
    }
    
    const success = this.contextManager.setActiveContext(sourceIds);
    
    this.sendResponse(client, {
      id: message.id,
      success,
      data: { sourceIds }
    });
    
    if (success) {
      // Broadcast event
      this.broadcastEvent({
        type: EventType.ACTIVE_CONTEXT_CHANGED,
        timestamp: new Date(),
        data: { sourceIds }
      }, client.clientId);
    }
  }
  
  /**
   * Handle GET_SOURCE_CONTENT message
   */
  private async handleGetSourceContent(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { sourceId } = message.payload as { sourceId: string };
    
    if (!sourceId) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Source ID is required'
      });
      return;
    }
    
    const source = this.contextManager.getSource(sourceId);
    
    if (!source) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Source not found'
      });
      return;
    }
    
    try {
      let content: string | undefined;
      
      if (source.type === SourceType.FILE) {
        const fileSource = source as FileSource;
        const filePath = path.resolve(this.config.workspaceRoot!, fileSource.filePath);
        content = await fs.promises.readFile(filePath, 'utf8');
      }
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { sourceId, content }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to read file content: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Handle UPDATE_SOURCE_CONTENT message
   */
  private async handleUpdateSourceContent(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { sourceId, content } = message.payload as { sourceId: string; content: string };
    
    if (!sourceId || typeof content !== 'string') {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Source ID and content are required'
      });
      return;
    }
    
    const source = this.contextManager.getSource(sourceId);
    
    if (!source) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Source not found'
      });
      return;
    }
    
    if (source.type !== SourceType.FILE) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Content updates only supported for file sources'
      });
      return;
    }
    
    try {
      const fileSource = source as FileSource;
      const filePath = path.resolve(this.config.workspaceRoot!, fileSource.filePath);
      await fs.promises.writeFile(filePath, content, 'utf8');
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { sourceId }
      });
      
      // Broadcast event
      this.broadcastEvent({
        type: EventType.CONTENT_UPDATED,
        sourceId,
        sourceType: source.type,
        timestamp: new Date(),
        data: { content }
      }, client.clientId);
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to write file content: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Handle CLEAR_SOURCE_CONTENT message
   */
  private async handleClearSourceContent(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { sourceId } = message.payload as { sourceId: string };
    
    if (!sourceId) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Source ID is required'
      });
      return;
    }
    
    const source = this.contextManager.getSource(sourceId);
    
    if (!source) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Source not found'
      });
      return;
    }
    
    if (source.type !== SourceType.FILE) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Content clearing only supported for file sources'
      });
      return;
    }
    
    try {
      const fileSource = source as FileSource;
      const filePath = path.resolve(this.config.workspaceRoot!, fileSource.filePath);
      await fs.promises.writeFile(filePath, '', 'utf8');
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { sourceId }
      });
      
      // Broadcast event
      this.broadcastEvent({
        type: EventType.CONTENT_CLEARED,
        sourceId,
        sourceType: source.type,
        timestamp: new Date()
      }, client.clientId);
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to clear file content: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Handle SUBSCRIBE_EVENTS message
   */
  private async handleSubscribeEvents(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    client.subscribedToEvents = true;
    
    this.sendResponse(client, {
      id: message.id,
      success: true,
      data: { subscribed: true }
    });
  }

  /**
   * Handle BROWSE_DIRECTORY message
   */
  private async handleBrowseDirectory(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { directoryPath, includeHidden = false } = message.payload as { directoryPath?: string; includeHidden?: boolean };
    
    const targetPath = directoryPath ? path.resolve(this.config.workspaceRoot!, directoryPath) : this.config.workspaceRoot!;
    
    try {
      const stats = await fs.promises.stat(targetPath);
      
      if (!stats.isDirectory()) {
        this.sendResponse(client, {
          id: message.id,
          success: false,
          error: 'Path is not a directory'
        });
        return;
      }
      
      const items = await fs.promises.readdir(targetPath, { withFileTypes: true });
      const directoryItems: DirectoryItem[] = [];
      
      for (const item of items) {
        if (!includeHidden && item.name.startsWith('.')) {
          continue;
        }
        
        const itemPath = path.join(targetPath, item.name);
        const relativePath = path.relative(this.config.workspaceRoot!, itemPath);
        
        try {
          const itemStats = await fs.promises.stat(itemPath);
          
          directoryItems.push({
            name: item.name,
            path: relativePath,
            isDirectory: item.isDirectory(),
            size: item.isFile() ? itemStats.size : undefined,
            lastModified: itemStats.mtime
          });
        } catch {
          // Skip items we can't stat (permissions, broken symlinks, etc.)
          continue;
        }
      }
      
      // Sort directories first, then files, both alphabetically
      directoryItems.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { path: path.relative(this.config.workspaceRoot!, targetPath), items: directoryItems }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to browse directory: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Handle GET_WORKSPACE_TREE message
   */
  private async handleGetWorkspaceTree(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { maxDepth = 3, includeHidden = false } = message.payload as { maxDepth?: number; includeHidden?: boolean };
    
    try {
      const tree = await this.buildFileTree(this.config.workspaceRoot!, maxDepth, includeHidden);
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: tree
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to get workspace tree: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Handle SEARCH_FILES message
   */
  private async handleSearchFiles(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { query, maxResults = 50, includeDirectories = true, includeHidden = false } = message.payload as { 
      query: string; 
      maxResults?: number; 
      includeDirectories?: boolean; 
      includeHidden?: boolean; 
    };
    
    if (!query || query.trim().length < 1) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Search query is required'
      });
      return;
    }
    
    try {
      const searchResults = await this.searchFiles(this.config.workspaceRoot!, query.trim(), {
        maxResults,
        includeDirectories,
        includeHidden
      });
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { query, results: searchResults }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to search files: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Builds a file tree for the given directory
   */
  private async buildFileTree(
    rootPath: string, 
    maxDepth: number, 
    includeHidden: boolean,
    currentDepth: number = 0
  ): Promise<FileTreeNode> {
    const stats = await fs.promises.stat(rootPath);
    const name = path.basename(rootPath);
    const relativePath = path.relative(this.config.workspaceRoot!, rootPath);
    
    const node: FileTreeNode = {
      name: name || 'workspace',
      path: relativePath || '.',
      isDirectory: stats.isDirectory(),
      size: stats.isFile() ? stats.size : undefined,
      lastModified: stats.mtime
    };
    
    if (stats.isDirectory() && currentDepth < maxDepth) {
      try {
        const items = await fs.promises.readdir(rootPath, { withFileTypes: true });
        const children: FileTreeNode[] = [];
        
        for (const item of items) {
          if (!includeHidden && item.name.startsWith('.')) {
            continue;
          }
          
          const itemPath = path.join(rootPath, item.name);
          
          try {
            const childNode = await this.buildFileTree(itemPath, maxDepth, includeHidden, currentDepth + 1);
            children.push(childNode);
          } catch {
            // Skip items we can't access
            continue;
          }
        }
        
        // Sort directories first, then files, both alphabetically
        children.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
        
        node.children = children;
      } catch {
        // If we can't read the directory, just mark it as a directory without children
      }
    }
    
    return node;
  }

  /**
   * Searches for files matching the query using fuzzy matching
   */
  private async searchFiles(
    rootPath: string, 
    query: string, 
    options: {
      maxResults: number;
      includeDirectories: boolean;
      includeHidden: boolean;
    }
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    
    const searchDirectory = async (dirPath: string): Promise<void> => {
      if (results.length >= options.maxResults) {
        return;
      }
      
      try {
        const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
        
        for (const item of items) {
          if (results.length >= options.maxResults) {
            break;
          }
          
          if (!options.includeHidden && item.name.startsWith('.')) {
            continue;
          }
          
          const itemPath = path.join(dirPath, item.name);
          const relativePath = path.relative(this.config.workspaceRoot!, itemPath);
          
          // Calculate fuzzy match score
          const score = this.calculateFuzzyScore(item.name.toLowerCase(), queryLower);
          
          if (score > 0) {
            if (item.isFile() || (item.isDirectory() && options.includeDirectories)) {
              results.push({
                path: relativePath,
                name: item.name,
                isDirectory: item.isDirectory(),
                score
              });
            }
          }
          
          // Recursively search subdirectories
          if (item.isDirectory()) {
            await searchDirectory(itemPath);
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };
    
    await searchDirectory(rootPath);
    
    // Sort by score (highest first), then by name
    results.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.name.localeCompare(b.name);
    });
    
    return results.slice(0, options.maxResults);
  }

  /**
   * Calculates a fuzzy matching score between a filename and query
   */
  private calculateFuzzyScore(filename: string, query: string): number {
    if (filename.includes(query)) {
      // Exact substring match gets high score
      const startIndex = filename.indexOf(query);
      // Prefer matches at the beginning of the filename
      return startIndex === 0 ? 100 : 80 - startIndex;
    }
    
    // Check for fuzzy matching (all characters in order)
    let queryIndex = 0;
    let filenameIndex = 0;
    let matchScore = 0;
    let consecutiveMatches = 0;
    
    while (queryIndex < query.length && filenameIndex < filename.length) {
      if (query[queryIndex] === filename[filenameIndex]) {
        queryIndex++;
        consecutiveMatches++;
        matchScore += consecutiveMatches; // Bonus for consecutive matches
      } else {
        consecutiveMatches = 0;
      }
      filenameIndex++;
    }
    
    // Only return a score if all query characters were found
    if (queryIndex === query.length) {
      return Math.max(1, matchScore);
    }
    
    return 0;
  }

  /**
   * Handles server errors
   */
  private handleError(error: Error): void {
    console.error('WebSocket server error:', error);
  }
  
  /**
   * Sets up the ping interval for connection health monitoring
   */
  private setupPingInterval(): void {
    if (!this.config.pingInterval) {
      return;
    }
    
    this.pingInterval = setInterval(() => {
      if (!this.server) {
        return;
      }
      
      this.clients.forEach((client, clientId) => {
        if (client.isAlive === false) {
          this.clients.delete(clientId);
          return client.terminate();
        }
        
        client.isAlive = false;
        client.ping();
      });
    }, this.config.pingInterval);
  }
  
  /**
   * Clears the ping interval
   */
  private clearPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  /**
   * Gets the context manager instance
   */
  getContextManager(): ContextManager {
    return this.contextManager;
  }
  
  // @Mention prompt builder handlers
  
  /**
   * Handle READ_FILE message - read file content
   */
  private async handleReadFile(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { path: filePath } = message.payload as { path: string };
    
    if (!filePath) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'File path is required'
      });
      return;
    }
    
    try {
      const fullPath = path.resolve(this.config.workspaceRoot!, filePath);
      const content = await fs.promises.readFile(fullPath, 'utf8');
      const stats = await fs.promises.stat(fullPath);
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { 
          content,
          size: stats.size,
          lastModified: stats.mtime
        }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Handle LIST_FILES message - list files matching pattern
   */
  private async handleListFiles(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { pattern } = message.payload as { pattern: string };
    
    if (!pattern) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'File pattern is required'
      });
      return;
    }
    
    try {
      // Simple glob-like pattern matching for now
      const files: string[] = [];
      await this.findMatchingFiles(this.config.workspaceRoot!, pattern, files);
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { files }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Handle GET_FILE_METADATA message
   */
  private async handleGetFileMetadata(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { path: filePath } = message.payload as { path: string };
    
    if (!filePath) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'File path is required'
      });
      return;
    }
    
    try {
      const fullPath = path.resolve(this.config.workspaceRoot!, filePath);
      const stats = await fs.promises.stat(fullPath);
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { 
          size: stats.size,
          lastModified: stats.mtime,
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile()
        }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to get file metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Handle GET_RECENT_FILES message - mock implementation for now
   */
  private async handleGetRecentFiles(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { hoursBack = 2 } = message.payload as { hoursBack?: number };
    
    try {
      // Mock implementation - in a real VS Code extension, this would use VS Code APIs
      const recentFiles: string[] = [];
      const cutoffTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
      
      await this.findRecentFiles(this.config.workspaceRoot!, cutoffTime, recentFiles);
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { files: recentFiles }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to get recent files: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Handle GET_OPEN_FILES message - mock implementation for now
   */
  private async handleGetOpenFiles(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    // Mock implementation - in a real VS Code extension, this would use VS Code APIs
    this.sendResponse(client, {
      id: message.id,
      success: true,
      data: { files: [] } // Empty for now, would be populated by VS Code extension
    });
  }
  
  /**
   * Handle GET_DIAGNOSTICS message - mock implementation for now
   */
  private async handleGetDiagnostics(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { file } = message.payload as { file?: string };
    
    // Mock implementation - in a real VS Code extension, this would use the Problems panel API
    this.sendResponse(client, {
      id: message.id,
      success: true,
      data: { 
        diagnostics: [] // Empty for now, would be populated by VS Code extension
      }
    });
  }
  
  /**
   * Handle GET_DIAGNOSTIC_SUMMARY message - mock implementation for now
   */
  private async handleGetDiagnosticSummary(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    // Mock implementation - in a real VS Code extension, this would aggregate Problems panel data
    this.sendResponse(client, {
      id: message.id,
      success: true,
      data: { 
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        fileCount: 0,
        topErrorFiles: []
      }
    });
  }
  
  /**
   * Handle GET_GIT_DIFF message
   */
  private async handleGetGitDiff(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { staged = false, file } = message.payload as { staged?: boolean; file?: string };
    
    try {
      const { execSync } = require('child_process');
      let command = staged ? 'git diff --cached' : 'git diff';
      
      if (file) {
        command += ` -- "${file}"`;
      }
      
      const diff = execSync(command, { 
        cwd: this.config.workspaceRoot,
        encoding: 'utf8'
      });
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { diff }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to get git diff: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Handle GET_GIT_STATUS message
   */
  private async handleGetGitStatus(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    try {
      const { execSync } = require('child_process');
      const statusOutput = execSync('git status --porcelain', {
        cwd: this.config.workspaceRoot,
        encoding: 'utf8'
      });
      
      const files = statusOutput.split('\n')
        .filter((line: string) => line.trim())
        .map((line: string) => {
          const status = line.substring(0, 2);
          const filePath = line.substring(3);
          
          let fileStatus: 'M' | 'A' | 'D' | 'R' = 'M';
          if (status.includes('A')) fileStatus = 'A';
          else if (status.includes('D')) fileStatus = 'D';
          else if (status.includes('R')) fileStatus = 'R';
          
          return {
            path: filePath,
            status: fileStatus,
            additions: 0, // Would need git diff --stat for accurate numbers
            deletions: 0
          };
        });
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { files }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to get git status: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Handle GET_GIT_BRANCH message
   */
  private async handleGetGitBranch(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    try {
      const { execSync } = require('child_process');
      const branch = execSync('git branch --show-current', {
        cwd: this.config.workspaceRoot,
        encoding: 'utf8'
      }).trim();
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { branch }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to get git branch: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Handle GET_COMMIT_FILES message
   */
  private async handleGetCommitFiles(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { commit } = message.payload as { commit: string };
    
    if (!commit) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Commit hash is required'
      });
      return;
    }
    
    try {
      const { execSync } = require('child_process');
      const filesOutput = execSync(`git diff-tree --no-commit-id --name-only -r ${commit}`, {
        cwd: this.config.workspaceRoot,
        encoding: 'utf8'
      });
      
      const files = filesOutput.split('\n').filter((line: string) => line.trim());
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { files }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to get commit files: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Handle GET_BRANCH_FILES message
   */
  private async handleGetBranchFiles(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { branch, baseBranch = 'main' } = message.payload as { branch: string; baseBranch?: string };
    
    if (!branch) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Branch name is required'
      });
      return;
    }
    
    try {
      const { execSync } = require('child_process');
      const filesOutput = execSync(`git diff --name-only ${baseBranch}...${branch}`, {
        cwd: this.config.workspaceRoot,
        encoding: 'utf8'
      });
      
      const files = filesOutput.split('\n').filter((line: string) => line.trim());
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { files }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to get branch files: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  /**
   * Handle GET_COMMIT_HISTORY message
   */
  private async handleGetCommitHistory(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { limit = 10 } = message.payload as { limit?: number };
    
    try {
      const { execSync } = require('child_process');
      const historyOutput = execSync(`git log -${limit} --pretty=format:"%H|%s|%an|%ad|%d" --date=iso --stat=1,1`, {
        cwd: this.config.workspaceRoot,
        encoding: 'utf8'
      });
      
      const commits = historyOutput.split('\n')
        .filter((line: string) => line.includes('|'))
        .map((line: string) => {
          const [hash, message, author, date] = line.split('|');
          return {
            hash,
            message,
            author,
            date: new Date(date),
            filesChanged: 0 // Would need to parse git log --stat output for accurate count
          };
        });
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { commits }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to get commit history: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  // Symbol-related handlers (mock implementations - would be replaced by Language Server integration)
  
  /**
   * Handle FIND_SYMBOL message - mock implementation for now
   */
  private async handleFindSymbol(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { name, kind } = message.payload as { name: string; kind?: string };
    
    if (!name) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Symbol name is required'
      });
      return;
    }
    
    // Mock implementation - in a real implementation, this would use TypeScript Language Server
    this.sendResponse(client, {
      id: message.id,
      success: true,
      data: { symbols: [] }
    });
  }
  
  /**
   * Handle GET_SYMBOL_DEFINITION message - mock implementation for now
   */
  private async handleGetSymbolDefinition(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { file, line, character } = message.payload as { file: string; line: number; character: number };
    
    if (!file || line === undefined || character === undefined) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'File, line, and character are required'
      });
      return;
    }
    
    // Mock implementation - in a real implementation, this would use TypeScript Language Server
    this.sendResponse(client, {
      id: message.id,
      success: true,
      data: { symbol: null }
    });
  }
  
  /**
   * Handle GET_SYMBOL_REFERENCES message - mock implementation for now
   */
  private async handleGetSymbolReferences(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { file, line, character } = message.payload as { file: string; line: number; character: number };
    
    if (!file || line === undefined || character === undefined) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'File, line, and character are required'
      });
      return;
    }
    
    // Mock implementation - in a real implementation, this would use TypeScript Language Server
    this.sendResponse(client, {
      id: message.id,
      success: true,
      data: { references: [] }
    });
  }
  
  /**
   * Handle GET_FILE_SYMBOLS message - mock implementation for now
   */
  private async handleGetFileSymbols(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { file } = message.payload as { file: string };
    
    if (!file) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'File path is required'
      });
      return;
    }
    
    // Mock implementation - in a real implementation, this would use TypeScript Language Server or AST analyzer
    this.sendResponse(client, {
      id: message.id,
      success: true,
      data: { symbols: [] }
    });
  }
  
  /**
   * Handle SEARCH_SYMBOLS message - mock implementation for now
   */
  private async handleSearchSymbols(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { query, limit = 50 } = message.payload as { query: string; limit?: number };
    
    if (!query) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'Search query is required'
      });
      return;
    }
    
    // Mock implementation - in a real implementation, this would use TypeScript Language Server
    this.sendResponse(client, {
      id: message.id,
      success: true,
      data: { symbols: [] }
    });
  }
  
  /**
   * Handle GET_TYPE_DEFINITION message - mock implementation for now
   */
  private async handleGetTypeDefinition(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { file, line, character } = message.payload as { file: string; line: number; character: number };
    
    if (!file || line === undefined || character === undefined) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'File, line, and character are required'
      });
      return;
    }
    
    // Mock implementation - in a real implementation, this would use TypeScript Language Server
    this.sendResponse(client, {
      id: message.id,
      success: true,
      data: { symbol: null }
    });
  }
  
  /**
   * Handle GET_IMPLEMENTATION message - mock implementation for now
   */
  private async handleGetImplementation(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { file, line, character } = message.payload as { file: string; line: number; character: number };
    
    if (!file || line === undefined || character === undefined) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: 'File, line, and character are required'
      });
      return;
    }
    
    // Mock implementation - in a real implementation, this would use TypeScript Language Server
    this.sendResponse(client, {
      id: message.id,
      success: true,
      data: { symbols: [] }
    });
  }
  
  /**
   * Handle GET_TYPESCRIPT_CONFIG message - mock implementation for now
   */
  private async handleGetTypeScriptConfig(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    const { configPath } = message.payload as { configPath?: string };
    
    try {
      const tsconfigPath = configPath || path.join(this.config.workspaceRoot!, 'tsconfig.json');
      
      let compilerOptions = {};
      let files: string[] = [];
      
      try {
        const tsconfigContent = await fs.promises.readFile(tsconfigPath, 'utf8');
        const tsconfig = JSON.parse(tsconfigContent);
        compilerOptions = tsconfig.compilerOptions || {};
        
        // Find TypeScript files in the project
        await this.findTypeScriptFiles(this.config.workspaceRoot!, files);
      } catch {
        // If no tsconfig.json, use default settings and find all TS files
        await this.findTypeScriptFiles(this.config.workspaceRoot!, files);
      }
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { 
          files,
          compilerOptions
        }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to get TypeScript config: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }
  
  // Helper methods
  
  /**
   * Find files matching a simple glob-like pattern
   */
  private async findMatchingFiles(dir: string, pattern: string, results: string[]): Promise<void> {
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        const relativePath = path.relative(this.config.workspaceRoot!, itemPath);
        
        if (item.isFile()) {
          // Simple pattern matching - could be enhanced with proper glob support
          if (this.matchesPattern(item.name, pattern) || this.matchesPattern(relativePath, pattern)) {
            results.push(relativePath);
          }
        } else if (item.isDirectory() && !item.name.startsWith('.')) {
          await this.findMatchingFiles(itemPath, pattern, results);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }
  
  /**
   * Find recently modified files
   */
  private async findRecentFiles(dir: string, cutoffTime: Date, results: string[]): Promise<void> {
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        
        if (item.isFile()) {
          try {
            const stats = await fs.promises.stat(itemPath);
            if (stats.mtime > cutoffTime) {
              const relativePath = path.relative(this.config.workspaceRoot!, itemPath);
              results.push(relativePath);
            }
          } catch {
            // Skip files we can't stat
          }
        } else if (item.isDirectory() && !item.name.startsWith('.')) {
          await this.findRecentFiles(itemPath, cutoffTime, results);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }
  
  /**
   * Find TypeScript files in a directory
   */
  private async findTypeScriptFiles(dir: string, results: string[]): Promise<void> {
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const itemPath = path.join(dir, item.name);
        
        if (item.isFile() && (item.name.endsWith('.ts') || item.name.endsWith('.tsx'))) {
          results.push(itemPath);
        } else if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
          await this.findTypeScriptFiles(itemPath, results);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }
  
  /**
   * Simple pattern matching for file names/paths
   */
  private matchesPattern(text: string, pattern: string): boolean {
    // Convert simple glob patterns to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    try {
      return new RegExp(regexPattern, 'i').test(text);
    } catch {
      // If regex is invalid, fall back to simple includes
      return text.toLowerCase().includes(pattern.toLowerCase());
    }
  }

  // Workspace management handlers

  /**
   * Handle CREATE_WORKSPACE message
   */
  private async handleCreateWorkspace(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    try {
      const { name, rootPath, settings } = message.payload as { name: string; rootPath: string; settings?: any };
      
      if (!name || !rootPath) {
        throw new Error('Name and rootPath are required');
      }

      const workspace = await this.workspaceManager.createWorkspace(name, rootPath, settings);
      this.currentWorkspace = workspace;
      
      // Update server workspace root to match the new workspace
      this.config.workspaceRoot = workspace.rootPath;
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: workspace
      });

      // Broadcast workspace change event
      this.broadcastEvent({
        type: EventType.WORKSPACE_CHANGED,
        timestamp: new Date(),
        data: { workspaceId: workspace.id, workspaceName: workspace.name }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to create workspace: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Handle LOAD_WORKSPACE message
   */
  private async handleLoadWorkspace(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    try {
      const { id } = message.payload as { id: string };
      
      if (!id) {
        throw new Error('Workspace ID is required');
      }

      const workspace = await this.workspaceManager.loadWorkspace(id);
      
      if (!workspace) {
        throw new Error(`Workspace with ID ${id} not found`);
      }

      this.currentWorkspace = workspace;
      
      // Update server workspace root to match the loaded workspace
      this.config.workspaceRoot = workspace.rootPath;
      
      // Load context sources into the context manager
      this.contextManager.clearAllSources();
      for (const source of workspace.contextSources) {
        // For workspace loading, we need to restore the full source with its ID
        // Since addSource creates new IDs, we'll manually set the sources
        (this.contextManager as any).sources.set(source.id, source);
      }
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: workspace
      });

      // Broadcast workspace change event
      this.broadcastEvent({
        type: EventType.WORKSPACE_CHANGED,
        timestamp: new Date(),
        data: { workspaceId: workspace.id, workspaceName: workspace.name }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to load workspace: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Handle SAVE_WORKSPACE message
   */
  private async handleSaveWorkspace(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    try {
      if (!this.currentWorkspace) {
        throw new Error('No workspace currently loaded');
      }

      // Update workspace with current context sources
      this.currentWorkspace.contextSources = this.contextManager.getAllSources();
      
      await this.workspaceManager.saveWorkspace(this.currentWorkspace);
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { message: 'Workspace saved successfully' }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to save workspace: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Handle DELETE_WORKSPACE message
   */
  private async handleDeleteWorkspace(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    try {
      const { id } = message.payload as { id: string };
      
      if (!id) {
        throw new Error('Workspace ID is required');
      }

      const success = await this.workspaceManager.deleteWorkspace(id);
      
      if (!success) {
        throw new Error(`Failed to delete workspace ${id}`);
      }

      // If we deleted the current workspace, clear it
      if (this.currentWorkspace?.id === id) {
        this.currentWorkspace = null;
        this.contextManager.clearAllSources();
      }
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { message: 'Workspace deleted successfully' }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to delete workspace: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Handle GET_RECENT_WORKSPACES message
   */
  private async handleGetRecentWorkspaces(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    try {
      if (!this.workspaceManagerReady) {
        this.sendResponse(client, {
          id: message.id,
          success: true,
          data: []
        });
        return;
      }
      
      const recentWorkspaces = await this.workspaceManager.getRecentWorkspaces();
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: recentWorkspaces
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to get recent workspaces: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Handle FIND_WORKSPACE_BY_PATH message
   */
  private async handleFindWorkspaceByPath(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    try {
      const { rootPath } = message.payload as { rootPath: string };
      
      if (!rootPath) {
        throw new Error('Root path is required');
      }

      const workspace = await this.workspaceManager.findWorkspaceByPath(rootPath);
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: workspace
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to find workspace: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Handle UPDATE_WORKSPACE_SETTINGS message
   */
  private async handleUpdateWorkspaceSettings(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    try {
      const { workspaceId, settings } = message.payload as { workspaceId: string; settings: any };
      
      if (!workspaceId || !settings) {
        throw new Error('Workspace ID and settings are required');
      }

      await this.workspaceManager.updateWorkspaceSettings(workspaceId, settings);
      
      // If this is the current workspace, update our reference
      if (this.currentWorkspace?.id === workspaceId) {
        this.currentWorkspace.settings = { ...this.currentWorkspace.settings, ...settings };
      }
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { message: 'Workspace settings updated successfully' }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to update workspace settings: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Handle ADD_WORKSPACE_CONTEXT_SOURCE message
   */
  private async handleAddWorkspaceContextSource(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    try {
      const { workspaceId, contextSource } = message.payload as { workspaceId: string; contextSource: ContextSource };
      
      if (!workspaceId || !contextSource) {
        throw new Error('Workspace ID and context source are required');
      }

      await this.workspaceManager.addContextSource(workspaceId, contextSource);
      
      // If this is the current workspace, also add to context manager
      if (this.currentWorkspace?.id === workspaceId) {
        (this.contextManager as any).sources.set(contextSource.id, contextSource);
        this.currentWorkspace.contextSources.push(contextSource);
      }
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { message: 'Context source added to workspace successfully' }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to add context source: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Handle REMOVE_WORKSPACE_CONTEXT_SOURCE message
   */
  private async handleRemoveWorkspaceContextSource(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    try {
      const { workspaceId, contextSourceId } = message.payload as { workspaceId: string; contextSourceId: string };
      
      if (!workspaceId || !contextSourceId) {
        throw new Error('Workspace ID and context source ID are required');
      }

      await this.workspaceManager.removeContextSource(workspaceId, contextSourceId);
      
      // If this is the current workspace, also remove from context manager
      if (this.currentWorkspace?.id === workspaceId) {
        this.contextManager.deleteSource(contextSourceId);
        this.currentWorkspace.contextSources = this.currentWorkspace.contextSources.filter(
          cs => cs.id !== contextSourceId
        );
      }
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { message: 'Context source removed from workspace successfully' }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to remove context source: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Handle ADD_RECENT_MENTION message
   */
  private async handleAddRecentMention(client: CodeWeaverWebSocket, message: Message): Promise<void> {
    try {
      const { workspaceId, mention } = message.payload as { workspaceId: string; mention: string };
      
      if (!workspaceId || !mention) {
        throw new Error('Workspace ID and mention are required');
      }

      await this.workspaceManager.addRecentMention(workspaceId, mention);
      
      // If this is the current workspace, update our reference
      if (this.currentWorkspace?.id === workspaceId) {
        this.currentWorkspace.recentMentions = [
          mention, 
          ...this.currentWorkspace.recentMentions.filter(m => m !== mention)
        ].slice(0, 50);
      }
      
      this.sendResponse(client, {
        id: message.id,
        success: true,
        data: { message: 'Recent mention added successfully' }
      });
    } catch (error) {
      this.sendResponse(client, {
        id: message.id,
        success: false,
        error: `Failed to add recent mention: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Get current workspace
   */
  getCurrentWorkspace(): Workspace | null {
    return this.currentWorkspace;
  }
}