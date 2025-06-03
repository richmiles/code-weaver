import baseConfig from '../../jest.base.config.js';

export default {
  ...baseConfig,
  displayName: 'websocket-client',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.tests.json'
      }
    ],
  },
};
