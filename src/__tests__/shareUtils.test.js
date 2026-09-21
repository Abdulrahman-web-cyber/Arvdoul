// src/__tests__/shareUtils.test.js
import { jest } from '@jest/globals';
import { getProfileHandle, getProfileUrl, shareProfile, copyToClipboard } from '../utils/shareUtils.js';

describe('shareUtils', () => {
  const originalNavigator = global.navigator;

  const setNavigator = (value) => {
    Object.defineProperty(globalThis, 'navigator', {
      value,
      configurable: true,
      writable: true,
    });
  };

  afterEach(() => {
    setNavigator(originalNavigator);
    jest.restoreAllMocks();
  });

  describe('getProfileHandle', () => {
    it('prefers a real username', () => {
      expect(getProfileHandle({ username: 'nova', uid: 'abc123' })).toBe('nova');
    });

    it('falls back to uid when the username is a generated placeholder', () => {
      expect(getProfileHandle({ username: 'user_abc123', uid: 'abc123' })).toBe('abc123');
      expect(getProfileHandle({ username: 'creator', uid: 'abc123' })).toBe('abc123');
    });

    it('falls back to id when no uid exists', () => {
      expect(getProfileHandle({ id: 'xyz789' })).toBe('xyz789');
    });

    it('returns an empty string for an empty profile', () => {
      expect(getProfileHandle({})).toBe('');
      expect(getProfileHandle(null)).toBe('');
    });
  });

  describe('getProfileUrl', () => {
    it('builds an absolute profile url from the username', () => {
      const url = getProfileUrl({ username: 'nova' });
      expect(url).toMatch(/^https?:\/\/.+\/profile\/nova$/);
    });
  });

  describe('shareProfile', () => {
    it('uses the native share sheet when available', async () => {
      const share = jest.fn().mockResolvedValue(undefined);
      setNavigator({ share });
      const result = await shareProfile({ username: 'nova' });
      expect(share).toHaveBeenCalledTimes(1);
      expect(result.shared).toBe(true);
      expect(result.copied).toBe(false);
    });

    it('reports user cancellation without copying', async () => {
      const abort = new Error('cancelled');
      abort.name = 'AbortError';
      setNavigator({ share: jest.fn().mockRejectedValue(abort), clipboard: { writeText: jest.fn() } });
      const result = await shareProfile({ username: 'nova' });
      expect(result.cancelled).toBe(true);
      expect(result.copied).toBe(false);
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
    });

    it('copies to the clipboard when the share sheet is unavailable', async () => {
      const writeText = jest.fn().mockResolvedValue(undefined);
      setNavigator({ clipboard: { writeText } });
      const result = await shareProfile({ username: 'nova' });
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(result.copied).toBe(true);
      expect(result.shared).toBe(false);
    });
  });

  describe('copyToClipboard', () => {
    it('rejects when no clipboard mechanism is available', async () => {
      setNavigator({});
      await expect(copyToClipboard('x')).rejects.toThrow();
    });
  });
});