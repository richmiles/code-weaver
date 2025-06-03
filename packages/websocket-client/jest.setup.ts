// Ensure all timers are cleaned up after tests
afterAll(() => {
  // Force clear all timers
  jest.clearAllTimers();
});

// Increase timeout for connection tests
jest.setTimeout(10000);