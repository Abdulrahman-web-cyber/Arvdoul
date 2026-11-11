/**
 * src/__tests__/directoryPaginationService.test.js
 *
 * Two directory services had dead/incorrect "Load More":
 *   - `communityService.listCommunities` pushed a bare NUMBER
 *     (`(page - 1) * COMMUNITIES_PER_PAGE`) into the constraint list, which
 *     `query()` rejects — every page > 1 threw ("Failed to load communities").
 *   - `eventService.listEvents` accepted `page` but never applied a cursor, so
 *     every "Load More" re-fetched page 1.
 * Both now use real doc-id cursor pagination and return `nextCursor`/`hasMore`.
 *
 * @jest-environment node
 */

import { jest } from '@jest/globals';

jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: async () => ({}),
  getFunctionsInstance: async () => ({}),
}));

// `query` validates its constraints the way the real SDK does: a bare number is
// not a QueryConstraint and must throw.
const QueryConstraintBrand = Symbol('QueryConstraint');
const isConstraint = (c) => c && c[QueryConstraintBrand] === true;
jest.unstable_mockModule('firebase/firestore', () => ({
  collection: () => ({}),
  doc: (_db, coll, id) => ({ __doc: true, coll, id }),
  getDoc: async (ref) => ({ id: ref.id, exists: () => ref.id in globalThis.__pages }),
  getDocs: async (q) => {
    const ids = globalThis.__pages[q.__cursorId ?? '__start__'] ?? [];
    const limited = q.__limit ? ids.slice(0, q.__limit) : ids;
    return {
      docs: limited.map((id) => ({ id, data: () => globalThis.__docData?.[id] ?? { id } })),
      size: limited.length,
      empty: limited.length === 0,
    };
  },
  query: (base, ...constraints) => {
    for (const c of constraints) {
      if (!isConstraint(c)) {
        throw new Error(`Invalid QueryConstraint: ${String(c)}`);
      }
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
  serverTimestamp: () => null,
  onSnapshot: () => () => {},
}));

const { getCommunityService } = await import('../services/communityService.js');
const { getEventService } = await import('../services/eventService.js');

const ids = (n, prefix) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

beforeEach(() => {
  globalThis.__pages = {};
});

test('listCommunities returns a cursor and never pushes a bare number', async () => {
  const svc = getCommunityService();
  svc.initialized = true;
  svc.db = {};

  globalThis.__pages = { __start__: ids(20, 'c'), c19: ['c20', 'c21'] };
  const page1 = await svc.listCommunities({ page: 1, sortBy: 'newest' });
  expect(page1.communities.map((c) => c.id)).toHaveLength(20);
  expect(page1.hasMore).toBe(true);
  expect(page1.nextCursor).toBe('c19');

  // Page 2 must apply the cursor (previously it threw on a bare number).
  const page2 = await svc.listCommunities({ page: 2, startAfterId: 'c19', sortBy: 'newest' });
  expect(page2.communities.map((c) => c.id)).toEqual(['c20', 'c21']);
  expect(page2.hasMore).toBe(false);
  expect(page2.nextCursor).toBeNull();
});

test('listEvents applies the startAfter cursor and honors the status filter', async () => {
  const svc = getEventService();
  svc.initialized = true;
  svc.db = {};

  globalThis.__pages = { __start__: ids(20, 'e'), e19: ['e20'] };
  const page1 = await svc.listEvents({ page: 1, status: ['published', 'open'], sortBy: 'upcoming' });
  expect(page1.events).toHaveLength(20);
  expect(page1.hasMore).toBe(true);
  expect(page1.nextCursor).toBe('e19');

  const page2 = await svc.listEvents({ page: 2, startAfterId: 'e19', sortBy: 'upcoming' });
  expect(page2.events.map((e) => e.id)).toEqual(['e20']);
  expect(page2.hasMore).toBe(false);
  expect(page2.nextCursor).toBeNull();
});

test('listEvents applies the free-text searchQuery (previously a dead input)', async () => {
  const svc = getEventService();
  svc.initialized = true;
  svc.db = {};

  globalThis.__pages = { __start__: ['e0', 'e1', 'e2'] };
  globalThis.__docData = {
    e0: { id: 'e0', title: 'Design Summit', location: 'Berlin' },
    e1: { id: 'e1', title: 'Coffee Meetup', location: 'Berlin' },
    e2: { id: 'e2', title: 'Design Jam', description: 'a design evening' },
  };

  // Title match and description match both surface; a non-match is dropped.
  const res = await svc.listEvents({ page: 1, searchQuery: 'design' });
  expect(res.events.map((e) => e.id)).toEqual(['e0', 'e2']);
  // A search is a single window: never advertise more pages.
  expect(res.hasMore).toBe(false);
  expect(res.nextCursor).toBeNull();

  // No match -> empty result, not the whole collection.
  const none = await svc.listEvents({ page: 1, searchQuery: 'zzz' });
  expect(none.events).toEqual([]);
});
