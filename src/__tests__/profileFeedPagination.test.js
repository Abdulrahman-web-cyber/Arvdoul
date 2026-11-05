/**
 * Profile feed pagination.
 *
 * The profile grid previously truncated at the first page: the store's
 * `loadMorePosts` existed but nothing called it, the service ignored the
 * `cursor` option the store passed, and a cached first page dropped
 * `hasMore`/`nextCursor`. These tests lock the fix in.
 */

import { jest } from '@jest/globals';
import { firestoreService } from '../services/firestoreService.js';
import { useProfileStore } from '../store/profileStore.js';

describe('profile feed pagination', () => {
  let spy;

  beforeEach(() => {
    useProfileStore.getState().clear();
    spy = jest.spyOn(firestoreService, 'getPostsByUser').mockResolvedValue({
      success: true, posts: [], hasMore: false, nextCursor: null,
    });
  });

  afterEach(() => {
    spy.mockRestore();
  });

  test('loadPosts records the cursor and whether more pages exist', async () => {
    spy.mockResolvedValue({
      success: true,
      posts: [{ id: 'p1' }, { id: 'p2' }],
      hasMore: true,
      nextCursor: 'p2',
    });

    await useProfileStore.getState().loadPosts('u1', { limit: 12 });

    const state = useProfileStore.getState();
    expect(state.posts.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(state.postsHasMore).toBe(true);
    expect(state.postsCursor).toBe('p2');
    expect(spy).toHaveBeenCalledWith('u1', { limit: 12 });
  });

  test('loadMorePosts appends the next page and advances the cursor', async () => {
    spy.mockResolvedValueOnce({
      success: true, posts: [{ id: 'p1' }], hasMore: true, nextCursor: 'p1',
    });
    await useProfileStore.getState().loadPosts('u1', { limit: 12 });

    spy.mockResolvedValueOnce({
      success: true, posts: [{ id: 'p2' }], hasMore: false, nextCursor: null,
    });
    await useProfileStore.getState().loadMorePosts('u1');

    expect(spy).toHaveBeenLastCalledWith('u1', { limit: 12, cursor: 'p1' });
    const state = useProfileStore.getState();
    expect(state.posts.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(state.postsHasMore).toBe(false);
    expect(state.postsCursor).toBeNull();
    expect(state.postsLoading).toBe(false);
  });

  test('loadMorePosts is a no-op when there is no cursor or no more pages', async () => {
    spy.mockResolvedValueOnce({
      success: true, posts: [{ id: 'p1' }], hasMore: false, nextCursor: null,
    });
    await useProfileStore.getState().loadPosts('u1', { limit: 12 });
    spy.mockClear();

    await useProfileStore.getState().loadMorePosts('u1');

    expect(spy).not.toHaveBeenCalled();
  });

  test('loadMorePosts drops ids already in the feed (no duplicates)', async () => {
    spy.mockResolvedValueOnce({
      success: true, posts: [{ id: 'p1' }, { id: 'p2' }], hasMore: true, nextCursor: 'p2',
    });
    await useProfileStore.getState().loadPosts('u1', { limit: 12 });

    // A post created between pages can shift the window and reappear.
    spy.mockResolvedValueOnce({
      success: true, posts: [{ id: 'p2' }, { id: 'p3' }], hasMore: true, nextCursor: 'p3',
    });
    await useProfileStore.getState().loadMorePosts('u1');

    expect(useProfileStore.getState().posts.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
  });
});

describe('profileStore follow/unfollow rollback', () => {
  beforeEach(() => {
    useProfileStore.getState().clear();
  });

  test('a failed follow restores the real previous follow status, not the optimistic one', async () => {
    // Seed a known previous state, then make the service call fail.
    useProfileStore.setState({ followStatus: { isFollowing: false }, profile: { followerCount: 10 } });
    const userServiceModule = await import('../services/userService.js');
    const userService = userServiceModule.getUserService();
    const spy = jest.spyOn(userService, 'followUser').mockRejectedValue(new Error('offline'));

    await useProfileStore.getState().follow('viewer', 'target');

    const state = useProfileStore.getState();
    // A failed follow must roll back to the true previous state.
    expect(state.followStatus.isFollowing).toBe(false);
    expect(state.profile.followerCount).toBe(10);
    spy.mockRestore();
  });

  test('a failed unfollow restores the real previous follow status', async () => {
    useProfileStore.setState({ followStatus: { isFollowing: true }, profile: { followerCount: 10 } });
    const userServiceModule = await import('../services/userService.js');
    const userService = userServiceModule.getUserService();
    const spy = jest.spyOn(userService, 'unfollowUser').mockRejectedValue(new Error('offline'));

    await useProfileStore.getState().unfollow('viewer', 'target');

    const state = useProfileStore.getState();
    expect(state.followStatus.isFollowing).toBe(true);
    expect(state.profile.followerCount).toBe(10);
    spy.mockRestore();
  });
});
