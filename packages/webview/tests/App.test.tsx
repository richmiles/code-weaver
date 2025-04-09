// packages/webview/tests/App.test.tsx
import { render } from '@testing-library/react';
import React from 'react';
import App from '../src/components/App';

// Mock the CSS imports
jest.mock('../src/styles/index.css', () => ({}));

describe('App', () => {
  it('renders without crashing', () => {
    // Just test that the component renders without errors
    render(<App />);
  });
});