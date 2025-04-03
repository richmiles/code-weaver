// packages/vscode-extension/tests/__mocks__/fs.ts
import { jest } from '@jest/globals';

// Mock file system functions
export const readdirSync = jest.fn().mockReturnValue(['main.1234.js', 'style.1234.css']);
export const existsSync = jest.fn().mockReturnValue(true);
export const readFileSync = jest.fn().mockReturnValue('mock file content');
export const statSync = jest.fn().mockReturnValue({
  isFile: () => true,
  isDirectory: () => false
});