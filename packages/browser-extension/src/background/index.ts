import browser from 'webextension-polyfill';

console.log('Background script loaded');

// Define the message interface and type guard
interface MyMessage {
  type: 'HELLO' | 'UNKNOWN';
  from?: string;
}

function isMyMessage(message: unknown): message is MyMessage {
  if (typeof message !== 'object' || message === null) {
    return false;
  }
  const msg = message as Partial<MyMessage>;
  if (typeof msg.type !== 'string') {
    return false;
  }
  if (msg.type !== 'HELLO' && msg.type !== 'UNKNOWN') {
    return false;
  }
  if ('from' in msg && typeof msg.from !== 'undefined' && typeof msg.from !== 'string') {
    return false;
  }
  return true;
}

browser.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details);
});

browser.runtime.onMessage.addListener((message: unknown, sender: browser.Runtime.MessageSender) => {
  if (!isMyMessage(message)) {
    console.warn('Received message that does not conform to MyMessage interface:', message);
    return Promise.resolve({ response: 'Invalid message format' });
  }

  console.log('Received message in background script:', message);
  console.log('From:', sender);

  if (message.type === 'HELLO') {
    return Promise.resolve({ response: 'Hello from background script!' });
  }
  
  return Promise.resolve({ response: 'Unknown message type' });
});
