// packages/websocket-client/src/websocketClient.ts
import { v4 as uuidv4 } from 'uuid';
import WebSocket from 'ws';

/**
 * Configuration for the WebSocket client
 */
export interface WebSocketClientConfig {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  events?: {
    onOpen?: (event: WebSocket.Event) => void;
    onMessage?: (data: WebSocket.Data) => void;
    onClose?: (event: WebSocket.CloseEvent) => void;
    onError?: (event: WebSocket.ErrorEvent) => void;
    onReconnect?: (attempt: number) => void;
  };
}

/**
 * Default configuration for the WebSocket client
 */
export const DEFAULT_CLIENT_CONFIG: WebSocketClientConfig = {
  autoReconnect: true,
  reconnectInterval: 5000, // 5 seconds
  maxReconnectAttempts: 5,
  pingInterval: 30000, // 30 seconds
  events: {}
};

/**
 * WebSocket client for communicating with the CodeWeaver WebSocket server
 */
export class WebSocketClient {
  private url: string;
  private config: Required<WebSocketClientConfig>;
  private socket: WebSocket | null = null;
  private clientId: string;
  private connected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;

  /**
   * Create a new WebSocketClient
   * @param url The WebSocket server URL
   * @param config Optional configuration
   */
  constructor(url: string, config: WebSocketClientConfig = {}) {
    this.url = url;
    this.clientId = uuidv4();

    // Merge default config with user-provided config
    this.config = {
      ...DEFAULT_CLIENT_CONFIG,
      ...config,
      events: {
        ...DEFAULT_CLIENT_CONFIG.events,
        ...config.events
      }
    } as Required<WebSocketClientConfig>;
  }

  /**
   * Connect to the WebSocket server
   * @returns Promise that resolves when connected or rejects on error
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Close existing connection if any
        if (this.socket) {
          this.disconnect();
        }

        // Create new WebSocket connection
        this.socket = new WebSocket(this.url);

        // Set up event handlers
        this.socket.onopen = (event: WebSocket.Event) => {
          this.connected = true;
          this.reconnectAttempts = 0;

          // Start ping interval
          this.startPingInterval();

          // Call user-provided event handler
          if (this.config.events.onOpen) {
            this.config.events.onOpen(event);
          }

          resolve();
        };

        this.socket.onmessage = (event: WebSocket.MessageEvent) => {
          // Call user-provided event handler
          if (this.config.events.onMessage) {
            this.config.events.onMessage(event.data);
          }
        };

        this.socket.onclose = (event: WebSocket.CloseEvent) => {
          this.connected = false;
          this.clearPingInterval();

          // Call user-provided event handler
          if (this.config.events.onClose) {
            this.config.events.onClose(event);
          }

          // Auto reconnect if enabled and not a normal closure
          if (
            this.config.autoReconnect &&
            event.code !== 1000 &&
            this.reconnectAttempts < this.config.maxReconnectAttempts
          ) {
            this.attemptReconnect();
          }
        };

        this.socket.onerror = (event: WebSocket.ErrorEvent) => {
          // Call user-provided event handler
          if (this.config.events.onError) {
            this.config.events.onError(event);
          }

          reject(new Error(`WebSocket error: ${event.message || 'Unknown error'}`));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   * @param code The close code (default: 1000)
   * @param reason The close reason (default: 'Normal closure')
   */
  public disconnect(code = 1000, reason = 'Normal closure'): void {
    this.clearReconnectTimer();
    this.clearPingInterval();

    if (this.socket) {
      this.connected = false;
      this.socket.close(code, reason);
      this.socket = null;
    }
  }

  /**
   * Send data to the WebSocket server
   * @param data The data to send
   * @returns True if sent successfully, false otherwise
   */
  public send(data: string | ArrayBuffer | SharedArrayBuffer | Blob | ArrayBufferView): boolean {
    if (!this.socket || !this.connected) {
      return false;
    }

    try {
      this.socket.send(data);
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      return false;
    }
  }

  /**
   * Check if the WebSocket is active (connected)
   * @returns True if connected, false otherwise
   */
  public isActive(): boolean {
    return this.connected;
  }

  /**
   * Get the client ID
   * @returns The client ID
   */
  public getClientId(): string {
    return this.clientId;
  }

  /**
   * Start the ping interval to keep the connection alive
   */
  private startPingInterval(): void {
    this.clearPingInterval();

    if (this.config.pingInterval > 0) {
      this.pingTimer = setInterval(() => {
        this.ping();
      }, this.config.pingInterval);
    }
  }

  /**
   * Clear the ping interval
   */
  private clearPingInterval(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Send a ping to the server
   */
  private ping(): void {
    if (this.socket && this.connected) {
      // For WebSocket implementation that supports ping
      if (typeof this.socket.ping === 'function') {
        this.socket.ping();
      } else {
        // Fallback for browsers that don't support ping: send a custom ping message
        this.send(JSON.stringify({ type: 'ping' }));
      }
    }
  }

  /**
   * Attempt to reconnect to the WebSocket server
   */
  private attemptReconnect(): void {
    this.clearReconnectTimer();

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;

      // Call user-provided event handler
      if (this.config.events.onReconnect) {
        this.config.events.onReconnect(this.reconnectAttempts);
      }

      // Attempt to reconnect
      this.connect().catch(() => {
        // If reconnection fails and we haven't reached max attempts, try again
        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      });
    }, this.config.reconnectInterval);
  }

  /**
   * Clear the reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}