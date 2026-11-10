/**
 * src/__tests__/messagingInboxBlockFiltering.test.js
 *
 * N221 made a block terminal for *creating* a DM (client guard + the
 * `blockEdgeBetween` rule), but the existing direct thread stayed in the
 * recipient's inbox: `getUserConversations` returned every conversation whose
 * `participants` included the viewer, so a blocked user's thread kept rendering
 * (and the block appeared to have done nothing). This suite pins the read-path
 * fix: a direct conversation whose other participant is on either side of a
 * block edge is dropped, mutes are NOT dropped, and blocking/unblocking drops
 * the cached inbox so the change is immediate.
 */

import { jest } from '@jest/globals';

const QueryConstraintBrand = Symbol('QueryConstraint');
const isConstraint = (c) => c && c[QueryConstraintBrand] === true;

const firestoreMock = {
  collection: () => ({}),
  collectionGroup: () => ({}),
  doc: (_db, coll, id) => ({ __doc: true, coll, id }),
  getDoc: async (ref) => ({ id: ref.id, exists: () => ref.id in (globalThis.__docs || {}) }),
  getDocs: async (q) => {
    const ids = (globalThis.__docs && Object.keys(globalThis.__docs)) || [];
    const docs = ids.map((id) => ({ id, data: () => globalThis.__docs[id] }));
    return { docs, size: docs.length, empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) };
  },
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

// Block edges: `blocked` = viewer -> other, `blocked_by` = other -> viewer.
const listEdges = jest.fn(async (_uid, kind) => ({ ids: globalThis.__edges?.[kind] || [] }));
jest.unstable_mockModule('../services/socialGraphService.js', () => ({
  getSocialGraphService: () => ({ listEdges, invalidate: () => {}, getRelationship: async () => ({ isBlocking: false }) }),
  socialGraphService: { listEdges },
}));

const { getMessagingService } = await import('../services/messagesService.js');

function seedConversations(convs) {
  globalThis.__docs = {};
  for (const c of convs) globalThis.__docs[c.id] = { ...c };
}

function primeService(svc) {
  svc.initialized = true;
  svc.firestore = {};
  svc.fs = firestoreMock;
  svc.auth = { currentUser: { uid: 'viewer' } };
  svc._getParticipantDetailsBatch = async (ids) =>
    Object.fromEntries(ids.map((id) => [id, { uid: id }]));
  svc._injectConversationListAds = async (list) => list;
  svc.messagesCache.clear();
  return svc;
}

beforeEach(() => {
  globalThis.__edges = {};
  listEdges.mockClear();
});

test('drops a direct thread with a user the viewer blocked', async () => {
  seedConversations([
    { id: 'd_blocked', type: 'direct', participants: ['viewer', 'blockedUser'], isActive: true },
    { id: 'd_ok', type: 'direct', participants: ['viewer', 'friend'], isActive: true },
  ]);
  globalThis.__edges = { blocked: ['blockedUser'] };
  const svc = primeService(getMessagingService());

  const res = await svc.getUserConversations('viewer', { limit: 20 });
  expect(res.conversations.map((c) => c.id)).toEqual(['d_ok']);
});

test('drops a direct thread with a user who blocked the viewer (reverse edge)', async () => {
  seedConversations([
    { id: 'd_reverse', type: 'direct', participants: ['viewer', 'blocker'], isActive: true },
  ]);
  globalThis.__edges = { blocked_by: ['blocker'] };
  const svc = primeService(getMessagingService());

  const res = await svc.getUserConversations('viewer', { limit: 20 });
  expect(res.conversations).toHaveLength(0);
});

test('does NOT drop a muted conversation and keeps group threads', async () => {
  seedConversations([
    { id: 'd_muted', type: 'direct', participants: ['viewer', 'mutedUser'], isActive: true },
    { id: 'g_group', type: 'group', participants: ['viewer', 'a', 'b'], isActive: true },
  ]);
  // Only a mute edge exists (mutes are not part of the blocked-pair read).
  globalThis.__edges = {};
  const svc = primeService(getMessagingService());

  const res = await svc.getUserConversations('viewer', { limit: 20 });
  expect(res.conversations.map((c) => c.id).sort()).toEqual(['d_muted', 'g_group']);
});

test('fails open (returns the inbox) when the block-edge read throws', async () => {
  seedConversations([
    { id: 'd_any', type: 'direct', participants: ['viewer', 'other'], isActive: true },
  ]);
  listEdges.mockRejectedValueOnce(new Error('graph offline'));
  const svc = primeService(getMessagingService());

  const res = await svc.getUserConversations('viewer', { limit: 20 });
  expect(res.conversations.map((c) => c.id)).toEqual(['d_any']);
});

test('getMessageRequests hides a pending request from a blocked sender', async () => {
  globalThis.__docs = {};
  globalThis.__docs = { req1: { senderId: 'blockedSender', recipientId: 'viewer', status: 'pending' } };
  globalThis.__edges = { blocked: ['blockedSender'] };
  const svc = primeService(getMessagingService());
  // getMessageRequests queries message_requests; the mock getDocs returns the
  // seeded docs regardless of collection, which is what we want here.
  const res = await svc.getMessageRequests('viewer', { limit: 20 });
  expect(res.requests).toHaveLength(0);
});

test('blockUser drops the cached inbox so the block takes effect immediately', async () => {
  seedConversations([
    { id: 'd_target', type: 'direct', participants: ['viewer', 'target'], isActive: true },
  ]);
  globalThis.__edges = {};
  const svc = primeService(getMessagingService());

  // Prime the cache with the thread visible.
  const before = await svc.getUserConversations('viewer', { limit: 20 });
  expect(before.conversations.map((c) => c.id)).toEqual(['d_target']);

  // Block the other party, then re-read: the cached list must have been dropped.
  globalThis.__edges = { blocked: ['target'] };
  await svc.blockUser('viewer', 'target');

  const after = await svc.getUserConversations('viewer', { limit: 20, cacheFirst: false });
  expect(after.conversations).toHaveLength(0);
});
