import baseConfig from '../../jest.base.config.js';

export default {
  ...baseConfig,
  displayName: 'core',
  // Core package doesn't need to mock anything externally
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testEnvironment: 'node',
};