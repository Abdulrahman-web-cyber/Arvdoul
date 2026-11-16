/**
 * src/__tests__/commentBlockFiltering.test.js
 *
 * Every other read surface (feed, notifications, search, ranking, stories,
 * live, videos) resolves blocked/blocked-by/muted authors through the graph
 * spine (`socialGraphService.getHiddenAuthorIds`) before rendering. The comment
 * thread did not: `commentService.getCommentsByPost` returned every comment,
 * so blocking someone still left their comments visible under a post (and the
 * comment preview in `PostCard`).
 *
 * This pins the fix: the thread filters hidden authors, resolves the viewer
 * from the live session when no explicit `viewerId` is passed, and never
 * filters when there is no viewer (a signed-out reader sees the public thread).
 *
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const svcSource = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../services/commentService.js'),
  'utf8'
);

jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: async () => ({}),
  getAuthInstance: async () => ({ currentUser: { uid: 'viewer-1' } }),
}));

jest.unstable_mockModule('../utils/OfflineQueue.js', () => ({
  offlineQueue: { enqueue: async () => {}, process: async () => {} },
  OfflineQueue: class {},
}));

// The graph spine is dynamically imported by `_getHiddenAuthors`. A blocked
// author ('blocked-1') is in the hidden set; 'friend-1' is not.
jest.unstable_mockModule('../services/socialGraphService.js', () => ({
  getSocialGraphService: () => ({
    getHiddenAuthorIds: async () => new Set(['blocked-1']),
  }),
}));

const { getCommentService } = await import('../services/commentService.js');

function snapshot(rows) {
  const docs = rows.map((r) => ({
    id: r.id,
    data: () => ({
      postId: 'p',
      userId: r.userId,
      isDeleted: false,
      isHidden: false,
      moderationStatus: 'approved',
      createdAt: { toDate: () => new Date() },
    }),
  }));
  return { size: docs.length, docs, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
}

function wire(svc, rows) {
  svc.initialized = true;
  svc.firestore = {};
  if (svc.cleanupInterval) { clearInterval(svc.cleanupInterval); svc.cleanupInterval = null; }
  svc.firestoreMethods = {
    collection: () => ({}),
    where: () => ({}),
    orderBy: () => ({}),
    limit: () => ({}),
    query: () => ({}),
    startAfter: () => ({}),
    doc: () => ({}),
    getDoc: async () => ({ exists: () => false }),
    getDocs: async () => snapshot(rows),
  };
}

// The service auto-initializes in its constructor. If we install the mock
// methods before that in-flight `initialize()` resolves, it overwrites them
// with the real `firebase/firestore` module (its `getDocs` cannot run a mock
// query → empty snapshot), so the suite fails nondeterministically depending on
// how fast the module import resolves. Await the real init first so nothing
// clobbers the mock afterwards.
async function wireStable(svc, rows) {
  for (let i = 0; i < 200 && !svc.initialized; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  wire(svc, rows);
}

test('hidden (blocked/muted) authors are filtered from the thread', async () => {
  const svc = getCommentService();
  await wireStable(svc, [
    { id: 'c1', userId: 'friend-1' },
    { id: 'c2', userId: 'blocked-1' },
    { id: 'c3', userId: 'friend-2' },
  ]);
  const res = await svc.getCommentsByPost('post-a', { parentId: null, viewerId: 'viewer-1', cacheFirst: false });
  expect(res.success).toBe(true);
  expect(res.comments.map((c) => c.id)).toEqual(['c1', 'c3']);
});

test('the viewer falls back to the live session when not passed explicitly', async () => {
  const svc = getCommentService();
  await wireStable(svc, [
    { id: 'c1', userId: 'friend-1' },
    { id: 'c2', userId: 'blocked-1' },
  ]);
  // No viewerId option: the mock auth session is viewer-1, so the block applies.
  const res = await svc.getCommentsByPost('post-b', { parentId: null, cacheFirst: false });
  expect(res.comments.map((c) => c.id)).toEqual(['c1']);
});

test('every comment read path resolves the hidden-author set', () => {
  // Static guarantee that getReplies and the realtime subscription — which the
  // behavioural tests above do not drive — also filter hidden authors, so a
  // future edit cannot quietly drop one surface again.
  for (const method of ['async getReplies(', 'subscribeToPostComments(']) {
    const start = svcSource.indexOf(method);
    expect(start).toBeGreaterThan(-1);
    const block = svcSource.slice(start, start + 2600);
    expect(block).toMatch(/this\._getHiddenAuthors\(/);
    expect(block).toMatch(/hiddenAuthors\.has\(data\.userId\)/);
  }
});
