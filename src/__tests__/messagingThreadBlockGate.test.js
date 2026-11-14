/**
 * src/__tests__/messagingThreadBlockGate.test.js
 *
 * N443 — a block hid the direct thread from the inbox (N245) but the thread
 * itself stayed openable by a direct link (`/chat/:conversationId`).
 * `getConversation` is the single read entry point for a thread
 * (`getMessages`, `subscribeToConversation`, `reactToMessage`,
 * `deleteMessage`, `editMessage` all route through it), and it had no block
 * gate — so a blocked pair could still read/write the thread by id.
 *
 * This suite pins the gate: a `direct` thread between a blocked pair (either
 * direction) resolves to `{ success: false }`, while groups/channels and
 * unblocked direct threads are unaffected, and the gate also covers the
 * cache-first path.
 */

import { jest } from '@jest/globals';

const QueryConstraintBrand = Symbol('QueryConstraint');
const isConstraint = (c) => c && c[QueryConstraintBrand] === true;

const firestoreMock = {
  collection: () => ({}),
  collectionGroup: () => ({}),
  doc: (_db, coll, id) => ({ __doc: true, coll, id }),
  getDoc: async (ref) => ({
    id: ref.id,
    exists: () => ref.id in (globalThis.__docs || {}),
    data: () => (globalThis.__docs || {})[ref.id],
  }),
  getDocs: async () => ({ docs: [], size: 0, empty: true, forEach: () => {} }),
  query: (base, ...constraints) => {
    for (const c of constraints) {
      if (!isConstraint(c)) throw new Error(`Invalid QueryConstraint: ${String(c)}`);
    }
    return {};
  },
  where: () => ({ [QueryConstraintBrand]: true }),
  orderBy: () => ({ [QueryConstraintBrand]: true }),
  limit: () => ({ [QueryConstraintBrand]: true }),
  startAfter: () => ({ [QueryConstraintBrand]: true }),
  setDoc: async () => {},
  updateDoc: async () => {},
  deleteDoc: async () => {},
  addDoc: async () => ({ id: 'new' }),
  serverTimestamp: () => null,
  increment: (n) => n,
  arrayUnion: () => ({}),
  arrayRemove: () => ({}),
  writeBatch: () => ({ set: () => {}, update: () => {}, commit: async () => {} }),
  runTransaction: async () => {},
  onSnapshot: () => () => {},
  getCountFromServer: async () => ({ data: () => ({ count: 0 }) }),
  Timestamp: { now: () => ({ toDate: () => new Date() }) },
};

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

// `getRelationship` reports both directions of a block for one pair.
const getRelationship = jest.fn(async () => ({ isBlocking: false, isBlockedBy: false }));
jest.unstable_mockModule('../services/socialGraphService.js', () => ({
  getSocialGraphService: () => ({ listEdges: async () => ({ ids: [] }), invalidate: () => {}, getRelationship }),
  socialGraphService: { getRelationship },
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

beforeEach(() => {
  globalThis.__docs = {};
  getRelationship.mockReset();
  getRelationship.mockResolvedValue({ isBlocking: false, isBlockedBy: false });
});

test('a direct thread between a blocked pair is not readable by id', async () => {
  globalThis.__docs = { d1: { type: 'direct', participants: ['viewer', 'other'], isActive: true } };
  getRelationship.mockResolvedValue({ isBlocking: true, isBlockedBy: false });
  const svc = primeService(getMessagingService());

  const res = await svc.getConversation('d1', { cacheFirst: false });
  expect(res.success).toBe(false);
});

test('a direct thread where the other party blocked the viewer is not readable', async () => {
  globalThis.__docs = { d2: { type: 'direct', participants: ['viewer', 'blocker'], isActive: true } };
  getRelationship.mockResolvedValue({ isBlocking: false, isBlockedBy: true });
  const svc = primeService(getMessagingService());

  const res = await svc.getConversation('d2', { cacheFirst: false });
  expect(res.success).toBe(false);
});

test('an unblocked direct thread still resolves', async () => {
  globalThis.__docs = { d3: { type: 'direct', participants: ['viewer', 'friend'], isActive: true } };
  const svc = primeService(getMessagingService());

  const res = await svc.getConversation('d3', { cacheFirst: false });
  expect(res.success).toBe(true);
  expect(res.conversation.id).toBe('d3');
});

test('a block never hides a group or channel thread', async () => {
  globalThis.__docs = {
    g1: { type: 'group', participants: ['viewer', 'a', 'b'], isActive: true },
    c1: { type: 'channel', participants: ['viewer', 'x', 'y'], isActive: true },
  };
  getRelationship.mockResolvedValue({ isBlocking: true, isBlockedBy: true });
  const svc = primeService(getMessagingService());

  expect((await svc.getConversation('g1', { cacheFirst: false })).success).toBe(true);
  expect((await svc.getConversation('c1', { cacheFirst: false })).success).toBe(true);
});

test('the block gate also covers the cache-first path', async () => {
  globalThis.__docs = { d4: { type: 'direct', participants: ['viewer', 'other'], isActive: true } };
  const svc = primeService(getMessagingService());

  // Populate the cache while unblocked…
  expect((await svc.getConversation('d4', { cacheFirst: false })).success).toBe(true);
  // …then block and read from cache.
  getRelationship.mockResolvedValue({ isBlocking: true, isBlockedBy: false });
  const res = await svc.getConversation('d4', { cacheFirst: true });
  expect(res.success).toBe(false);
});

test('fails open when the graph read throws (never locks a user out of their thread)', async () => {
  globalThis.__docs = { d5: { type: 'direct', participants: ['viewer', 'other'], isActive: true } };
  getRelationship.mockRejectedValue(new Error('graph offline'));
  const svc = primeService(getMessagingService());

  const res = await svc.getConversation('d5', { cacheFirst: false });
  expect(res.success).toBe(true);
});
