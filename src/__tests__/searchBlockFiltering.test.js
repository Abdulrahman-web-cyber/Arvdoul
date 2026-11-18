/**
 * src/__tests__/searchBlockFiltering.test.js
 *
 * Moderation enforcement in search (AGENTS.md §7.17: "Ensure moderation
 * actions are enforced throughout feeds, profiles, comments, search,
 * notifications and messaging"). The feed already filters blocked authors, but
 * search did not: a blocked user (or someone who blocked the viewer) could
 * still appear in people/post/video results. This suite pins the fix:
 *
 *   - `_getHiddenAuthorIds` delegates to the graph spine's
 *     `getHiddenAuthorIds` (blocks both directions + mutes), cached briefly.
 *     Search previously read blocks only, so a muted author's posts surfaced
 *     in search while the feed hid them (N525).
 *   - `_filterBlockedHits` / `_filterBlockedItems` drop blocked authors.
 *   - the search cache key is per-viewer (a shared page could leak a block).
 *
 * @jest-environment node
 */

import { jest } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const getHiddenAuthorIds = jest.fn();
jest.unstable_mockModule('../services/socialGraphService.js', () => ({
  getSocialGraphService: () => ({ getHiddenAuthorIds }),
  socialGraphService: { getHiddenAuthorIds },
}));

// `searchService` imports the `offlineQueue` singleton, whose constructor opens
// a `BroadcastChannel` that would keep the node test process alive.
jest.unstable_mockModule('../utils/OfflineQueue.js', () => ({
  offlineQueue: { enqueue: async () => {}, process: async () => {} },
  OfflineQueue: class {},
}));

const { getSearchService } = await import('../services/searchService.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const searchSource = fs.readFileSync(path.join(root, 'src/services/searchService.js'), 'utf8');

beforeEach(() => getHiddenAuthorIds.mockReset());

describe('searchService block filtering', () => {
  test('_getHiddenAuthorIds delegates to the spine (blocks both ways + mutes) and caches', async () => {
    // The spine owns the definition of "hidden author": everyone blocked,
    // everyone who blocks the viewer, and everyone the viewer muted.
    getHiddenAuthorIds.mockResolvedValue(new Set(['blocked-by-me', 'blocks-me', 'muted-by-me']));
    const svc = getSearchService();
    svc.hiddenAuthorCache.clear();

    const ids = await svc._getHiddenAuthorIds('viewer-1');
    expect([...ids].sort()).toEqual(['blocked-by-me', 'blocks-me', 'muted-by-me']);
    expect(getHiddenAuthorIds).toHaveBeenCalledWith('viewer-1');

    // Second call is served from the cache (no extra graph reads).
    getHiddenAuthorIds.mockClear();
    const again = await svc._getHiddenAuthorIds('viewer-1');
    expect([...again].sort()).toEqual(['blocked-by-me', 'blocks-me', 'muted-by-me']);
    expect(getHiddenAuthorIds).not.toHaveBeenCalled();
  });

  test('_getHiddenAuthorIds returns an empty set for an anonymous viewer', async () => {
    const svc = getSearchService();
    expect((await svc._getHiddenAuthorIds(null)).size).toBe(0);
    expect(getHiddenAuthorIds).not.toHaveBeenCalled();
  });

  test('_filterBlockedHits drops blocked authors from posts/videos and blocked users', () => {
    const svc = getSearchService();
    const blocked = new Set(['bad-user']);
    const results = {
      users: [{ objectID: 'bad-user' }, { objectID: 'ok-user' }],
      posts: [{ objectID: 'p1', authorId: 'bad-user' }, { objectID: 'p2', authorId: 'ok-user' }],
      videos: [{ objectID: 'v1', userId: 'bad-user' }, { objectID: 'v2', userId: 'ok-user' }],
      _posts_metadata: { maxScore: 1 },
    };
    const out = svc._filterBlockedHits(results, blocked);
    expect(out.users.map((h) => h.objectID)).toEqual(['ok-user']);
    expect(out.posts.map((h) => h.objectID)).toEqual(['p2']);
    expect(out.videos.map((h) => h.objectID)).toEqual(['v2']);
    // Metadata buckets are passed through untouched.
    expect(out._posts_metadata).toEqual({ maxScore: 1 });
  });

  test('_filterBlockedHits is a no-op without a block set', () => {
    const svc = getSearchService();
    const results = { users: [{ objectID: 'a' }] };
    expect(svc._filterBlockedHits(results, new Set())).toBe(results);
  });

  test('_filterBlockedItems drops blocked authors from built result items', () => {
    const svc = getSearchService();
    // `SearchResultItem.type` is the singular form (`TYPE_MAP`), not the
    // base-index name.
    const items = [
      { type: 'user', id: 'bad-user', raw: { id: 'bad-user' } },
      { type: 'post', id: 'p1', raw: { authorId: 'bad-user' } },
      { type: 'post', id: 'p2', raw: { authorId: 'ok-user' } },
      { type: 'video', id: 'v1', raw: { userId: 'bad-user' } },
    ];
    const out = svc._filterBlockedItems(items, new Set(['bad-user']));
    expect(out.map((i) => i.id)).toEqual(['p2']);
  });

  test('_hitAuthorId reads the right field per type (singular and plural)', () => {
    const { _hitAuthorId } = getSearchService().constructor;
    expect(_hitAuthorId({ objectID: 'u1' }, 'users')).toBe('u1');
    expect(_hitAuthorId({ objectID: 'u1' }, 'user')).toBe('u1');
    expect(_hitAuthorId({ authorId: 'a1' }, 'posts')).toBe('a1');
    expect(_hitAuthorId({ authorId: 'a1' }, 'post')).toBe('a1');
    expect(_hitAuthorId({ userId: 'v1' }, 'videos')).toBe('v1');
    expect(_hitAuthorId({}, 'posts')).toBe(null);
  });

  test('the search path applies hidden-author filtering to fresh and cached results, and scopes the cache per viewer', () => {
    // Fresh results: the merged hidden-author set is applied before fusion.
    expect(searchSource).toMatch(/_getHiddenAuthorIds\(viewerId\)[\s\S]*?_filterBlockedHits\(resultsByType, blockedIds\)/);
    // Cached results: filtered on read.
    expect(searchSource).toMatch(/_filterBlockedItems\(cached\.items, blocked\)/);
    // Per-viewer cache key.
    expect(searchSource).toMatch(/v: this\._resolveViewerId\(options\)/);
  });
});
