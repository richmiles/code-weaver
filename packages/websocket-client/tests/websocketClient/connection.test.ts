// tests/websocketClient/connection.test.ts
import { Server } from 'mock-socket';
import { WebSocketClient } from '../../src/websocketClient';

describe('WebSocketClient Connection', () => {
  const serverUrl = 'ws://localhost:8080';
  
  it('should connect successfully', async () => {
    // Create a mock WebSocket server for this test
    const mockServer = new Server(serverUrl);
    
    // Create a client
    const client = new WebSocketClient(serverUrl);
    
    // Set up the mock server to accept connections
    let connectionEstablished = false;
    mockServer.on('connection', () => {
      connectionEstablished = true;
    });
    
    try {
      // Connect to the server
      await client.connect();
      
      // Verify the connection is active from the client perspective
      expect(client.isActive()).toBe(true);
      
      // Verify the connection was established from the server perspective
      expect(connectionEstablished).toBe(true);
    } finally {
      // Close the mock server after the test
      mockServer.close();
    }
  });

  it('should handle connection errors', async () => {
    // Create a client (no server running for this test)
    const client = new WebSocketClient('ws://non-existent-server:9999');
    
    // Expect the promise to reject with an error when no server is available
    await expect(client.connect()).rejects.toBeTruthy();
    
    // After rejection, the client should not be active
    expect(client.isActive()).toBe(false);
  });
  
  it('should handle connection timeout', async () => {
    // Create a client
    const client = new WebSocketClient(serverUrl);
    
    // Mock WebSocket implementation for this test to force timeout behavior
    // @ts-ignore - Mocking the global WebSocket
    global.WebSocket = class MockWebSocket {
      constructor(_url: string) {
        // Don't call onopen - this simulates a connection that never completes
        setTimeout(() => {
          // Do nothing - this keeps the connection pending
        }, 10);
      }
      
      close() {}
    };
    
    // Store the original WebSocket class
    const OriginalWebSocket = global.WebSocket;
    
    try {
      // Attempt to connect with a short timeout
      const connectPromise = client.connect({ timeout: 50 });
      await expect(connectPromise).rejects.toThrow('Connection timeout');
      
      // After timeout, the client should not be active
      expect(client.isActive()).toBe(false);
    } finally {
      // Restore the original WebSocket implementation
      // @ts-ignore - Restoring the global WebSocket
      global.WebSocket = OriginalWebSocket;
    }
  });
});