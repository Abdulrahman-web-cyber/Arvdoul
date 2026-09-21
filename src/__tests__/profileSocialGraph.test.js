// src/__tests__/profileSocialGraph.test.js
//
// Covers the relationship reader that the profile list screens rely on.
// getFollowStates is the single source of truth for viewer->target follow state.

import { jest } from '@jest/globals';

const followsDocs = [];

jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: async () => ({}),
  db: {},
  auth: { currentUser: null },
  storage: {},
}));

jest.unstable_mockModule('firebase/firestore', () => ({
  collection: (_db, name) => ({ __type: 'collection', name }),
  query: (ref, ...constraints) => ({ ...ref, constraints }),
  where: (field, op, value) => ({ __type: 'where', field, op, value }),
  getDocs: async (q) => {
    const filters = (q.constraints || []).filter((c) => c.__type === 'where');
    const matched = followsDocs.filter((d) =>
      filters.every((f) => d[f.field] === f.value)
    );
    return {
      docs: matched.map((d) => ({
        id: `${d.followerId}_${d.followingId}`,
        data: () => d,
      })),
    };
  },
  doc: () => ({}),
  getDoc: async () => ({ exists: () => false }),
  setDoc: async () => {},
  updateDoc: async () => {},
  deleteDoc: async () => {},
  addDoc: async () => ({ id: 'x' }),
  serverTimestamp: () => '__ts__',
  runTransaction: async (_db, fn) => fn({ get: async () => ({ exists: () => false, data: () => ({}) }), set() {}, update() {}, delete() {} }),
  increment: (n) => n,
  arrayUnion: (...a) => a,
  arrayRemove: (...a) => a,
  writeBatch: () => ({ set() {}, update() {}, delete() {}, commit: async () => {} }),
  limit: (n) => ({ __type: 'limit', n }),
  orderBy: (f, d) => ({ __type: 'orderBy', f, d }),
  startAfter: (c) => ({ __type: 'startAfter', c }),
  onSnapshot: () => () => {},
}));

let getUserService;

beforeAll(async () => {
  ({ getUserService } = await import('../services/userService.js'));
});

describe('getFollowStates (relationship single source of truth)', () => {
  let service;

  beforeEach(() => {
    followsDocs.length = 0;
    service = getUserService();
    service.initialized = true;
    service.firestore = {};
  });

  test('marks a target the viewer follows as isFollowing', async () => {
    followsDocs.push({ followerId: 'me', followingId: 'a' });

    const states = await service.getFollowStates('me', ['a']);

    expect(states.get('a')).toEqual({
      isFollowing: true,
      isFollower: false,
      isMutualFriend: false,
    });
  });

  test('marks a target that follows the viewer as isFollower', async () => {
    followsDocs.push({ followerId: 'b', followingId: 'me' });

    const states = await service.getFollowStates('me', ['b']);

    expect(states.get('b')).toEqual({
      isFollowing: false,
      isFollower: true,
      isMutualFriend: false,
    });
  });

  test('mutual follow is reported as isMutualFriend', async () => {
    followsDocs.push({ followerId: 'me', followingId: 'c' });
    followsDocs.push({ followerId: 'c', followingId: 'me' });

    const states = await service.getFollowStates('me', ['c']);

    expect(states.get('c')).toEqual({
      isFollowing: true,
      isFollower: true,
      isMutualFriend: true,
    });
  });

  test('viewer is never reported as following themselves', async () => {
    const states = await service.getFollowStates('me', ['me']);

    expect(states.get('me')).toEqual({
      isFollowing: false,
      isFollower: false,
      isMutualFriend: false,
    });
  });

  test('unknown targets default to no relationship', async () => {
    const states = await service.getFollowStates('me', ['x', 'y']);

    expect(states.get('x').isFollowing).toBe(false);
    expect(states.get('y').isFollowing).toBe(false);
  });

  test('returns an empty map without a viewer id', async () => {
    followsDocs.push({ followerId: 'me', followingId: 'a' });

    const states = await service.getFollowStates(null, ['a']);

    expect(states.has('a')).toBe(false);
  });

  test('deduplicates repeated target ids', async () => {
    followsDocs.push({ followerId: 'me', followingId: 'a' });

    const states = await service.getFollowStates('me', ['a', 'a', 'a']);

    expect([...states.keys()]).toEqual(['a']);
    expect(states.get('a').isFollowing).toBe(true);
  });
});