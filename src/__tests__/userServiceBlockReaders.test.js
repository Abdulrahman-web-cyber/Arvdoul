// src/__tests__/userServiceBlockReaders.test.js
//
// A block is a mutual denial: a surface that hides blocked content must hide
// BOTH the users the viewer blocked and the users who blocked the viewer.
// `userService.getBlockedUserIds` is the both-direction id reader the comment
// drawer uses (the feed and search already read both directions). N226.

import { jest } from '@jest/globals';

const listEdges = jest.fn();

jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: async () => ({}),
  db: {},
  auth: { currentUser: null },
  storage: {},
}));

jest.unstable_mockModule('../services/socialGraphService.js', () => ({
  getSocialGraphService: () => ({ listEdges }),
  socialGraphService: { listEdges },
}));

let getUserService;

beforeAll(async () => {
  ({ getUserService } = await import('../services/userService.js'));
});

beforeEach(() => listEdges.mockReset());

describe('userService.getBlockedUserIds (both block directions)', () => {
  test('unions the outgoing block list with the reverse (blocked-by) list', async () => {
    listEdges.mockImplementation(async (_uid, kind) => ({
      ids: kind === 'blocked' ? ['blocked-by-me'] : ['blocks-me'],
    }));

    const res = await getUserService().getBlockedUserIds('viewer-1');

    expect(res.success).toBe(true);
    expect(res.ids.sort()).toEqual(['blocked-by-me', 'blocks-me']);
    expect(listEdges).toHaveBeenCalledWith('viewer-1', 'blocked', expect.any(Object));
    expect(listEdges).toHaveBeenCalledWith('viewer-1', 'blocked_by', expect.any(Object));
  });

  test('deduplicates an id that appears in both directions', async () => {
    listEdges.mockResolvedValue({ ids: ['dup'] });
    const res = await getUserService().getBlockedUserIds('viewer-2');
    expect(res.ids).toEqual(['dup']);
  });

  test('returns an empty set when the viewer has no edges', async () => {
    listEdges.mockResolvedValue({ ids: [] });
    const res = await getUserService().getBlockedUserIds('viewer-3');
    expect(res.ids).toEqual([]);
  });
});
