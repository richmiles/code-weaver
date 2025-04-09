// packages/webview/jest.config.js
import baseConfig from '../../jest.base.config.js';

export default {
  ...baseConfig,
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '^webextension-polyfill$': '<rootDir>/tests/__mocks__/webextension-polyfill.ts',
    '\\.(css|less|scss|sass)$': '<rootDir>/../../shared/mocks/styleMock.ts', 
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/../../shared/mocks/styleMock.ts'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts']
};