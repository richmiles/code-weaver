// packages/websocket-server/src/index.ts
import { v4 as uuidv4 } from 'uuid';
import { WebSocket, WebSocketServer } from 'ws';
import { parseConfig } from './config.js';
import { CodeWeaverWebSocket, ServerConfig } from './types.js';

// Track clients for each server instance separately
const clients = new Map<string, CodeWeaverWebSocket>();

// Get the raw WebSocketServer instance
let serverInstance: WebSocketServer | null = null;

/**
 * Clear all stored clients - useful for testing
 */
export function clearClients(): void {
  clients.clear();
}

// Create WebSocket server and export it
export const createWebSocketServer = (config: Partial<ServerConfig> = {}): WebSocketServer => {
  // Parse and validate config
  const parsedConfig = parseConfig(config);
  const port = parsedConfig.port;
  
  // Clean up any previous server instances
  if (serverInstance) {
    serverInstance.close();
    clearClients();
  }

  // Create a new WebSocket server
  const wss = new WebSocketServer({ port });
  serverInstance = wss;

  // Handle client connections
  wss.on('connection', (ws: WebSocket) => {
    // Cast to our extended type
    const client = ws as CodeWeaverWebSocket;
    client.isAlive = true;
    client.clientId = uuidv4();
    
    // Store client in our map
    clients.set(client.clientId, client);
    
    console.error('Client connected');

    // Handle messages from clients
    client.on('message', (message: Buffer) => {
      console.error('Received message:', message.toString());
      // Echo back the message for now 
      client.send(`Echo: ${message}`);
    });

    // Handle client disconnection
    client.on('close', () => {
      // Remove from client map
      clients.delete(client.clientId);
      console.error('Client disconnected');
    });

    // Handle connection errors
    client.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Handle pong messages to keep track of connection
    client.on('pong', () => {
      client.isAlive = true;
    });

    // Send a welcome message
    client.send('Connected to CodeWeaver WebSocket Server');
  });

  // Set up interval to ping clients and clean up dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const client = ws as CodeWeaverWebSocket;
      
      if (client.isAlive === false) {
        clients.delete(client.clientId);
        return client.terminate();
      }
      
      client.isAlive = false;
      client.ping();
    });
  }, parsedConfig.pingInterval);

  // Clean up interval on server close
  wss.on('close', () => {
    clearInterval(interval);
  });

  // Log when server is started
  console.error(`WebSocket server is running on port ${port}`);

  return wss;
};

/**
 * Broadcast a message to all connected clients
 * @param message Message to broadcast
 * @param excludeClientId Optional ID of client to exclude
 * @returns Number of clients the message was sent to
 */
export function broadcast(message: string, excludeClientId?: string): number {
  if (!serverInstance) {
    throw new Error('Server not initialized. Call createWebSocketServer first.');
  }
  
  let count = 0;
  
  serverInstance.clients.forEach((ws) => {
    const client = ws as CodeWeaverWebSocket;
    
    // Skip excluded client if specified
    if (excludeClientId && client.clientId === excludeClientId) {
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
 * Get the number of currently connected clients
 * @returns Number of connected clients
 */
export function getClientCount(): number {
  return clients.size;
}

export default createWebSocketServer;