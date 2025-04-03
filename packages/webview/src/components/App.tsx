import { useState, useEffect } from 'react';
import '../styles/index.css';

// Define types for the VS Code API
interface VSCodeAPI {
  postMessage: (message: unknown) => void;
  getState: () => unknown;
  setState: (state: unknown) => void;
}

// Get the VS Code API
// This will be available when running in the VS Code extension
declare function acquireVsCodeApi(): VSCodeAPI;

// Define message types for better type safety
interface VSCodeMessage {
  type: string;
  [key: string]: unknown;
}

interface UpdateMessage extends VSCodeMessage {
  type: 'update';
  text: string;
}

interface InitMessage extends VSCodeMessage {
  type: 'init';
}

type MessageTypes = UpdateMessage | InitMessage;

let vscode: VSCodeAPI;
try {
  vscode = acquireVsCodeApi();
} catch {
  // Running outside VS Code, provide a mock for development
  vscode = {
    postMessage: (message: unknown) => {
      // Console statement allowed in development mock
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.log('Sent message to VS Code:', message);
      }
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
      const message = event.data as MessageTypes;
      
      // Fix: Add type guard to handle unknown message types
      if (!message || typeof message !== 'object' || !('type' in message)) {
        console.warn('Received invalid message format');
        return;
      }
      
      switch (message.type) {
        case 'init':
          setMessage('Connected to VS Code Extension!');
          break;
        case 'update':
          setMessage(message.text);
          break;
        default:
          // Console warning is allowed by eslint config
          console.warn(`Unknown message type: ${(message as VSCodeMessage).type}`);
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