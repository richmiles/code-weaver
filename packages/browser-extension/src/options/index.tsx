import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import browser from 'webextension-polyfill';
// Fix the CSS import path
import '../popup/popup.css';

export const Popup: React.FC = () => {
  const [message, setMessage] = useState<string>('');

  interface MessageResponse {
    response: string;
  }

  useEffect(() => {
    browser.runtime.sendMessage({ type: 'HELLO', from: 'popup' })
      .then((response) => {
        const typedResponse = response as MessageResponse;
        setMessage(typedResponse.response || 'No response');
      })
      .catch(error => {
        setMessage(`Error: ${error.message}`);
      });
  }, []);

  const sendMessageToContent = async () => {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });

      if (tabs[0]?.id) {
        const response = await browser.tabs.sendMessage(tabs[0].id, {
          type: 'HELLO',
          from: 'popup'
        });
        const typedResponse = response as MessageResponse;
        setMessage(typedResponse.response || 'No response from content script');
      } else {
        setMessage('No active tab found');
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="popup-container">
      <h1>Code Weaver</h1>
      <p>Hello from the popup!</p>
      <div className="message-container">
        <p><strong>Message:</strong> {message}</p>
      </div>
      <button onClick={sendMessageToContent}>
        Send Message to Content Script
      </button>
    </div>
  );
};

// Only render if root element is found
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>
  );
}

export default Popup;