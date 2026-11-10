/**
 * Social graph spine (the foundation every system resolves "who is this to me"
 * through). Covers the batch edge reader, bounded edge lists, batched profile
 * hydration and viewer projection against an in-memory fake Firestore.
 */

import { jest } from '@jest/globals';
import fs from 'fs';

const store = new Map(); // "collection/id" -> data

const capturedQueries = [];

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
    capturedQueries.push({ name: q.name, constraints });
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
  capturedQueries.length = 0;
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

  test('blocked_by lists users who block the viewer (reverse direction)', async () => {
    store.set('blocks/me_x', { blockerId: 'me', blockedId: 'x' });
    store.set('blocks/y_me', { blockerId: 'y', blockedId: 'me' });
    const blocked = await getSocialGraphService().listEdges('me', 'blocked');
    const blockedBy = await getSocialGraphService().listEdges('me', 'blocked_by');
    expect(blocked.ids).toEqual(['x']);
    expect(blockedBy.ids).toEqual(['y']);
  });
});

describe('getHiddenAuthorIds + suggestions safety (N225)', () => {
  test('unions blocked, blocked-by and muted edges', async () => {
    store.set('blocks/me_x', { blockerId: 'me', blockedId: 'x' });
    store.set('blocks/y_me', { blockerId: 'y', blockedId: 'me' });
    store.set('mutes/me_z', { muterId: 'me', mutedId: 'z' });
    const hidden = await getSocialGraphService().getHiddenAuthorIds('me');
    expect([...hidden].sort()).toEqual(['x', 'y', 'z']);
  });

  test('fails open (empty set) when the graph read throws', async () => {
    const svc = getSocialGraphService();
    const spy = jest.spyOn(svc, 'listEdges').mockRejectedValue(new Error('offline'));
    const hidden = await svc.getHiddenAuthorIds('me');
    expect(hidden.size).toBe(0);
    spy.mockRestore();
  });

  test('a blocked friends-of-friends candidate is not suggested', async () => {
    // me -> a -> {blocked, ok}; a blocked candidate must be dropped.
    seedFollow('me', 'a');
    seedFollow('a', 'blocked');
    seedFollow('a', 'ok');
    store.set('blocks/me_blocked', { blockerId: 'me', blockedId: 'blocked' });
    store.set('users/blocked', { uid: 'blocked', displayName: 'Blocked' });
    store.set('users/ok', { uid: 'ok', displayName: 'Okay' });
    const recs = await getSocialGraphService().getSuggestions('me', { limit: 10 });
    const ids = recs.map((r) => r.id || r.uid);
    expect(ids).toContain('ok');
    expect(ids).not.toContain('blocked');
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

describe('query shape (rules-provable, no silent denial)', () => {
  // Firestore rules are not filters: `blocks`/`mutes`/`restricts` authorise on
  // `resource.data.<actorField> == uid()`, so a `documentId() in [...]` list
  // read is denied and the batch silently degrades. The batch reader must pin
  // the actor field with `==`. See socialGraphEdgeReadRules.test.js (emulator).
  test('getEdgeSet scopes block/mute/restrict reads by the actor field', async () => {
    store.set('blocks/me_x', { blockerId: 'me', blockedId: 'x' });
    store.set('blocks/y_me', { blockerId: 'y', blockedId: 'me' });
    store.set('mutes/me_x', { muterId: 'me', mutedId: 'x' });
    store.set('restricts/me_x', { restricterId: 'me', restrictedId: 'x' });

    await getSocialGraphService().getEdgeSet('me', ['x', 'y', 'z']);

    const safetyQueries = capturedQueries.filter((q) =>
      ['blocks', 'mutes', 'restricts'].includes(q.name)
    );
    expect(safetyQueries.length).toBeGreaterThan(0);

    const allowedActorFields = {
      blocks: ['blockerId', 'blockedId'],
      mutes: ['muterId'],
      restricts: ['restricterId'],
    };
    for (const q of safetyQueries) {
      const wheres = q.constraints.filter((c) => c.__type === 'where');
      const equalityFields = wheres.filter((c) => c.op === '==').map((c) => c.field);
      // Never rely on a bare documentId `in` list (which the rules cannot prove).
      expect(equalityFields.some((f) => allowedActorFields[q.name].includes(f))).toBe(true);
    }
  });

  test('a two-target block read resolves both directions', async () => {
    store.set('blocks/me_x', { blockerId: 'me', blockedId: 'x' });
    store.set('blocks/y_me', { blockerId: 'y', blockedId: 'me' });
    const map = await getSocialGraphService().getEdgeSet('me', ['x', 'y', 'z']);
    expect(map.get('x')).toMatchObject({ isBlocking: true, isBlocked: true });
    expect(map.get('y')).toMatchObject({ isBlocking: false, isBlockedBy: true, isBlocked: true });
    expect(map.get('z')).toMatchObject({ isBlocked: false });
  });

  test('getRelationship uses the same rules-provable shape (no point read)', async () => {
    store.set('blocks/x_me', { blockerId: 'x', blockedId: 'me' });
    capturedQueries.length = 0;

    const edge = await getSocialGraphService().getRelationship('me', 'x');

    expect(edge).toMatchObject({ isBlocking: false, isBlockedBy: true, isBlocked: true });
    const safetyQueries = capturedQueries.filter((q) =>
      ['blocks', 'mutes', 'restricts'].includes(q.name)
    );
    expect(safetyQueries.length).toBe(4); // block out, block in, mute, restrict (follows excluded)
    const allowedActorFields = {
      blocks: ['blockerId', 'blockedId'],
      mutes: ['muterId'],
      restricts: ['restricterId'],
    };
    for (const q of safetyQueries) {
      const equalityFields = q.constraints
        .filter((c) => c.__type === 'where' && c.op === '==')
        .map((c) => c.field);
      expect(equalityFields.some((f) => allowedActorFields[q.name].includes(f))).toBe(true);
    }
  });

  test('the spine never point-reads a safety collection', () => {
    const src = fs.readFileSync(new URL('../services/socialGraphService.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/getDoc\(\s*doc\([^)]*'blocks'/);
    expect(src).not.toMatch(/getDoc\(\s*doc\([^)]*'mutes'/);
    expect(src).not.toMatch(/getDoc\(\s*doc\([^)]*'restricts'/);
  });
});
