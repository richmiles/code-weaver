// This is a TypeScript mock for the vscode module
// Add any VS Code API functions you need to mock here

export const window = {
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  showWarningMessage: jest.fn(),
  createOutputChannel: jest.fn(() => ({
    appendLine: jest.fn(),
    show: jest.fn(),
    clear: jest.fn(),
  })),
};

export const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn(),
};

export const workspace = {
  getConfiguration: jest.fn(() => ({
    get: jest.fn(),
    update: jest.fn(),
    has: jest.fn(),
  })),
  workspaceFolders: [],
};

export const extensions = {
  getExtension: jest.fn(),
};

export class ExtensionContext {
  subscriptions: any[] = [];
  workspaceState = {
    get: jest.fn(),
    update: jest.fn(),
  };
  globalState = {
    get: jest.fn(),
    update: jest.fn(),
  };
  extensionPath: string = '/test/extension/path';
  extensionUri = { fsPath: '/test/extension/path' };
  storageUri = { fsPath: '/test/storage/path' };
  globalStorageUri = { fsPath: '/test/global-storage/path' };
  logUri = { fsPath: '/test/log/path' };
  extensionMode: number = 1; // ExtensionMode.Development
}

export const Uri = {
  file: jest.fn((path: string) => ({ fsPath: path })),
  parse: jest.fn(),
};