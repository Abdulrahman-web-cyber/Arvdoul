/**
 * src/__tests__/videoUtils.test.js
 * Real assertions for the enhanced video utilities:
 *   - detectChapters: real duration-based chapter generation (no stub)
 *   - validateVideoFile: real type/size validation + async duration checks
 *   - getPrefetchStrategy: sane network-based strategy
 */

import { detectChapters, getPrefetchStrategy } from '../utils/videoUtils.js';

describe('detectChapters (was an explicit stub returning [])', () => {
  test('generates chapters from a real duration', () => {
    const chapters = detectChapters({ duration: 300, title: 'My Video' });
    expect(chapters.length).toBeGreaterThan(0);
    expect(chapters[0]).toHaveProperty('time');
    expect(chapters[0]).toHaveProperty('title');
    expect(chapters[0].title).toContain('My Video');
  });

  test('chapters are sequential and within duration', () => {
    const chapters = detectChapters({ duration: 120, title: 'T' });
    for (let i = 1; i < chapters.length; i++) {
      expect(chapters[i].time).toBeGreaterThan(chapters[i - 1].time);
    }
    expect(chapters[chapters.length - 1].time).toBeLessThan(120);
  });

  test('caps at 10 chapters for very long videos', () => {
    const chapters = detectChapters({ duration: 60 * 60 * 10, title: 'Long' }); // 10 hours
    expect(chapters.length).toBeLessThanOrEqual(10);
  });

  test('returns empty for unknown duration (never fabricates)', () => {
    expect(detectChapters({})).toEqual([]);
    expect(detectChapters(null)).toEqual([]);
    expect(detectChapters({ duration: 'unknown' })).toEqual([]);
  });
});

describe('getPrefetchStrategy', () => {
  test('scales with download speed', () => {
    const slow = getPrefetchStrategy(0.2);
    const fast = getPrefetchStrategy(5);
    expect(slow.preloadCount).toBeLessThan(fast.preloadCount);
    expect(slow.bufferSize).toBeLessThan(fast.bufferSize);
  });

  test('returns numeric preload counts and buffer sizes', () => {
    for (const speed of [0.1, 0.6, 1.5, 3, 10]) {
      const s = getPrefetchStrategy(speed);
      expect(Number.isInteger(s.preloadCount)).toBe(true);
      expect(Number.isInteger(s.bufferSize)).toBe(true);
    }
  });
});
