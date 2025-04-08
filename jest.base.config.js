/**
 * Base Jest configuration to be extended by each package
 */
export default {
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', {
      useESM: true,
    }],
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '@codeweaver/core/(.*)': '<rootDir>/../core/src/$1',
    '@codeweaver/core': '<rootDir>/../core/src'
  },
  coverageDirectory: '<rootDir>/coverage',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.[jt]s?(x)'],
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{ts,tsx}',
    '!<rootDir>/src/**/*.d.ts',
    '!<rootDir>/src/**/*.stories.{ts,tsx}',
    '!<rootDir>/src/**/index.{ts,tsx}'
  ],
  coverageReporters: ['text', 'lcov'],
  roots: ['<rootDir>/tests'],
};