// packages/websocket-server/tests/websocket.test.ts
import { MessageType, SourceType } from '@codeweaver/core';
import { WebSocket } from 'ws';
import { WebSocketServer } from '../src/websocketServer';

describe('WebSocketServer', () => {
  let server: WebSocketServer;
  const TEST_PORT = 9090;
  
  beforeEach(() => {
    server = new WebSocketServer({ port: TEST_PORT });
  });
  
  afterEach(() => {
    server.stop();
  });

  it('should start and stop correctly', () => {
    // Start server
    server.start();
    expect(server.isRunning()).toBe(true);
    
    // Stop server
    server.stop();
    expect(server.isRunning()).toBe(false);
  });

  it('should accept connections and send welcome message', (done) => {
    server.start();
    
    // Create a client to test the connection
    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    // Setup event handlers
    client.on('open', () => {
      // Wait for welcome message
    });
    
    client.on('message', (data) => {
      const response = JSON.parse(data.toString());
      
      // Check welcome message
      expect(response.id).toBe('welcome');
      expect(response.success).toBe(true);
      expect(response.data.message).toBe('Connected to CodeWeaver WebSocket Server');
      expect(response.data.clientId).toBeDefined();
      
      // Close the connection
      client.close();
      done();
    });
    
    client.on('error', (err) => {
      done(err);
    });
  });

  it('should handle GET_SOURCES message', (done) => {
    server.start();
    
    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    client.on('open', () => {
      // Skip welcome message
      client.once('message', () => {
        // Send GET_SOURCES message
        const message = {
          type: MessageType.GET_SOURCES,
          id: 'test-1',
          timestamp: new Date()
        };
        
        client.send(JSON.stringify(message));
        
        // Listen for response
        client.on('message', (data) => {
          const response = JSON.parse(data.toString());
          
          expect(response.id).toBe('test-1');
          expect(response.success).toBe(true);
          expect(Array.isArray(response.data)).toBe(true);
          expect(response.data.length).toBe(0); // Initially empty
          
          client.close();
          done();
        });
      });
    });
    
    client.on('error', (err) => done(err));
  });

  it('should handle ADD_SOURCE message', (done) => {
    server.start();
    
    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    client.on('open', () => {
      // Skip welcome message
      client.once('message', () => {
        // Send ADD_SOURCE message
        const sourceData = {
          type: SourceType.FILE,
          name: 'test.js',
          filePath: 'test.js'
        };
        
        const message = {
          type: MessageType.ADD_SOURCE,
          id: 'test-add',
          timestamp: new Date(),
          payload: sourceData
        };
        
        client.send(JSON.stringify(message));
        
        // Listen for response
        client.on('message', (data) => {
          const response = JSON.parse(data.toString());
          
          expect(response.id).toBe('test-add');
          expect(response.success).toBe(true);
          expect(response.data.sourceId).toBeDefined();
          expect(response.data.source).toBeDefined();
          expect(response.data.source.type).toBe(SourceType.FILE);
          expect(response.data.source.name).toBe('test.js');
          
          client.close();
          done();
        });
      });
    });
    
    client.on('error', (err) => done(err));
  });

  it('should handle invalid JSON message', (done) => {
    server.start();
    
    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    client.on('open', () => {
      // Skip welcome message
      client.once('message', () => {
        // Send invalid JSON
        client.send('invalid json');
        
        // Listen for error response
        client.on('message', (data) => {
          const response = JSON.parse(data.toString());
          
          expect(response.id).toBe('unknown');
          expect(response.success).toBe(false);
          expect(response.error).toBe('Invalid JSON message format');
          
          client.close();
          done();
        });
      });
    });
    
    client.on('error', (err) => done(err));
  });

  it('should track client connections correctly', (done) => {
    server.start();
    
    // Initially there should be no clients
    expect(server.getClientCount()).toBe(0);
    
    // Connect a client
    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    // Wait for connection to establish
    client.on('open', () => {
      // Skip the welcome message
      client.once('message', () => {
        // Now check the client count after connection is fully established
        setTimeout(() => {
          // Should have 1 connected client
          expect(server.getClientCount()).toBe(1);
          
          // Disconnect the client
          client.close();
          
          // Give it time to disconnect
          setTimeout(() => {
            // Should have 0 connected clients
            expect(server.getClientCount()).toBe(0);
            done();
          }, 100);
        }, 100);
      });
    });
    
    client.on('error', (err) => done(err));
  });

  it('should handle event subscription and broadcasting', (done) => {
    server.start();
    
    // Connect two clients
    const client1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    const client2 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    let client1Ready = false;
    let client2Ready = false;
    let eventReceived = false;
    
    // Client 1 - will subscribe to events
    client1.on('open', () => {
      client1.once('message', () => {
        // Subscribe to events
        const subscribeMessage = {
          type: MessageType.SUBSCRIBE_EVENTS,
          id: 'subscribe-1',
          timestamp: new Date()
        };
        
        client1.send(JSON.stringify(subscribeMessage));
        
        client1.on('message', (data) => {
          const response = JSON.parse(data.toString());
          
          if (response.id === 'subscribe-1') {
            expect(response.success).toBe(true);
            client1Ready = true;
            checkAddSource();
          } else if (response.type === MessageType.EVENT && !eventReceived) {
            // This should be the event broadcast
            eventReceived = true;
            expect(response.payload).toBeDefined();
            expect(response.payload.type).toBe('source_added');
            
            client1.close();
            client2.close();
            done();
          }
        });
      });
    });
    
    // Client 2 - will add a source to trigger event
    client2.on('open', () => {
      client2.once('message', () => {
        client2Ready = true;
        checkAddSource();
      });
    });
    
    function checkAddSource() {
      if (client1Ready && client2Ready) {
        // Add a source from client2 to trigger event
        const sourceData = {
          type: SourceType.FILE,
          name: 'broadcast-test.js',
          filePath: 'broadcast-test.js'
        };
        
        const message = {
          type: MessageType.ADD_SOURCE,
          id: 'test-broadcast',
          timestamp: new Date(),
          payload: sourceData
        };
        
        client2.send(JSON.stringify(message));
      }
    }
    
    // Handle errors
    client1.on('error', (err) => done(err));
    client2.on('error', (err) => done(err));
  });

  it('should handle ping/pong for connection health', (done) => {
    // Create server with a bit longer ping interval to avoid test flakiness
    const pingServer = new WebSocketServer({
      port: TEST_PORT,
      pingInterval: 200 // Short, but not too short for testing
    });
    
    pingServer.start();
    
    // Connect a client
    const client = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    client.on('open', () => {
      // Skip welcome message
      client.once('message', () => {
        // Wait for the client to be registered
        setTimeout(() => {
          expect(pingServer.getClientCount()).toBe(1);
          
          // Mock client's isAlive to false to simulate a non-responsive client
          const clients = (pingServer as any).clients;
          const clientId = Array.from(clients.keys())[0];
          const wsClient = clients.get(clientId);
          
          // Set isAlive to false to simulate a dead connection
          wsClient.isAlive = false;
          
          // Wait for ping interval to detect and remove dead client
          // We're using 2.5x the ping interval to ensure the interval has run
          setTimeout(() => {
            expect(pingServer.getClientCount()).toBe(0);
            
            pingServer.stop();
            done();
          }, 500); // Ensure we wait long enough
        }, 100);
      });
    });
    
    client.on('error', (err) => {
      pingServer.stop();
      done(err);
    });
  });
});