/**
 * src/__tests__/searchPaginationWiring.test.js
 *
 * `useSearch` read `response.hasNextPage` / `response.cursor`, but
 * `searchService.search` returns `hasMore` / `nextCursor`. The wrong keys left
 * `hasMore` pinned to `false`, so `SearchScreen`'s "load more" never fired and
 * `loadMore` always sent a null cursor — the second page was unreachable.
 *
 * This exercises the real hook against a mocked service and asserts the store
 * fields and the follow-up request reflect the service response.
 */

import { jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';

const searchMock = jest.fn();
jest.unstable_mockModule('../services/searchService', () => ({
  default: {
    search: (...args) => searchMock(...args),
    getSuggestions: async () => ({ success: true, suggestions: [] }),
    getFacetValues: async () => ({ success: true, facetValues: [] }),
  },
}));

const { useSearch } = await import('../hooks/useSearch.js');
const { useSearchStore } = await import('../store/searchStore.js');

beforeEach(() => {
  searchMock.mockReset();
  useSearchStore.getState().reset();
  // Deterministic per-query responses so the mount-time trending fetch
  // (`search('')`) cannot consume a queued mock.
  searchMock.mockImplementation(async (q, opts = {}) => {
    if (q === '') return { success: true, items: [], hasMore: false, nextCursor: null };
    if (opts.cursor) return { success: true, items: [{ id: 'p2' }], hasMore: false, nextCursor: null };
    return { success: true, items: [{ id: 'p1' }], hasMore: true, nextCursor: '2' };
  });
});

test('hasMore/cursor reflect the service response (hasMore/nextCursor)', async () => {
  const { result } = renderHook(() => useSearch());

  await act(async () => { await result.current.search('hello'); });

  expect(result.current.hasMore).toBe(true);
  expect(useSearchStore.getState().cursor).toBe('2');
});

test('loadMore pages with the returned cursor and appends results', async () => {
  useSearchStore.setState({ query: 'hello' });
  const { result } = renderHook(() => useSearch());
  await act(async () => { await result.current.search('hello'); });
  await act(async () => { await result.current.loadMore(); });

  expect(searchMock).toHaveBeenLastCalledWith('hello', expect.objectContaining({ cursor: '2' }));
  expect(result.current.results.map((r) => r.id)).toEqual(['p1', 'p2']);
  expect(result.current.hasMore).toBe(false);
});
