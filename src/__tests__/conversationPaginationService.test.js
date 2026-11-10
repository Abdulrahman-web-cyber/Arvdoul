/**
 * src/__tests__/conversationPaginationService.test.js
 *
 * `messagesService.getUserConversations` returned `nextCursor` (a conversation
 * id) but fed `options.startAfter` straight into `startAfter()` — which needs a
 * DocumentSnapshot, not an id string — so every "load more" threw. It also set
 * the cursor from the last doc of the 2x over-fetch window (not the last doc
 * actually returned), skipping conversations the caller never saw. Both fixed.
 */

import { jest } from '@jest/globals';

const QueryConstraintBrand = Symbol('QueryConstraint');
const isConstraint = (c) => c && c[QueryConstraintBrand] === true;

const firestoreMock = {
  collection: () => ({}),
  collectionGroup: () => ({}),
  doc: (_db, coll, id) => ({ __doc: true, coll, id }),
  getDoc: async (ref) => ({ id: ref.id, exists: () => ref.id in globalThis.__docs }),
  getDocs: async (q) => {
    const ids = globalThis.__pages[q.__cursorId ?? '__start__'] ?? [];
    const limited = q.__limit ? ids.slice(0, q.__limit) : ids;
    const docs = limited.map((id) => ({ id, data: () => globalThis.__docs[id] || {} }));
    return { docs, size: docs.length, empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) };
  },
  query: (base, ...constraints) => {
    for (const c of constraints) {
      if (!isConstraint(c)) throw new Error(`Invalid QueryConstraint: ${String(c)}`);
    }
    const startAfter = constraints.find((c) => c.__startAfter);
    const limitC = constraints.find((c) => c.__limit);
    return { __cursorId: startAfter ? startAfter.__cursorId : undefined, __limit: limitC?.__limit };
  },
  where: () => ({ [QueryConstraintBrand]: true }),
  orderBy: () => ({ [QueryConstraintBrand]: true }),
  limit: (n) => ({ [QueryConstraintBrand]: true, __limit: n }),
  startAfter: (snap) => ({ [QueryConstraintBrand]: true, __startAfter: true, __cursorId: snap.id }),
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

const { getMessagingService } = await import('../services/messagesService.js');

const convs = (n, prefix = 'c') =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, participants: ['viewer', `u${i}`] }));

function seed(docs) {
  globalThis.__docs = {};
  for (const d of docs) globalThis.__docs[d.id] = { participants: d.participants };
}

beforeEach(() => {
  globalThis.__docs = {};
  globalThis.__pages = {};
});

test('getUserConversations resolves the string cursor and returns the last RETURNED id', async () => {
  const svc = getMessagingService();
  svc.initialized = true;
  svc.firestore = {};
  svc.fs = firestoreMock;
  svc.auth = { currentUser: { uid: 'viewer' } };
  svc._getParticipantDetailsBatch = async (ids) =>
    Object.fromEntries(ids.map((id) => [id, { uid: id }]));
  svc._injectConversationListAds = async (list) => list;
  svc.messagesCache.clear();

  seed(convs(40));
  globalThis.__pages = {
    __start__: convs(40).map((c) => c.id),
    c19: convs(40).slice(20).map((c) => c.id),
  };

  // Page 1: service over-fetches 2x (limit 20 -> 40) but must return 20 and
  // cursor at the 20th RETURNED conversation, not the 40th fetched.
  const page1 = await svc.getUserConversations('viewer', { limit: 20 });
  expect(page1.conversations.map((c) => c.id)).toHaveLength(20);
  expect(page1.conversations.map((c) => c.id)).toEqual(convs(20).map((c) => c.id));
  expect(page1.hasMore).toBe(true);
  expect(page1.nextCursor).toBe('c19');

  // Page 2: the string cursor is resolved to a snapshot and applied. Passing the
  // raw id to startAfter() previously threw.
  const page2 = await svc.getUserConversations('viewer', { limit: 20, startAfter: 'c19' });
  expect(page2.conversations.map((c) => c.id)).toEqual(convs(40).slice(20).map((c) => c.id));
  expect(page2.hasMore).toBe(false);
  expect(page2.nextCursor).toBeNull();
});
