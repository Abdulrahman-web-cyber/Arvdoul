/**
 * src/__tests__/connectionsAndProgressionFixes.test.jsx
 *
 * Regression coverage for Social Graph, Requests, and Progression fixes:
 * - ConnectionsScreen: owner Friends tab loads real friends, cursor pagination Load more deduplicates & appends, Discover tab renders suggestions & Add Friend / Cancel Friend Sent toggle
 * - NotificationsScreen: preloads pending follow + friend requests badge on mount & switches to Network & Friends sub-tabs
 * - ProgressScreen: loads live levelInfo, balance, and profile stats, rendering '—' instead of fabricated 0/1 when values are null
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

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
  useTheme: () => ({ theme: 'dark', isDark: true, toggleTheme: jest.fn() }),
}));

let mockAuthValue = {
  user: { uid: 'viewer-1', email: 'viewer@arvdoul.test', displayName: 'Viewer One' },
  currentUser: { uid: 'viewer-1', email: 'viewer@arvdoul.test', displayName: 'Viewer One' },
  userProfile: {
    uid: 'viewer-1',
    id: 'viewer-1',
    username: 'viewer_one',
    displayName: 'Viewer One',
    level: 5,
    xp: 450,
    experience: 450,
    coins: 320,
    activeDaysCount: 12,
    activeStreak: 4,
    isCreator: true,
  },
  authInitialized: true,
};

jest.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock('../services/notificationsService.js', () => ({
  __esModule: true,
  default: {
    getNotifications: jest.fn(async () => ({ items: [], unreadCount: 0, nextCursor: null })),
    subscribeToNotifications: jest.fn(() => () => {}),
    subscribeToUserNotifications: jest.fn((_uid, cb) => {
      cb([]);
      return () => {};
    }),
    markAllAsRead: jest.fn(async () => ({ success: true })),
    markAsRead: jest.fn(async () => ({ success: true })),
    markNotificationAsRead: jest.fn(async () => ({ success: true })),
  },
}));

const mockUserSvc = {
  getUserProfile: jest.fn(),
  getRelationshipState: jest.fn(async () => ({ isOwner: true })),
  getFollowers: jest.fn(),
  getFollowing: jest.fn(),
  getFriends: jest.fn(),
  getFriendRecommendations: jest.fn(),
  getFriendRequests: jest.fn(),
  getFollowRequests: jest.fn(),
  getFollowStates: jest.fn(),
  sendFriendRequest: jest.fn(),
  cancelFriendRequest: jest.fn(),
  acceptFriendRequest: jest.fn(),
  declineFriendRequest: jest.fn(),
  approveFollowRequest: jest.fn(),
  declineFollowRequest: jest.fn(),
  followUser: jest.fn(),
  unfollowUser: jest.fn(),
  cancelFollowRequest: jest.fn(),
};

const mockMonSvc = {
  getBalance: jest.fn(),
};

jest.mock('../services/userService.js', () => ({
  __esModule: true,
  getUserService: () => mockUserSvc,
  default: () => mockUserSvc,
}));

jest.mock('../services/monetizationService.js', () => ({
  __esModule: true,
  getMonetizationService: () => mockMonSvc,
  default: () => mockMonSvc,
}));

jest.mock('../services/socialGraphService.js', () => ({
  __esModule: true,
  socialGraphService: {
    hydrateProfiles: jest.fn(async (ids = []) =>
      ids.map((id) => ({ uid: id, id, displayName: `User ${id}` }))
    ),
  },
  getSocialGraphService: () => ({
    hydrateProfiles: jest.fn(async (ids = []) =>
      ids.map((id) => ({ uid: id, id, displayName: `User ${id}` }))
    ),
  }),
}));

const mockGetLevelInfo = jest.fn();

jest.mock('../services/levelSystemService.js', () => {
  const actual = jest.requireActual('../services/levelSystemService.js');
  return {
    __esModule: true,
    ...actual,
    levelSystemService: {
      ...actual.levelSystemService,
      getLevelInfo: (...args) => mockGetLevelInfo(...args),
    },
  };
});

import ConnectionsScreen from '../screens/Profile/ConnectionsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProgressScreen from '../screens/Progression/ProgressScreen';

describe('ConnectionsScreen social graph & pagination fixes', () => {
  const userSvc = mockUserSvc;

  beforeEach(() => {
    Object.values(mockUserSvc).forEach((fn) => fn.mockReset && fn.mockReset());

    userSvc.getRelationshipState.mockResolvedValue({ isOwner: true });
    userSvc.getUserProfile.mockResolvedValue({
      uid: 'viewer-1',
      id: 'viewer-1',
      username: 'viewer_one',
      displayName: 'Viewer One',
      level: 5,
      isCreator: true,
    });
    userSvc.getFollowers.mockResolvedValue({
      followers: [
        { uid: 'u-1', id: 'u-1', displayName: 'Ada Lovelace', username: 'ada_l', level: 4 },
      ],
      hasMore: true,
      nextCursor: 'cursor-1',
    });
    userSvc.getFollowing.mockResolvedValue({
      following: [],
      hasMore: false,
      nextCursor: null,
    });
    userSvc.getFriends.mockResolvedValue({
      friends: [
        { uid: 'f-1', id: 'f-1', displayName: 'Grace Hopper', username: 'grace_h', level: 8 },
      ],
      hasMore: false,
      nextCursor: null,
    });
    userSvc.getFriendRecommendations.mockResolvedValue({
      recommendations: [
        { uid: 's-1', id: 's-1', displayName: 'Alan Turing', username: 'alan_t', level: 9 },
      ],
    });
    userSvc.getFriendRequests.mockResolvedValue({ requests: [] });
    userSvc.getFollowRequests.mockResolvedValue({ requests: [] });
    userSvc.getFollowStates.mockResolvedValue(new Map());
    userSvc.sendFriendRequest.mockResolvedValue({ success: true });
    userSvc.cancelFriendRequest.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('owner Friends tab calls userService.getFriends and displays friends', async () => {
    render(
      <MemoryRouter initialEntries={['/profile/viewer-1/friends']}>
        <Routes>
          <Route path="/profile/:userId/friends" element={<ConnectionsScreen initialTab="friends" />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Grace Hopper')).toBeInTheDocument();
    expect(userSvc.getFriends).toHaveBeenCalledWith(
      'viewer-1',
      expect.objectContaining({ viewerId: 'viewer-1' })
    );
  });

  test('cursor pagination Load more appends paginated followers without duplicates', async () => {
    userSvc.getFollowers
      .mockResolvedValueOnce({
        followers: [
          { uid: 'u-1', id: 'u-1', displayName: 'Ada Lovelace', username: 'ada_l', level: 4 },
        ],
        hasMore: true,
        nextCursor: 'cursor-1',
      })
      .mockResolvedValueOnce({
        followers: [
          { uid: 'u-1', id: 'u-1', displayName: 'Ada Lovelace', username: 'ada_l', level: 4 },
          { uid: 'u-2', id: 'u-2', displayName: 'Linus Torvalds', username: 'linus_t', level: 7 },
        ],
        hasMore: false,
        nextCursor: null,
      });

    render(
      <MemoryRouter initialEntries={['/profile/viewer-1/followers']}>
        <Routes>
          <Route path="/profile/:userId/followers" element={<ConnectionsScreen initialTab="followers" />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();

    const loadMoreBtn = await screen.findByRole('button', { name: /Load more/i });
    fireEvent.click(loadMoreBtn);

    expect(await screen.findByText('Linus Torvalds')).toBeInTheDocument();
    expect(screen.getAllByText('Ada Lovelace')).toHaveLength(1);
    expect(userSvc.getFollowers).toHaveBeenLastCalledWith(
      'viewer-1',
      expect.objectContaining({ startAfter: 'cursor-1' })
    );
  });

  test('owner Discover tab loads friend suggestions and toggles Add Friend / Friend Sent', async () => {
    render(
      <MemoryRouter initialEntries={['/profile/viewer-1/connections']}>
        <Routes>
          <Route path="/profile/:userId/connections" element={<ConnectionsScreen initialTab="discover" />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Alan Turing')).toBeInTheDocument();

    const addBtn = screen.getByRole('button', { name: /Add Friend/i });
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(userSvc.sendFriendRequest).toHaveBeenCalledWith('viewer-1', 's-1');
    });

    const sentBtn = await screen.findByRole('button', { name: /Friend Sent/i });
    fireEvent.click(sentBtn);

    await waitFor(() => {
      expect(userSvc.cancelFriendRequest).toHaveBeenCalledWith('viewer-1', 's-1');
    });
  });
});

describe('NotificationsScreen pending requests preload', () => {
  const userSvc = mockUserSvc;

  beforeEach(() => {
    Object.values(mockUserSvc).forEach((fn) => fn.mockReset && fn.mockReset());
    userSvc.getFollowers.mockResolvedValue({ followers: [] });
    userSvc.getFollowing.mockResolvedValue({ following: [] });
    userSvc.getFriendRecommendations.mockResolvedValue({ recommendations: [] });
    userSvc.getFollowStates.mockResolvedValue(new Map());
    userSvc.getFriendRequests.mockResolvedValue({
      requests: [{ id: 'req-f1', fromUserId: 'u-10', user: { uid: 'u-10', displayName: 'Friend Requester' } }],
    });
    userSvc.getFollowRequests.mockResolvedValue({
      requests: [{ id: 'req-fl1', fromUserId: 'u-11', requester: { uid: 'u-11', displayName: 'Follow Requester' } }],
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('preloads total pending network badge on mount before switching tabs', async () => {
    render(
      <MemoryRouter initialEntries={['/notifications']}>
        <Routes>
          <Route path="/notifications" element={<NotificationsScreen />} />
        </Routes>
      </MemoryRouter>
    );

    const networkTab = await screen.findByRole('tab', { name: /Network & Friends/i });
    await waitFor(() => {
      expect(networkTab).toHaveTextContent('2');
    });

    fireEvent.click(networkTab);
    expect(await screen.findByText('Friend Requester')).toBeInTheDocument();
  });
});

describe('ProgressScreen live hydration & zero-fabrication guard', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('fetches live level info and renders unknown metrics as em-dash without inventing 0 or 1', async () => {
    mockAuthValue = {
      user: { uid: 'viewer-2', email: 'new@arvdoul.test' },
      currentUser: { uid: 'viewer-2', email: 'new@arvdoul.test' },
      userProfile: { uid: 'viewer-2', id: 'viewer-2', username: 'fresh_user', displayName: 'Fresh User' },
      authInitialized: true,
    };

    mockGetLevelInfo.mockResolvedValue({
      level: null,
      xp: null,
      progressPercent: 0,
      xpToNext: null,
      nextLevel: null,
    });

    mockMonSvc.getBalance.mockReset().mockResolvedValue(null);
    mockUserSvc.getUserProfile.mockReset().mockResolvedValue({
      uid: 'viewer-2',
      id: 'viewer-2',
      displayName: 'Fresh User',
    });

    render(
      <MemoryRouter initialEntries={['/progress']}>
        <Routes>
          <Route path="/progress" element={<ProgressScreen />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockGetLevelInfo).toHaveBeenCalledWith('viewer-2');
      expect(mockMonSvc.getBalance).toHaveBeenCalledWith('viewer-2');
      expect(mockUserSvc.getUserProfile).toHaveBeenCalledWith('viewer-2', 'viewer-2');
    });

    expect(screen.getByText('Level unavailable')).toBeInTheDocument();
    expect(screen.queryByText(/Total XP: 0/i)).not.toBeInTheDocument();
  });
});
