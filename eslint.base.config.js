import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config({
  ignores: ['dist/**'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      project: true,
    },
  },
  plugins: {
    '@typescript-eslint': tseslint.plugin,
    'import': importPlugin,
  },
  rules: {
    // TypeScript-specific rules
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    // Import order enforcement
    'import/order': ['error', { 
      alphabetize: { order: 'asc' }, 
      groups: ['builtin', 'external', 'internal', ['sibling', 'parent']] 
    }],
    // Console usage restrictions
    'no-console': ['error', { allow: ['warn', 'error'] }],
    // Enforcing block braces for clarity
    'curly': 'error',
    // Enforcing strict equality
    'eqeqeq': 'error',
    // Semicolon enforcement
    'semi': ['error', 'always'],
    // Prevent throwing literals
    'no-throw-literal': 'error',
    // Additional strict rules:
    'no-debugger': 'error',
    'no-var': 'error',
    'prefer-const': 'error',
  },
});
