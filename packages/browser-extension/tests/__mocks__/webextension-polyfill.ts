const browser = {
    runtime: {
      sendMessage: jest.fn(async (msg) => {
        if (msg?.type === 'HELLO') {
          return { response: 'Hello popup! This is the background script.' };
        }
        return { response: 'Unknown message type' };
      }),
      onMessage: {
        addListener: jest.fn(),
      },
      onInstalled: {
        addListener: jest.fn(),
      },
    },
    tabs: {
      query: jest.fn(async () => [{ id: 123 }]),
      sendMessage: jest.fn(async (tabId, msg) => {
        if (msg?.type === 'HELLO') {
          return { response: 'Hello from content script!' };
        }
        return { response: 'Unknown message type' };
      }),
    },
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
      },
    },
  };
  
  export default browser;
  