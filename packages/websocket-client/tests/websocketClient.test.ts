// packages/websocket-client/tests/websocketClient.test.ts
import WebSocket from 'ws';
import { WebSocketClient } from '../src/websocketClient';

// Mock the WebSocket class
jest.mock('ws');

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  let mockWebSocket: jest.Mocked<WebSocket>;
  
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup WebSocket mock
    mockWebSocket = {
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send: jest.fn(),
      close: jest.fn(),
      ping: jest.fn(),
    } as unknown as jest.Mocked<WebSocket>;
    
    // Make the WebSocket constructor return our mock
    (WebSocket as unknown as jest.Mock).mockImplementation(() => mockWebSocket);
    
    // Create a new client for each test
    client = new WebSocketClient('ws://localhost:8080');
  });

  it('should create a WebSocketClient instance', () => {
    expect(client).toBeInstanceOf(WebSocketClient);
  });

  it('should connect to the WebSocket server', async () => {
    const connectPromise = client.connect();
    
    // Simulate the socket connection opening
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen({} as WebSocket.Event);
    }
    
    await connectPromise;
    
    expect(WebSocket).toHaveBeenCalledWith('ws://localhost:8080');
    expect(client.isActive()).toBe(true);
  });

  it('should handle connection errors', async () => {
    const connectPromise = client.connect();
    
    // Simulate an error
    if (mockWebSocket.onerror) {
      mockWebSocket.onerror({ message: 'Connection failed' } as WebSocket.ErrorEvent);
    }
    
    await expect(connectPromise).rejects.toThrow('WebSocket error');
    expect(client.isActive()).toBe(false);
  });

  it('should send data when connected', async () => {
    const connectPromise = client.connect();
    
    // Simulate the socket connection opening
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen({} as WebSocket.Event);
    }
    
    await connectPromise;
    
    const message = 'Hello, WebSocket!';
    const result = client.send(message);
    
    expect(result).toBe(true);
    expect(mockWebSocket.send).toHaveBeenCalledWith(message);
  });

  it('should not send data when not connected', () => {
    const result = client.send('Test Message');
    
    expect(result).toBe(false);
    expect(mockWebSocket.send).not.toHaveBeenCalled();
  });

  it('should disconnect from the WebSocket server', async () => {
    const connectPromise = client.connect();
    
    // Simulate the socket connection opening
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen({} as WebSocket.Event);
    }
    
    await connectPromise;
    
    client.disconnect(1000, 'Normal closure');
    
    expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Normal closure');
    expect(client.isActive()).toBe(false);
  });

  it('should call the onMessage callback when receiving a message', async () => {
    const onMessageMock = jest.fn();
    
    client = new WebSocketClient('ws://localhost:8080', {
      events: {
        onMessage: onMessageMock
      }
    });
    
    const connectPromise = client.connect();
    
    // Simulate the socket connection opening
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen({} as WebSocket.Event);
    }
    
    await connectPromise;
    
    // Simulate receiving a message
    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage({ data: 'Received message' } as WebSocket.MessageEvent);
    }
    
    expect(onMessageMock).toHaveBeenCalledWith('Received message');
  });

  it('should send ping messages at the configured interval', async () => {
    jest.useFakeTimers();
    
    client = new WebSocketClient('ws://localhost:8080', {
      pingInterval: 5000
    });
    
    const connectPromise = client.connect();
    
    // Simulate the socket connection opening
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen({} as WebSocket.Event);
    }
    
    await connectPromise;
    
    // Fast-forward time
    jest.advanceTimersByTime(5000);
    
    expect(mockWebSocket.ping).toHaveBeenCalled();
    
    // Clean up
    jest.useRealTimers();
  });

  it('should attempt to reconnect when connection closes abnormally', async () => {
    // Add a test timeout for this specific test
    jest.setTimeout(10000);
    
    // Add debug logs
    console.log('Starting reconnection test');
    
    jest.useFakeTimers();
    
    client = new WebSocketClient('ws://localhost:8080', {
      autoReconnect: true,
      reconnectInterval: 1000
    });
    
    console.log('Connecting client...');
    const connectPromise = client.connect();
    
    // Simulate the socket connection opening
    if (mockWebSocket.onopen) {
      console.log('Simulating socket open');
      mockWebSocket.onopen({} as WebSocket.Event);
    }
    
    await connectPromise;
    console.log('Initial connection established');
    
    // Reset the mock to track new calls
    (WebSocket as unknown as jest.Mock).mockClear();
    
    // Simulate connection closing abnormally
    if (mockWebSocket.onclose) {
      console.log('Simulating socket close');
      mockWebSocket.onclose({ code: 1006 } as WebSocket.CloseEvent);
    }
    
    console.log('Advancing timer by 1000ms');
    jest.advanceTimersByTime(1000);
    
    // Add a small delay to let any promises resolve
    await Promise.resolve();
    console.log('Timer advanced, checking reconnection');
    
    expect(WebSocket).toHaveBeenCalledTimes(1);
    console.log('Test completed successfully');
    
    // Clean up
    jest.useRealTimers();
  });

  it('should not attempt to reconnect when connection closes normally', async () => {
    jest.useFakeTimers();
    
    client = new WebSocketClient('ws://localhost:8080', {
      autoReconnect: true,
      reconnectInterval: 1000
    });
    
    const connectPromise = client.connect();
    
    // Simulate the socket connection opening
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen({} as WebSocket.Event);
    }
    
    await connectPromise;
    
    // Reset the mock to track new calls
    (WebSocket as unknown as jest.Mock).mockClear();
    
    // Simulate connection closing normally
    if (mockWebSocket.onclose) {
      mockWebSocket.onclose({ code: 1000 } as WebSocket.CloseEvent);
    }
    
    // Fast-forward time
    jest.advanceTimersByTime(1000);
    
    expect(WebSocket).not.toHaveBeenCalled();
    
    // Clean up
    jest.useRealTimers();
  });

  it('should stop reconnecting after reaching the maximum attempts', async () => {
    jest.useFakeTimers();
    
    client = new WebSocketClient('ws://localhost:8080', {
      autoReconnect: true,
      reconnectInterval: 1000,
      maxReconnectAttempts: 3
    });
    
    const connectPromise = client.connect();
    
    // Simulate the socket connection opening
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen({} as WebSocket.Event);
    }
    
    await connectPromise;
    
    // Set up the mock for reconnection attempts
    (WebSocket as unknown as jest.Mock).mockImplementation(() => {
      // Return a new mock for each reconnection
      const reconnectMock = {
        onopen: null,
        onclose: null,
        onerror: null
      } as unknown as jest.Mocked<WebSocket>;
      
      // Simulate connection failures
      setTimeout(() => {
        if (reconnectMock.onclose) {
          reconnectMock.onclose({ code: 1006 } as WebSocket.CloseEvent);
        }
      }, 100);
      
      return reconnectMock;
    });
    
    // Simulate first connection closing abnormally
    if (mockWebSocket.onclose) {
      mockWebSocket.onclose({ code: 1006 } as WebSocket.CloseEvent);
    }
    
    // Reset the mock to track new calls
    (WebSocket as unknown as jest.Mock).mockClear();
    
    // Fast-forward time for all reconnection attempts
    for (let i = 0; i < 3; i++) {
      jest.advanceTimersByTime(1000);
      await new Promise(resolve => setTimeout(resolve, 10)); // Allow event loop to process
    }
    
    // Should have tried to reconnect 3 times
    expect(WebSocket).toHaveBeenCalledTimes(3);
    
    // Fast-forward one more time - should not try again
    (WebSocket as unknown as jest.Mock).mockClear();
    jest.advanceTimersByTime(1000);
    
    expect(WebSocket).not.toHaveBeenCalled();
    
    // Clean up
    jest.useRealTimers();
  });
});