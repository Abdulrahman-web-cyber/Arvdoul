/**
 * src/__tests__/rankingBlockFiltering.test.js
 *
 * Moderation enforcement in the leaderboards. `RankingsScreen` lists users
 * (creator/wealth/reputation/rising) from the `rankings` collections with no
 * block filter, so a blocked/blocked-by/muted user could still be ranked and
 * shown. `rankingService` now resolves the viewer's hidden-author set through
 * the graph spine and drops those rows (the viewer's own row always survives).
 *
 * @jest-environment node
 */

import { jest } from '@jest/globals';

const getHiddenAuthorIds = jest.fn();

jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: async () => ({}),
  db: {},
  auth: { currentUser: null },
  storage: {},
}));

// Fake Firestore: every `rankings` read returns a fixed set of rows; the
// batched `users` read returns minimal profiles.
jest.unstable_mockModule('firebase/firestore', () => ({
  collection: (_db, ...path) => ({ __type: 'collection', path: path.join('/') }),
  doc: (_db, ...path) => ({ __type: 'doc', path: path.join('/') }),
  query: (ref, ...constraints) => ({ ...ref, constraints }),
  where: (field, op, value) => ({ __type: 'where', field, op, value }),
  orderBy: (field, dir) => ({ __type: 'orderBy', field, dir }),
  limit: (n) => ({ __type: 'limit', n }),
  getDocs: async (q) => {
    if (q.path === 'users') {
      return { docs: [], forEach: () => {}, size: 0 };
    }
    return {
      docs: [
        { id: 'r1', data: () => ({ userId: 'blocked-1', score: 900 }) },
        { id: 'r2', data: () => ({ userId: 'me', score: 800 }) },
        { id: 'r3', data: () => ({ userId: 'blocker-1', score: 700 }) },
      ],
      size: 3,
    };
  },
  getDoc: async () => ({ exists: () => false, data: () => ({}) }),
}));

jest.unstable_mockModule('../services/socialGraphService.js', () => ({
  getSocialGraphService: () => ({ getHiddenAuthorIds }),
}));

const { default: rankingService, getRankingService } = await import('../services/rankingService.js');

beforeEach(() => {
  getHiddenAuthorIds.mockReset();
  getHiddenAuthorIds.mockResolvedValue(new Set(['blocked-1', 'blocker-1']));
  getRankingService()._clearCache();
});

describe('rankingService block filtering', () => {
  test('getCreatorRankings drops blocked / blocked-by users but keeps the viewer', async () => {
    const rows = await rankingService.getCreatorRankings('engagement', 'month', 0, 'me');
    expect(rows.map((r) => r.userId)).toEqual(['me']);
    expect(getHiddenAuthorIds).toHaveBeenCalledWith('me');
  });

  test('getWealthRankings drops hidden users and renumbers the visible ranks', async () => {
    const rows = await rankingService.getWealthRankings('net_worth', 'month', 0, 'me');
    expect(rows.map((r) => r.userId)).toEqual(['me']);
    expect(rows[0].rank).toBe(1);
  });

  test('getReputationRankings drops hidden users', async () => {
    const rows = await rankingService.getReputationRankings('trust', 'month', 0, 'me');
    expect(rows.map((r) => r.userId)).toEqual(['me']);
  });

  test('with no viewerId nothing is filtered (public/anonymous read)', async () => {
    const rows = await rankingService.getCreatorRankings('engagement', 'month', 0, null);
    expect(rows.map((r) => r.userId)).toEqual(['blocked-1', 'me', 'blocker-1']);
    expect(getHiddenAuthorIds).not.toHaveBeenCalled();
  });

  test('the viewer cache key is per-viewer, so a shared page cannot leak a block', async () => {
    await rankingService.getCreatorRankings('engagement', 'month', 0, 'me');
    getHiddenAuthorIds.mockClear();
    // A different viewer must not be served the previous viewer's filtered page.
    getHiddenAuthorIds.mockResolvedValue(new Set());
    const rows = await rankingService.getCreatorRankings('engagement', 'month', 0, 'someone-else');
    expect(getHiddenAuthorIds).toHaveBeenCalledWith('someone-else');
    expect(rows).toHaveLength(3);
  });
});
