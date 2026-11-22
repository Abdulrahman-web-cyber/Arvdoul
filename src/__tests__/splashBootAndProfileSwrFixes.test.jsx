import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockGetUserProfile = jest.fn();
const mockGetPostsByUser = jest.fn();
const mockGetUserPostsCount = jest.fn();
const mockGetUserTotalPostLikes = jest.fn();
const mockGetFriendCount = jest.fn();
const mockGetRelationshipState = jest.fn();
const mockGetBalance = jest.fn();
const mockGetUserPosition = jest.fn();
const mockGetUserRank = jest.fn();
const mockGetUserStories = jest.fn();
const mockGetHighlights = jest.fn();

const mockAuthState = {
  user: null,
  loading: false,
  isAuthenticated: false,
  isEmailVerified: true,
  authInitialized: false,
  profileResolved: false,
  needsOnboarding: false,
  isSignupInProgress: false,
};

jest.mock('../context/ThemeContext.jsx', () => ({
  useTheme: () => ({ theme: 'dark', isDark: true, toggleTheme: jest.fn() }),
}));

jest.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => mockAuthState,
}));

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

jest.mock('../services/socialGraphService.js', () => ({
  __esModule: true,
  socialGraphService: {
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
  },
  default: {
    getFriendCount: (...args) => mockGetFriendCount(...args),
  },
}));

jest.mock('../services/userService.js', () => ({
  __esModule: true,
  getUserService: () => ({
    getUserProfile: (...args) => mockGetUserProfile(...args),
    getFollowStatus: jest.fn(async () => ({ isFollowing: false, requestStatus: 'none' })),
    getRelationshipState: (...args) => mockGetRelationshipState(...args),
    getMutualFriends: jest.fn(async () => ({ mutualFriends: [] })),
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

jest.mock('../services/monetizationService.js', () => ({
  __esModule: true,
  getMonetizationService: () => ({
    getBalance: (...args) => mockGetBalance(...args),
    getUserPosition: (...args) => mockGetUserPosition(...args),
  }),
}));

jest.mock('../services/analyticsService.js', () => ({
  __esModule: true,
  getAnalyticsService: () => ({
    getUserRank: (...args) => mockGetUserRank(...args),
    trackProfileView: jest.fn(async () => {}),
  }),
}));

jest.mock('../services/storyService.js', () => ({
  __esModule: true,
  getStoryService: () => ({
    getUserStories: (...args) => mockGetUserStories(...args),
    getHighlights: (...args) => mockGetHighlights(...args),
  }),
}));

jest.mock('../utils/security.js', () => ({
  hasStoredAuthSession: () => false,
}));

import { resolveSplashDestination } from '../utils/profileCompletion.js';
import AppStateGuard from '../app/AppStateGuard.jsx';
import { ArvdoulWordmark } from '../components/Shared/ArvdoulLogo.jsx';
import { WORDMARK } from '../components/Shared/ArvdoulBrandAssets.js';
import { UnifiedSyncProgressBar } from '../components/Navigation/RouteProgressBar.jsx';
import { useProfileStore, isSwrFreshForTarget } from '../store/profileStore.js';

const root = process.cwd();
const readFile = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Splash boot, anti-blink guard, brand wordmark, unified progress & profile SWR', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProfileStore.getState().reset();
    Object.assign(mockAuthState, {
      user: null,
      loading: false,
      isAuthenticated: false,
      isEmailVerified: true,
      authInitialized: false,
      profileResolved: false,
      needsOnboarding: false,
      isSignupInProgress: false,
    });
    mockGetBalance.mockResolvedValue(100);
    mockGetUserPosition.mockResolvedValue(null);
    mockGetUserRank.mockResolvedValue(null);
    mockGetFriendCount.mockResolvedValue(0);
    mockGetRelationshipState.mockResolvedValue({
      isFollowing: false,
      requestStatus: 'none',
      friendshipStatus: 'none',
    });
  });

  test('resolveSplashDestination prioritizes email verification, then onboarding, then home, then intro', () => {
    expect(resolveSplashDestination({
      isAuthenticated: true,
      needsEmailVerification: true,
      needsOnboarding: true,
      hasStoredSession: true,
    })).toBe('/verify-email');

    expect(resolveSplashDestination({
      isAuthenticated: true,
      needsEmailVerification: false,
      needsOnboarding: true,
      hasStoredSession: true,
    })).toBe('/setup-profile');

    expect(resolveSplashDestination({
      isAuthenticated: true,
      needsEmailVerification: false,
      needsOnboarding: false,
      hasStoredSession: true,
    })).toBe('/home');

    expect(resolveSplashDestination({
      isAuthenticated: false,
      needsEmailVerification: false,
      needsOnboarding: false,
      hasStoredSession: false,
    })).toBe('/intro');
  });

  test('AppStateGuard hides route children completely during auth restoration and redirect transitions (zero frame blink)', () => {
    mockAuthState.authInitialized = false;
    mockAuthState.loading = true;

    const { rerender } = render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route
            path="/home"
            element={(
              <AppStateGuard>
                <div>Protected Child Screen</div>
              </AppStateGuard>
            )}
          />
          <Route path="/intro" element={<div>Intro Destination</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Protected Child Screen')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Preparing screen')).toBeInTheDocument();

    // When unauthenticated check finishes on a protected route, navigating away never blinks Protected Child Screen
    mockAuthState.authInitialized = true;
    mockAuthState.loading = false;
    mockAuthState.isAuthenticated = false;

    rerender(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route
            path="/home"
            element={(
              <AppStateGuard>
                <div>Protected Child Screen</div>
              </AppStateGuard>
            )}
          />
          <Route path="/intro" element={<div>Intro Destination</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByText('Protected Child Screen')).not.toBeInTheDocument();
    expect(screen.getByText('Intro Destination')).toBeInTheDocument();
  });

  test('ArvdoulWordmark renders the static vector SVG matching SplashScreen WORDMARK paths', () => {
    const { container } = render(
      <MemoryRouter>
        <ArvdoulWordmark variant="gradient" size="md" />
      </MemoryRouter>
    );

    const svg = screen.getByRole('img', { name: 'Arvdoul' });
    expect(svg.tagName.toLowerCase()).toBe('svg');
    const expectedPathCount = WORDMARK.letters.reduce((sum, l) => sum + l.paths.length, 0);
    expect(container.querySelectorAll('path').length).toBe(expectedPathCount);
  });

  test('UnifiedSyncProgressBar aggregates arvdoul:sync_progress sources cleanly', () => {
    const { container } = render(<UnifiedSyncProgressBar />);

    expect(container.firstChild).toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent('arvdoul:sync_progress', {
        detail: { source: 'profile-my', active: true },
      }));
    });
    expect(container.firstChild).not.toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent('arvdoul:sync_progress', {
        detail: { source: 'profile-public', active: true },
      }));
      window.dispatchEvent(new CustomEvent('arvdoul:sync_progress', {
        detail: { source: 'profile-my', active: false },
      }));
    });
    // Still active while profile-public is active
    expect(container.firstChild).not.toBeNull();

    act(() => {
      window.dispatchEvent(new CustomEvent('arvdoul:sync_progress', {
        detail: { source: 'profile-public', active: false },
      }));
    });
    expect(container.firstChild).toBeNull();
  });

  test('profileStore.loadPosts records exact numeric 0 for postsCount and postsLikesCount when empty', async () => {
    mockGetPostsByUser.mockResolvedValue({
      success: true,
      posts: [],
      hasMore: false,
      nextCursor: null,
    });

    await act(async () => {
      await useProfileStore.getState().loadPosts('u-empty', { viewerId: 'u-empty' });
    });

    const state = useProfileStore.getState();
    expect(state.postsCount).toBe(0);
    expect(state.postsLikesCount).toBe(0);
  });

  test('profileStore bounded SWR cache hits same key instantly, isolates viewer/viewAs, and purges on clear/reset', async () => {
    mockGetUserProfile.mockResolvedValue({
      id: 'u-target',
      uid: 'u-target',
      displayName: 'Target Citizen',
      username: 'targetcitizen',
      level: 4,
    });

    await act(async () => {
      await useProfileStore.getState().loadProfile('u-target', 'viewer-1');
    });

    expect(mockGetUserProfile).toHaveBeenCalledTimes(1);
    expect(isSwrFreshForTarget('u-target', 'viewer-1', 'default')).toBe(true);
    expect(isSwrFreshForTarget('u-target', 'viewer-2', 'default')).toBe(false);
    expect(isSwrFreshForTarget('u-target', 'viewer-1', 'public')).toBe(false);

    // Subsequent call for the exact same (target, viewer, perspective) hits fresh SWR cache without network refetch
    await act(async () => {
      await useProfileStore.getState().loadProfile('u-target', 'viewer-1');
    });
    expect(mockGetUserProfile).toHaveBeenCalledTimes(1);

    // Different viewer bypasses cache and triggers viewer-scoped fetch
    await act(async () => {
      await useProfileStore.getState().loadProfile('u-target', 'viewer-2');
    });
    expect(mockGetUserProfile).toHaveBeenCalledTimes(2);

    // clear() evicts SWR cache
    useProfileStore.getState().clear();
    expect(isSwrFreshForTarget('u-target', 'viewer-1', 'default')).toBe(false);
    expect(isSwrFreshForTarget('u-target', 'viewer-2', 'default')).toBe(false);
  });

  test('index.html pre-splash boot canvas and ProfileMyScreen unified sync/hero alignment are intact', () => {
    const html = readFile('index.html');
    const profileMy = readFile('src/screens/Profile/ProfileMyScreen.jsx');
    const topAppBar = readFile('src/components/Shared/TopAppBar.jsx');

    expect(html).toContain('.av-boot');
    expect(html).toContain('.av-boot-mark');
    expect(html).toContain('#03071B');
    expect(html).toContain('#F6F8FC');

    expect(profileMy).toContain("arvdoul:sync_progress");
    expect(profileMy).not.toContain('pms-sync');
    expect(profileMy).not.toContain('const AMBIENT');

    expect(topAppBar).toContain('currentMode === "profile_me"');
    expect(topAppBar).toContain('max-w-[1040px]');
  });
});
