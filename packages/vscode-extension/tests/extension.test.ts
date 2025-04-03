// tests/extension.test.ts
import * as vscode from 'vscode';
import { activate } from '../src/extension';

describe('My Extension', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should register the helloWorld command on activation', () => {
    const context = new vscode.ExtensionContext();
    activate(context);

    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'myExtension.helloWorld',
      expect.any(Function)
    );
    expect(context.subscriptions).toHaveLength(1);
  });

  it('should call showInformationMessage when the helloWorld command is executed', () => {
    const context = new vscode.ExtensionContext();
    activate(context);

    // Cast to jest.Mock so we can access the .mock property.
    const registeredCall = (vscode.commands.registerCommand as jest.Mock).mock.calls.find(
      ([command]) => command === 'myExtension.helloWorld'
    );
    expect(registeredCall).toBeDefined();

    const commandCallback = registeredCall[1];
    commandCallback();

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Hello World from my Extension!'
    );
  });
});
