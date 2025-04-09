// packages/websocket-server/src/websocketServer.ts
import { v4 as uuidv4 } from 'uuid';
import { WebSocket, WebSocketServer as WSServer } from 'ws';

// Basic server configuration
export interface ServerConfig {
  port: number;
  pingInterval?: number;
  enableLogging?: boolean;
}

// Default configuration
const DEFAULT_CONFIG: ServerConfig = {
  port: 8080,
  pingInterval: 30000,
  enableLogging: false
};

// Extended WebSocket type with our custom properties
export interface CodeWeaverWebSocket extends WebSocket {
  clientId: string;
  isAlive: boolean;
}

export class WebSocketServer {
  private server: WSServer | null = null;
  private clients: Map<string, CodeWeaverWebSocket> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private config: ServerConfig;
  
  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
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
   * Broadcasts a message to all connected clients
   */
  broadcast(message: string, excludeClientId?: string): number {
    if (!this.server) {
      throw new Error('Server not started');
    }
    
    let count = 0;
    
    this.clients.forEach((client, clientId) => {
      if (excludeClientId && clientId === excludeClientId) {
        return;
      }
      
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
        count++;
      }
    });
    
    return count;
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
    
    this.clients.set(client.clientId, client);
    
    if (this.config.enableLogging) {
      console.error(`Client connected: ${client.clientId}`);
    }
    
    // Set up message handler
    client.on('message', (data) => {
      const message = data.toString();
      
      if (this.config.enableLogging) {
        console.error(`Message from ${client.clientId}: ${message}`);
      }
      
      // Default behavior: echo back the message
      client.send(`Echo: ${message}`);
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
    client.send('Connected to CodeWeaver WebSocket Server');
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
}