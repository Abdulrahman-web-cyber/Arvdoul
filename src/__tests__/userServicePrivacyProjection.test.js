/**
 * getUserProfile privacy projection (AUDIT V3 N007 / N018).
 *
 * `getUserProfile` used to run its own section-masking on top of the
 * capability engine, so the two could disagree. It now resolves the relation
 * flags and delegates the decision to `resolveCapabilities` +
 * `projectProfileForViewer`. These tests exercise the real code path against an
 * in-memory fake Firestore and assert the projection is exactly the engine's
 * decision for the same relation (no second privacy layer).
 */

import { jest } from '@jest/globals';
import { resolveCapabilities } from '../services/profileCapabilityEngine.js';

const docs = new Map(); // "collection/id" -> data

const fakeFirestore = {
  doc: (_db, ...segments) => ({
    path: segments.join('/'),
    collection: segments[0],
    id: segments.length > 2 ? segments.slice(1).join('/') : segments[1],
  }),
  collection: (_db, name) => ({ name }),
  getDoc: async (ref) => {
    const data = docs.get(`${ref.collection}/${ref.id}`);
    return { exists: () => data !== undefined, data: () => data, id: ref.id };
  },
  enableIndexedDbPersistence: async () => ({}),
  serverTimestamp: () => ({ __ts: 1 }),
  Timestamp: { fromDate: (d) => ({ toDate: () => d }), now: () => ({ toDate: () => new Date() }) },
  addDoc: async () => ({ id: 'x' }),
  setDoc: async () => {},
  updateDoc: async () => {},
  deleteDoc: async () => {},
  getDocs: async () => ({ docs: [], forEach: () => {}, size: 0, empty: true }),
  onSnapshot: (_ref, cb) => { cb({ exists: () => false, data: () => null }); return () => {}; },
  writeBatch: () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: async () => {} }),
  runTransaction: async () => {},
  query: (colRef, ...constraints) => ({ colRef, constraints }),
  where: (field, op, value) => ({ field, op, value }),
  orderBy: () => ({}),
  limit: (n) => ({ limit: n }),
  increment: (n) => ({ __inc: n }),
  arrayUnion: (v) => ({ __union: v }),
  arrayRemove: (v) => ({ __remove: v }),
};

jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: jest.fn(async () => fakeFirestore),
  getAuthInstance: jest.fn(async () => ({ currentUser: null })),
  auth: { currentUser: null },
  db: fakeFirestore,
  storage: {},
  initializeFirebase: jest.fn(async () => {}),
  awaitFirebaseReady: jest.fn(async () => true),
  isFirebaseInitialized: jest.fn(() => true),
  FIREBASE_CONFIG: { projectId: 'test' },
}));
jest.unstable_mockModule('firebase/firestore', () => fakeFirestore);

const TARGET = 'target-user';
const VIEWER = 'viewer-user';

async function serviceWith(docData) {
  const { getUserService } = await import('../services/userService.js');
  const svc = getUserService();
  svc.firestore = fakeFirestore;
  svc.initialized = true;
  svc.cache.clear();
  docs.set(`users/${TARGET}`, docData);
  return svc;
}

beforeEach(() => docs.clear());

describe('getUserProfile privacy projection', () => {
  it('masks economic status and presence for a public viewer but keeps public links', async () => {
    const svc = await serviceWith({
      displayName: 'Elena', coins: 500, links: ['https://elena.dev'],
      isOnline: true, lastActive: new Date().toISOString(),
    });

    const profile = await svc.getUserProfile(TARGET, VIEWER);

    expect(profile.coins).toBeNull();
    expect(profile.presence.isOnline).toBe(false);
    expect(profile.links).toEqual(['https://elena.dev']);
    expect(profile.canViewActivity).toBe(true);
  });

  it('returns the same section decisions the engine resolves (single source)', async () => {
    const svc = await serviceWith({ displayName: 'Elena', isPrivate: false, coins: 10 });

    const profile = await svc.getUserProfile(TARGET, VIEWER);
    const caps = resolveCapabilities({
      viewer: { uid: VIEWER },
      target: { ...docs.get(`users/${TARGET}`), uid: TARGET, id: TARGET },
      relationship: { isOwner: false, isBlocking: false, isBlockedBy: false, isBlocked: false },
    });

    expect(profile.canViewActivity).toBe(caps.canViewActivity);
    expect(profile.canViewAchievements).toBe(caps.canViewAchievements);
    expect(profile.canViewTitles).toBe(caps.canViewTitles);
    expect(profile.canViewFollowersList).toBe(caps.canViewFollowers);
    expect(profile.canViewFollowingList).toBe(caps.canViewFollowing);
  });

  it('lets the owner see economic status and every section', async () => {
    const svc = await serviceWith({ displayName: 'Elena', coins: 500 });

    const profile = await svc.getUserProfile(TARGET, TARGET);

    expect(profile.coins).toBe(500);
    expect(profile.canViewActivity).toBe(true);
    expect(profile.canViewFollowersList).toBe(true);
  });

  it('denies content and every section for a private account viewed by a non-follower', async () => {
    const svc = await serviceWith({ displayName: 'Elena', isPrivate: true, coins: 500, links: ['x'] });

    const profile = await svc.getUserProfile(TARGET, VIEWER);
    const caps = resolveCapabilities({
      viewer: { uid: VIEWER },
      target: { ...docs.get(`users/${TARGET}`), uid: TARGET, id: TARGET },
      relationship: { isOwner: false },
    });

    expect(caps.canViewContent).toBe(false);
    expect(profile.canViewActivity).toBe(false);
    expect(profile.canViewAchievements).toBe(false);
    expect(profile.links).toEqual([]);
    expect(profile.presence.isOnline).toBe(false);
    // Identity survives the gate so the screen can offer "Follow".
    expect(profile.displayName).toBe('Elena');
  });

  it('shows presence to a follower (presence defaults to FOLLOWERS)', async () => {
    const svc = await serviceWith({
      displayName: 'Elena',
      isOnline: true, lastActive: new Date().toISOString(),
    });
    docs.set(`follows/${VIEWER}_${TARGET}`, { followerId: VIEWER, followingId: TARGET });

    const profile = await svc.getUserProfile(TARGET, VIEWER);

    expect(profile.presence.isOnline).toBe(true);
  });

  it('strips bio and counts and reports block flags when the target blocked the viewer', async () => {
    const svc = await serviceWith({ displayName: 'Elena', bio: 'hi', followerCount: 42, coins: 5 });
    docs.set(`blocks/${TARGET}_${VIEWER}`, { blockerId: TARGET, blockedId: VIEWER });

    const profile = await svc.getUserProfile(TARGET, VIEWER);

    expect(profile.isBlocked).toBe(true);
    expect(profile.isBlockedByTarget).toBe(true);
    expect(profile.isBlockedByViewer).toBe(false);
    expect(profile.bio).toBe('');
    expect(profile.followerCount).toBe(0);
    expect(profile.presence.isOnline).toBe(false);
  });

  it('reports the viewer-side block direction distinctly', async () => {
    const svc = await serviceWith({ displayName: 'Elena' });
    docs.set(`blocks/${VIEWER}_${TARGET}`, { blockerId: VIEWER, blockedId: TARGET });

    const profile = await svc.getUserProfile(TARGET, VIEWER);

    expect(profile.isBlocked).toBe(true);
    expect(profile.isBlockedByTarget).toBe(false);
    expect(profile.isBlockedByViewer).toBe(true);
  });

  it('does not hide content from a muted (non-blocking) viewer', async () => {
    const svc = await serviceWith({ displayName: 'Elena', coins: 5 });
    docs.set(`mutes/${VIEWER}_${TARGET}`, { muterId: VIEWER, mutedId: TARGET });

    const profile = await svc.getUserProfile(TARGET, VIEWER);

    expect(profile.isBlocked).toBe(false);
    expect(profile.canViewActivity).toBe(true);
    expect(profile.coins).toBeNull();
  });

  it('treats a restricted viewer as restricted but not blocked', async () => {
    const svc = await serviceWith({ displayName: 'Elena', coins: 5 });
    // The viewer restricted the target; the flag surfaces so the UI can offer
    // "Unrestrict", but restriction (unlike a block) does not hide content.
    docs.set(`restricts/${VIEWER}_${TARGET}`, { restricterId: VIEWER, restrictedId: TARGET });

    const profile = await svc.getUserProfile(TARGET, VIEWER);

    expect(profile.isRestricted).toBe(true);
    expect(profile.isBlocked).toBe(false);
    // Restriction is not a block: content stays visible to the viewer.
    expect(profile.canViewActivity).toBe(true);
  });

  it('denies content for a suspended account', async () => {
    const svc = await serviceWith({ displayName: 'Elena', accountStatus: 'suspended' });

    const profile = await svc.getUserProfile(TARGET, VIEWER);

    expect(profile.canViewActivity).toBe(false);
    expect(profile.presence.isOnline).toBe(false);
  });

  it('returns null rather than a synthesized identity when the document is absent', async () => {
    const { getUserService } = await import('../services/userService.js');
    const svc = getUserService();
    svc.firestore = fakeFirestore;
    svc.initialized = true;
    svc.cache.clear();

    expect(await svc.getUserProfile('missing-user', VIEWER)).toBeNull();
  });
});
