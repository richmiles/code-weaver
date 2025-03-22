import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config({
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
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
    }],
    'import/order': ['warn', { 
      alphabetize: { order: 'asc' }, 
      groups: ['builtin', 'external', 'internal', ['sibling', 'parent']] 
    }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'curly': 'warn',
    'eqeqeq': 'warn',
    'semi': ['warn', 'always'],
    'no-throw-literal': 'warn',
  },
});
