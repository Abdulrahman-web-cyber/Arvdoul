/**
 * src/__tests__/feedService.test.js
 * Real assertions for the feed ranking/ranking-adjacent pure logic:
 * deterministic shuffle, stable hashing, cursor codec round-trips,
 * fallback scoring monotonicity, and diversity enforcement.
 * (Firestore-dependent paths are intentionally not exercised here —
 * the Firebase singleton is mocked so init falls back to offline mode.)
 */

import { jest } from '@jest/globals';

jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: jest.fn(async () => {
    throw new Error('firebase mocked off for feed tests');
  }),
}));

const { getFeedService, feedService } = await import('../services/feedService.js');

// The real UltimateFeedService instance (facade lazily creates it).
const svc = () => getFeedService();

describe('feedService - _shuffleArray (seeded, deterministic)', () => {
  test('is deterministic for the same seed', () => {
    const arr = Array.from({ length: 50 }, (_, i) => i);
    const a = svc()._shuffleArray(arr, 0.42);
    const b = svc()._shuffleArray(arr, 0.42);
    expect(a).toEqual(b);
    expect(a).toHaveLength(arr.length);
  });

  test('produces different orders for different seeds', () => {
    const arr = Array.from({ length: 50 }, (_, i) => i);
    const a = svc()._shuffleArray(arr, 0.11);
    const b = svc()._shuffleArray(arr, 0.99);
    expect(a).not.toEqual(b);
  });

  test('does not mutate the input array', () => {
    const arr = [1, 2, 3, 4, 5];
    const snapshot = [...arr];
    svc()._shuffleArray(arr, 0.5);
    expect(arr).toEqual(snapshot);
  });

  test('preserves all elements (permutation)', () => {
    const arr = Array.from({ length: 30 }, (_, i) => i);
    const shuffled = svc()._shuffleArray(arr, 0.77);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(arr);
  });
});

describe('feedService - _hashString', () => {
  test('is stable across calls', () => {
    expect(svc()._hashString('user_123')).toBe(svc()._hashString('user_123'));
  });

  test('distinguishes different inputs', () => {
    expect(svc()._hashString('a')).not.toBe(svc()._hashString('b'));
  });

  test('returns a non-negative integer', () => {
    const h = svc()._hashString('anything-here');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });
});

describe('feedService - cursor codec', () => {
  test('round-trips an encoded feed cursor', () => {
    const feed = [
      { id: 'post-1', createdAt: new Date('2026-08-01T00:00:00Z') },
      { id: 'post-2', createdAt: new Date('2026-08-02T00:00:00Z') },
    ];
    const cursor = svc()._encodeCursorFromFeed(feed);
    expect(cursor).toBeTruthy();
    const decoded = svc()._decodeCursor(cursor);
    expect(decoded).toHaveProperty('p', 'post-2');
    expect(decoded).toHaveProperty('c');
  });

  test('returns null for empty inputs', () => {
    expect(svc()._encodeCursorFromFeed([])).toBeNull();
    expect(svc()._encodeCursorFromFeed(null)).toBeNull();
    expect(svc()._decodeCursor('')).toBeNull();
    expect(svc()._decodeCursor(null)).toBeNull();
    expect(svc()._decodeCursor('not-a-valid-cursor!!')).toBeNull();
  });

  test('builds a cursor object with per-source positions', () => {
    const feed = [{ id: 'p1', createdAt: new Date('2026-08-01T00:00:00Z') }];
    const sources = {
      following: [{ id: 'p1', createdAt: new Date('2026-08-01T00:00:00Z') }],
      for_you: [{ id: 'p1', createdAt: new Date('2026-08-01T00:00:00Z'), personalizationScore: 0.9 }],
    };
    const cursor = svc()._buildCursorObject(feed, sources);
    expect(cursor).toHaveProperty('p', 'p1');
    expect(cursor.s.for_you.sc).toBe(0.9);
    expect(cursor.s.following.i).toBe('p1');
  });
});

describe('feedService - _calculateFallbackScore', () => {
  const freshPost = (overrides = {}) => ({
    id: 'p',
    createdAt: new Date().toISOString(),
    likeCount: 10,
    commentCount: 2,
    shareCount: 1,
    viewCount: 100,
    ...overrides,
  });

  test('returns a score within the [0.1, 1.0] band', () => {
    const score = svc()._calculateFallbackScore(freshPost());
    expect(score).toBeGreaterThanOrEqual(0.1);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  test('highly engaged fresh posts score higher than stale quiet ones', () => {
    const hot = svc()._calculateFallbackScore(freshPost({ likeCount: 5000, commentCount: 500, shareCount: 200, viewCount: 100000 }));
    const stale = svc()._calculateFallbackScore(freshPost({ likeCount: 0, createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString() }));
    expect(hot).toBeGreaterThan(stale);
  });

  test('handles missing counters via aliases', () => {
    const score = svc()._calculateFallbackScore({ id: 'p', likes: 3, comments: 1, shares: 0, views: 10, createdAt: new Date().toISOString() });
    expect(score).toBeGreaterThanOrEqual(0.1);
  });
});

describe('feedService - _applyDiversityOptimized', () => {
  const makePosts = (count, authorId, type, category, topics = []) =>
    Array.from({ length: count }, (_, i) => ({
      id: `${authorId}-${type}-${i}`,
      authorId,
      type,
      category,
      topics,
    }));

  test('returns at most targetLimit posts', () => {
    const posts = [
      ...makePosts(20, 'a', 'video', 'music'),
      ...makePosts(20, 'b', 'photo', 'art'),
    ];
    svc().clearUserCache('div-user-1');
    const result = svc()._applyDiversityOptimized(posts, 'div-user-1', 10, 0.5, {});
    expect(result.length).toBeLessThanOrEqual(10);
  });

  test('does not immediately repeat the previous page last author', () => {
    svc().clearUserCache('div-user-2');
    // First page ends with author 'z'
    svc()._applyDiversityOptimized(
      makePosts(5, 'z', 'video', 'music'),
      'div-user-2', 5, 0.5, {}
    );
    const next = svc()._applyDiversityOptimized(
      [...makePosts(5, 'z', 'video', 'music'), ...makePosts(5, 'y', 'photo', 'art')],
      'div-user-2', 5, 0.5, {}
    );
    expect(next.length).toBeGreaterThan(0);
    // The page must not open with the previous page's last author
    expect(next[0].authorId).not.toBe('z');
    // No two consecutive posts may share an author
    for (let i = 1; i < next.length; i++) {
      expect(next[i].authorId).not.toBe(next[i - 1].authorId);
    }
  });

  test('diversity metrics are recorded per user', () => {
    svc().clearUserCache('div-user-3');
    svc()._applyDiversityOptimized(
      [...makePosts(3, 'a', 'video', 'music'), ...makePosts(3, 'b', 'photo', 'art')],
      'div-user-3', 6, 0.5, {}
    );
    const metrics = svc().diversityMetrics.get('div-user-3');
    expect(metrics).toBeDefined();
    expect(metrics.uniqueAuthors).toBeGreaterThanOrEqual(2);
  });

  test('does not duplicate posts within a page', () => {
    svc().clearUserCache('div-user-4');
    const posts = [...makePosts(5, 'a', 'video', 'music'), ...makePosts(5, 'a', 'video', 'music')];
    const result = svc()._applyDiversityOptimized(posts, 'div-user-4', 10, 0.5, {});
    const ids = new Set(result.map((p) => p.id));
    expect(ids.size).toBe(result.length);
  });
});

describe('feedService - stats & cache hygiene', () => {
  test('getStats exposes operational state', () => {
    const stats = svc().getStats();
    expect(stats).toHaveProperty('algorithmVersion');
    expect(stats).toHaveProperty('initialized');
    expect(stats).toHaveProperty('cacheSize');
  });

  test('clearUserCache removes per-user state', () => {
    svc().userFeedState.set('u-999', { topicStreaks: { x: 1 } });
    svc().feedHistory.set('u-999', []);
    svc().clearUserCache('u-999');
    expect(svc().userFeedState.has('u-999')).toBe(false);
    expect(svc().feedHistory.has('u-999')).toBe(false);
  });
});

afterAll(() => {
  svc().destroy();
  jest.clearAllTimers();
});
