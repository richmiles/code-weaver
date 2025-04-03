// packages/vscode-extension/jest.config.js
/** @type {import('jest').Config} */
export default {
  displayName: 'vscode-extension',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

  transform: {
    // Match .ts, .tsx, .js, .jsx - ts-jest handles TS/TSX, babel/node handles JS/JSX if needed by deps
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        useESM: true, // <<<--- Keep this TRUE
        isolatedModules: true
      }
    ]
  },

  // Tell Jest these extensions are ESM
  extensionsToTreatAsEsm: ['.ts', '.tsx'],

  moduleNameMapper: {
    // When code imports 'vscode', Jest should use our mock file.
    // Crucially, the mock file MUST be resolved correctly relative to the rootDir.
    '^vscode$': '<rootDir>/tests/__mocks__/vscode-mock.ts',

    // ts-jest in ESM mode might add .js to relative imports, this handles it.
    // Make sure this pattern is specific enough not to catch node_modules accidentally.
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  clearMocks: true,
  restoreMocks: true,
  // Ensure Jest knows about .ts and .tsx files
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'], // Ignore dist directory
  // No moduleDirectories needed if moduleNameMapper is correct
  resetMocks: true
};