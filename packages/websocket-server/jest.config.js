import baseConfig from '../../jest.base.config.js';

export default {
  ...baseConfig,
  displayName: 'websocket-server',
  testEnvironment: 'node',
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '@codeweaver/context-manager/(.*)': '<rootDir>/../context-manager/src/$1',
    '@codeweaver/context-manager': '<rootDir>/../context-manager/src'
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.tests.json',
        useESM: true
      }
    ],
  },
};
