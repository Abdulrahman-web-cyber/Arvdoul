/**
 * src/__tests__/profileSystemFixes.test.jsx
 *
 * Regression coverage for Profile System & Screens fixes:
 * - useProfileStore.loadProfile clearing stale posts, highlights, and followStatus when switching targets
 * - ProfilePublicScreen rendering isBlockedBy cleanly (ShieldAlert) and storeError retry state
 * - ProfileFeedGrid loading skeleton precedence, photos tab exclusion of video/audio, and audio teardown
 * - AboutScreen owner detection on @handle and visitor relationship resolution
 * - EditProfileScreen Creator Suite rendering (Palette icon) & accessible field labels
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockUpdateUserProfile = jest.fn();

jest.mock('../firebase/firebase.js', () => ({
  __esModule: true,
  default: {},
  db: {},
  auth: { currentUser: { uid: 'viewer-1' } },
  storage: {},
  getFirestoreInstance: async () => ({}),
  getAuthInstance: async () => ({ currentUser: { uid: 'viewer-1' } }),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ settings: {} })),
  setPersistence: jest.fn(async () => {}),
  browserLocalPersistence: {},
  onAuthStateChanged: jest.fn(() => () => {}),
  signOut: jest.fn(async () => {}),
}));

jest.mock('../services/storyService.js', () => ({
  __esModule: true,
  getStoryService: () => ({
    getHighlights: async () => ({ success: true, highlights: [] }),
    getUserStories: async () => [],
    getStoriesFeed: async () => [],
  }),
  storyService: {
    getHighlights: async () => ({ success: true, highlights: [] }),
    getUserStories: async () => [],
  },
  default: {
    getHighlights: async () => ({ success: true, highlights: [] }),
    getUserStories: async () => [],
  },
}));

jest.mock('../utils/Logger.js', () => {
  class Logger {
    debug() {} info() {} warn() {} error() {} fatal() {}
    child() { return this; }
  }
  return {
    Logger,
    logger: new Logger(),
    setCorrelationId: jest.fn(),
    getCorrelationId: jest.fn(),
  };
});

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

jest.mock('../context/ThemeContext.jsx', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() }),
}));

jest.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { uid: 'viewer-1', email: 'viewer@arvdoul.test', level: 5 },
    currentUser: { uid: 'viewer-1', email: 'viewer@arvdoul.test', level: 5 },
    userProfile: {
      uid: 'viewer-1',
      id: 'viewer-1',
      username: 'viewer_handle',
      displayName: 'Viewer One',
      level: 5,
      isCreator: true,
    },
    updateUserProfile: (...args) => mockUpdateUserProfile(...args),
    userService: {
      checkUsernameAvailability: async () => ({ available: true }),
    },
  }),
}));

jest.mock('../services/levelSystemService.js', () => ({
  __esModule: true,
  LEVEL_GATES: { CREATOR_DASHBOARD: 3, creatorProfile: 3 },
  getRankTitle: () => 'Pathfinder',
  getPerksForLevel: () => [],
  levelSystemService: {
    getLevelInfo: async () => ({ level: 4, xp: 400 }),
  },
}));

import { useProfileStore } from '../store/profileStore.js';
import { getUserService } from '../services/userService.js';
import { firestoreService } from '../services/firestoreService.js';
import { getMonetizationService } from '../services/monetizationService.js';
import { getAnalyticsService } from '../services/analyticsService.js';

import ProfilePublicScreen from '../screens/Profile/ProfilePublicScreen';
import AboutScreen from '../screens/Profile/AboutScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import ProfileFeedGrid from '../components/profile/ProfileFeedGrid';

let userSvc;
let relSpy;
let getUserProfileSpy;

beforeEach(() => {
  useProfileStore.getState().clear();
  mockUpdateUserProfile.mockReset().mockResolvedValue({ success: true });

  userSvc = getUserService();
  const monSvc = getMonetizationService();
  const anSvc = getAnalyticsService();

  getUserProfileSpy = jest.spyOn(userSvc, 'getUserProfile').mockResolvedValue({
    id: 'target-2',
    uid: 'target-2',
    username: 'target_creator',
    displayName: 'Target Creator',
    bio: 'Creator bio',
    level: 4,
    isCreator: true,
  });
  relSpy = jest.spyOn(userSvc, 'getRelationshipState').mockResolvedValue({
    isFollowing: false,
    isBlocking: false,
    isBlockedBy: false,
    isFriend: false,
  });
  jest.spyOn(userSvc, 'getMutualFriends').mockResolvedValue({ success: true, mutualFriends: [] });
  jest.spyOn(userSvc, 'areFriends').mockResolvedValue(false);
  jest.spyOn(userSvc, 'getFriendRequests').mockResolvedValue({ requests: [] });
  jest.spyOn(userSvc, 'isBlocked').mockResolvedValue({ blocked: false });
  jest.spyOn(userSvc, 'isMuted').mockResolvedValue({ muted: false });
  jest.spyOn(userSvc, 'isRestricted').mockResolvedValue({ restricted: false });
  jest.spyOn(userSvc, 'getFollowStatus').mockResolvedValue({ isFollowing: false, requestStatus: 'none' });

  jest.spyOn(firestoreService, 'getPostsByUser').mockResolvedValue({ posts: [], hasMore: false, nextCursor: null });
  jest.spyOn(firestoreService, 'getLikedPostIds').mockResolvedValue(new Set());
  jest.spyOn(firestoreService, 'getSavedPosts').mockResolvedValue({ posts: [] });

  jest.spyOn(monSvc, 'getBalance').mockResolvedValue(250);
  jest.spyOn(monSvc, 'getUserPosition').mockResolvedValue({ rank: 12 });
  jest.spyOn(monSvc, 'getUserLevel').mockResolvedValue({ level: 4, xp: 400 });

  jest.spyOn(anSvc, 'getUserAnalytics').mockResolvedValue({});
  jest.spyOn(anSvc, 'trackProfileView').mockResolvedValue({});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Profile store regression fixes', () => {
  test('loadProfile clears stale posts, highlights, and followStatus when switching targets', () => {
    useProfileStore.setState({
      profile: { id: 'old-user', uid: 'old-user', username: 'old_user' },
      posts: [{ id: 'stale-post', content: 'Old' }],
      highlights: [{ id: 'stale-highlight', title: 'Old' }],
      followStatus: { isFollowing: true },
    });

    getUserProfileSpy.mockImplementation(() => new Promise(() => {}));

    useProfileStore.getState().loadProfile('target-2', 'viewer-1');
    const state = useProfileStore.getState();
    expect(state.posts).toEqual([]);
    expect(state.highlights).toEqual([]);
    expect(state.followStatus).toBeNull();
    expect(state.loading).toBe(true);
  });
});

describe('ProfilePublicScreen regression fixes', () => {
  test('renders Profile Unavailable cleanly when isBlockedBy is true (no ShieldAlert ReferenceError)', async () => {
    relSpy.mockResolvedValue({
      isFollowing: false,
      isBlocking: false,
      isBlockedBy: true,
      isFriend: false,
    });

    render(
      <MemoryRouter initialEntries={['/profile/public/target-2']}>
        <Routes>
          <Route path="/profile/public/:userId" element={<ProfilePublicScreen />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Profile Unavailable')).toBeInTheDocument();
  });

  test('renders error recovery state with Retry button when storeError is present without profile data', async () => {
    getUserProfileSpy.mockRejectedValue(new Error('Network unavailable'));

    render(
      <MemoryRouter initialEntries={['/profile/public/target-2']}>
        <Routes>
          <Route path="/profile/public/:userId" element={<ProfilePublicScreen />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Could Not Load Profile')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
  });
});

describe('ProfileFeedGrid regression fixes', () => {
  test('renders loading skeleton while loading with empty posts instead of No Posts Yet', () => {
    const { container } = render(
      <MemoryRouter>
        <ProfileFeedGrid posts={[]} loading={true} activeTab="posts" viewMode="grid" />
      </MemoryRouter>
    );

    expect(screen.queryByText(/No Posts Yet/i)).toBeNull();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  test('photos tab excludes video/reel and audio posts', () => {
    const posts = [
      { id: 'img-1', type: 'photo', mediaURL: 'https://example.com/photo.jpg', caption: 'Sunset' },
      { id: 'vid-1', type: 'video', mediaURL: 'https://example.com/clip.mp4', videoURL: 'https://example.com/clip.mp4', caption: 'Video Clip' },
      { id: 'aud-1', type: 'audio', audioURL: 'https://example.com/track.mp3', title: 'Track One' },
    ];

    render(
      <MemoryRouter>
        <ProfileFeedGrid posts={posts} loading={false} activeTab="photos" viewMode="masonry" />
      </MemoryRouter>
    );

    expect(screen.getByTestId('like-button-img-1')).toBeInTheDocument();
    expect(screen.queryByTestId('like-button-vid-1')).toBeNull();
    expect(screen.queryByTestId('like-button-aud-1')).toBeNull();
  });

  test('pauses playing audio when unmounted', () => {
    const pauseSpy = jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const playSpy = jest.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());

    const posts = [
      { id: 'aud-1', type: 'audio', audioURL: 'https://example.com/track.mp3', title: 'Acoustic Track' },
    ];

    const { unmount } = render(
      <MemoryRouter>
        <ProfileFeedGrid posts={posts} loading={false} activeTab="audio" viewMode="grid" />
      </MemoryRouter>
    );

    const playBtn = screen.getByRole('button', { name: /Play track/i });
    fireEvent.click(playBtn);
    expect(playSpy).toHaveBeenCalled();

    unmount();
    expect(pauseSpy).toHaveBeenCalled();
  });
});

describe('AboutScreen & EditProfileScreen regression fixes', () => {
  test('AboutScreen resolves relationship state for a visitor and detects @handle owner cleanly', async () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/profile/target_creator/about']}>
        <Routes>
          <Route path="/profile/:userId/about" element={<AboutScreen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(relSpy).toHaveBeenCalledWith('viewer-1', 'target-2');
    });

    useProfileStore.setState({
      profile: {
        id: 'viewer-1',
        uid: 'viewer-1',
        username: 'viewer_handle',
        displayName: 'Viewer One',
      },
    });
    relSpy.mockClear();

    rerender(
      <MemoryRouter initialEntries={['/profile/@viewer_handle/about']}>
        <Routes>
          <Route path="/profile/:userId/about" element={<AboutScreen />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /Edit/i })).toBeInTheDocument();
    expect(relSpy).not.toHaveBeenCalled();
  });

  test('EditProfileScreen renders Creator Suite cleanly (Palette icon) with accessible form controls', async () => {
    render(
      <MemoryRouter initialEntries={['/profile/edit']}>
        <EditProfileScreen />
      </MemoryRouter>
    );

    expect(await screen.findByText('Creator Suite')).toBeInTheDocument();
    expect(screen.getByLabelText('Unique Username')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change profile photo' })).toBeInTheDocument();
  });
});
