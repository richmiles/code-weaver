import baseConfig from '../../jest.base.config.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  ...baseConfig,
  displayName: 'browser-extension',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'], // ✅ Only tests here
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'],
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '^webextension-polyfill$': '<rootDir>/tests/__mocks__/webextension-polyfill.ts',
    '\\.(css|scss|sass|less)$': '<rootDir>/tests/__mocks__/styleMock.ts',
  },
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { useESM: true }],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!webextension-polyfill).+\\.js$',
  ],
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{ts,tsx}',
    '!<rootDir>/src/**/*.d.ts',
    '!<rootDir>/src/**/*.stories.{ts,tsx}',
    '!<rootDir>/src/**/index.{ts,tsx}'
  ],
};
