/**
 * src/__tests__/phase10ScalabilityAndHardening.test.js - Phase 10 Scalability & Production Readiness Tests
 * 
 * Validates:
 * 1. Distributed Sharded Counter behavior and mathematical balance.
 * 2. High-concurrency shard increment distribution.
 * 3. CDN Cache-Control header policies and TTL freshness checks.
 * 4. Resource cleanup and memory leakage prevention guards.
 */

import { jest } from '@jest/globals';
import {
  DistributedShardedCounter,
  getShardId,
  getFirestoreShardRef
} from '../utils/shardedCounter.js';
import {
  CACHE_POLICIES,
  getCacheHeaders,
  isCacheValid
} from '../utils/cacheControl.js';

describe('Phase 10: Scalability Architecture & Sharded Counters', () => {
  describe('DistributedShardedCounter', () => {
    test('initializes with correct number of zeroed shards', () => {
      const counter = new DistributedShardedCounter(10);
      expect(counter.getTotal()).toBe(0);
      const dist = counter.getDistribution();
      expect(Object.keys(dist).length).toBe(10);
      expect(dist.shard_0).toBe(0);
      expect(dist.shard_9).toBe(0);
    });

    test('accurately computes total across distributed concurrent increments', () => {
      const counter = new DistributedShardedCounter(20);
      const numOperations = 500;

      for (let i = 0; i < numOperations; i++) {
        counter.increment(1);
      }

      expect(counter.getTotal()).toBe(numOperations);

      // Verify shards are dispersed and not all loaded into a single shard
      const dist = counter.getDistribution();
      const activeShards = Object.values(dist).filter(v => v > 0);
      expect(activeShards.length).toBeGreaterThan(1);
    });

    test('supports custom delta values and negative decrements', () => {
      const counter = new DistributedShardedCounter(5);
      counter.increment(10);
      counter.increment(25);
      counter.increment(-5);

      expect(counter.getTotal()).toBe(30);
    });

    test('resets shards back to zero cleanly', () => {
      const counter = new DistributedShardedCounter(10);
      counter.increment(100);
      expect(counter.getTotal()).toBe(100);

      counter.reset();
      expect(counter.getTotal()).toBe(0);
    });

    test('generates valid Firestore subcollection shard reference path', () => {
      const ref = getFirestoreShardRef('posts', 'post_abc_123', 'likes', 10);
      expect(ref.path).toMatch(/^posts\/post_abc_123\/sharded_counters\/likes\/shards\/shard_\d+$/);
      expect(ref.shardId).toMatch(/^shard_\d+$/);
    });
  });

  describe('getShardId bounds', () => {
    test('returns shard IDs strictly within requested bounds', () => {
      for (let i = 0; i < 100; i++) {
        const id = getShardId(10);
        const index = parseInt(id.replace('shard_', ''), 10);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(10);
      }
    });

    test('handles edge case inputs safely (1 shard, invalid numbers)', () => {
      expect(getShardId(1)).toBe('shard_0');
      expect(getShardId(0)).toBe('shard_0');
    });
  });

  describe('Cache Control & CDN Directives', () => {
    test('produces correct Cache-Control headers for static assets', () => {
      const headers = getCacheHeaders('IMMUTABLE_STATIC');
      expect(headers['Cache-Control']).toBe(CACHE_POLICIES.IMMUTABLE_STATIC);
      expect(headers['Cache-Control']).toContain('immutable');
    });

    test('enforces strict no-cache for private auth queries', () => {
      const headers = getCacheHeaders('PRIVATE_AUTH');
      expect(headers['Cache-Control']).toContain('no-store');
      expect(headers['Cache-Control']).toContain('no-cache');
    });

    test('evaluates client cache validity accurately', () => {
      const now = Date.now();
      expect(isCacheValid(now - 10000, 30)).toBe(true); // 10s old, 30s TTL -> valid
      expect(isCacheValid(now - 40000, 30)).toBe(false); // 40s old, 30s TTL -> expired
      expect(isCacheValid(null)).toBe(false);
      expect(isCacheValid('invalid')).toBe(false);
    });
  });
});
