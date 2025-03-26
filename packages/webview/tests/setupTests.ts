import '@testing-library/jest-dom';

// Mock the acquireVsCodeApi function
global.acquireVsCodeApi = jest.fn(() => ({
  postMessage: jest.fn(),
  getState: jest.fn(),
  setState: jest.fn()
}));