/**
 * src/__tests__/inboxPreviewPresenceWiring.test.js
 *
 * The messaging inbox rendered three fabricated/absent values (N452-N454):
 *   - `presenceOnline` — a field NO writer set, so the online dot was always off;
 *   - `c.lastMessage`   — a field NO writer set, so every row showed "No
 *     messages yet" even though `sendMessage` writes `last_messages/{cid}`;
 *   - `c.unreadCounts[uid]` — a field NO writer set, so every unread badge was 0
 *     even though the server maintains sharded `unread_counters`.
 * This suite pins the read-path fixes: the service now attaches a real
 * `lastMessage` (from `last_messages`), a real `presenceOnline` (from the
 * scope-gated `user_presence` doc via the social-graph spine) and a real
 * `unreadCount` (summed shards), and the screen renders from those.
 */

import { jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const QueryConstraintBrand = Symbol('QueryConstraint');
const isConstraint = (c) => c && c[QueryConstraintBrand] === true;

const firestoreMock = {
  collection: () => ({}),
  collectionGroup: () => ({}),
  documentId: () => ({ __docId: true }),
  doc: (_db, coll, id) => ({ __doc: true, coll, id }),
  getDoc: async (ref) => ({ id: ref.id, exists: () => ref.id in (globalThis.__docs || {}) }),
  getDocs: async (q) => {
    // The inbox enrichment reads `last_messages` (preview) and
    // `unread_counters/*/shards` (unread). Serve from the seeded maps.
    const ids = globalThis.__lastMessages || {};
    const shards = globalThis.__unreadShards || {};
    const coll = q?.__collection;
    let docs = [];
    if (coll === 'conversations') {
      docs = Object.keys(globalThis.__docs || {}).map((id) => ({ id, data: () => globalThis.__docs[id] }));
    } else if (coll === 'last_messages') {
      docs = Object.keys(ids).map((id) => ({ id, data: () => ids[id] }));
    } else if (coll === 'unread_counters') {
      docs = (shards[q.__counterId] || []).map((count, i) => ({ id: String(i), data: () => ({ count }) }));
    }
    return { docs, size: docs.length, empty: docs.length === 0, forEach: (cb) => docs.forEach(cb) };
  },
  query: (base, ...constraints) => {
    for (const c of constraints) {
      if (!isConstraint(c)) throw new Error(`Invalid QueryConstraint: ${String(c)}`);
    }
    return { ...(base || {}) };
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

// `collection()` is called with the collection name; carry it on the returned
// token so `getDocs` can route to the right seeded map. The unread path calls
// `collection(db, 'unread_counters', counterId, 'shards')`.
firestoreMock.collection = (...args) => {
  if (args.length === 1) return { __collection: args[0] };
  const [, name, counterId] = args;
  return { __collection: name, __counterId: counterId };
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

const presenceMap = new Map([['u0', { isOnline: true }]]);
jest.unstable_mockModule('../services/socialGraphService.js', () => ({
  getSocialGraphService: () => ({
    listEdges: async () => ({ ids: [] }),
    invalidate: () => {},
    getRelationship: async () => ({ isBlocking: false, isBlocking2: false }),
    getPresenceMap: async () => presenceMap,
  }),
  socialGraphService: {},
}));

const { getMessagingService } = await import('../services/messagesService.js');

function prime(svc) {
  svc.initialized = true;
  svc.firestore = {};
  svc.fs = firestoreMock;
  svc.auth = { currentUser: { uid: 'viewer' } };
  svc._getParticipantDetailsBatch = async (ids) =>
    Object.fromEntries(ids.map((id) => [id, { id, uid: id }]));
  svc._injectConversationListAds = async (list) => list;
  svc.messagesCache.clear();
  return svc;
}

beforeEach(() => {
  globalThis.__docs = {};
  globalThis.__lastMessages = {};
  globalThis.__unreadShards = {};
});

describe('inbox preview / presence / unread are real', () => {
  test('_fetchLastMessages reads last_messages and returns a Map', async () => {
    globalThis.__lastMessages = {
      c1: { text: 'hello there', type: 'text', senderId: 'u1' },
      c2: { text: 'photo', type: 'image', senderId: 'u2' },
    };
    const svc = prime(getMessagingService());
    const map = await svc._fetchLastMessages(['c1', 'c2']);
    expect(map.get('c1')).toMatchObject({ text: 'hello there', type: 'text' });
    expect(map.get('c2')).toMatchObject({ type: 'image' });
  });

  test('_fetchUnreadCounts sums the shards per conversation', async () => {
    globalThis.__unreadShards = { unread_c1_viewer: [2, 3], unread_c2_viewer: [1] };
    const svc = prime(getMessagingService());
    const map = await svc._fetchUnreadCounts('viewer', ['c1', 'c2']);
    expect(map.get('c1')).toBe(5);
    expect(map.get('c2')).toBe(1);
  });

  test('getUserConversations attaches real lastMessage / presenceOnline / unreadCount', async () => {
    globalThis.__docs = {
      c1: { id: 'c1', type: 'direct', participants: ['viewer', 'u0'] },
    };
    globalThis.__lastMessages = { c1: { text: 'hey', type: 'text', senderId: 'u0' } };
    globalThis.__unreadShards = { unread_c1_viewer: [4] };
    const svc = prime(getMessagingService());

    const res = await svc.getUserConversations('viewer', { limit: 20 });
    const c = res.conversations.find((x) => x.id === 'c1');
    expect(c.lastMessage).toMatchObject({ text: 'hey' });
    expect(c.presenceOnline).toBe(true);
    expect(c.unreadCount).toBe(4);
    // The roll-up is the sum of the RETURNED rows, not a phantom field.
    expect(res.unreadCount).toBe(4);
  });

  test('a conversation with no last message stays honest (null, not a fake object)', async () => {
    globalThis.__docs = { c1: { id: 'c1', type: 'direct', participants: ['viewer', 'u0'] } };
    const svc = prime(getMessagingService());
    const res = await svc.getUserConversations('viewer', { limit: 20 });
    expect(res.conversations[0].lastMessage).toBeNull();
  });
});

describe('MessagingScreen renders from the real fields', () => {
  const screen = fs.readFileSync(path.join(root, 'src/screens/MessagingScreen.jsx'), 'utf8');

  test('no dead hasAttachment / hasPhoto / photoPreview props', () => {
    expect(screen).not.toMatch(/hasAttachment/);
    expect(screen).not.toMatch(/hasPhoto/);
    expect(screen).not.toMatch(/photoPreview/);
  });

  test('the row attachment badge is driven by the real attachmentType', () => {
    expect(screen).toMatch(/attachmentType/);
  });

  test('the unread badge reads the real unreadCount (never unreadCounts)', () => {
    expect(screen).not.toMatch(/unreadCounts/);
    expect(screen).toMatch(/unread: Number\(c\.unreadCount\)/);
  });

  test('the presence dot reads the real presenceOnline and is direct-only', () => {
    expect(screen).toMatch(/activeDot: Boolean\(c\.presenceOnline\)/);
    expect(screen).toMatch(/item\.type === 'direct' && item\.activeDot/);
  });
});
