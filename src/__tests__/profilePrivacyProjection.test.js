/**
 * src/__tests__/profilePrivacyProjection.test.js
 *
 * Behavioural tests for the authoritative profile read projection
 * (userService.getUserProfile). These lock the privacy invariants the Profile
 * blueprint relies on:
 *
 *   1. A private account is reduced to a public shell for a public viewer.
 *   2. Section scopes (links, presence, economic status) are enforced on the
 *      returned object, not left to the UI to hide.
 *   3. A blocked pair sees the restricted shell, never the real profile.
 *   4. Privacy-masked projections are cached in memory only — never written to
 *      localStorage (no persisted leak of another user's data).
 *
 * Services run against an in-memory fake Firestore layer (hermetic).
 */

import { jest } from '@jest/globals';

const state = {
  users: new Map(),
  blocks: new Map(),
  privatePii: new Map(),
};

const PRIVATE_PRIVACY = {
  profileInfo: 'EVERYONE',
  activity: 'ONLY_ME',
  achievements: 'ONLY_ME',
  titles: 'ONLY_ME',
  links: 'ONLY_ME',
  presence: 'ONLY_ME',
  economicStatus: 'ONLY_ME',
};

function seedUser(id, overrides = {}) {
  state.users.set(id, {
    id,
    username: id,
    displayName: `User ${id}`,
    bio: 'hello',
    photoURL: null,
    followerCount: 7,
    followingCount: 3,
    postCount: 2,
    coins: 12345,
    earnings: 999,
    links: [{ label: 'site', url: 'https://example.com' }],
    isOnline: true,
    lastActive: new Date(),
    ...overrides,
  });
}

const fakeFirestore = {
  doc: (db, ...segments) => ({
    path: segments.join('/'),
    segments,
    collection: segments[0],
    id: segments.length > 2 ? segments.slice(1).join('/') : segments[1],
  }),
  collection: (db, name) => ({ name }),
  getDoc: async (ref) => {
    // users/{uid}/private/pii — owner-only PII document
    if (ref.segments && ref.segments.length === 4 && ref.segments[2] === 'private') {
      const doc = state.privatePii.get(ref.segments[1]);
      return { exists: () => Boolean(doc), data: () => doc, id: ref.segments[3] };
    }
    const coll = state[ref.collection];
    const doc = coll && coll.get(ref.id);
    return { exists: () => Boolean(doc), data: () => doc, id: ref.id };
  },
  getDocs: async () => ({ docs: [], size: 0, empty: true, forEach: () => {} }),
  query: (colRef, ...constraints) => ({ colRef, constraints }),
  where: (field, op, value) => ({ field, op, value }),
  orderBy: (field, dir) => ({ field, dir }),
  limit: (n) => ({ limit: n }),
  startAfter: (doc) => ({ startAfter: doc }),
  serverTimestamp: () => ({ __ts: Date.now() }),
  deleteField: () => ({ __deleteField: true }),
  increment: (n) => ({ __inc: n }),
  arrayUnion: (v) => ({ __arrayUnion: v }),
  arrayRemove: (v) => ({ __arrayRemove: v }),
  addDoc: async () => ({ id: 'doc_new' }),
  setDoc: async (ref, data) => {
    if (ref.segments && ref.segments.length === 4 && ref.segments[2] === 'private') {
      state.privatePii.set(ref.segments[1], { ...(state.privatePii.get(ref.segments[1]) || {}), ...data });
      return;
    }
    const existing = state[ref.collection]?.get(ref.id) || {};
    const merged = { ...existing };
    for (const [k, v] of Object.entries(data)) {
      if (v && v.__deleteField) delete merged[k];
      else merged[k] = v;
    }
    if (!state[ref.collection]) state[ref.collection] = new Map();
    state[ref.collection].set(ref.id, merged);
  },
  updateDoc: async () => {},
  deleteDoc: async () => {},
  writeBatch: () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: async () => {} }),
  enableIndexedDbPersistence: async () => {},
  Timestamp: { fromDate: (d) => ({ toDate: () => d }), now: () => ({ toDate: () => new Date() }) },
  runTransaction: async (db, fn) => fn({
    get: async (ref) => {
      if (ref.segments && ref.segments.length === 4 && ref.segments[2] === 'private') {
        const d = state.privatePii.get(ref.segments[1]);
        return { exists: () => Boolean(d), data: () => d };
      }
      const d = state[ref.collection]?.get(ref.id);
      return { exists: () => Boolean(d), data: () => d };
    },
    set: (ref, data) => {
      if (ref.segments && ref.segments.length === 4 && ref.segments[2] === 'private') {
        state.privatePii.set(ref.segments[1], { ...(state.privatePii.get(ref.segments[1]) || {}), ...data });
        return;
      }
      if (!state[ref.collection]) state[ref.collection] = new Map();
      state[ref.collection].set(ref.id, { ...(state[ref.collection].get(ref.id) || {}), ...data });
    },
  }),
  onSnapshot: () => () => {},
};

jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: jest.fn(async () => ({ fake: true })),
  getAuthInstance: jest.fn(async () => ({ currentUser: null })),
  auth: { currentUser: null },
  db: { type: 'mock-db' },
  storage: { type: 'mock-storage' },
  initializeFirebase: jest.fn(async () => {}),
  awaitFirebaseReady: jest.fn(async () => true),
  isFirebaseInitialized: jest.fn(() => true),
  FIREBASE_CONFIG: { projectId: 'test' },
}));
jest.unstable_mockModule('firebase/firestore', () => fakeFirestore);
jest.unstable_mockModule('firebase/functions', () => ({
  getFunctions: () => ({ __mock: true }),
  httpsCallable: () => async () => ({ data: { success: true } }),
}));
jest.unstable_mockModule('@stripe/stripe-js', () => ({ loadStripe: async () => null }));

const getService = async () => {
  const { getUserService } = await import('../services/userService.js');
  const svc = getUserService();
  svc.firestore = { fake: true };
  svc.initialized = true;
  svc._ensureInitialized = async () => ({ fake: true });
  // Relationship probes are exercised separately; pin them to "stranger".
  svc.getFollowStatus = async () => ({ isFollowing: false });
  svc._areMutualFriends = async () => false;
  return svc;
};

describe('getUserProfile privacy projection', () => {
  beforeEach(() => {
    state.users.clear();
    state.blocks.clear();
    state.privatePii.clear();
    localStorage.clear();
  });

  test('reduces a private account to a public shell for a public viewer', async () => {
    seedUser('priv', { isPrivate: true, privacy: PRIVATE_PRIVACY });
    const svc = await getService();

    const projected = await svc.getUserProfile('priv', 'stranger');

    expect(projected.isRestricted).toBe(true);
    expect(projected.canViewActivity).toBe(false);
    expect(projected.canViewAchievements).toBe(false);
    expect(projected.canViewTitles).toBe(false);
    // Sensitive fields are not present in the restricted projection.
    expect(projected.coins).toBeUndefined();
    expect(projected.earnings).toBeUndefined();
    expect(projected.links).toEqual([]);
    expect(projected.presence.isOnline).toBe(false);
  });

  test('enforces section scopes on a public (non-private) profile', async () => {
    seedUser('pub', {
      isPrivate: false,
      email: 'secret@example.com',
      phoneNumber: '+15550001111',
      privacy: {
        profileInfo: 'EVERYONE',
        activity: 'FOLLOWERS',
        achievements: 'FOLLOWERS',
        titles: 'ONLY_ME',
        links: 'ONLY_ME',
        presence: 'ONLY_ME',
        economicStatus: 'ONLY_ME',
      },
    });
    const svc = await getService();

    const projected = await svc.getUserProfile('pub', 'stranger');

    expect(projected.isRestricted).toBeUndefined();
    expect(projected.canViewActivity).toBe(false);
    expect(projected.canViewTitles).toBe(false);
    expect(projected.links).toEqual([]);
    expect(projected.presence.isOnline).toBe(false);
    // Economic status is stripped for non-owners.
    expect(projected.coins).toBeUndefined();
    expect(projected.earnings).toBeUndefined();
    // PII is never projected to another viewer, even on an everyoned profile.
    expect(projected.email).toBeUndefined();
    expect(projected.phoneNumber).toBeUndefined();
    // Identity remains visible (profileInfo = EVERYONE).
    expect(projected.displayName).toBe('User pub');
  });

  test('owner reads their PII from the owner-only private document', async () => {
    seedUser('self', { isPrivate: false });
    state.privatePii.set('self', { email: 'me@example.com', phoneNumber: '+15550002222' });
    const svc = await getService();

    const projected = await svc.getUserProfile('self', 'self');

    expect(projected.email).toBe('me@example.com');
    expect(projected.phoneNumber).toBe('+15550002222');
  });

  test('a legacy inline PII document is migrated off the profile doc on owner read', async () => {
    seedUser('legacy', { isPrivate: false, email: 'old@example.com', phoneNumber: '+15550003333' });
    const svc = await getService();

    const projected = await svc.getUserProfile('legacy', 'legacy');
    // Owner still sees their own values...
    expect(projected.email).toBe('old@example.com');
    // ...and after migration the world-readable doc no longer carries PII.
    await new Promise((r) => setTimeout(r, 0));
    expect(state.privatePii.get('legacy')?.email).toBe('old@example.com');
    expect(state.users.get('legacy')?.email).toBeUndefined();
    expect(state.users.get('legacy')?.phoneNumber).toBeUndefined();
  });

  test('an unknown/unrecognized section scope fails closed', async () => {
    seedUser('weird', {
      isPrivate: false,
      privacy: { ...PRIVATE_PRIVACY, activity: 'not-a-real-scope' },
    });
    const svc = await getService();

    const projected = await svc.getUserProfile('weird', 'stranger');
    expect(projected.canViewActivity).toBe(false);
  });

  test('a blocked pair receives the restricted shell, not the real profile', async () => {
    seedUser('target', { isPrivate: false, privacy: PRIVATE_PRIVACY });
    seedUser('viewer');
    state.blocks.set('target_viewer', { blockerId: 'target', blockedId: 'viewer' });
    const svc = await getService();

    const projected = await svc.getUserProfile('target', 'viewer');

    expect(projected.isRestricted).toBe(true);
    expect(projected.isBlocked).toBe(true);
    expect(projected.isBlockedByTarget).toBe(true);
    expect(projected.bio).toBe('');
    expect(projected.canViewActivity).toBe(false);
  });

  test('never persists a privacy-masked projection to localStorage', async () => {
    seedUser('priv2', { isPrivate: true, privacy: PRIVATE_PRIVACY });
    const svc = await getService();

    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');
    await svc.getUserProfile('priv2', 'stranger');

    const writtenKeys = setItemSpy.mock.calls.map((c) => String(c[0]));
    expect(writtenKeys.some((k) => k.includes('priv2'))).toBe(false);
    setItemSpy.mockRestore();
  });

  test('returns null for a non-existent user instead of synthesizing one', async () => {
    const svc = await getService();
    await expect(svc.getUserProfile('ghost', 'stranger')).resolves.toBeNull();
  });
});
