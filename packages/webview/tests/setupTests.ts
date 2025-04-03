import '@testing-library/jest-dom';

// Declare global acquireVsCodeApi function
declare global {
  interface Window {
    acquireVsCodeApi: () => {
      postMessage: (message: any) => void;
      getState: () => any;
      setState: (state: any) => void;
    };
  }
  
  // For Node.js environment in tests
  namespace NodeJS {
    interface Global {
      acquireVsCodeApi: jest.Mock;
    }
  }
}

// Mock the acquireVsCodeApi function
(global as any).acquireVsCodeApi = jest.fn(() => ({
  postMessage: jest.fn(),
  getState: jest.fn(),
  setState: jest.fn()
}));