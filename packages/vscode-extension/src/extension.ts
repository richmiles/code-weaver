// packages/vscode-extension/src/extension.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  console.warn('Congratulations, your extension "Code Weaver" is now active!');

  // Register the hello world command
  const helloWorldCommand = vscode.commands.registerCommand('code-weaver.helloWorld', () => {
    vscode.window.showInformationMessage('Hello World from Code Weaver!');
  });

  // Register a command to open the webview panel
  const openWebviewCommand = vscode.commands.registerCommand('code-weaver.openWebview', () => {
    // Create and show the webview panel
    const panel = vscode.window.createWebviewPanel(
      'codeWeaverWebview', // Unique identifier for this webview panel
      'Code Weaver', // Title displayed in the UI
      vscode.ViewColumn.One, // Editor column to show the webview in
      {
        enableScripts: true, // Enable JavaScript in the webview
        retainContextWhenHidden: true, // Keep the webview content around when hidden
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, 'dist', 'webview'))
        ],
      }
    );

    // Set the HTML content of the webview
    panel.webview.html = getWebviewContent(context.extensionPath, panel.webview);

    // Handle messages from the webview
    panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case 'ready':
            // Send an initialization message when the webview is ready
            panel.webview.postMessage({ type: 'init' });
            break;
          case 'hello':
            vscode.window.showInformationMessage(message.text);
            break;
        }
      },
      undefined,
      context.subscriptions
    );
  });

  // Add both commands to the context subscriptions
  context.subscriptions.push(helloWorldCommand, openWebviewCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {}

// Helper function to get the content for the webview
function getWebviewContent(extensionPath: string, webview: vscode.Webview): string {
  // Read the index.html file
  const webviewPath = path.join(extensionPath, 'dist', 'webview');
  
  try {
    // Get all files in the webview directory
    const files = fs.readdirSync(path.join(extensionPath, 'dist', 'webview', 'assets'));
    
    // Find the main JS and CSS files
    const jsFile = files.find(file => file.endsWith('.js') && file.includes('main'));
    const cssFile = files.find(file => file.endsWith('.css'));
    
    // Convert the local file paths to webview URIs
    const jsUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(extensionPath, 'dist', 'webview', 'assets', jsFile || ''))
    );
    
    const cssUri = cssFile 
      ? webview.asWebviewUri(
          vscode.Uri.file(path.join(extensionPath, 'dist', 'webview', 'assets', cssFile))
        ) 
      : '';

    // Create the HTML content
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src ${webview.cspSource}; style-src ${webview.cspSource};">
          <title>Code Weaver</title>
          ${cssUri ? `<link rel="stylesheet" type="text/css" href="${cssUri}">` : ''}
        </head>
        <body>
          <div id="root"></div>
          <script type="module" src="${jsUri}"></script>
        </body>
      </html>
    `;
  } catch (error) {
    console.error('Error generating webview content:', error);
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Error</title>
        </head>
        <body>
          <h1>Error loading webview</h1>
          <p>An error occurred while loading the webview. Please check the developer console for details.</p>
        </body>
      </html>
    `;
  }
}