/**
 * src/__tests__/useDoubleTap.test.js
 * Regression: the old hook wired BOTH onClick and onTouchEnd - on mobile a
 * single tap fired both handlers, so ONE tap triggered the "double tap"
 * action. The fixed hook wires onClick only and fires exactly once per pair.
 */

import { jest } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import useDoubleTap from '../hooks/useDoubleTap.js';

function TapProbe({ onDouble }) {
  const handlers = useDoubleTap(onDouble);
  return <button {...handlers}>tap</button>;
}

describe('useDoubleTap', () => {
  test('single tap does NOT fire the double-tap callback', () => {
    const onDouble = jest.fn();
    render(<TapProbe onDouble={onDouble} />);
    fireEvent.click(screen.getByText('tap'));
    expect(onDouble).not.toHaveBeenCalled();
  });

  test('two taps within the window fire the callback exactly once', () => {
    const onDouble = jest.fn();
    render(<TapProbe onDouble={onDouble} />);
    const btn = screen.getByText('tap');
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onDouble).toHaveBeenCalledTimes(1);
  });

  test('two taps beyond the delay do not fire', () => {
    jest.useFakeTimers();
    const onDouble = jest.fn();
    render(<TapProbe onDouble={onDouble} />);
    const btn = screen.getByText('tap');
    fireEvent.click(btn);
    jest.advanceTimersByTime(500);
    fireEvent.click(btn);
    expect(onDouble).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  test('a third tap after a pair starts a new pair (fires again after another tap)', () => {
    const onDouble = jest.fn();
    render(<TapProbe onDouble={onDouble} />);
    const btn = screen.getByText('tap');
    fireEvent.click(btn); // tap 1 (pair A start)
    fireEvent.click(btn); // tap 2 (pair A fires)
    fireEvent.click(btn); // tap 3 (pair B start - reset happened)
    fireEvent.click(btn); // tap 4 (pair B fires)
    expect(onDouble).toHaveBeenCalledTimes(2);
  });
});
