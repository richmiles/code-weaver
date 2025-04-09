// packages/websocket-server/tests/websocket.test.ts
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

  it('should accept connections and respond to messages', (done) => {
    server.start();
    
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
    server.start();
    
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
        server.broadcast('Broadcast test');
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

  it('should exclude client when broadcasting with exclusion', (done) => {
    server.start();
    
    // Connect two clients
    const client1 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    const client2 = new WebSocket(`ws://localhost:${TEST_PORT}`);
    
    // Set up the necessary tracking variables
    let client1Ready = false;
    let client2Ready = false;
    let testStarted = false;
    
    // Set up message tracking
    const client1Messages: string[] = [];
    const client2Messages: string[] = [];
    
    // Client 1 setup
    client1.on('open', () => {
      // Skip welcome message and mark as ready
      client1.once('message', () => {
        client1Ready = true;
        checkTestStart();
      });
    });
    
    // Record all messages received by client1
    client1.on('message', (data) => {
      const message = data.toString();
      client1Messages.push(message);
    });
    
    // Client 2 setup
    client2.on('open', () => {
      // Skip welcome message and mark as ready
      client2.once('message', () => {
        client2Ready = true;
        checkTestStart();
      });
    });
    
    // Record all messages received by client2
    client2.on('message', (data) => {
      const message = data.toString();
      client2Messages.push(message);
      
      // If this is the broadcast message, check results
      if (message === 'Exclusive broadcast' && testStarted) {
        // Give some time for any messages to arrive at client1
        setTimeout(() => {
          const client1ReceivedBroadcast = client1Messages.includes('Exclusive broadcast');
          const client2ReceivedBroadcast = client2Messages.includes('Exclusive broadcast');
          
          expect(client1ReceivedBroadcast).toBe(false);
          expect(client2ReceivedBroadcast).toBe(true);
          
          client1.close();
          client2.close();
          done();
        }, 100);
      }
    });
    
    // Handle errors
    client1.on('error', (err) => done(err));
    client2.on('error', (err) => done(err));
    
    // Check if both clients are ready to start the test
    function checkTestStart() {
      if (client1Ready && client2Ready && !testStarted) {
        testStarted = true;
        
        // Wait a moment for both connections to be fully established
        setTimeout(() => {
          // Get all client IDs from the server
          const clientIds = Array.from((server as any).clients.keys());
          
          // For this test, we'll exclude the first client (which should be client1)
          // We're using timeout to ensure the welcome message is fully processed
          server.broadcast('Exclusive broadcast', clientIds[0] as string);
        }, 100);
      }
    }
  });
  
  it('should handle server not started error', () => {
    // Don't start the server
    expect(() => {
      server.broadcast('This should fail');
    }).toThrow('Server not started');
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