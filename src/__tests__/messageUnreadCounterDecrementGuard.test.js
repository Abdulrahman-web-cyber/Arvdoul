/**
 * src/__tests__/messageUnreadCounterDecrementGuard.test.js
 *
 * N487 — the sharded message unread counters (`unread_counters`,
 * `user_unread_totals`) were decremented by picking a RANDOM shard and writing
 * `Math.max(0, current - delta)`. The shards are a SUM (every reader adds all of
 * them), so a decrement that landed on an empty shard was clamped to nothing
 * and the unread badge drifted upward and never reached zero. `deleteMessage`
 * (delete-for-me) additionally called `_decrementUnreadCounter` WITHOUT the
 * required transaction, so it threw `TypeError` and the unread total was never
 * reduced. The delete-for-everyone branch also issued `transaction.get()`
 * AFTER its writes, which the Firestore SDK rejects.
 *
 * This suite drives the real service: it asserts the shard delta is applied
 * with `increment` (never a clamped read-modify-write), that no transaction
 * reads after it writes, and that both delete branches move the total.
 */

import { jest } from '@jest/globals';

const firestoreMock = {
  collection: () => ({}),
  collectionGroup: () => ({}),
  documentId: () => ({ __docId: true }),
  doc: (_db, ...segs) => ({ __doc: true, path: segs.join('/') }),
  getDoc: async (ref) => snapFor(ref),
  getDocs: async () => ({ docs: [], size: 0, empty: true, forEach: () => {} }),
  query: () => ({}),
  where: () => ({}),
  orderBy: () => ({}),
  limit: () => ({}),
  startAfter: () => ({}),
  setDoc: async () => {},
  updateDoc: async () => {},
  deleteDoc: async () => {},
  addDoc: async () => ({ id: 'new' }),
  serverTimestamp: () => null,
  increment: (n) => ({ __increment: n }),
  arrayUnion: () => ({ __arrayUnion: true }),
  arrayRemove: () => ({}),
  writeBatch: () => ({ set: () => {}, update: () => {}, commit: async () => {} }),
  runTransaction: async (_db, cb) => {
    // Firestore gives each runTransaction a fresh transaction, so the
    // read-before-write contract is per-transaction. Reset the flag so a
    // method that opens two transactions (e.g. getConversation then the
    // unread reset) is not falsely flagged.
    globalThis.__tx._wrote = false;
    return cb(globalThis.__tx);
  },
  onSnapshot: () => () => {},
  getCountFromServer: async () => ({ data: () => ({ count: 0 }) }),
  Timestamp: { now: () => ({ toDate: () => new Date() }), fromDate: (d) => ({ __ts: d }) },
};

function snapFor(ref) {
  const doc = (globalThis.__docs || {})[ref.path];
  return {
    id: ref.path?.split('/').pop(),
    exists: () => Boolean(doc),
    data: () => doc,
  };
}

jest.unstable_mockModule('firebase/firestore', () => firestoreMock);
jest.unstable_mockModule('firebase/database', () => ({
  getDatabase: () => ({}), ref: () => ({}), onValue: () => () => {}, set: () => {},
  remove: () => {}, onDisconnect: () => ({ set: () => {} }), push: () => ({}),
}));
jest.unstable_mockModule('firebase/storage', () => ({
  ref: () => ({}), uploadBytesResumable: () => ({}), getDownloadURL: async () => '',
  deleteObject: async () => {}, getStorage: () => ({}),
}));
jest.unstable_mockModule('../firebase/firebase', () => ({
  getFirestoreInstance: async () => ({}),
  getAuthInstance: async () => ({ currentUser: { uid: 'viewer' } }),
}));
jest.unstable_mockModule('idb', () => ({ openDB: async () => ({}) }));
jest.unstable_mockModule('../services/featureFlagService.js', () => ({
  featureFlagService: { isEnabled: () => false },
}));
jest.unstable_mockModule('../services/socialGraphService.js', () => ({
  getSocialGraphService: () => ({ listEdges: async () => ({ ids: [] }), invalidate: () => {}, getRelationship: async () => ({ isBlocking: false, isBlockedBy: false }) }),
  socialGraphService: { getRelationship: async () => ({ isBlocking: false, isBlockedBy: false }) },
}));

const { getMessagingService } = await import('../services/messagesService.js');

function primeService(svc) {
  svc.initialized = true;
  svc.firestore = {};
  svc.fs = firestoreMock;
  svc.auth = { currentUser: { uid: 'viewer' } };
  svc._getParticipantDetailsBatch = async (ids) => Object.fromEntries(ids.map((id) => [id, { uid: id }]));
  svc.conversationsCache.clear();
  return svc;
}

// A transaction mock that enforces Firestore's read-before-write contract and
// records the writes so the test can inspect the shard deltas.
function makeTx() {
  return {
    _wrote: false,
    writes: [],
    async get(ref) {
      if (this._wrote) throw new Error('all reads must be executed before all writes');
      return snapFor(ref);
    },
    set(ref, data, opts) { this._wrote = true; this.writes.push({ type: 'set', ref, data, opts }); },
    update(ref, data) { this._wrote = true; this.writes.push({ type: 'update', ref, data }); },
    delete(ref) { this._wrote = true; this.writes.push({ type: 'delete', ref }); },
  };
}

const CONV = 'c1';
const MSG = 'm1';

beforeEach(() => {
  globalThis.__tx = makeTx();
  globalThis.__docs = {
    [`conversations/${CONV}`]: {
      type: 'group',
      participants: ['viewer', 'p1', 'p2'],
      participantCount: 3,
      participantDetails: { viewer: {}, p1: {}, p2: {} },
      hiddenFor: [],
    },
    [`conversations/${CONV}/messages/${MSG}`]: {
      senderId: 'p1',
      readBy: ['p1'],
      isDeleted: false,
      createdAt: { toDate: () => new Date('2026-01-01T00:00:00Z') },
    },
    [`last_messages/${CONV}`]: { messageId: MSG },
  };
});

describe('message unread counters lose no decrements (N487)', () => {
  test('_decrementUnreadCounter applies an atomic increment, not a clamped read-modify-write', async () => {
    const svc = primeService(getMessagingService());
    await svc._decrementUnreadCounter(CONV, 'p2', 1, globalThis.__tx);

    const shardWrites = globalThis.__tx.writes.filter((w) => String(w.ref.path).startsWith('unread_counters/'));
    expect(shardWrites.length).toBe(1);
    expect(shardWrites[0].data.count).toEqual({ __increment: -1 });
    // The old clamped literal must be gone.
    expect(shardWrites[0].data.count).not.toBe(0);
  });

  test('the total counter is decremented with increment too', async () => {
    const svc = primeService(getMessagingService());
    await svc._decrementUnreadCounter(CONV, 'p2', 1, globalThis.__tx);
    const totalWrites = globalThis.__tx.writes.filter((w) => String(w.ref.path).startsWith('user_unread_totals/'));
    expect(totalWrites.length).toBe(1);
    expect(totalWrites[0].data.count).toEqual({ __increment: -1 });
  });

  test('delete-for-me (no ambient transaction) writes the shard directly, not a TypeError', async () => {
    const svc = primeService(getMessagingService());
    globalThis.__docs[`conversations/${CONV}/messages/${MSG}`].senderId = 'viewer';
    const writes = [];
    const origSet = svc.fs.setDoc;
    svc.fs.setDoc = async (ref, data, opts) => { writes.push({ ref, data, opts }); };
    try {
      const res = await svc.deleteMessage(MSG, CONV, 'viewer', false);
      expect(res.success).toBe(true);
    } finally {
      svc.fs.setDoc = origSet;
    }
    const shardWrites = writes.filter((w) => String(w.ref.path).startsWith('unread_counters/'));
    expect(shardWrites.length).toBe(1);
    expect(shardWrites[0].data.count).toEqual({ __increment: -1 });
  });

  test('delete-for-everyone reads before it writes and decrements each unread participant', async () => {
    const svc = primeService(getMessagingService());
    // `__tx` throws if a get() happens after a set/update/delete().
    const res = await svc.deleteMessage(MSG, CONV, 'p1', true);
    expect(res.success).toBe(true);

    const shardWrites = globalThis.__tx.writes.filter((w) => String(w.ref.path).startsWith('unread_counters/'));
    // Both non-sender participants (viewer, p2) are unread.
    expect(shardWrites.length).toBe(2);
    for (const w of shardWrites) expect(w.data.count).toEqual({ __increment: -1 });
    // The message is soft-deleted and the stale last_message repaired.
    const del = globalThis.__tx.writes.find((w) => w.type === 'update' && w.data?.isDeleted === true);
    expect(del).toBeTruthy();
  });

  test('markConversationAsRead clears unread even when read receipts are disabled', async () => {
    const svc = primeService(getMessagingService());
    globalThis.__docs[`conversations/${CONV}`].disableReadReceipts = true;

    await svc.markConversationAsRead(CONV, 'viewer');

    const shardWrites = globalThis.__tx.writes.filter((w) => String(w.ref.path).startsWith('unread_counters/'));
    expect(shardWrites.length).toBeGreaterThan(0);
    for (const w of shardWrites) expect(w.data.count).toBe(0);
    // The `lastRead` receipt must NOT be published when receipts are disabled.
    const receipt = globalThis.__tx.writes.find((w) => w.data && 'lastRead.viewer' in w.data);
    expect(receipt).toBeUndefined();
  });
});
