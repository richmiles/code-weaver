// src/websocketClient.ts

export interface WebSocketClientOptions {
  events?: {
    onMessage?: (data: unknown) => void;
    // You can add more event handlers here later as needed
  };
}

export interface ConnectionOptions {
  timeout?: number;
}

export class WebSocketClient {
  private url: string;
  private options?: WebSocketClientOptions;
  private clientId: string;
  private socket: WebSocket | null = null;
  
  /**
   * Creates a new WebSocketClient instance
   * 
   * @param url - The WebSocket server URL to connect to
   * @param options - Optional configuration options
   */
  constructor(url: string, options?: WebSocketClientOptions) {
    this.url = url;
    this.options = options;
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
        resolve();
      };
      
      this.socket.onerror = (error) => {
        if (timeoutId) { clearTimeout(timeoutId); }
        this.socket = null;
        reject(error);
      };
    });
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
   * Generates a random client ID
   * @private
   */
  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}