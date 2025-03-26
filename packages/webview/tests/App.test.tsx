import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/components/App';

describe('App', () => {
  it('renders the initial message', () => {
    render(<App />);
    expect(screen.getByText(/Waiting for VS Code to connect/)).toBeInTheDocument();
  });

  it('has a button to send messages', () => {
    render(<App />);
    const button = screen.getByText('Send Message to Extension');
    expect(button).toBeInTheDocument();
  });
});
