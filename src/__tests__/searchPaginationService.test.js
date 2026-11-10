/**
 * src/__tests__/searchPaginationService.test.js
 *
 * `searchService.search` asked the provider for page N and then sliced
 * `finalHits[page * hitsPerPage …]` out of the fused list — but the fused list
 * only ever held the single fetched page, so page N returned an EMPTY page for
 * N > 0, and `hasMore` (derived from the page-local length) was always false.
 * The service now fetches a window of pages in one provider query and slices
 * the requested page out of it. This pins the real behaviour.
 *
 * @jest-environment node
 */

import { jest } from '@jest/globals';

// `searchService` imports the `offlineQueue` singleton, whose constructor opens
// a `BroadcastChannel` that would keep the node test process alive.
jest.unstable_mockModule('../utils/OfflineQueue.js', () => ({
  offlineQueue: { enqueue: async () => {}, process: async () => {} },
  OfflineQueue: class {},
}));

const { getSearchService, default: searchService } = await import('../services/searchService.js');

function makeHits(start, count) {
  return Array.from({ length: count }, (_, i) => ({
    objectID: `p${start + i}`,
    authorId: 'author',
    _rankingScore: 1,
  }));
}

/** A fake Algolia client that serves the requested page of a `total`-hit index. */
function algoliaClient(total) {
  return {
    multipleQueries: jest.fn(async (requests) => ({
      results: requests.map((r) => {
        const { page = 0, hitsPerPage = 20 } = r.params;
        const start = page * hitsPerPage;
        const available = Math.max(0, Math.min(hitsPerPage, total - start));
        return { hits: makeHits(start, available), nbHits: total, page, hitsPerPage };
      }),
    })),
  };
}

function readyService(total) {
  const svc = getSearchService();
  svc.client = algoliaClient(total);
  svc.indices = {};
  svc.firestore = {};
  return svc;
}

const opts = (page) => ({ indices: ['posts'], hitsPerPage: 20, page, cache: false });

test('page 1 returns the second page of hits, not an empty page', async () => {
  const svc = readyService(100);
  const page0 = await svc.search('x', opts(0));
  const page1 = await svc.search('x', opts(1));

  expect(page0.items.map((i) => i.id).slice(0, 2)).toEqual(['p0', 'p1']);
  expect(page1.items.map((i) => i.id).slice(0, 2)).toEqual(['p20', 'p21']);
  expect(page1.items).toHaveLength(20);
});

test('hasMore stays true while pages remain and total reports the provider count', async () => {
  const svc = readyService(100);
  const page0 = await svc.search('x', opts(0));
  expect(page0.hasMore).toBe(true);
  expect(page0.total).toBe(100);
  expect(page0.totalPages).toBe(5);
  expect(page0.nextCursor).toBe('1');
});

test('a result set smaller than one page reports no further pages', async () => {
  const svc = readyService(3);
  const page0 = await svc.search('x', opts(0));
  expect(page0.items).toHaveLength(3);
  expect(page0.hasMore).toBe(false);
  expect(page0.nextCursor).toBeNull();
});

test('the provider is asked for a window of pages, not just the requested page', async () => {
  const svc = readyService(100);
  await svc.search('x', opts(0));
  const request = svc.client.multipleQueries.mock.calls[0][0][0];
  expect(request.params.hitsPerPage).toBe(20 * searchService.CONFIG.PAGINATION.FETCH_PAGES);
});
