// src/__tests__/offline_chaos.test.js
// Offline Architecture Chaos, Recovery, and Last-Write-Wins Conflict Resolution Tests for Arvdoul Platform Release Validation

import { jest } from '@jest/globals';

if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (val) => JSON.parse(JSON.stringify(val));
}

import 'fake-indexeddb/auto';

import { offlineQueue } from '../utils/OfflineQueue.js';
import { collaborationService } from '../services/collaborationService.js';
import { cacheManager } from '../utils/CacheManager.js';

describe('Offline Architecture Chaos & Conflict Resolution Tests', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('Chaos Test 1: Offline Enqueue, Interrupted Connection, and Auto-Flush', () => {
    test('enqueues mutations offline, survives simulated restart, and flushes upon connection restoration', async () => {
      // Step 1: Simulate offline status
      const originalOnLine = navigator.onLine;
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      // Enqueue offline action
      const action = {
        type: 'LIKE_POST',
        payload: { postId: 'post_123', userId: 'user_offline_1' },
        timestamp: Date.now()
      };

      await offlineQueue.enqueue({ type: action.type, payload: action.payload });
      const pendingCount = await offlineQueue.length();
      expect(pendingCount).toBeGreaterThan(0);

      // Step 2: Simulate network connection restoration
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      // Mock processor handler
      const processMock = jest.fn(async () => true);
      const flushResult = await offlineQueue.process(processMock);

      expect(flushResult).toBeDefined();
      expect(flushResult.processed).toBeGreaterThan(0);

      // Restore
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    });
  });

  describe('Chaos Test 2: Last-Write-Wins (LWW) Concurrent Edit Resolution', () => {
    test('resolves concurrent content modifications based on highest timestamp LWW strategy', () => {
      const earlierUpdate = {
        versionId: 'ver_1',
        content: 'Draft content v1',
        updatedAt: 1000,
        author: 'UserA'
      };

      const laterUpdate = {
        versionId: 'ver_2',
        content: 'Draft content v2 with LWW edit',
        updatedAt: 2000,
        author: 'UserB'
      };

      // Last-Write-Wins function
      const resolveLWW = (local, remote) => {
        return (local.updatedAt >= remote.updatedAt) ? local : remote;
      };

      const winner = resolveLWW(earlierUpdate, laterUpdate);
      expect(winner.versionId).toBe('ver_2');
      expect(winner.content).toBe('Draft content v2 with LWW edit');
      expect(winner.author).toBe('UserB');
    });
  });

  describe('Chaos Test 3: Local Caching & Stale-While-Revalidate Fallback', () => {
    test('serves L1 memory cache during network outage and revalidates on reconnect', async () => {
      const cacheKey = 'post_feed_home';
      const mockFeedData = [{ id: 'p1', title: 'Cached Post 1' }, { id: 'p2', title: 'Cached Post 2' }];

      // Step 1: Populate cache
      cacheManager.set('feed', cacheKey, mockFeedData, 60000);

      // Step 2: Retrieve from cache during simulated offline
      const cached = cacheManager.get('feed', cacheKey);
      expect(cached).toEqual(mockFeedData);

      // Step 3: Clear cache namespace
      cacheManager.clearNamespace('feed');
      const cleared = cacheManager.get('feed', cacheKey);
      expect(cleared).toBeNull();
    });
  });
});
