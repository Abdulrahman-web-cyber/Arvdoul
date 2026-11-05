/**
 * src/__tests__/idempotencyKey.test.js
 * Real assertions for the live double-tap/dedupe utility used by
 * monetizationService, liveService, messagesService and storageService.
 */

import { IdempotencyStore } from '../utils/IdempotencyKey.js';

describe('IdempotencyStore', () => {
  let store;

  beforeEach(() => {
    localStorage.clear();
    store = new IdempotencyStore({ defaultTtlMs: 5000 });
  });

  test('generate returns distinct keys for different parts', () => {
    const a = store.generate('like', ['u1', 'p1']);
    const b = store.generate('like', ['u1', 'p2']);
    expect(a).not.toBe(b);
    expect(a.startsWith('like:u1:p1:')).toBe(true);
  });

  test('checkAndRecord is true once then false within the TTL', () => {
    const key = store.generate('follow', ['u1', 'u2']);
    expect(store.checkAndRecord(key)).toBe(true);
    expect(store.checkAndRecord(key)).toBe(false);
  });

  test('release allows the same key to be recorded again', () => {
    const key = store.generate('post', ['u1']);
    expect(store.checkAndRecord(key)).toBe(true);
    store.release(key);
    expect(store.isDuplicate(key)).toBe(false);
    expect(store.checkAndRecord(key)).toBe(true);
  });

  test('isDuplicate reflects recorded state', () => {
    const key = store.generate('tip', ['u1', 'u2']);
    expect(store.isDuplicate(key)).toBe(false);
    store.checkAndRecord(key);
    expect(store.isDuplicate(key)).toBe(true);
  });

  test('expired keys are not duplicates', () => {
    const key = store.generate('exp', ['u1']);
    expect(store.checkAndRecord(key, -1)).toBe(true);
    expect(store.isDuplicate(key)).toBe(false);
  });

  test('persisted mirror dedupes across instances (multi-tab)', () => {
    const key = store.generate('shared', ['u1']);
    expect(store.checkAndRecord(key)).toBe(true);
    const other = new IdempotencyStore({ defaultTtlMs: 5000 });
    expect(other.checkAndRecord(key)).toBe(false);
  });

  test('survives a large number of keys (opportunistic cleanup)', () => {
    for (let i = 0; i < 1200; i++) store.checkAndRecord(`k:${i}`, -1);
    expect(store.checkAndRecord('fresh', 5000)).toBe(true);
  });
});
