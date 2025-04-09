// packages/vscode-extension/tests/setup.ts

// Set Jest timeout
jest.setTimeout(10000);

// Silence console.log during tests to clean up the output
// Only console.error will be shown
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  error: console.error, // Keep error messages visible
  debug: jest.fn(),
};

// If you need to see specific console output for debugging, uncomment this:
// console.log = console.error;