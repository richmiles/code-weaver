// tests/websocketClient/creation.test.ts
import { WebSocketClient, WebSocketClientOptions } from '../../src/websocketClient';

describe('WebSocketClient Creation', () => {
  it('should create a WebSocketClient instance with URL', () => {
    const url = 'ws://localhost:8080';
    const client = new WebSocketClient(url);
    
    // Verify client is an instance of WebSocketClient
    expect(client).toBeInstanceOf(WebSocketClient);
    
    // Verify client has a valid clientId
    const clientId = client.getClientId();
    expect(typeof clientId).toBe('string');
    expect(clientId.length).toBeGreaterThan(0);
  });

  it('should create a WebSocketClient with options', () => {
    const url = 'ws://localhost:8080';
    const onMessageMock = jest.fn();
    
    const options: WebSocketClientOptions = {
      events: {
        onMessage: onMessageMock
      }
    };
    
    const client = new WebSocketClient(url, options);
    
    // Verify client is an instance of WebSocketClient
    expect(client).toBeInstanceOf(WebSocketClient);
    
    // Verify client has a valid clientId
    const clientId = client.getClientId();
    expect(typeof clientId).toBe('string');
    expect(clientId.length).toBeGreaterThan(0);
  });

  it('should generate different client IDs for different instances', () => {
    const url = 'ws://localhost:8080';
    const client1 = new WebSocketClient(url);
    const client2 = new WebSocketClient(url);
    
    const clientId1 = client1.getClientId();
    const clientId2 = client2.getClientId();
    
    // Verify we have two different client IDs
    expect(clientId1).not.toBe(clientId2);
  });
});