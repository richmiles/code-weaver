import type { Memento, Uri } from 'vscode';

// Create a dummy Memento that satisfies the official interface.
// Notice that 'keys' is now a function returning an empty readonly string array.
const emptyMemento: Memento = {
  get: <T>(_key: string, _defaultValue?: T): T | undefined => undefined,
  update: (_key: string, _value: any): Promise<void> => Promise.resolve(),
  keys: () => [] as readonly string[],
};

export const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn(),
};

export const window = {
  showInformationMessage: jest.fn(),
};

export class ExtensionContext {
  public subscriptions: { dispose(): any }[] = [];
  public workspaceState: Memento = emptyMemento;
  public globalState: Memento & { setKeysForSync(_keys: readonly string[]): void } =
    Object.assign({}, emptyMemento, {
      setKeysForSync: (_keys: readonly string[]) => {
        // Dummy implementation.
      },
    });
  public extensionUri: Uri = { fsPath: '' } as Uri;
  public extensionPath: string = '';
  
  asAbsolutePath(relativePath: string): string {
    return relativePath;
  }
}

module.exports = {
  commands,
  window,
  ExtensionContext,
};
