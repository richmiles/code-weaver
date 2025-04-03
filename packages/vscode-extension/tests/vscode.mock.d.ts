// tests/vscode.mock.d.ts
import { Memento, Uri } from 'vscode';

declare module 'vscode' {
  // This tells TypeScript that the module exports a class named ExtensionContext
  // with the following properties.
  export class ExtensionContext {
    readonly subscriptions: { dispose(): any }[];
    readonly workspaceState: Memento;
    readonly globalState: Memento & { setKeysForSync(keys: readonly string[]): void };
    readonly extensionUri: Uri;
    readonly extensionPath: string;
    asAbsolutePath(relativePath: string): string;
  }
}
