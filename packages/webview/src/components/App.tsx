import { useState, useEffect } from 'react';
import '../styles/index.css';

// Get the VS Code API
// This will be available when running in the VS Code extension
declare function acquireVsCodeApi(): any;

let vscode: any;
try {
  vscode = acquireVsCodeApi();
} catch (error) {
  // Running outside VS Code, provide a mock for development
  vscode = {
    postMessage: (message: any) => {
      console.log('Sent message to VS Code:', message);
    },
    getState: () => null,
    setState: () => {}
  };
}

const App = () => {
  const [message, setMessage] = useState<string>('Waiting for VS Code to connect...');

  useEffect(() => {
    // Listen for messages from the extension
    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'init':
          setMessage('Connected to VS Code Extension!');
          break;
        case 'update':
          setMessage(message.text);
          break;
        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    };

    window.addEventListener('message', messageListener);

    // Let the extension know the webview is ready
    vscode.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', messageListener);
    };
  }, []);

  const sendMessage = () => {
    vscode.postMessage({
      type: 'hello',
      text: 'Hello from the webview!'
    });
  };

  return (
    <div className="app">
      <h1>VS Code Webview</h1>
      <p>{message}</p>
      <button onClick={sendMessage}>Send Message to Extension</button>
    </div>
  );
};

export default App;