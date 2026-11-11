/**
 * src/__tests__/commentPaginationWiring.test.js
 *
 * `CommentsDrawer.handleLoadMore` sends `startAfter: postState.nextCursor` and
 * reads `result.hasMore` / `result.nextCursor`, but `commentService
 * .getCommentsByPost` never applied a cursor and never returned `nextCursor`:
 * "load more" re-fetched page 1 forever and (deduped by id) appended nothing.
 * Its cache-hit path also dropped `hasMore`/`nextCursor`, disabling load-more
 * on a warm cache. This pins the fixed contract against a stubbed Firestore.
 *
 * @jest-environment node
 */

import { jest } from '@jest/globals';

// The service auto-initializes Firebase and starts a 60s cleanup interval on
// construction; mock Firebase so the test never touches the network and the
// process can exit.
jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: async () => ({}),
}));

// `commentService` imports the `offlineQueue` singleton, whose constructor
// opens a `BroadcastChannel` that would keep the node test process alive.
jest.unstable_mockModule('../utils/OfflineQueue.js', () => ({
  offlineQueue: { enqueue: async () => {}, process: async () => {} },
  OfflineQueue: class {},
}));

const { getCommentService } = await import('../services/commentService.js');

/** A snapshot shaped like a Firestore QuerySnapshot over the given ids. */
function snapshot(ids) {
  const docs = ids.map((id) => ({
    id,
    data: () => ({
      postId: 'p',
      isDeleted: false,
      isHidden: false,
      moderationStatus: 'approved',
      createdAt: { toDate: () => new Date() },
    }),
  }));
  return { size: docs.length, docs, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
}

/**
 * Wire the service's `firestoreMethods` to an in-memory page store. `pages` is
 * keyed by cursor (`'__start__'` for the first page) so we can prove the cursor
 * the service passes is the one the query actually uses.
 */
function wire(svc, pages) {
  svc.initialized = true;
  svc.firestore = {};
  // The service starts a 60s cleanup interval; stop it so the test process can
  // exit.
  if (svc.cleanupInterval) { clearInterval(svc.cleanupInterval); svc.cleanupInterval = null; }
  const calls = { startAfter: 0, docIds: [] };
  svc.firestoreMethods = {
    collection: () => ({}),
    where: () => ({}),
    orderBy: () => ({}),
    limit: (n) => ({ __limit: n }),
    query: (_ref, ...conds) => ({ __conds: conds }),
    startAfter: () => {
      calls.startAfter += 1;
      return { __startAfter: true };
    },
    doc: (_fs, _coll, id) => {
      calls.docIds.push(id);
      return { __ref: id };
    },
    getDoc: async (ref) => ({ exists: () => ref.__ref in pages }),
    getDocs: async (q) => {
      const cursorCond = (q.__conds || []).find((c) => c && c.__startAfter);
      const limitCond = (q.__conds || []).find((c) => c && c.__limit);
      const cursorId = cursorCond ? calls.docIds[calls.docIds.length - 1] : '__start__';
      const ids = pages[cursorId] ?? [];
      const limited = limitCond ? ids.slice(0, limitCond.__limit) : ids;
      return snapshot(limited);
    },
  };
  return calls;
}

test('the first page returns hasMore/nextCursor pointing at the last id', async () => {
  const svc = getCommentService();
  const ids = Array.from({ length: 30 }, (_, i) => `c${i}`);
  wire(svc, { __start__: ids, c29: ['c30', 'c31'] });

  const page1 = await svc.getCommentsByPost('post-a', { parentId: null, limit: 30, cacheFirst: false });
  expect(page1.success).toBe(true);
  expect(page1.comments).toHaveLength(30);
  expect(page1.hasMore).toBe(true);
  expect(page1.nextCursor).toBe('c29');
});

test('a cursor query applies startAfter and returns the next page', async () => {
  const svc = getCommentService();
  wire(svc, { __start__: Array.from({ length: 30 }, (_, i) => `c${i}`), c29: ['c30', 'c31'] });

  const page2 = await svc.getCommentsByPost('post-b', {
    parentId: null,
    limit: 30,
    startAfter: 'c29',
    cacheFirst: false,
  });
  expect(page2.comments.map((c) => c.id)).toEqual(['c30', 'c31']);
  // A short page means the end of the thread.
  expect(page2.hasMore).toBe(false);
  expect(page2.nextCursor).toBeNull();
});

test('a cache hit still carries hasMore/nextCursor', async () => {
  const svc = getCommentService();
  wire(svc, { __start__: Array.from({ length: 30 }, (_, i) => `c${i}`), c29: [] });

  const first = await svc.getCommentsByPost('post-c', { parentId: null, limit: 30 });
  expect(first.hasMore).toBe(true);
  expect(first.nextCursor).toBe('c29');

  // Second call within the cache window must not drop the pagination fields.
  const second = await svc.getCommentsByPost('post-c', { parentId: null, limit: 30 });
  expect(second.cached).toBe(true);
  expect(second.hasMore).toBe(true);
  expect(second.nextCursor).toBe('c29');
});
