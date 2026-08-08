/**
 * ARVDOUL pure-logic formatter tests (no mocks, no Firebase).
 */
import { formatDuration, formatViewCount, getInitials } from '../videoUtils.js';
import { saveToCache, loadFromCache } from '../offlineCache.js';

describe('videoUtils formatDuration', () => {
  test('formats seconds as H:MM:SS', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  test('handles undefined gracefully', () => {
    expect(formatDuration(undefined)).toBe('0:00');
  });
});

describe('videoUtils formatViewCount', () => {
  test('formats thousands/millions with K/M suffixes', () => {
    expect(formatViewCount(0)).toBe('0');
    expect(formatViewCount(999)).toBe('999');
    expect(formatViewCount(1500)).toMatch(/1\.5K/);
    expect(formatViewCount(2500000)).toMatch(/2\.5M/);
  });
});

describe('videoUtils getInitials', () => {
  test('returns up to two initials', () => {
    expect(getInitials('John Doe')).toBe('JD');
    expect(getInitials('alice')).toBe('AL');
    expect(getInitials('')).toBe('??');
    expect(getInitials(null)).toBe('??');
  });
});

describe('offlineCache', () => {
  test('round-trips and honors TTL (6h)', () => {
    const key = 'test_offline_cache';
    saveToCache(key, { hello: 'world' });
    expect(loadFromCache(key)).toEqual({ hello: 'world' });
    // Corrupt / expired entry (timestamp 7h old) is discarded.
    localStorage.setItem(key, JSON.stringify({ data: 1, timestamp: Date.now() - 7 * 60 * 60 * 1000 }));
    expect(loadFromCache(key)).toBeNull();
    localStorage.removeItem(key);
  });
});
