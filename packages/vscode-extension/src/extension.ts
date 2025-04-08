// src/extension.ts
import * as vscode from 'vscode';

export function activate(context: ExtensionContext) {
  const disposable = vscode.commands.registerCommand('myExtension.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from my Extension!');
  });
  context.subscriptions.push(disposable);
}

export function deactivate() {
  // Cleanup if needed.
}
