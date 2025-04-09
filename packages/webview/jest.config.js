// packages/webview/jest.config.js
import baseConfig from '../../jest.base.config.js';

export default {
  ...baseConfig, // Inherit base settings FIRST
  displayName: 'webview', // Optional: Add display name for clarity in logs
  testEnvironment: 'jsdom', // Explicitly override the environment for this package
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper, // Keep base mappings
    // Add webview-specific mappings (CSS, assets)
    '\\.(css|less|scss|sass)$': '<rootDir>/../../shared/mocks/styleMock.ts', // Correct relative path
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/../../shared/mocks/styleMock.ts' // Correct relative path
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'], // Keep setup for jest-dom
  // REMOVE the redundant transform and extensionsToTreatAsEsm - they are inherited
};