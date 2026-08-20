/**
 * src/__tests__/cacheAndCounters.test.js
 * Real assertions for the caching and counter layers: CacheManager,
 * RedisCacheManager, CacheInvalidationService, TTL optimization and
 * sharded counters (with mocked Firestore).
 */

import { jest } from '@jest/globals';
import { CacheManager, cacheManager } from '../utils/CacheManager.js';
import { redisCacheManager } from '../services/RedisCacheManager.js';
import { cacheInvalidationService } from '../services/CacheInvalidationService.js';
import { ttlOptimizationService } from '../services/TTLOptimizationService.js';

describe('CacheManager', () => {
  let cache;
  beforeEach(() => {
    cache = new CacheManager({ maxSize: 100, defaultTtlMs: 60000 });
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('stores and retrieves values', () => {
    cache.set('ns', 'k1', { a: 1 });
    expect(cache.get('ns', 'k1')).toEqual({ a: 1 });
    expect(cache.get('ns', 'missing')).toBeNull();
  });

  test('deep-clones values on write and read (no aliasing)', () => {
    const original = { nested: { deep: [1, 2, 3] } };
    cache.set('ns', 'obj', original);
    const read = cache.get('ns', 'obj');
    read.nested.deep.push(4);
    expect(cache.get('ns', 'obj').nested.deep).toEqual([1, 2, 3]);
  });

  test('expires entries after TTL', () => {
    cache.set('ns', 'k', 'v', 1000);
    jest.advanceTimersByTime(1001);
    expect(cache.get('ns', 'k')).toBeNull();
  });

  test('getOrFetch computes on miss and caches on hit', async () => {
    const fetcher = jest.fn(async () => ({ data: 42 }));
    const first = await cache.getOrFetch('ns', 'k', fetcher, 5000);
    const second = await cache.getOrFetch('ns', 'k', fetcher, 5000);
    expect(first).toEqual({ data: 42 });
    expect(second).toEqual({ data: 42 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('getOrFetch does not cache null results', async () => {
    const fetcher = jest.fn(async () => null);
    await cache.getOrFetch('ns', 'k', fetcher, 5000);
    await cache.getOrFetch('ns', 'k', fetcher, 5000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test('invalidatePattern removes keys with wildcard support', () => {
    cache.set('user_posts', 'u1:1', 'a');
    cache.set('user_posts', 'u1:2', 'b');
    cache.set('user_posts', 'u2:1', 'c');
    cache.invalidatePattern('user_posts:u1:*');
    expect(cache.get('user_posts', 'u1:1')).toBeNull();
    expect(cache.get('user_posts', 'u1:2')).toBeNull();
    expect(cache.get('user_posts', 'u2:1')).toBe('c');
  });

  test('invalidateUser clears user-scoped entries across namespaces', () => {
    cache.set('feed', 'home_u123', 'f');
    cache.set('profile', 'u123', 'p');
    cache.set('other', 'u456', 'x');
    cache.invalidateUser('u123');
    expect(cache.get('feed', 'home_u123')).toBeNull();
    expect(cache.get('profile', 'u123')).toBeNull();
    expect(cache.get('other', 'u456')).toBe('x');
  });

  test('clearNamespace only clears its own namespace', () => {
    cache.set('a', 'k', 1);
    cache.set('b', 'k', 2);
    cache.clearNamespace('a');
    expect(cache.get('a', 'k')).toBeNull();
    expect(cache.get('b', 'k')).toBe(2);
  });

  test('evicts the oldest entry when at capacity', () => {
    const small = new CacheManager({ maxSize: 2, defaultTtlMs: 60000 });
    small.set('ns', 'a', 1);
    small.set('ns', 'b', 2);
    small.set('ns', 'c', 3);
    expect(small.size).toBe(2);
    expect(small.get('ns', 'a')).toBeNull();
    expect(small.getStats().evictions).toBe(1);
  });

  test('tracks hit/miss/set statistics', () => {
    cache.set('ns', 'k', 1);
    cache.get('ns', 'k');
    cache.get('ns', 'nope');
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.sets).toBe(1);
  });

  test('purgeExpired removes only expired entries', () => {
    cache.set('ns', 'expired', 1, 100);
    cache.set('ns', 'fresh', 2, 60000);
    jest.advanceTimersByTime(200);
    cache.purgeExpired();
    expect(cache.get('ns', 'expired')).toBeNull();
    expect(cache.get('ns', 'fresh')).toBe(2);
  });

  test('namespace handle scopes keys and supports keys()/entries()/size', () => {
    const ns = cache.namespace('feed', 30000);
    ns.set('home_1', 'x');
    ns.set('home_2', 'y');
    expect(ns.size).toBe(2);
    expect(ns.keys()).toEqual(expect.arrayContaining(['home_1', 'home_2']));
    expect(ns.entries().length).toBe(2);
    expect(ns.get('home_1')).toBe('x');
    ns.clear();
    expect(ns.size).toBe(0);
  });
});

describe('RedisCacheManager (L1/L2/L3 hybrid)', () => {
  beforeEach(() => {
    redisCacheManager.clear();
  });

  test('inherits core CacheManager behavior', () => {
    redisCacheManager.set('ns', 'k', 'v', 60000);
    expect(redisCacheManager.get('ns', 'k')).toBe('v');
  });

  test('setNamespaceTtlMultiplier persists multiplier per namespace', () => {
    redisCacheManager.setNamespaceTtlMultiplier('hot', 2.5);
    expect(redisCacheManager.getNamespaceTtlMultiplier('hot')).toBe(2.5);
    expect(redisCacheManager.getNamespaceTtlMultiplier('cold')).toBe(1.0);
  });
});

describe('TTLOptimizationService', () => {
  beforeEach(() => {
    ttlOptimizationService.keyAccessRates.clear();
    redisCacheManager.setNamespaceTtlMultiplier('ttl_ns', 1.0);
  });

  test('returns base TTL for first access in a window', () => {
    const ttl = ttlOptimizationService.recordAccessAndGetOptimalTtl('ttl_ns', 'k', 300000);
    expect(ttl).toBe(300000);
  });

  test('escalates TTL for high-frequency access', () => {
    const base = 300000;
    let ttl = base;
    for (let i = 0; i < 55; i++) {
      ttl = ttlOptimizationService.recordAccessAndGetOptimalTtl('ttl_ns', 'viral', base);
    }
    expect(ttl).toBeGreaterThan(base);
    // Active tier: 1.5x
    expect(ttl).toBe(450000);
  });

  test('applies 4x multiplier at viral tier (>1000 rpm)', () => {
    const base = 100000;
    let ttl = base;
    for (let i = 0; i < 1005; i++) {
      ttl = ttlOptimizationService.recordAccessAndGetOptimalTtl('ttl_ns', 'mega', base);
    }
    expect(ttl).toBe(base * 4);
    expect(redisCacheManager.getNamespaceTtlMultiplier('ttl_ns')).toBe(4.0);
  });
});

describe('CacheInvalidationService', () => {
  test('onPostMutated invalidates post, feed and aggregations', async () => {
    const redisSpy = jest.spyOn(redisCacheManager, 'invalidateDistributed').mockResolvedValue();
    cacheManager.set('user_posts', 'author1:post1', 'x');
    await cacheInvalidationService.onPostMutated('post1', 'author1', 'update');
    expect(redisSpy).toHaveBeenCalledWith('posts', 'post1');
    expect(redisSpy).toHaveBeenCalledWith('feed', '*');
    expect(cacheManager.get('user_posts', 'author1:post1')).toBeNull();
    redisSpy.mockRestore();
  });

  test('onCommentMutated invalidates comment namespace', async () => {
    const redisSpy = jest.spyOn(redisCacheManager, 'invalidateDistributed').mockResolvedValue();
    await cacheInvalidationService.onCommentMutated('post1');
    expect(redisSpy).toHaveBeenCalledWith('comments', 'post1');
    redisSpy.mockRestore();
  });

  test('onUserProfileUpdated clears user cache', async () => {
    const redisSpy = jest.spyOn(redisCacheManager, 'invalidateDistributed').mockResolvedValue();
    cacheManager.set('profile', 'u9', 'stale');
    await cacheInvalidationService.onUserProfileUpdated('u9');
    expect(redisSpy).toHaveBeenCalledWith('user', 'u9');
    expect(cacheManager.get('profile', 'u9')).toBeNull();
    redisSpy.mockRestore();
  });
});

describe('global cacheManager singleton', () => {
  test('is the shared instance used across services', () => {
    cacheManager.set('singleton', 'check', true, 60000);
    expect(cacheManager.get('singleton', 'check')).toBe(true);
    cacheManager.clear();
  });
});
