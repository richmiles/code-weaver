// This file is run before each test file

// Set timeout for tests
jest.setTimeout(15000);

// Reset mocks after each test
afterEach(() => {
  jest.resetAllMocks();
});