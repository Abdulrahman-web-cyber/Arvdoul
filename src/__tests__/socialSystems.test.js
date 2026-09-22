/**
 * src/__tests__/socialSystems.test.js
 * Real assertions for the social-loop enhancements:
 *   - likePost fires author notification + like_received XP (only on NEW likes)
 *   - sendGift rejects unknown gift types; fires gift notification + XP
 *   - sendFriendRequest short-circuits when already friends; notifies recipient
 *   - cancelFriendRequest / areFriends behave correctly
 *   - followUser awards follow_received XP to the followed user
 *
 * Services run against in-memory fake Firestore layers (hermetic).
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Shared fake Firestore + fake user doc store
// ---------------------------------------------------------------------------
const state = {
  users: new Map(), // userId -> doc
  follows: new Map(), // "a_b" -> doc
  friendRequests: new Map(), // "a_b" -> doc
  posts: new Map(),
  notifications: [],
  xpAwards: [],
};

function seedUser(id, overrides = {}) {
  state.users.set(id, {
    id,
    displayName: `User ${id}`,
    coins: 1000,
    level: 1,
    experience: 0,
    ...overrides,
  });
}

function makeFakeFirestore() {
  return {
    doc: (db, ...segments) => ({
      path: segments.join('/'),
      collection: segments[0],
      // Subcollection refs (5+ args) use the full remainder as the id so the
      // fake can distinguish users/u1 from users/u1/liked_posts/p1.
      id: segments.length > 2 ? segments.slice(1).join('/') : segments[1],
    }),
    collection: (db, name) => ({ name }),
    serverTimestamp: () => ({ __ts: Date.now() }),
    increment: (n) => ({ __inc: n }),
    query: (colRef, ...constraints) => ({ colRef, constraints }),
    where: (field, op, value) => ({ field, op, value }),
    orderBy: (field, dir) => ({ field, dir }),
    limit: (n) => ({ limit: n }),
    startAfter: (doc) => ({ startAfter: doc }),
    enableIndexedDbPersistence: async () => ({ __persisted: true }),
    arrayUnion: (v) => ({ __arrayUnion: v }),
    arrayRemove: (v) => ({ __arrayRemove: v }),
    Timestamp: { fromDate: (d) => ({ toDate: () => d }), now: () => ({ toDate: () => new Date() }) },
    addDoc: async (colRef, data) => ({ id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }),
    getDoc: async (ref) => {
      const coll = stateFor(ref.collection);
      const doc = coll && coll.get(ref.id);
      return { exists: () => Boolean(doc), data: () => doc, id: ref.id };
    },
    getDocs: async (q) => {
      // Minimal in-memory query: filter by where() equality constraints
      const colName = q.colRef ? q.colRef.name : q.name;
      const coll = state[colName] || new Map();
      let docs = Array.from(coll.values());
      for (const c of q.constraints || []) {
        if (c.field && c.op === '==') {
          docs = docs.filter((d) => d[c.field] === c.value);
        }
      }
      return {
        docs: docs.map((d) => ({ id: d.id, data: () => d, exists: () => true })),
        forEach: (cb) => docs.forEach((d) => cb({ id: d.id, data: () => d })),
        size: docs.length,
        empty: docs.length === 0,
      };
    },
    onSnapshot: (ref, cb) => {
      cb({ exists: () => false, data: () => null });
      return () => {};
    },
    setDoc: async (ref, data) => {
      if (!stateFor(ref.collection)) state[ref.collection] = new Map();
      stateFor(ref.collection).set(ref.id, { id: ref.id, ...data });
    },
    updateDoc: async (ref, data) => {
      const cur = stateFor(ref.collection).get(ref.id) || {};
      stateFor(ref.collection).set(ref.id, { ...cur, ...data });
    },
    deleteDoc: async (ref) => {
      stateFor(ref.collection).delete(ref.id);
    },
    writeBatch: () => ({
      set: () => {},
      update: () => {},
      delete: () => {},
      commit: async () => {},
    }),
    runTransaction: async (db, fn) => {
      const tx = {
        get: async (ref) => {
          const coll = stateFor(ref.collection);
          const doc = coll && coll.get(ref.id);
          return { exists: () => Boolean(doc), data: () => doc };
        },
        set: (ref, data, opts) => {
          if (!stateFor(ref.collection)) state[ref.collection] = new Map();
          if (opts?.merge) {
            stateFor(ref.collection).set(ref.id, { ...(stateFor(ref.collection).get(ref.id) || {}), ...data });
          } else {
            stateFor(ref.collection).set(ref.id, data);
          }
        },
        update: (ref, data) => {
          if (!stateFor(ref.collection)) state[ref.collection] = new Map();
          const cur = stateFor(ref.collection).get(ref.id) || {};
          stateFor(ref.collection).set(ref.id, { ...cur, ...data });
        },
        delete: (ref) => stateFor(ref.collection).delete(ref.id),
      };
      return await fn(tx);
    },
  };
}

/** Maps a Firestore collection name to the local state map key. */
function stateFor(name) {
  if (state[name]) return state[name];
  const camel = name.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  return state[camel] || null;
}

const mockNotifications = {
  createLikeNotification: jest.fn(async () => {}),
  createCommentNotification: jest.fn(async () => {}),
  createFollowNotification: jest.fn(async () => {}),
  createGiftNotification: jest.fn(async () => {}),
  createFriendRequestNotification: jest.fn(async () => {}),
  sendNotification: jest.fn(async () => {}),
};

const mockLevelSystem = {
  awardExperience: jest.fn(async (opts) => ({ success: true, xpAwarded: 1, leveledUp: false, newLevel: 1, coinReward: 0 })),
};

jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: jest.fn(async () => ({ fake: true })),
  getAuthInstance: jest.fn(async () => ({ currentUser: { uid: 'u1' } })),
  // firebase.js exports a live `auth` singleton used by some services
  auth: { currentUser: { uid: 'u1' } },
  db: { type: 'mock-db' },
  storage: { type: 'mock-storage' },
  initializeFirebase: jest.fn(async () => {}),
  awaitFirebaseReady: jest.fn(async () => true),
  isFirebaseInitialized: jest.fn(() => true),
  FIREBASE_CONFIG: { projectId: 'test' },
}));
jest.unstable_mockModule('firebase/firestore', () => makeFakeFirestore());
jest.unstable_mockModule('firebase/functions', () => ({
  getFunctions: () => ({ __mock: true }),
  httpsCallable: () => async () => ({ data: { success: true } }),
}));
jest.unstable_mockModule('@stripe/stripe-js', () => ({
  loadStripe: async () => null,
}));
jest.unstable_mockModule('../services/notificationsService.js', () => ({
  getNotificationsService: () => mockNotifications,
  notificationsService: mockNotifications,
}));
jest.unstable_mockModule('../services/levelSystemService.js', () => ({
  levelSystemService: mockLevelSystem,
}));

describe('likes - notification + XP wiring', () => {
  test('likePost notifies the author and awards like_received XP on a NEW like', async () => {
    seedUser('u_author', { displayName: 'Author' });
    seedUser('u_liker');
    state.posts.set('p1', { id: 'p1', authorId: 'u_author', content: 'hi' });

    const { getFirestoreService } = await import('../services/firestoreService.js');
    const svc = getFirestoreService();
    svc.firestore = { fake: true };
    svc.firestoreMethods = {
      doc: (db, ...segments) => ({
        path: segments.join('/'),
        collection: segments[0],
        id: segments.length > 2 ? segments.slice(1).join('/') : segments[1],
      }),
      serverTimestamp: () => ({ __ts: Date.now() }),
      runTransaction: async (db, fn) => {
        const tx = {
          get: async (ref) => {
            const coll = stateFor(ref.collection);
            const doc = coll && coll.get(ref.id);
            return { exists: () => Boolean(doc), data: () => doc };
          },
          set: (ref, data) => {
            if (!stateFor(ref.collection)) state[ref.collection] = new Map();
            stateFor(ref.collection).set(ref.id, data);
          },
        };
        return await fn(tx);
      },
    };
    svc.cache = { delete: () => {} };
    svc.ensureInitialized = async () => {};
    const { countersManager } = await import('../utils/CountersManager.js');
    jest.spyOn(countersManager, 'incrementInTransaction').mockResolvedValue();
    jest.spyOn(countersManager, 'invalidate').mockImplementation(() => {});

    const res = await svc.likePost('p1', 'u_liker');
    expect(res.success).toBe(true);
    expect(res.alreadyLiked).toBe(false);

    // Give the fire-and-forget side effects a tick
    await new Promise((r) => setTimeout(r, 20));
    expect(mockNotifications.createLikeNotification).toHaveBeenCalledWith('p1', 'u_liker', 'u_author');
    expect(mockLevelSystem.awardExperience).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u_author', action: 'like_received', source: 'p1' })
    );
  });
});

describe('gifts - validation + notification + XP wiring', () => {
  test('sendGift rejects unknown gift types instead of silently charging', async () => {
    const { getMonetizationService } = await import('../services/monetizationService.js');
    const monetizationService = getMonetizationService();
    monetizationService.config = {
      GIFTS: [
        { type: 'rose', value: 5 },
        { type: 'crown', value: 50 },
      ],
    };
    await expect(
      monetizationService.sendGift('u1', 'p1', 'gold_plated_unicorn')
    ).rejects.toThrow('Unknown gift type');
  });

  test('_afterGiftSent notifies the author and awards gift_received XP', async () => {
    seedUser('u_author');
    state.posts.set('p1', { id: 'p1', authorId: 'u_author', content: 'x' });
    const { getMonetizationService } = await import('../services/monetizationService.js');
    const monetizationService = getMonetizationService();
    monetizationService.db = { fake: true };

    await monetizationService._afterGiftSent('u_sender', 'p1', 'rose', 5);
    expect(mockNotifications.createGiftNotification).toHaveBeenCalledWith('u_sender', 'u_author', 'p1', 'rose', 5);
    expect(mockLevelSystem.awardExperience).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u_author', action: 'gift_received', source: 'p1' })
    );
  });
});

describe('friends - areFriends + cancel + notification', () => {
  beforeEach(() => {
    state.follows.clear();
    state.friendRequests.clear();
    mockNotifications.createFriendRequestNotification.mockClear();
  });

  test('areFriends is true only with mutual follow edges', async () => {
    const { getUserService } = await import('../services/userService.js');
    const svc = getUserService();
    svc.firestore = { fake: true };

    expect(await svc.areFriends('a', 'b')).toBe(false);

    state.follows.set('a_b', { followerId: 'a', followingId: 'b' });
    expect(await svc.areFriends('a', 'b')).toBe(false); // one-way only

    state.follows.set('b_a', { followerId: 'b', followingId: 'a' });
    expect(await svc.areFriends('a', 'b')).toBe(true);

    expect(await svc.areFriends('a', 'a')).toBe(false);
    expect(await svc.areFriends(null, 'b')).toBe(false);
  });

  test('sendFriendRequest short-circuits when already friends', async () => {
    state.follows.set('a_b', { followerId: 'a', followingId: 'b' });
    state.follows.set('b_a', { followerId: 'b', followingId: 'a' });

    const { getUserService } = await import('../services/userService.js');
    const svc = getUserService();
    svc.firestore = { fake: true };
    svc._assertNotBlocked = async () => {};

    const res = await svc.sendFriendRequest('a', 'b');
    expect(res.alreadyFriends).toBe(true);
    expect(mockNotifications.createFriendRequestNotification).not.toHaveBeenCalled();
  });

  test('sendFriendRequest notifies the recipient on a new request', async () => {
    const { getUserService } = await import('../services/userService.js');
    const svc = getUserService();
    svc.firestore = { fake: true };
    svc._assertNotBlocked = async () => {};
    svc.getUserProfile = async () => ({ displayName: 'Alice' });

    const res = await svc.sendFriendRequest('a', 'b');
    expect(res.success).toBe(true);
    expect(state.friendRequests.has('a_b')).toBe(true);
    expect(mockNotifications.createFriendRequestNotification).toHaveBeenCalledWith('a', 'b', 'Alice');
  });

  test('cancelFriendRequest marks a pending request as cancelled', async () => {
    state.friendRequests.set('a_b', { fromUserId: 'a', toUserId: 'b', status: 'pending' });
    const { getUserService } = await import('../services/userService.js');
    const svc = getUserService();
    svc.firestore = { fake: true };

    const res = await svc.cancelFriendRequest('a', 'b');
    expect(res.success).toBe(true);
    expect(state.friendRequests.get('a_b').status).toBe('cancelled');
  });

  test('cancelFriendRequest rejects non-senders', async () => {
    // Request a->b stored under b_a (caller claims to be b, but ref maps to a->b)
    state.friendRequests.set('b_a', { fromUserId: 'a', toUserId: 'b', status: 'pending' });
    const { getUserService } = await import('../services/userService.js');
    const svc = getUserService();
    svc.firestore = { fake: true };

    await expect(svc.cancelFriendRequest('b', 'a')).rejects.toThrow('Not authorized');
  });
});

describe('follows - XP wiring', () => {
  test('followUser awards follow_received XP to the followed user on a new follow', async () => {
    seedUser('u_target');
    seedUser('u_follower');
    const { getUserService } = await import('../services/userService.js');
    const svc = getUserService();
    svc.firestore = { fake: true };
    svc._assertNotBlocked = async () => {};
    svc._getNotificationsService = async () => mockNotifications;
    svc._recordFollowerSnapshotIfDue = async () => {};
    svc._invalidateUserCache = () => {};

    const res = await svc.followUser('u_follower', 'u_target');
    expect(res.success).toBe(true);
    expect(state.follows.has('u_follower_u_target')).toBe(true);

    await new Promise((r) => setTimeout(r, 20));
    expect(mockLevelSystem.awardExperience).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u_target', action: 'follow_received', source: 'u_follower' })
    );
  });

  test('followUser does not award XP for a duplicate follow', async () => {
    state.follows.set('u_follower_u_target', { followerId: 'u_follower', followingId: 'u_target' });
    const { getUserService } = await import('../services/userService.js');
    const svc = getUserService();
    svc.firestore = { fake: true };
    svc._assertNotBlocked = async () => {};

    const res = await svc.followUser('u_follower', 'u_target');
    expect(res.alreadyFollowing).toBe(true);

    await new Promise((r) => setTimeout(r, 20));
    const calls = mockLevelSystem.awardExperience.mock.calls.filter(
      (c) => c[0]?.action === 'follow_received'
    );
    expect(calls.length).toBe(0);
  });
});
