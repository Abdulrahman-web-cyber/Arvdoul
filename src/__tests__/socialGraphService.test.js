/**
 * Social graph spine (the foundation every system resolves "who is this to me"
 * through). Covers the batch edge reader, bounded edge lists, batched profile
 * hydration and viewer projection against an in-memory fake Firestore.
 */

import { jest } from '@jest/globals';

const store = new Map(); // "collection/id" -> data

const idOf = (key) => key.slice(key.indexOf('/') + 1);
const colOf = (key) => key.slice(0, key.indexOf('/'));

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
  orderBy: (field, order) => ({ __type: 'orderBy', field, order }),
  limit: (n) => ({ __type: 'limit', n }),
  startAfter: (c) => ({ __type: 'startAfter', c }),
  documentId: () => '__name__',
  getDocs: async (q) => {
    const constraints = q.constraints || [];
    const filters = constraints.filter((c) => c.__type === 'where');
    const order = constraints.find((c) => c.__type === 'orderBy');
    const cap = constraints.find((c) => c.__type === 'limit');

    let rows = [...store.entries()]
      .filter(([key]) => colOf(key) === q.name)
      .map(([key, data]) => ({ id: idOf(key), data }));

    rows = rows.filter((r) =>
      filters.every((f) => {
        if (f.op === 'in') {
          const values = Array.isArray(f.value) ? f.value : [f.value];
          return f.field === '__name__' ? values.includes(r.id) : values.includes(r.data[f.field]);
        }
        return r.data[f.field] === f.value;
      })
    );

    if (order) {
      const dir = order.order === 'DESCENDING' ? -1 : 1;
      rows.sort((a, b) => (a.data[order.field] > b.data[order.field] ? dir : a.data[order.field] < b.data[order.field] ? -dir : 0));
    }
    if (cap) rows = rows.slice(0, cap.n);

    const docs = rows.map((r) => ({ id: r.id, data: () => r.data }));
    return { docs, forEach: (cb) => docs.forEach(cb), empty: docs.length === 0, size: docs.length };
  },
  doc: (_db, ...segments) => ({ path: segments.join('/'), collection: segments[0], id: segments.slice(1).join('/') }),
  getDoc: async (ref) => {
    const data = store.get(ref.path);
    return { exists: () => data !== undefined, data: () => data, id: ref.id };
  },
  setDoc: async () => {},
  updateDoc: async () => {},
  deleteDoc: async () => {},
  addDoc: async () => ({ id: 'x' }),
  serverTimestamp: () => '__ts__',
  runTransaction: async () => {},
  increment: (n) => n,
  arrayUnion: (...a) => a,
  arrayRemove: (...a) => a,
  writeBatch: () => ({ set() {}, update() {}, delete() {}, commit: async () => {} }),
  onSnapshot: () => () => {},
}));

let getSocialGraphService;

beforeAll(async () => {
  ({ getSocialGraphService } = await import('../services/socialGraphService.js'));
});

beforeEach(() => {
  store.clear();
  const svc = getSocialGraphService();
  svc.initialized = true;
  svc.firestore = {};
  svc.clearCache();
});

const seedFollow = (a, b) => store.set(`follows/${a}_${b}`, { followerId: a, followingId: b });

describe('getRelationship (single pair, bounded)', () => {
  test('mutual follow is a friendship', async () => {
    seedFollow('me', 'a');
    seedFollow('a', 'me');
    const edge = await getSocialGraphService().getRelationship('me', 'a');
    expect(edge).toMatchObject({ isFollowing: true, isFollower: true, isMutualFriend: true, isBlocked: false });
  });

  test('one-way follow distinguishes following from follower', async () => {
    seedFollow('me', 'b');
    const edge = await getSocialGraphService().getRelationship('me', 'b');
    expect(edge).toMatchObject({ isFollowing: true, isFollower: false, isMutualFriend: false });
  });

  test('preserves block direction', async () => {
    store.set('blocks/me_x', { blockerId: 'me', blockedId: 'x' });
    store.set('blocks/y_me', { blockerId: 'y', blockedId: 'me' });
    const out = await getSocialGraphService().getRelationship('me', 'x');
    const inb = await getSocialGraphService().getRelationship('me', 'y');
    expect(out).toMatchObject({ isBlocking: true, isBlockedBy: false, isBlocked: true });
    expect(inb).toMatchObject({ isBlocking: false, isBlockedBy: true, isBlocked: true });
  });

  test('mute and restrict are directional and private to the actor', async () => {
    store.set('mutes/me_m', { muterId: 'me', mutedId: 'm' });
    store.set('restricts/me_r', { restricterId: 'me', restrictedId: 'r' });
    expect((await getSocialGraphService().getRelationship('me', 'm')).isMuted).toBe(true);
    expect((await getSocialGraphService().getRelationship('me', 'r')).isRestricted).toBe(true);
  });

  test('self is the owner with no follow edges', async () => {
    const edge = await getSocialGraphService().getRelationship('me', 'me');
    expect(edge).toMatchObject({ isOwner: true, isFollowing: false, isFollower: false });
  });
});

describe('getEdgeSet (batch, no N+1)', () => {
  test('resolves many targets in one pass', async () => {
    seedFollow('me', 'a');
    seedFollow('a', 'me');
    seedFollow('me', 'b');
    store.set('blocks/me_x', { blockerId: 'me', blockedId: 'x' });

    const map = await getSocialGraphService().getEdgeSet('me', ['a', 'b', 'x', 'z']);
    expect(map.get('a')).toMatchObject({ isMutualFriend: true });
    expect(map.get('b')).toMatchObject({ isFollowing: true, isFollower: false });
    expect(map.get('x')).toMatchObject({ isBlocking: true });
    expect(map.get('z')).toMatchObject({ isFollowing: false, isBlocked: false });
  });

  test('areFriends is mutual follow', async () => {
    seedFollow('me', 'a');
    seedFollow('a', 'me');
    seedFollow('me', 'b');
    expect(await getSocialGraphService().areFriends('me', 'a')).toBe(true);
    expect(await getSocialGraphService().areFriends('me', 'b')).toBe(false);
  });
});

describe('listEdges (bounded, index-backed)', () => {
  test('pages following and followers', async () => {
    seedFollow('me', 'a');
    seedFollow('me', 'b');
    seedFollow('c', 'me');
    const following = await getSocialGraphService().listEdges('me', 'following');
    const followers = await getSocialGraphService().listEdges('me', 'followers');
    expect(following.ids.sort()).toEqual(['a', 'b']);
    expect(followers.ids).toEqual(['c']);
  });

  test('respects the page limit and reports hasMore', async () => {
    for (let i = 0; i < 5; i++) seedFollow('me', `u${i}`);
    const page = await getSocialGraphService().listEdges('me', 'following', { limit: 2 });
    expect(page.ids).toHaveLength(2);
    expect(page.hasMore).toBe(true);
  });
});

describe('listMutualConnections (friends = mutual follow)', () => {
  test('keeps only follow-backs and hydrates them', async () => {
    seedFollow('me', 'a'); seedFollow('a', 'me'); // mutual
    seedFollow('me', 'b');                        // one-way
    seedFollow('me', 'c'); seedFollow('c', 'me'); // mutual
    store.set('users/a', { uid: 'a', displayName: 'Alice', username: 'alice' });
    store.set('users/b', { uid: 'b', displayName: 'Bob', username: 'bob' });
    store.set('users/c', { uid: 'c', displayName: 'Cara', username: 'cara' });

    const res = await getSocialGraphService().listMutualConnections('me', { viewerId: 'me' });
    expect(res.connections.map((p) => p.id).sort()).toEqual(['a', 'c']);
    expect(res.connections.map((p) => p.displayName).sort()).toEqual(['Alice', 'Cara']);
  });

  test('returns nothing for a user with no follow-backs', async () => {
    seedFollow('me', 'a');
    seedFollow('me', 'b');
    store.set('users/a', { uid: 'a', displayName: 'Alice' });
    store.set('users/b', { uid: 'b', displayName: 'Bob' });
    const res = await getSocialGraphService().listMutualConnections('me');
    expect(res.connections).toEqual([]);
    expect(res.count).toBe(0);
  });
});

describe('hydration and projection', () => {
  test('batches profiles and masks economic fields for non-owners', async () => {
    seedFollow('me', 'a');
    seedFollow('me', 'b');
    store.set('users/a', { uid: 'a', displayName: 'Alice', username: 'alice', coins: 500, followerCount: 3 });
    store.set('users/b', { uid: 'b', displayName: 'Bob', username: 'bob', coins: 100, followerCount: 1 });

    const profiles = await getSocialGraphService().hydrateProfiles(['a', 'b'], { viewerId: 'me' });
    expect(profiles.map((p) => p.displayName)).toEqual(['Alice', 'Bob']);
    expect(profiles.every((p) => p.coins === null)).toBe(true);
  });

  test('owner sees their own economic fields', async () => {
    const raw = { uid: 'a', displayName: 'Alice', username: 'alice', coins: 500 };
    const projected = getSocialGraphService().projectProfile(raw, 'a');
    expect(projected.coins).toBe(500);
  });

  test('a blocked viewer loses bio and counts', async () => {
    store.set('blocks/a_me', { blockerId: 'a', blockedId: 'me' });
    const raw = { uid: 'a', displayName: 'Alice', username: 'alice', bio: 'secret', followerCount: 9 };
    const edge = await getSocialGraphService().getRelationship('me', 'a');
    const projected = getSocialGraphService().projectProfile(raw, 'me', edge);
    expect(projected.isBlocked).toBe(true);
    expect(projected.bio).toBe('');
    expect(projected.followerCount).toBe(0);
  });
});

describe('cache invalidation', () => {
  test('invalidate clears a user edge after a follow changes', async () => {
    const graph = getSocialGraphService();
    expect((await graph.getRelationship('me', 'a')).isFollowing).toBe(false);
    seedFollow('me', 'a');
    // Cached: still false until invalidated.
    expect((await graph.getRelationship('me', 'a')).isFollowing).toBe(false);
    graph.invalidate('me');
    expect((await graph.getRelationship('me', 'a')).isFollowing).toBe(true);
  });
});
