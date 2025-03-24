// packages/browser-extension/tests/__mocks__/webextension-polyfill.ts

// Type definition for message handlers
type MessageHandler = (message: any, sender?: any) => Promise<any> | any;

// Store for different message handlers based on type
const messageHandlers: Record<string, MessageHandler> = {
  // Default handler for HELLO messages
  HELLO: (message) => {
    // Return different responses based on 'from' field
    const from = message.from || 'unknown';
    
    if (from === 'popup') {
      return Promise.resolve({ response: 'Hello popup! This is the background script.' });
    } else if (from === 'content-script') {
      return Promise.resolve({ response: 'Hello content script! This is the background script.' });
    } else {
      return Promise.resolve({ response: `Hello ${from}! This is the background script.` });
    }
  },
  
  // Example of another message type
  GET_DATA: (message) => {
    const dataType = message.dataType || 'default';
    
    // Simulate different data responses
    const responses: Record<string, any> = {
      'user': { userId: 123, name: 'Test User', role: 'admin' },
      'settings': { theme: 'dark', notifications: true, autoUpdate: false },
      'default': { status: 'success', message: 'Default data' }
    };
    
    return Promise.resolve(responses[dataType] || responses.default);
  },
  
  // Example of an error case
  ERROR_TEST: () => {
    return Promise.reject(new Error('Simulated error for testing'));
  }
};

// Define behavior for the runtime.sendMessage mock
const runtimeSendMessage: MessageHandler = (message) => {
  if (typeof message !== 'object' || message === null) {
    return Promise.reject(new Error('Invalid message format'));
  }
  
  const messageType = message.type;
  if (!messageType || typeof messageType !== 'string') {
    return Promise.reject(new Error('Message must have a type property'));
  }
  
  // Use the appropriate handler or return a default response
  const handler = messageHandlers[messageType];
  if (handler) {
    return handler(message);
  }
  
  return Promise.resolve({ response: 'Unknown message type' });
};

// Mock for tabs.sendMessage with similar behavior
const tabsSendMessage: MessageHandler = (tabId, message) => {
  // For testing, we can have the content script mock respond similarly
  if (typeof message !== 'object' || message === null) {
    return Promise.reject(new Error('Invalid message format'));
  }
  
  const messageType = message.type;
  if (!messageType || typeof messageType !== 'string') {
    return Promise.reject(new Error('Message must have a type property'));
  }
  
  // Content script would typically have different responses
  if (messageType === 'HELLO') {
    return Promise.resolve({ response: 'Hello from content script!' });
  }
  
  return Promise.resolve({ response: 'Content script received unknown message type' });
};

// Define storage data type for type safety
interface StorageData {
  theme: string;
  enabled: boolean;
  preferences: {
    autoSave: boolean;
    notifications: boolean;
  };
  [key: string]: any; // Add index signature for other potential keys
}

// Default storage data
const defaultStorageData: StorageData = {
  theme: 'light',
  enabled: true,
  preferences: { autoSave: true, notifications: true }
};

// Create the mock browser object
const browserMock = {
  runtime: {
    sendMessage: jest.fn().mockImplementation(runtimeSendMessage),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn().mockImplementation(() => {
      return Promise.resolve([{ id: 123, url: 'https://example.com' }]);
    }),
    sendMessage: jest.fn().mockImplementation(tabsSendMessage),
    onUpdated: {
      addListener: jest.fn(),
    },
  },
  storage: {
    sync: {
      get: jest.fn().mockImplementation((keys?: string | string[] | null) => {
        if (!keys) {
          return Promise.resolve({...defaultStorageData});
        }
        
        if (typeof keys === 'string') {
          const key = keys as keyof typeof defaultStorageData;
          // Check if the key exists in our defaults
          if (key in defaultStorageData) {
            return Promise.resolve({ [key]: defaultStorageData[key] });
          }
          return Promise.resolve({});
        }
        
        if (Array.isArray(keys)) {
          const result: Partial<StorageData> = {};
          keys.forEach(key => {
            const typedKey = key as keyof typeof defaultStorageData;
            if (typedKey in defaultStorageData) {
              result[typedKey] = defaultStorageData[typedKey];
            }
          });
          return Promise.resolve(result);
        }
        
        return Promise.resolve({...defaultStorageData});
      }),
      set: jest.fn().mockImplementation((items) => Promise.resolve()),
      remove: jest.fn().mockImplementation((keys) => Promise.resolve()),
      clear: jest.fn().mockImplementation(() => Promise.resolve()),
    },
    local: {
      get: jest.fn().mockImplementation(() => Promise.resolve({})),
      set: jest.fn().mockImplementation(() => Promise.resolve()),
      remove: jest.fn().mockImplementation(() => Promise.resolve()),
      clear: jest.fn().mockImplementation(() => Promise.resolve()),
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }
  },
  
  // Mock API to help with testing
  __mockReset: () => {
    Object.values(browserMock).forEach(namespace => {
      Object.values(namespace).forEach(method => {
        if (jest.isMockFunction(method)) {
          method.mockClear();
        }
      });
    });
  },
  
  // Helper to register custom message handlers for testing
  __registerMessageHandler: (type: string, handler: MessageHandler) => {
    messageHandlers[type] = handler;
  }
};

export default browserMock;