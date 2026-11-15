/**
 * src/__tests__/collectionsCounterAtomicity.test.js
 *
 * N479 — `collections/{id}.itemCount` must track the `items` subcollection
 * atomically.
 *
 * The previous implementation read the collection doc with `getDoc`, then
 * wrote `itemCount: (data.itemCount || 0) + 1` in a separate `updateDoc`.
 * That is a read-modify-write: two concurrent adds both read the same stale
 * value and both write the same result (a lost update), and a duplicate
 * submit double-counted. `removeFromCollection` clamped with `Math.max(0, …)`,
 * which *hid* a drift (a double-decrement) instead of preventing it.
 *
 * The fix moves both the item write and the counter bump into one Firestore
 * transaction using the atomic `increment()` sentinel, and only decrements
 * when the item actually existed (idempotent remove).
 *
 * These assertions run against the real service with the Firebase singleton
 * and `firebase/firestore` mocked, so a regression to a non-transactional
 * read-modify-write fails the guard.
 */

import { jest } from '@jest/globals';

// ---- Firestore double -------------------------------------------------------
// A tiny in-memory store + transaction engine that faithfully models
// `runTransaction` (serialised), `increment()` (relative), `set`/`update`/
// `delete` and `tx.get`. It is deliberately strict: an `update` that is not
// inside a transaction still works, but the service must call `runTransaction`.
const store = new Map();
let transactionCalls = 0;

const deepGet = (path) => store.get(path) || null;
const deepSet = (path, data) => store.set(path, { ...(deepGet(path) || {}), ...data });

class DocRef {
  constructor(path) { this.path = path; this.id = path.split('/').pop(); }
}
const doc = (firestoreOrRef, ...segments) => {
  if (firestoreOrRef && firestoreOrRef.__collection) {
    return new DocRef(`${firestoreOrRef.__collection}/auto_${Math.random().toString(36).slice(2)}`);
  }
  if (segments.length === 0 && typeof firestoreOrRef === 'string') return new DocRef(firestoreOrRef);
  return new DocRef(['db', ...segments].join('/'));
};
const collection = (_fs, ...segments) => ({ __collection: ['db', ...segments].join('/') });

// `increment()` returns a sentinel the fake transaction applies relatively.
const increment = (n) => ({ __increment: n });

const applyFieldValues = (base, patch) => {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && '__increment' in v) {
      out[k] = (typeof out[k] === 'number' ? out[k] : 0) + v.__increment;
    } else {
      out[k] = v;
    }
  }
  return out;
};

let txQueue = Promise.resolve();
const runTransaction = (_fs, fn) => {
  transactionCalls += 1;
  // Serialise transactions the way Firestore does under contention.
  const run = txQueue.then(async () => {
    const ops = [];
    const tx = {
      async get(ref) {
        const data = deepGet(ref.path);
        return { exists: () => data !== null, data: () => data, id: ref.id };
      },
      set(ref, data) { ops.push(() => store.set(ref.path, applyFieldValues(deepGet(ref.path) || {}, data))); },
      update(ref, data) { ops.push(() => deepSet(ref.path, applyFieldValues(deepGet(ref.path) || {}, data))); },
      delete(ref) { ops.push(() => store.delete(ref.path)); },
    };
    const result = await fn(tx);
    ops.forEach((op) => op());
    return result;
  });
  txQueue = run.then(() => undefined, () => undefined);
  return run;
};

jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: jest.fn(async () => ({ __name: 'db' })),
}));

jest.unstable_mockModule('firebase/firestore', () => ({
  doc,
  collection,
  increment,
  runTransaction,
  serverTimestamp: () => ({ __ts: true }),
  getDoc: async (ref) => ({ exists: deepGet(ref.path) !== null, data: () => deepGet(ref.path), id: ref.id }),
  getDocs: async () => ({ docs: [], size: 0 }),
  addDoc: async (col, data) => {
    const path = `${col.__collection}/auto_${Math.random().toString(36).slice(2)}`;
    store.set(path, { ...data });
    return new DocRef(path);
  },
  updateDoc: async (ref, data) => deepSet(ref.path, applyFieldValues(deepGet(ref.path) || {}, data)),
  deleteDoc: async (ref) => store.delete(ref.path),
  writeBatch: () => ({ delete: () => {}, commit: async () => {} }),
  query: (...a) => ({ a }),
  where: (...a) => ({ a }),
  orderBy: (...a) => ({ a }),
  limit: (...a) => ({ a }),
  startAfter: (...a) => ({ a }),
  serverTimestamp_: null,
}));

const { getCollectionsService } = await import('../services/collectionsService.js');

const newService = () => {
  const svc = getCollectionsService();
  svc.initialized = false;
  return svc;
};

const seedCollection = (id, userId, itemCount = 0) => {
  store.set(`db/collections/${id}`, { userId, name: 'Saved', itemCount, sharedWith: [] });
  return `db/collections/${id}`;
};

describe('N479 — collections.itemCount is atomic', () => {
  beforeEach(() => {
    store.clear();
    transactionCalls = 0;
    txQueue = Promise.resolve();
  });

  test('concurrent adds land on exactly N (no lost update)', async () => {
    seedCollection('c1', 'alice');
    const svc = newService();
    await Promise.all([
      svc.addToCollection('alice', 'c1', { id: 'p1' }),
      svc.addToCollection('alice', 'c1', { id: 'p2' }),
      svc.addToCollection('alice', 'c1', { id: 'p3' }),
    ]);
    expect(deepGet('db/collections/c1').itemCount).toBe(3);
    // The counter bump is inside a transaction, not a bare update.
    expect(transactionCalls).toBe(3);
  });

  test('a remove is idempotent — a repeated remove does not drive the count negative', async () => {
    seedCollection('c2', 'alice');
    const svc = newService();
    const { itemId } = await svc.addToCollection('alice', 'c2', { id: 'p1' });
    expect(deepGet('db/collections/c2').itemCount).toBe(1);

    const first = await svc.removeFromCollection('alice', 'c2', itemId);
    expect(first.success).toBe(true);
    expect(deepGet('db/collections/c2').itemCount).toBe(0);

    // Second remove of the same (now absent) item must be a no-op.
    const second = await svc.removeFromCollection('alice', 'c2', itemId);
    expect(second.success).toBe(true);
    expect(second.alreadyRemoved).toBe(true);
    expect(deepGet('db/collections/c2').itemCount).toBe(0);
  });

  test('a non-owner cannot add to a collection they do not share', async () => {
    seedCollection('c3', 'alice');
    const svc = newService();
    await expect(svc.addToCollection('mallory', 'c3', { id: 'p1' })).rejects.toThrow(/Not authorized/);
    expect(deepGet('db/collections/c3').itemCount).toBe(0);
  });
});

describe('N479 — collectionsService has no read-modify-write counter', () => {
  test('the source uses increment() and runTransaction, never `itemCount … || 0) ± 1`', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/services/collectionsService.js'),
      'utf8',
    );
    expect(src).toContain('runTransaction');
    expect(src).toContain('increment(1)');
    expect(src).toContain('increment(-1)');
    expect(src).not.toMatch(/itemCount:\s*\(data\.itemCount\s*\|\|\s*0\)\s*[+-]\s*1/);
    expect(src).not.toMatch(/itemCount:\s*Math\.max\(0,/);
  });
});
