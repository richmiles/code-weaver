// packages/browser-extension/src/popup/Popup.tsx
import React, { useState, useEffect, useCallback } from 'react';
import browser from 'webextension-polyfill';
import './popup.css';

export interface MessageResponse {
  response: string;
}

export const Popup: React.FC = () => {
  const [message, setMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Separate the message sending logic into a testable function
  const sendBackgroundMessage = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await browser.runtime.sendMessage({ type: 'HELLO', from: 'popup' });
      const typedResponse = response as MessageResponse;
      setMessage(typedResponse.response || 'No response');
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Use the callback in useEffect
  useEffect(() => {
    sendBackgroundMessage();
  }, [sendBackgroundMessage]);

  const sendMessageToContent = async () => {
    try {
      setIsLoading(true);
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });

      if (tabs[0]?.id) {
        const response = await browser.tabs.sendMessage(tabs[0].id, {
          type: 'HELLO',
          from: 'popup',
        });
        const typedResponse = response as MessageResponse;
        setMessage(typedResponse.response || 'No response from content script');
      } else {
        setMessage('No active tab found');
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="popup-container">
      <h1>Code Weaver</h1>
      <p>Hello from the popup!</p>
      <div className="message-container">
        <p>
          <strong>Message:</strong> {isLoading ? 'Loading...' : message}
        </p>
      </div>
      <button onClick={sendMessageToContent} disabled={isLoading}>
        Send Message to Content Script
      </button>
    </div>
  );
};

export default Popup;