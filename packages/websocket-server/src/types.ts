// packages/websocket-server/src/types.ts
import { WebSocket } from 'ws';

// Define types for messages
export interface Message {
  type: string;
  payload: unknown;
}

// Extended WebSocket interface with custom properties
export interface CodeWeaverWebSocket extends WebSocket {
  isAlive: boolean;
  clientId: string;
}

// Server configuration
export interface ServerConfig {
  port: number;
  pingInterval?: number;
  debugMode?: boolean;
}

// Default configuration values
export const DEFAULT_CONFIG: ServerConfig = {
  port: 8080,
  pingInterval: 30000,  // 30 seconds
  debugMode: false
};