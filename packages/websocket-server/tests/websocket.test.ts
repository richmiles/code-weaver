// packages/websocket-server/tests/websocket.test.ts
import { WebSocketServer } from 'ws';
import { WebSocket } from 'ws';
import { createWebSocketServer, getClientCount, broadcast, clearClients } from '../src/index';

describe('WebSocket Server', () => {
  let server: WebSocketServer;
  const TEST_PORT = 9090;
  
  beforeEach(() => {
    // Clear clients before each test
    clearClients();
    server = createWebSocketServer({ port: TEST_PORT });
  });
  
  afterEach((done) => {
    server.close(() => {
      clearClients(); // Also clear clients after each test
      done();
    });
  });

  it('should accept connections and respond to messages', (done) => {
    // Create a client to test the connection
    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    // Setup event handlers
    client.on('open', () => {
      // Send a test message
      client.send('Hello Server');
    });
    
    // Track received messages
    const messages: string[] = [];
    
    client.on('message', (data) => {
      messages.push(data.toString());
      
      // Check if we've received both expected messages
      if (messages.length === 2) {
        // Check welcome message
        expect(messages[0]).toBe('Connected to CodeWeaver WebSocket Server');
        // Check echo response
        expect(messages[1]).toBe('Echo: Hello Server');
        
        // Close the connection
        client.close();
        done();
      }
    });
    
    client.on('error', (err) => {
      done(err);
    });
  });

  it('should broadcast messages to all clients', (done) => {
    // Connect two clients
    const client1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    const client2 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    let client1Ready = false;
    let client2Ready = false;
    let broadcastSent = false;
    
    // Wait for both to be ready
    function checkBroadcast() {
      if (client1Ready && client2Ready && !broadcastSent) {
        broadcastSent = true;
        // Broadcast a message
        broadcast('Broadcast test');
      }
    }
    
    // Client 1 setup
    let client1ReceivedBroadcast = false;
    client1.on('open', () => {
      // Skip welcome message
      client1.once('message', () => {
        client1Ready = true;
        checkBroadcast();
        
        // Listen for broadcast
        client1.on('message', (data) => {
          if (data.toString() === 'Broadcast test') {
            client1ReceivedBroadcast = true;
            checkComplete();
          }
        });
      });
    });
    
    // Client 2 setup
    let client2ReceivedBroadcast = false;
    client2.on('open', () => {
      // Skip welcome message
      client2.once('message', () => {
        client2Ready = true;
        checkBroadcast();
        
        // Listen for broadcast
        client2.on('message', (data) => {
          if (data.toString() === 'Broadcast test') {
            client2ReceivedBroadcast = true;
            checkComplete();
          }
        });
      });
    });
    
    function checkComplete() {
      if (client1ReceivedBroadcast && client2ReceivedBroadcast) {
        client1.close();
        client2.close();
        done();
      }
    }
    
    // Handle errors
    client1.on('error', (err) => done(err));
    client2.on('error', (err) => done(err));
  });  
  
  it('should track client connections correctly', (done) => {
    // Initially there should be no clients
    expect(getClientCount()).toBe(0);
    
    // Connect a client
    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    // We need to wait for the connection to establish and be registered
    client.on('open', () => {
      // Skip the welcome message
      client.once('message', () => {
        // Now check the client count after connection is fully established
        setTimeout(() => {
          // Should have 1 connected client
          expect(getClientCount()).toBe(1);
          
          // Disconnect the client
          client.close();
          
          // Give it time to disconnect
          setTimeout(() => {
            // Should have 0 connected clients
            expect(getClientCount()).toBe(0);
            done();
          }, 100);
        }, 100);
      });
    });
    
    client.on('error', (err) => done(err));
  });
});