import baseConfig from '../../jest.base.config.js';

export default {
  ...baseConfig,
  displayName: 'mcp-server',
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