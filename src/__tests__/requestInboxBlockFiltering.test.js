/**
 * src/__tests__/requestInboxBlockFiltering.test.js
 *
 * N246. A block is terminal for the *social graph*: `followUser` /
 * `sendFriendRequest` refuse to file a request across a block (N221-class
 * hardening), but a request filed BEFORE the block stayed actionable in the
 * owner's Network tab — `getFollowRequests` / `getFriendRequests` returned every
 * pending row — and approving it minted the very `follows` edge the block had
 * just removed. This suite pins the fix:
 *   - the read paths drop a request whose other party is on either side of a
 *     block (spine `blocked` + `blocked_by`), and
 *   - the consent writes (`approveFollowRequest` / `acceptFriendRequest`) refuse
 *     across a block and close the request instead of creating the edge.
 *
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const QueryConstraintBrand = Symbol('QueryConstraint');
const isConstraint = (c) => c && c[QueryConstraintBrand] === true;

const firestoreMock = {
  collection: () => ({}),
  collectionGroup: () => ({}),
  doc: (_db, coll, id) => ({ __doc: true, coll, id }),
  getDoc: async (ref) => ({ id: ref.id, exists: () => ref.id in (globalThis.__docs || {}), data: () => (globalThis.__docs || {})[ref.id] }),
  getDocs: async () => {
    const docs = Object.entries(globalThis.__docs || {}).map(([id, data]) => ({ id, data: () => data }));
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
  runTransaction: async (_db, fn) => fn({
    get: async (ref) => ({ exists: () => true, id: ref.id, data: () => globalThis.__txDoc || {} }),
    update: () => {},
    set: () => {},
  }),
  onSnapshot: () => () => {},
  getCountFromServer: async () => ({ data: () => ({ count: 0 }) }),
  Timestamp: { now: () => ({ toDate: () => new Date() }) },
};

jest.unstable_mockModule('firebase/firestore', () => firestoreMock);
jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: async () => ({}),
  getAuthInstance: async () => ({ currentUser: { uid: 'owner' } }),
  db: {},
  auth: { currentUser: { uid: 'owner' } },
  storage: {},
}));

// Block edges: `blocked` = viewer -> other, `blocked_by` = other -> viewer.
const listEdges = jest.fn(async (_uid, kind) => ({ ids: globalThis.__edges?.[kind] || [] }));
let relationship = { isBlocking: false, isBlockedBy: false };
const getRelationship = jest.fn(async () => relationship);
jest.unstable_mockModule('../services/socialGraphService.js', () => ({
  getSocialGraphService: () => ({ listEdges, getRelationship, invalidate: () => {} }),
  socialGraphService: { listEdges, getRelationship },
}));

// Force the local tokenized fallback: the primary (Algolia) path is exercised
// by searchService's own tests.
jest.unstable_mockModule('../services/searchService.js', () => ({
  searchUsers: async () => { throw new Error('algolia unavailable'); },
}));

const { getUserService } = await import('../services/userService.js');

function primeService(svc) {
  svc.firestore = {};
  svc._ensureInitialized = async () => {};
  svc._invalidateUserCache = () => {};
  svc._getNotificationsService = async () => ({ sendNotification: async () => {} });
  return svc;
}

beforeEach(() => {
  globalThis.__edges = {};
  globalThis.__docs = {};
  globalThis.__txDoc = {};
  listEdges.mockClear();
  listEdges.mockImplementation(async (_uid, kind) => ({ ids: globalThis.__edges?.[kind] || [] }));
  getRelationship.mockReset();
  getRelationship.mockImplementation(async () => relationship);
  relationship = { isBlocking: false, isBlockedBy: false };
});

describe('request inboxes hide blocked parties', () => {
  test('getFollowRequests drops a request from a blocked sender', async () => {
    globalThis.__docs = { r1: { fromUserId: 'blockedUser', toUserId: 'owner', status: 'pending' } };
    globalThis.__edges = { blocked: ['blockedUser'] };
    const svc = primeService(getUserService());

    const res = await svc.getFollowRequests('owner');
    expect(res.requests).toHaveLength(0);
  });

  test('getFollowRequests drops a request from a user who blocked the owner', async () => {
    globalThis.__docs = { r1: { fromUserId: 'blocker', toUserId: 'owner', status: 'pending' } };
    globalThis.__edges = { blocked_by: ['blocker'] };
    const svc = primeService(getUserService());

    const res = await svc.getFollowRequests('owner');
    expect(res.requests).toHaveLength(0);
  });

  test('getFollowRequests keeps an unrelated pending request', async () => {
    globalThis.__docs = { r1: { fromUserId: 'stranger', toUserId: 'owner', status: 'pending' } };
    const svc = primeService(getUserService());

    const res = await svc.getFollowRequests('owner');
    expect(res.requests.map((r) => r.fromUserId)).toEqual(['stranger']);
  });

  test('getFriendRequests drops a blocked sender but keeps others', async () => {
    globalThis.__docs = {
      a: { fromUserId: 'blockedUser', toUserId: 'owner', status: 'pending' },
      b: { fromUserId: 'stranger', toUserId: 'owner', status: 'pending' },
    };
    globalThis.__edges = { blocked: ['blockedUser'] };
    const svc = primeService(getUserService());

    const res = await svc.getFriendRequests('owner', 'received');
    expect(res.requests.map((r) => r.fromUserId)).toEqual(['stranger']);
  });

  test('fails open (keeps requests) when the graph read throws', async () => {
    globalThis.__docs = { r1: { fromUserId: 'x', toUserId: 'owner', status: 'pending' } };
    listEdges.mockRejectedValue(new Error('graph offline'));
    const svc = primeService(getUserService());

    const res = await svc.getFollowRequests('owner');
    expect(res.requests.map((r) => r.fromUserId)).toEqual(['x']);
  });
});

describe('consent writes refuse across a block', () => {
  test('approveFollowRequest closes the request instead of minting the edge', async () => {
    globalThis.__txDoc = { fromUserId: 'blockedUser', toUserId: 'owner', status: 'pending' };
    relationship = { isBlocking: true, isBlockedBy: false };
    const svc = primeService(getUserService());

    const res = await svc.approveFollowRequest('blockedUser_owner', 'owner');
    expect(res).toEqual({ success: false, blocked: true });
  });

  test('acceptFriendRequest closes the request instead of minting mutual edges', async () => {
    globalThis.__txDoc = { fromUserId: 'blockedUser', toUserId: 'owner', status: 'pending' };
    relationship = { isBlocking: false, isBlockedBy: true };
    const svc = primeService(getUserService());

    const res = await svc.acceptFriendRequest('blockedUser_owner', 'owner');
    expect(res).toEqual({ success: false, blocked: true });
  });

  test('_isBlockedPair propagates a graph read error so the write aborts (fails closed, no destructive status)', async () => {
    getRelationship.mockRejectedValue(new Error('offline'));
    const svc = primeService(getUserService());
    await expect(svc._isBlockedPair('a', 'b')).rejects.toThrow('offline');
  });
});

describe('searchUsers fallback hides blocked pairs (N248)', () => {
  test('drops a blocked user from the tokenized fallback results', async () => {
    globalThis.__docs = {
      blockedUser: { id: 'blockedUser', username: 'blocked', searchTokens: ['blocked'] },
      okUser: { id: 'okUser', username: 'okay', searchTokens: ['okay'] },
    };
    globalThis.__edges = { blocked: ['blockedUser'] };
    const svc = primeService(getUserService());
    svc.getAvatarUrl = (id) => id;

    const res = await svc.searchUsers('okay blocked', { userId: 'viewer' });
    expect(res.users.map((u) => u.id)).toEqual(['okUser']);
  });

  test('keeps results when the viewer has no block edges', async () => {
    globalThis.__docs = { okUser: { id: 'okUser', username: 'okay', searchTokens: ['okay'] } };
    const svc = primeService(getUserService());
    svc.getAvatarUrl = (id) => id;

    const res = await svc.searchUsers('okay', { userId: 'viewer' });
    expect(res.users.map((u) => u.id)).toEqual(['okUser']);
  });
});
