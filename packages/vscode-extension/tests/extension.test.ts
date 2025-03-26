// packages/vscode-extension/tests/extension.test.ts
import * as vscode from 'vscode';

// Use the mock from the __mocks__ directory
jest.mock('vscode');
jest.mock('fs');

describe('Extension Test Suite', () => {
  let extension: any;
  
  beforeEach(async () => {
    // Clear module cache to ensure a fresh import each time
    jest.resetModules();
    // Import the extension after mocking the vscode module
    extension = await import('../src/extension');
  });

  it('should register commands when activated', () => {
    // Create a mock extension context
    const context = {
      subscriptions: [],
      extensionPath: '/test/extension/path',
    };

    // Activate the extension
    extension.activate(context);

    // Verify that commands were registered
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'code-weaver.helloWorld',
      expect.any(Function)
    );
    
    expect(vscode.commands.registerCommand).toHaveBeenCalledWith(
      'code-weaver.openWebview',
      expect.any(Function)
    );

    // Verify that the commands were added to the subscriptions
    expect(context.subscriptions.length).toBe(2);
  });

  it('should show information message when hello world command is executed', () => {
    // Create a mock extension context
    const context = {
      subscriptions: [],
      extensionPath: '/test/extension/path',
    };

    // Activate the extension
    extension.activate(context);

    // Execute the command using our helper
    vscode._executeCommand('code-weaver.helloWorld');

    // Verify that the information message was shown
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Hello World from Code Weaver!'
    );
  });

  it('should create webview panel when openWebview command is executed', () => {
    // Create a mock extension context
    const context = {
      subscriptions: [],
      extensionPath: '/test/extension/path',
    };

    // Activate the extension
    extension.activate(context);

    // Execute the command using our helper
    vscode._executeCommand('code-weaver.openWebview');

    // Verify that a webview panel was created
    expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
      'codeWeaverWebview',
      'Code Weaver',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [expect.any(Object)],
      }
    );
  });

  it('should handle "ready" message from webview correctly', () => {
    // Create a mock extension context
    const context = {
      subscriptions: [],
      extensionPath: '/test/extension/path',
    };

    // Activate the extension
    extension.activate(context);

    // Execute the command to open the webview
    vscode._executeCommand('code-weaver.openWebview');

    // Simulate receiving a "ready" message from the webview
    vscode._sendMessageFromWebview({ type: 'ready' });

    // Verify that the extension responded with an init message
    expect(vscode.window.createWebviewPanel().webview.postMessage).toHaveBeenCalledWith({ 
      type: 'init' 
    });
  });

  it('should handle "hello" message from webview correctly', () => {
    // Create a mock extension context
    const context = {
      subscriptions: [],
      extensionPath: '/test/extension/path',
    };

    // Activate the extension
    extension.activate(context);

    // Execute the command to open the webview
    vscode._executeCommand('code-weaver.openWebview');

    // Simulate receiving a "hello" message from the webview
    vscode._sendMessageFromWebview({ 
      type: 'hello', 
      text: 'Hello from the webview!' 
    });

    // Verify that the extension showed an information message
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Hello from the webview!'
    );
  });

  it('should generate valid HTML content for the webview', () => {
    // Create a mock extension context
    const context = {
      subscriptions: [],
      extensionPath: '/test/extension/path',
    };

    // Activate the extension
    extension.activate(context);

    // Execute the command to open the webview
    vscode._executeCommand('code-weaver.openWebview');

    // Check that HTML content was set on the webview
    expect(vscode.window.createWebviewPanel().webview.html).toBeDefined();
    
    // The HTML content should contain script tags
    const htmlContent = vscode.window.createWebviewPanel().webview.html;
    expect(htmlContent).toContain('<script');
    
    // The HTML content should have proper Content-Security-Policy
    expect(htmlContent).toContain('Content-Security-Policy');
  });
});