import browser from 'webextension-polyfill';

console.log('Code Weaver content script loaded');

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

// Send a message to the background script
browser.runtime.sendMessage({ type: 'HELLO', from: 'content-script' } as MyMessage)
  .then(response => {
    console.log('Response from background:', response);
  })
  .catch(error => {
    console.error('Error sending message:', error);
  });

// Listen for messages using the type guard
browser.runtime.onMessage.addListener((message: unknown) => {
  if (!isMyMessage(message)) {
    console.warn('Received message that does not conform to MyMessage interface:', message);
    return Promise.resolve({ response: 'Invalid message format' });
  }

  console.log('Content script received message:', message);

  if (message.type === 'HELLO') {
    return Promise.resolve({ response: 'Hello from content script!' });
  }

  return Promise.resolve({ response: 'Unknown message type' });
});
