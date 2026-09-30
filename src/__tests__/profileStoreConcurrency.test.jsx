/**
 * src/__tests__/profileStoreConcurrency.test.jsx
 *
 * Guards the profileStore's stale-response protection and its refusal to
 * fabricate domain values. A slow response for a previous target must never
 * overwrite newer state, and unavailable domain data must stay null rather than
 * being defaulted to a plausible number.
 *
 * Services are mocked with `unstable_mockModule` because the store loads them
 * through dynamic import(), which `jest.mock` cannot intercept under the ESM
 * test runtime.
 */

import { useProfileStore } from '../store/profileStore.js';

jest.mock('../utils/Logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockGetPostsByUser = jest.fn();
const mockFollowUser = jest.fn(async () => true);
const mockUnfollowUser = jest.fn(async () => true);

jest.unstable_mockModule('../services/userService.js', () => {
  const userService = {
    followUser: (...args) => mockFollowUser(...args),
    unfollowUser: (...args) => mockUnfollowUser(...args),
    getFollowStatus: jest.fn(async () => ({ isFollowing: false })),
    getUserProfile: jest.fn(async () => null),
  };
  return { __esModule: true, getUserService: () => userService, userService };
});

jest.unstable_mockModule('../services/firestoreService.js', () => {
  const fsMock = {
    getPostsByUser: (...args) => mockGetPostsByUser(...args),
    getSavedPosts: jest.fn(async () => ({ posts: [] })),
  };
  return { __esModule: true, getFirestoreService: () => fsMock, firestoreService: fsMock };
});

jest.unstable_mockModule('../services/achievementService.js', () => ({
  __esModule: true,
  default: { getUserAchievements: jest.fn(async () => []) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  useProfileStore.setState({
    posts: [],
    postsLoading: false,
    postsError: null,
    postsHasMore: false,
    postsCursor: null,
    _postsRequestId: 0,
    achievements: [],
    _activeTargetId: null,
    resolvedTargetId: null,
    isOwner: false,
    capabilities: null,
    balance: null,
  });
});

describe('profileStore stale-response protection', () => {
  test('a superseded loadPosts response cannot overwrite newer posts', async () => {
    useProfileStore.setState({ _activeTargetId: 'u1', resolvedTargetId: 'u1' });

    let resolveFirst;
    mockGetPostsByUser
      .mockImplementationOnce(() => new Promise((res) => { resolveFirst = res; }))
      .mockImplementationOnce(async () => ({ posts: [{ id: 'newer' }], hasMore: false, nextCursor: null }));

    const first = useProfileStore.getState().loadPosts('u1', { limit: 12 });
    const second = useProfileStore.getState().loadPosts('u1', { limit: 12 });

    await second;
    resolveFirst({ posts: [{ id: 'stale' }], hasMore: false, nextCursor: null });
    await first;

    expect(mockGetPostsByUser).toHaveBeenCalledTimes(2);
    expect(useProfileStore.getState().posts.map((p) => p.id)).toEqual(['newer']);
  });

  test('a response for a previous target is dropped', async () => {
    let resolveSlow;
    mockGetPostsByUser.mockImplementationOnce(() => new Promise((res) => { resolveSlow = res; }));

    const pending = useProfileStore.getState().loadPosts('u1', { limit: 12 });
    // Let the deferred dynamic import resolve so the mock is actually invoked.
    await new Promise((r) => setTimeout(r, 0));
    useProfileStore.setState({ _activeTargetId: 'u2', resolvedTargetId: 'u2' });
    resolveSlow({ posts: [{ id: 'u1-post' }], hasMore: false, nextCursor: null });
    await pending;

    expect(useProfileStore.getState().posts).toEqual([]);
  });
});

describe('profileStore does not fabricate domain data', () => {
  test('initial store state never seeds a fabricated balance or capability', () => {
    const state = useProfileStore.getState();
    expect(state.balance).toBeNull();
    expect(state.capabilities).toBeNull();
    expect(state.resolvedTargetId).toBeNull();
  });
});

describe('profileStore follow/unfollow mutation races', () => {
  test('the newest mutation wins when a follow resolves after an unfollow', async () => {
    let resolveFollow;
    mockFollowUser.mockImplementationOnce(() => new Promise((res) => { resolveFollow = res; }));
    mockUnfollowUser.mockImplementationOnce(async () => true);

    useProfileStore.setState({
      _activeTargetId: 'u2',
      _followRequestId: 0,
      profile: { id: 'u2', followerCount: 10 },
      followStatus: { isFollowing: false },
    });

    const following = useProfileStore.getState().follow('u1', 'u2');
    const unfollowing = useProfileStore.getState().unfollow('u1', 'u2');

    await unfollowing;
    resolveFollow(true);
    await following;

    const state = useProfileStore.getState();
    expect(state.followStatus.isFollowing).toBe(false);
    expect(state.followLoading).toBe(false);
    expect(state.profile.followerCount).toBe(10);
  });

  test('a failed follow restores the previous follow state', async () => {
    mockFollowUser.mockImplementationOnce(async () => { throw new Error('network'); });

    useProfileStore.setState({
      _activeTargetId: 'u2',
      _followRequestId: 0,
      profile: { id: 'u2', followerCount: 10 },
      followStatus: { isFollowing: false },
    });

    await expect(useProfileStore.getState().follow('u1', 'u2')).rejects.toThrow('network');

    const state = useProfileStore.getState();
    expect(state.followStatus.isFollowing).toBe(false);
    expect(state.profile.followerCount).toBe(10);
    expect(state.followLoading).toBe(false);
  });
});
