// jest.base.config.js
const config = {
  preset: 'ts-jest/presets/js-with-ts-esm',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '@codeweaver/core/(.*)': '<rootDir>/../core/src/$1',
    '@codeweaver/core': '<rootDir>/../core/src'
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: '<rootDir>/tsconfig.tests.json',
    }]
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testMatch: ['**/tests/**/*.test.[jt]s?(x)'],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov'],
  roots: ['<rootDir>/tests'],
};

export default config;