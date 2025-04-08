import baseConfig from '../../jest.base.config.js';

export default {
  ...baseConfig,
  displayName: 'websocket-client',
  testEnvironment: 'node',
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.tests.json'
      }
    ],
  },
};
