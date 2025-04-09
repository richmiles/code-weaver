import baseConfig from '../../jest.base.config.js';

export default {
  ...baseConfig,
  displayName: 'vscode-extension',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        useESM: true,
        isolatedModules: true,
      },
    ],
  },
  // Merge base moduleNameMapper with an override for vscode
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '^vscode$': '<rootDir>/tests/__mocks__/vscode-mock.ts',
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,
};
