import { 
  MessageType
} from '@codeweaver/core';

import type { 
  Message, 
  MessageResponse,
  ContextEvent,
  ContextSource
} from '@codeweaver/core';

export interface WebSocketClientOptions {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  events?: {
    onMessage?: (data: unknown) => void;
    onConnect?: () => void;
    onDisconnect?: (code: number, reason: string) => void;
    onError?: (error: Error) => void;
    onEvent?: (event: ContextEvent) => void;
  };
}

export interface ConnectionOptions {
  timeout?: number;
}

interface PendingRequest {
  resolve: (response: MessageResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class WebSocketClient {
  private url: string;
  private options: WebSocketClientOptions;
  private clientId: string;
  private socket: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private isClosing = false;
  private messageQueue: Message[] = [];
  
  /**
   * Creates a new WebSocketClient instance
   * 
   * @param url - The WebSocket server URL to connect to
   * @param options - Optional configuration options
   */
  constructor(url: string, options?: WebSocketClientOptions) {
    this.url = url;
    this.options = {
      autoReconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 5,
      ...options
    };
    this.clientId = this.generateClientId();
  }

  /**
   * Returns the unique client ID for this WebSocket client
   */
  getClientId(): string {
    return this.clientId;
  }

  /**
   * Connects to the WebSocket server
   * 
   * @param options - Connection options
   * @returns - Promise that resolves when connected or rejects on error
   */
  async connect(options?: ConnectionOptions): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.isClosing = false;
      this.socket = new WebSocket(this.url);
      
      // Set up timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;
      if (options?.timeout) {
        timeoutId = setTimeout(() => {
          if (this.socket) {
            this.socket.close();
            this.socket = null;
            reject(new Error('Connection timeout'));
          }
        }, options.timeout);
      }
      
      // Set up connection handlers
      this.socket.onopen = () => {
        if (timeoutId) { clearTimeout(timeoutId); }
        this.reconnectAttempts = 0;
        this.options.events?.onConnect?.();
        
        // Process queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          if (message) {
            this.send(message);
          }
        }
        
        resolve();
      };
      
      this.socket.onerror = (_error) => {
        if (timeoutId) { clearTimeout(timeoutId); }
        const err = new Error('WebSocket error');
        this.options.events?.onError?.(err);
        if (this.socket?.readyState === WebSocket.CONNECTING) {
          this.socket = null;
          reject(err);
        }
      };
      
      this.socket.onclose = (event) => {
        if (timeoutId) { clearTimeout(timeoutId); }
        this.socket = null;
        this.options.events?.onDisconnect?.(event.code, event.reason);
        
        // Reject all pending requests
        this.pendingRequests.forEach((pending) => {
          clearTimeout(pending.timeout);
          pending.reject(new Error('Connection closed'));
        });
        this.pendingRequests.clear();
        
        // Attempt reconnection if enabled
        if (!this.isClosing && this.options.autoReconnect && 
            this.reconnectAttempts < (this.options.maxReconnectAttempts || 5)) {
          this.scheduleReconnect();
        }
      };
      
      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as Message | MessageResponse | ContextEvent;
          
          // Handle different message types
          if ('requestId' in data && data.requestId) {
            // This is a response to a request
            const pending = this.pendingRequests.get(data.requestId);
            if (pending) {
              clearTimeout(pending.timeout);
              this.pendingRequests.delete(data.requestId);
              pending.resolve(data as MessageResponse);
            }
          } else if ('type' in data && data.type === MessageType.EVENT && 'payload' in data) {
            // This is an event broadcast
            const event = data.payload as ContextEvent;
            this.options.events?.onEvent?.(event);
          }
          
          // Always call the general message handler
          this.options.events?.onMessage?.(data);
          
        } catch (error) {
          this.options.events?.onError?.(new Error(`Failed to parse message: ${error}`));
        }
      };
    });
  }

  /**
   * Disconnects from the WebSocket server
   * 
   * @param code - Optional close code
   * @param reason - Optional close reason
   */
  disconnect(code?: number, reason?: string): void {
    this.isClosing = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    if (this.socket) {
      this.socket.close(code || 1000, reason || 'Client disconnect');
      this.socket = null;
    }
    
    // Clear pending requests
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client disconnected'));
    });
    this.pendingRequests.clear();
  }

  /**
   * Checks if the WebSocket connection is active
   * 
   * @returns - True if the connection is active, false otherwise
   */
  isActive(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Sends a message to the server
   * 
   * @param message - The message to send
   * @throws Error if not connected
   */
  send(message: Message): void {
    if (!this.isActive()) {
      if (this.options.autoReconnect && !this.isClosing) {
        this.messageQueue.push(message);
        if (!this.reconnectTimer) {
          this.scheduleReconnect();
        }
        return;
      }
      throw new Error('WebSocket is not connected');
    }
    
    this.socket!.send(JSON.stringify(message));
  }

  /**
   * Sends a message and waits for a response
   * 
   * @param message - The message to send
   * @param timeout - Response timeout in milliseconds (default: 30000)
   * @returns Promise that resolves with the response
   */
  async sendAndWait(message: Message, timeout = 30000): Promise<MessageResponse> {
    const messageId = message.id || this.generateMessageId();
    const messageWithId = { ...message, id: messageId };
    
    return new Promise<MessageResponse>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error(`Request timeout for message ${messageId}`));
      }, timeout);
      
      this.pendingRequests.set(messageId, {
        resolve,
        reject,
        timeout: timeoutId
      });
      
      try {
        this.send(messageWithId);
      } catch (error) {
        this.pendingRequests.delete(messageId);
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Subscribes to server events
   */
  async subscribeToEvents(): Promise<void> {
    const message: Message = {
      type: MessageType.SUBSCRIBE_EVENTS,
      id: this.generateMessageId(),
      timestamp: new Date()
    };
    
    await this.sendAndWait(message);
  }

  /**
   * Gets all context sources
   */
  async getSources(): Promise<ContextSource[]> {
    const message: Message = {
      type: MessageType.GET_SOURCES,
      id: this.generateMessageId(),
      timestamp: new Date()
    };
    
    const response = await this.sendAndWait(message);
    return response.data as ContextSource[];
  }

  /**
   * Adds a new context source
   */
  async addSource(source: Omit<ContextSource, 'id' | 'createdAt' | 'updatedAt'>): Promise<ContextSource> {
    const message: Message = {
      type: MessageType.ADD_SOURCE,
      id: this.generateMessageId(),
      timestamp: new Date(),
      payload: source
    };
    
    const response = await this.sendAndWait(message);
    return response.data as ContextSource;
  }

  /**
   * Updates an existing context source
   */
  async updateSource(id: string, updates: Partial<ContextSource>): Promise<ContextSource> {
    const message: Message = {
      type: MessageType.UPDATE_SOURCE,
      id: this.generateMessageId(),
      timestamp: new Date(),
      payload: { id, updates }
    };
    
    const response = await this.sendAndWait(message);
    return response.data as ContextSource;
  }

  /**
   * Deletes a context source
   */
  async deleteSource(id: string): Promise<void> {
    const message: Message = {
      type: MessageType.DELETE_SOURCE,
      id: this.generateMessageId(),
      timestamp: new Date(),
      payload: { id }
    };
    
    await this.sendAndWait(message);
  }

  /**
   * Gets the active context source IDs
   */
  async getActiveContext(): Promise<string[]> {
    const message: Message = {
      type: MessageType.GET_ACTIVE_CONTEXT,
      id: this.generateMessageId(),
      timestamp: new Date()
    };
    
    const response = await this.sendAndWait(message);
    return response.data as string[];
  }

  /**
   * Sets the active context source IDs
   */
  async setActiveContext(sourceIds: string[]): Promise<void> {
    const message: Message = {
      type: MessageType.SET_ACTIVE_CONTEXT,
      id: this.generateMessageId(),
      timestamp: new Date(),
      payload: sourceIds
    };
    
    await this.sendAndWait(message);
  }

  /**
   * Gets content for a source
   */
  async getSourceContent(sourceId: string): Promise<string> {
    const message: Message = {
      type: MessageType.GET_SOURCE_CONTENT,
      id: this.generateMessageId(),
      timestamp: new Date(),
      payload: { sourceId }
    };
    
    const response = await this.sendAndWait(message);
    return response.data as string;
  }

  /**
   * Updates content for a source
   */
  async updateSourceContent(sourceId: string, content: string): Promise<void> {
    const message: Message = {
      type: MessageType.UPDATE_SOURCE_CONTENT,
      id: this.generateMessageId(),
      timestamp: new Date(),
      payload: { sourceId, content }
    };
    
    await this.sendAndWait(message);
  }

  /**
   * Clears content for a source
   */
  async clearSourceContent(sourceId: string): Promise<void> {
    const message: Message = {
      type: MessageType.CLEAR_SOURCE_CONTENT,
      id: this.generateMessageId(),
      timestamp: new Date(),
      payload: { sourceId }
    };
    
    await this.sendAndWait(message);
  }

  /**
   * Schedules a reconnection attempt
   * @private
   */
  private scheduleReconnect(): void {
    if (this.isClosing || this.reconnectTimer) {
      return;
    }
    
    const interval = Math.min(
      (this.options.reconnectInterval || 1000) * Math.pow(2, this.reconnectAttempts),
      30000
    );
    
    this.reconnectAttempts++;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect().catch((error) => {
        this.options.events?.onError?.(error);
      });
    }, interval);
  }

  /**
   * Generates a random client ID
   * @private
   */
  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * Generates a random message ID
   * @private
   */
  private generateMessageId(): string {
    return `${this.clientId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}