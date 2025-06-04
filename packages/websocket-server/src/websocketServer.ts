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
  SourceType 
} from '@codeweaver/core';
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
  
  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.contextManager = new ContextManager();
  }
  
  /**
   * Starts the WebSocket server
   */
  start(): void {
    if (this.server) {
      this.stop();
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
      console.error(`Message from ${client.clientId}:`, message.type);
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
}