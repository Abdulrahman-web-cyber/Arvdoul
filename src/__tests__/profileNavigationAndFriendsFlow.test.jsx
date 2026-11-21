import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockGetPostsByUser = jest.fn();
const mockGetUserPostsCount = jest.fn();
const mockGetUserTotalPostLikes = jest.fn();
const mockGetFriendCount = jest.fn();
const mockGetUserProfile = jest.fn();
const mockGetFollowStatus = jest.fn();
const mockGetFriendshipStatus = jest.fn();
const mockGetRelationshipState = jest.fn();

jest.mock('../utils/Logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  },
  setCorrelationId: jest.fn(),
  getCorrelationId: jest.fn(),
}));

jest.mock('../context/ThemeContext.jsx', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() }),
}));

jest.mock('../context/AuthContext.jsx', () => {
  const ReactMod = require('react');
  const authValue = {
    user: { uid: 'owner-uid', email: 'owner@arvdoul.test' },
    currentUser: { uid: 'owner-uid', email: 'owner@arvdoul.test' },
    userProfile: {
      uid: 'owner-uid',
      id: 'owner-uid',
      displayName: 'Owner Citizen',
      username: 'ownercitizen',
      photoURL: 'https://cdn.arvdoul.test/owner-avatar.jpg',
      coins: 420,
      level: 2,
    },
    updateUserProfile: jest.fn(async () => ({ success: true })),
    signOut: jest.fn(),
  };
  return {
    AuthContext: ReactMod.createContext(authValue),
    useAuth: () => authValue,
  };
});

jest.mock('../hooks/useSound.js', () => ({
  useSound: () => ({ playSound: jest.fn() }),
}));

jest.mock('../hooks/useAnalytics.js', () => ({
  useAnalytics: () => ({ trackEvent: jest.fn(), track: jest.fn() }),
}));

jest.mock('../hooks/useNavBadges.js', () => ({
  useNavBadges: () => ({ messages: 0, notifications: 0, network: 0 }),
}));

jest.mock('../services/BackgroundSyncService.js', () => ({
  backgroundSyncService: {
    getPendingCount: jest.fn(() => 0),
    subscribe: jest.fn(() => () => {}),
    syncAll: jest.fn(async () => ({ synced: 0 })),
  },
}));

jest.mock('../hooks/useFeatureFlag.js', () => ({
  useFeatureFlag: () => true,
}));

jest.mock('../utils/deviceCapabilities.js', () => ({
  getAdaptiveTuning: () => ({ isLiteMode: false }),
}));

jest.mock('../services/socialGraphService.js', () => ({
  __esModule: true,
  default: {
    getFriendCount: (...args) => mockGetFriendCount(...args),
    getRelationship: jest.fn(async () => ({
      isFollowing: false,
      requestStatus: 'none',
      friendshipStatus: 'none',
      isBlocked: false,
      isBlockedBy: false,
      isMuted: false,
      isRestricted: false,
    })),
    listEdges: jest.fn(async () => ({ items: [], hasMore: false, nextCursor: null })),
    listConnections: jest.fn(async () => ({ items: [], hasMore: false, nextCursor: null })),
  },
}));

jest.mock('../services/userService.js', () => ({
  __esModule: true,
  default: {
    getUserProfile: (...args) => mockGetUserProfile(...args),
    getFollowStatus: (...args) => mockGetFollowStatus(...args),
    getFriendshipStatus: (...args) => mockGetFriendshipStatus(...args),
    getRelationshipState: (...args) => mockGetRelationshipState(...args),
    getMutualFriends: jest.fn(async () => []),
    areFriends: jest.fn(async () => false),
    getFriendRequests: jest.fn(async () => ({ success: true, requests: [] })),
    getFollowers: jest.fn(async () => ({ success: true, followers: [], hasMore: false })),
    getFollowing: jest.fn(async () => ({ success: true, following: [], hasMore: false })),
    getFriends: jest.fn(async () => ({ success: true, friends: [], hasMore: false })),
    isBlocked: jest.fn(async () => ({ blocked: false })),
    isMuted: jest.fn(async () => ({ muted: false })),
    isRestricted: jest.fn(async () => ({ restricted: false })),
    checkUsernameAvailability: jest.fn(async () => ({ available: true })),
    generateUniqueUsername: jest.fn(async (base) => `${base}_123`),
  },
  getUserService: () => ({
    getUserProfile: (...args) => mockGetUserProfile(...args),
    getFollowStatus: (...args) => mockGetFollowStatus(...args),
    getFriendshipStatus: (...args) => mockGetFriendshipStatus(...args),
    getRelationshipState: (...args) => mockGetRelationshipState(...args),
    getMutualFriends: jest.fn(async () => []),
    areFriends: jest.fn(async () => false),
    getFriendRequests: jest.fn(async () => ({ success: true, requests: [] })),
    isBlocked: jest.fn(async () => ({ blocked: false })),
    isMuted: jest.fn(async () => ({ muted: false })),
    isRestricted: jest.fn(async () => ({ restricted: false })),
    checkUsernameAvailability: jest.fn(async () => ({ available: true })),
    generateUniqueUsername: jest.fn(async (base) => `${base}_123`),
  }),
}));

jest.mock('../services/firestoreService.js', () => ({
  __esModule: true,
  firestoreService: {
    getPostsByUser: (...args) => mockGetPostsByUser(...args),
    getUserPostsCount: (...args) => mockGetUserPostsCount(...args),
    getUserTotalPostLikes: (...args) => mockGetUserTotalPostLikes(...args),
  },
  getFirestoreService: () => ({
    getPostsByUser: (...args) => mockGetPostsByUser(...args),
    getUserPostsCount: (...args) => mockGetUserPostsCount(...args),
    getUserTotalPostLikes: (...args) => mockGetUserTotalPostLikes(...args),
  }),
}));

jest.mock('../services/storyService.js', () => ({
  __esModule: true,
  default: {
    getUserStories: jest.fn(async () => []),
    getHighlights: jest.fn(async () => []),
  },
}));

jest.mock('../services/analyticsService.js', () => {
  const analytics = {
    getUserAnalytics: jest.fn(async () => ({})),
    trackProfileView: jest.fn(async () => {}),
  };
  return {
    __esModule: true,
    default: analytics,
    getAnalyticsService: () => analytics,
  };
});

jest.mock('../services/monetizationService.js', () => ({
  __esModule: true,
  getMonetizationService: () => ({
    sendTip: jest.fn(async () => ({ success: true })),
    getBalance: jest.fn(async () => 420),
    getUserPosition: jest.fn(async () => null),
  }),
}));

import TopAppBar from '../components/Shared/TopAppBar.jsx';
import BottomNav from '../components/Shared/BottomNav.jsx';
import ProfileMetricsGrid from '../components/profile/ProfileMetricsGrid.jsx';
import ProfileHeroSection from '../components/profile/ProfileHeroSection.jsx';
import ProfilePublicScreen from '../screens/Profile/ProfilePublicScreen.jsx';
import EditProfileScreen from '../screens/Profile/EditProfileScreen.jsx';
import { useProfileStore } from '../store/profileStore.js';
import { useAppStore } from '../store/appStore.js';

describe('Profile navigation, skeleton isolation, friends-only gate & real likes flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAppStore.setState({
      currentUser: {
        uid: 'owner-uid',
        id: 'owner-uid',
        displayName: 'Owner Citizen',
        username: 'ownercitizen',
        photoURL: 'https://cdn.arvdoul.test/owner-avatar.jpg',
        coins: 420,
      },
    });
    useProfileStore.setState({
      profile: null,
      loading: false,
      error: null,
      posts: [],
      postsCount: null,
      postsLikesCount: null,
      friendCount: null,
      postsHasMore: false,
      postsCursor: null,
      postsLoading: false,
      postsError: null,
      followStatus: {
        isFollowing: false,
        requestStatus: 'none',
        friendshipStatus: 'none',
      },
      viewerCapabilities: null,
    });
  });

  test('TopAppBar shows plain Profile title without circular avatar or visitor name/handle', () => {
    render(
      <MemoryRouter initialEntries={['/profile/visitor-uid']}>
        <TopAppBar />
      </MemoryRouter>
    );

    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText(/Visitor/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/@/i)).not.toBeInTheDocument();
  });

  test('BottomNav displays strictly the owner avatar even when profileStore holds another visited profile', () => {
    useProfileStore.setState({
      profile: {
        uid: 'visitor-uid',
        id: 'visitor-uid',
        displayName: 'Visited Creator',
        username: 'visitedcreator',
        photoURL: 'https://cdn.arvdoul.test/visited-avatar.jpg',
      },
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/profile/visitor-uid']}>
        <BottomNav />
      </MemoryRouter>
    );

    const imgs = Array.from(container.querySelectorAll('img'));
    const srcs = imgs.map((img) => img.getAttribute('src') || '');
    expect(srcs.some((s) => s.includes('owner-avatar.jpg'))).toBe(true);
    expect(srcs.some((s) => s.includes('visited-avatar.jpg'))).toBe(false);
  });

  test('ProfilePublicScreen renders skeleton immediately and never flashes owner profile when profileStore holds owner', () => {
    // Seed store with owner profile right before navigating to /profile/visitor-uid
    useProfileStore.setState({
      profile: {
        uid: 'owner-uid',
        id: 'owner-uid',
        displayName: 'Owner Citizen',
        username: 'ownercitizen',
        bio: 'Private owner bio should never flash on visitor route',
        level: 2,
      },
      loading: false,
    });
    // Keep profile resolution pending so initial render state is asserted deterministically
    mockGetUserProfile.mockReturnValue(new Promise(() => {}));
    mockGetRelationshipState.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={['/profile/visitor-uid']}>
        <Routes>
          <Route path="/profile/:userId" element={<ProfilePublicScreen />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByLabelText('Loading profile')).toBeInTheDocument();
    expect(screen.queryByText('Owner Citizen')).not.toBeInTheDocument();
    expect(screen.queryByText('@ownercitizen')).not.toBeInTheDocument();
    expect(screen.queryByText(/Private owner bio should never flash/i)).not.toBeInTheDocument();
  });

  test('Basic level (< Level 3, non-creator) enforces Friends-only metrics and hides Followers/Following until Level 3', () => {
    const basicProfile = {
      uid: 'u-basic',
      level: 2,
      isCreator: false,
      postCount: 4,
      friendCount: 7,
      followerCount: 99,
      followingCount: 15,
      likesReceived: 32,
    };
    const caps = {
      canViewFollowers: true,
      canViewFollowing: true,
      canViewFriends: true,
      canViewEconomicStatus: true,
    };

    const { rerender } = render(
      <ProfileMetricsGrid
        profile={basicProfile}
        capabilities={caps}
        theme="dark"
      />
    );

    expect(screen.getByText('Friends')).toBeInTheDocument();
    expect(screen.getByText('Posts')).toBeInTheDocument();
    expect(screen.getByText('Likes')).toBeInTheDocument();
    expect(screen.getByText('32')).toBeInTheDocument();
    expect(screen.queryByText('Followers')).not.toBeInTheDocument();
    expect(screen.queryByText('Following')).not.toBeInTheDocument();

    rerender(
      <ProfileMetricsGrid
        profile={{ ...basicProfile, level: 3 }}
        capabilities={caps}
        theme="dark"
      />
    );

    expect(screen.getByText('Followers')).toBeInTheDocument();
    expect(screen.getByText('Following')).toBeInTheDocument();
    expect(screen.getByText('Friends')).toBeInTheDocument();
  });

  test('ProfileHeroSection uses Friend Request primary CTA below Level 3 for visitors and Follow at Level 3+', () => {
    const onFriendRequestToggle = jest.fn();
    const onFollowToggle = jest.fn();
    const visitorBase = {
      uid: 'u-visitor',
      id: 'u-visitor',
      displayName: 'Basic Citizen',
      username: 'basiccitizen',
      level: 2,
      isCreator: false,
    };
    const caps = {
      canViewLevel: true,
      canViewIdentity: true,
      canMessage: true,
      canTip: false,
      canViewRoyal: false,
    };

    const { rerender } = render(
      <MemoryRouter>
        <ProfileHeroSection
          isOwner={false}
          profile={visitorBase}
          capabilities={caps}
          friendshipStatus="none"
          isFollowing={false}
          requestStatus="none"
          onFriendRequestToggle={onFriendRequestToggle}
          onFollowToggle={onFollowToggle}
          theme="dark"
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /Add friend/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Follow$/i })).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ProfileHeroSection
          isOwner={false}
          profile={{ ...visitorBase, level: 3 }}
          capabilities={caps}
          friendshipStatus="none"
          isFollowing={false}
          requestStatus="none"
          onFriendRequestToggle={onFriendRequestToggle}
          onFollowToggle={onFollowToggle}
          theme="dark"
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /^Follow$/i })).toBeInTheDocument();
  });

  test('profileStore.loadPosts aggregates real total post likes for full list and paginated profiles', async () => {
    mockGetPostsByUser.mockResolvedValue({
      success: true,
      posts: [
        { id: 'p1', status: 'published', isDeleted: false, stats: { likes: 12 } },
        { id: 'p2', status: 'published', isDeleted: false, stats: { likes: 8 } },
        { id: 'p3', status: 'scheduled', isDeleted: false, stats: { likes: 99 } },
      ],
      hasMore: false,
      nextCursor: null,
    });

    await act(async () => {
      await useProfileStore.getState().loadPosts('owner-uid', { viewerId: 'owner-uid' });
    });

    expect(useProfileStore.getState().postsLikesCount).toBe(20);

    // When paginated (hasMore: true), store queries firestoreService.getUserTotalPostLikes
    mockGetPostsByUser.mockResolvedValue({
      success: true,
      posts: [{ id: 'p1', status: 'published', isDeleted: false, stats: { likes: 12 } }],
      hasMore: true,
      nextCursor: 'p1',
    });
    mockGetUserPostsCount.mockResolvedValue(15);
    mockGetUserTotalPostLikes.mockResolvedValue(145);

    await act(async () => {
      await useProfileStore.getState().loadPosts('owner-uid', { limit: 1, viewerId: 'owner-uid' });
    });

    expect(mockGetUserTotalPostLikes).toHaveBeenCalledWith('owner-uid', expect.objectContaining({ viewerId: 'owner-uid' }));
    expect(useProfileStore.getState().postsLikesCount).toBe(145);
  });

  test('EditProfileScreen omits removed completeness/filter chrome and disables location input when hidden', () => {
    render(
      <MemoryRouter initialEntries={['/profile/edit']}>
        <EditProfileScreen />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /Save Profile Changes/i })).toBeInTheDocument();
    expect(screen.queryByText(/Citizen Presence Completeness/i)).not.toBeInTheDocument();

    const privacySelect = screen.getByLabelText('Location Privacy');
    fireEvent.change(privacySelect, { target: { value: 'hidden' } });
    const locationInput = screen.getByRole('textbox', { name: 'Location' });
    expect(locationInput).toBeDisabled();
    expect(screen.getByText(/Location is hidden from your profile while Keep Hidden is selected/i)).toBeInTheDocument();
  });
});
