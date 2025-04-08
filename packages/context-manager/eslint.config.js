import baseConfig from '../../eslint.base.config.js';

export default [
  ...baseConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // Add or override rules for this package if necessary
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      // Perhaps relax certain rules in test files
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off'
    },
  },
];
