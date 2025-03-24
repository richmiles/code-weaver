export default {
    runtime: {
      sendMessage: jest.fn(() => Promise.resolve({ response: 'Mocked response' })),
      onMessage: {
        addListener: jest.fn(),
      },
      onInstalled: {
        addListener: jest.fn(),
      },
    },
    tabs: {
      query: jest.fn(() => Promise.resolve([{ id: 123 }])),
      sendMessage: jest.fn(() => Promise.resolve({ response: 'Mocked content response' })),
    },
    storage: {
      sync: {
        get: jest.fn(() => Promise.resolve({ enabled: true, theme: 'light' })),
        set: jest.fn(() => Promise.resolve()),
      },
    },
  };
  