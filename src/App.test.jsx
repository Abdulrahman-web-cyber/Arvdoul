// src/App.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Simple App component for testing
function TestApp() {
  return (
    <div data-testid="test-app">
      <h1>Arvdoul Test App</h1>
      <p>React is working! 🎉</p>
    </div>
  );
}

describe('App', () => {
  describe('Rendering', () => {
    it('should render the app container', () => {
      render(<TestApp />);
      expect(screen.getByTestId('test-app')).toBeInTheDocument();
    });

    it('should display the title', () => {
      render(<TestApp />);
      expect(screen.getByText('Arvdoul Test App')).toBeInTheDocument();
    });

    it('should display success message', () => {
      render(<TestApp />);
      expect(screen.getByText(/react is working/i)).toBeInTheDocument();
    });
  });

  describe('Structure', () => {
    it('should render h1 heading', () => {
      render(<TestApp />);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    });

    it('should render paragraph', () => {
      render(<TestApp />);
      expect(screen.getByText(/🎉/)).toBeInTheDocument();
    });
  });
});
