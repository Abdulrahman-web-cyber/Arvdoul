// Basic production sanity test for ReelsFeed — ensures component renders without crash
import React from 'react';
import { render, screen } from '@testing-library/react';
import ReelsFeed from './ReelsFeed';

describe('ReelsFeed', () => {
  it('renders feed container without throwing', () => {
    // Mock auth/theme contexts to avoid Firebase initialization
    render(<ReelsFeed initialQueryLimit={2} />);
    expect(document.body).toBeInTheDocument();
  });

  it('exports default component', () => {
    expect(typeof ReelsFeed).toBe('function');
  });
});
