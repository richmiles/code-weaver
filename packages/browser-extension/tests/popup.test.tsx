import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import browser from 'webextension-polyfill';
import Popup from '../src/popup/Popup';

describe('Popup Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders with the expected initial text and loading state', async () => {
    render(<Popup />);
    
    // Initial render should show loading
    expect(screen.getByText(/Hello from the popup!/i)).toBeInTheDocument();
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    
    // Wait for the background message to resolve
    await waitFor(() => {
      expect(screen.getByText(/Hello popup! This is the background script./i)).toBeInTheDocument();
    });
  });

  it('sends a message to content script when button is clicked', async () => {
    render(<Popup />);
    
    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByText(/Hello popup! This is the background script./i)).toBeInTheDocument();
    });
    
    // Click the button to send message to content script
    const button = screen.getByRole('button', { name: /Send Message to Content Script/i });
    fireEvent.click(button);
    
    // Button should be disabled during loading
    expect(button).toBeDisabled();
    
    // Wait for the content script message to resolve
    await waitFor(() => {
      expect(screen.getByText(/Hello from content script!/i)).toBeInTheDocument();
      expect(button).not.toBeDisabled();
    });
    
    // Verify correct API calls were made
    expect(browser.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(browser.tabs.sendMessage).toHaveBeenCalledWith(123, {
      type: 'HELLO',
      from: 'popup',
    });
  });
});