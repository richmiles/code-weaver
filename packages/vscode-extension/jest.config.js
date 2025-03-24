import baseConfig from '../../jest.base.config.js';

/** @type {import('jest').Config} */
export default {
  ...baseConfig,
  displayName: 'vscode-extension',
  // Override the test environment to use node
  testEnvironment: 'node',
  // Setup script to run before tests
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // We need to adjust paths for the VS Code extension
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '^vscode$': '<rootDir>/tests/__mocks__/vscode-mock.ts',
  },
  // Run TypeScript tests directly
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { 
      useESM: true 
    }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!vscode).+\\.js$',
  ],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
};