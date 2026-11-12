/**
 * @jest-environment jsdom
 *
 * Pull-to-refresh (item 33). The hook drives a real DOM scroll container with
 * non-passive touch listeners; these tests exercise the real gesture path
 * (touchstart → touchmove → touchend) rather than a mock.
 */

import { jest } from '@jest/globals';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

function touchEvent(type, clientY) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', { value: [{ clientY }] });
  return event;
}

describe('usePullToRefresh', () => {
  let el;

  beforeEach(() => {
    el = document.createElement('div');
    // jsdom does not implement layout; scrollTop is a plain writable property.
    Object.defineProperty(el, 'scrollTop', { value: 0, writable: true });
    document.body.appendChild(el);
  });

  afterEach(() => {
    el.remove();
  });

  test('does not fire a refresh for a short pull', async () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePullToRefresh({ element: el, onRefresh, threshold: 70 })
    );

    await act(async () => {
      el.dispatchEvent(touchEvent('touchstart', 100));
      el.dispatchEvent(touchEvent('touchmove', 140)); // delta 40 * 0.5 = 20 < 70
    });
    expect(result.current.pull).toBeGreaterThan(0);

    await act(async () => {
      el.dispatchEvent(touchEvent('touchend', 140));
    });
    expect(onRefresh).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.pull).toBe(0));
  });

  test('fires onRefresh when the pull passes the threshold', async () => {
    let resolveRefresh;
    const onRefresh = jest.fn(
      () => new Promise((resolve) => { resolveRefresh = resolve; })
    );
    const { result } = renderHook(() =>
      usePullToRefresh({ element: el, onRefresh, threshold: 70 })
    );

    await act(async () => {
      el.dispatchEvent(touchEvent('touchstart', 100));
      el.dispatchEvent(touchEvent('touchmove', 260)); // delta 160 * 0.5 = 80 >= 70
    });
    expect(result.current.pull).toBeGreaterThanOrEqual(70);

    await act(async () => {
      el.dispatchEvent(touchEvent('touchend', 260));
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.isRefreshing).toBe(true);

    await act(async () => {
      resolveRefresh();
    });
    await waitFor(() => expect(result.current.isRefreshing).toBe(false));
    expect(result.current.pull).toBe(0);
  });

  test('ignores a pull when the scroller is not at the top', async () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePullToRefresh({ element: el, onRefresh, threshold: 70 })
    );

    el.scrollTop = 200;
    await act(async () => {
      el.dispatchEvent(touchEvent('touchstart', 100));
      el.dispatchEvent(touchEvent('touchmove', 300));
    });
    expect(result.current.pull).toBe(0);

    await act(async () => {
      el.dispatchEvent(touchEvent('touchend', 300));
    });
    expect(onRefresh).not.toHaveBeenCalled();
  });

  test('is inert when disabled', async () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      usePullToRefresh({ element: el, onRefresh, enabled: false, threshold: 70 })
    );

    await act(async () => {
      el.dispatchEvent(touchEvent('touchstart', 100));
      el.dispatchEvent(touchEvent('touchmove', 300));
      el.dispatchEvent(touchEvent('touchend', 300));
    });
    expect(result.current.pull).toBe(0);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
