// tests/__mocks__/vscode.ts
import type { Memento, Uri, SecretStorage, ExtensionMode, LogOutputChannel, ProgressLocation, CancellationToken, Event, LogLevel, Extension, LanguageModelAccessInformation, SecretStorageChangeEvent, GlobalEnvironmentVariableCollection, EnvironmentVariableCollection, EnvironmentVariableScope, Disposable } from 'vscode';

// Create a dummy Memento that satisfies the official interface.
const emptyMemento: Memento = {
  get: <T>(_key: string, _defaultValue?: T): T | undefined => undefined,
  update: (_key: string, _value: any): Promise<void> => Promise.resolve(),
  keys: () => [] as readonly string[],
};

// Proper implementation of Event
function createEvent<T>(): Event<T> {
  return function(_listener: (e: T) => any, _thisArgs?: any, _disposables?: Disposable[]): Disposable {
    return { dispose: () => {} };
  };
}

// Define ExtensionKind as value (not just a type)
const ExtensionKind = {
  UI: 1,
  Workspace: 2
};

// Mock for SecretStorage
class MockSecretStorage implements SecretStorage {
  onDidChange: Event<SecretStorageChangeEvent> = createEvent<SecretStorageChangeEvent>();
  
  get(_key: string): Thenable<string | undefined> {
    return Promise.resolve(undefined);
  }
  
  store(_key: string, _value: string): Thenable<void> {
    return Promise.resolve();
  }
  
  delete(_key: string): Thenable<void> {
    return Promise.resolve();
  }
}

// Mock for LogOutputChannel
class MockLogOutputChannel implements LogOutputChannel {
  name: string = 'Mock Log';
  logLevel: LogLevel = 0; // Off
  onDidChangeLogLevel: Event<LogLevel> = createEvent<LogLevel>();
  
  append(_value: string): void {}
  appendLine(_value: string): void {}
  clear(): void {}
  show(_preserveFocus?: boolean): void;
  show(_column?: any, _preserveFocus?: boolean): void;
  show(_columnOrPreserveFocus?: any, _preserveFocus?: boolean): void {}
  hide(): void {}
  dispose(): void {}
  replace(_value: string): void {}
  trace(_message: string, ..._args: any[]): void {}
  debug(_message: string, ..._args: any[]): void {}
  info(_message: string, ..._args: any[]): void {}
  warn(_message: string, ..._args: any[]): void {}
  error(_message: string | Error, ..._args: any[]): void {}
}

export const commands = {
  registerCommand: jest.fn(),
  executeCommand: jest.fn(),
};

export const window = {
  showInformationMessage: jest.fn(),
  withProgress: jest.fn((_options: { location: ProgressLocation; title?: string; cancellable?: boolean }, 
                         _task: (progress: any, token: CancellationToken) => Thenable<any>) => Promise.resolve()),
};

// Mock for EnvironmentVariableCollection
class MockEnvironmentVariableCollection implements EnvironmentVariableCollection {
  persistent: boolean = false;
  description: string | undefined = undefined;
  
  replace = jest.fn();
  append = jest.fn();
  prepend = jest.fn();
  get = jest.fn();
  forEach = jest.fn();
  delete = jest.fn();
  clear = jest.fn();
  
  *[Symbol.iterator]() {
    // Empty iterator implementation
  }
}

// Mock for GlobalEnvironmentVariableCollection
class MockGlobalEnvironmentVariableCollection implements GlobalEnvironmentVariableCollection {
  persistent: boolean = false;
  description: string | undefined = undefined;
  
  replace = jest.fn();
  append = jest.fn();
  prepend = jest.fn();
  get = jest.fn();
  forEach = jest.fn();
  delete = jest.fn();
  clear = jest.fn();
  
  getScoped(_scope: EnvironmentVariableScope): EnvironmentVariableCollection {
    return new MockEnvironmentVariableCollection();
  }
  
  *[Symbol.iterator]() {
    // Empty iterator implementation
  }
}

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
  
  // Add the missing properties
  public secrets: SecretStorage = new MockSecretStorage();
  public environmentVariableCollection: GlobalEnvironmentVariableCollection = new MockGlobalEnvironmentVariableCollection();
  public storageUri: Uri | undefined = undefined;
  public storagePath: string | undefined = undefined;
  public globalStorageUri: Uri = { fsPath: '' } as Uri;
  public globalStoragePath: string = '';
  public logUri: Uri = { fsPath: '' } as Uri;
  public logPath: string = '';
  public extensionMode: ExtensionMode = 1; // ExtensionMode.Test
  public extensionRuntime = { name: "Node" };
  public logOutputChannel: LogOutputChannel = new MockLogOutputChannel();
  
  // Add the newly required properties
  public extension: Extension<any> = {
    id: 'mock.extension',
    extensionUri: { fsPath: '' } as Uri,
    extensionPath: '',
    isActive: true,
    packageJSON: {},
    activate: () => Promise.resolve(),
    exports: undefined,
    extensionKind: ExtensionKind.UI
  };
  
  // Create a proper LanguageModelAccessInformation implementation
  public languageModelAccessInformation: LanguageModelAccessInformation = {
    onDidChange: createEvent<void>(),
    canSendRequest: () => true
  };
  
  asAbsolutePath(relativePath: string): string {
    return relativePath;
  }
}

module.exports = {
  commands,
  window,
  ExtensionContext,
  // Mock some important enum values that might be used
  ExtensionMode: {
    Production: 1,
    Development: 2,
    Test: 3,
  },
  ExtensionKind,
  ProgressLocation: {
    Window: 10,
    Notification: 15,
  },
  LogLevel: {
    Off: 0,
    Trace: 1,
    Debug: 2,
    Info: 3,
    Warning: 4,
    Error: 5,
    Critical: 6
  }
};