import baseConfig from '../../eslint.base.config.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  // Inherit the shared ESLint base configuration
  ...baseConfig,
  // Ignore coverage and build artifacts
  {
    ignores: ['coverage/**', 'dist/**', 'node_modules/**']
  },
  // Package-specific settings for source files
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: path.resolve(__dirname, 'tsconfig.eslint.json'),
      },
      globals: {
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        vscode: 'readonly',
        acquireVsCodeApi: 'readonly'
      }
    },
    rules: {
      // Relax some rules for a better dev experience
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'variableLike',
          format: ['camelCase', 'PascalCase'],
        }
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-throw-literal': 'warn',
      eqeqeq: 'warn',
      curly: 'warn',
      semi: ['warn', 'always'],
    },
  },
  // Test-specific overrides
  {
    files: ['tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        jest: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off'
    },
  },
];
