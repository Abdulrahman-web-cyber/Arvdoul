import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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

jest.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { uid: 'u1', email: 'test@example.com' },
    currentUser: { uid: 'u1', email: 'test@example.com' },
    userProfile: { uid: 'u1', username: 'testuser', displayName: 'Test User' },
    signOut: jest.fn(),
  }),
}));

jest.mock('../context/ThemeContext.jsx', () => ({
  useTheme: () => ({ theme: 'dark', toggleTheme: jest.fn() }),
}));

jest.mock('../services/storyService.js', () => ({
  __esModule: true,
  default: {
    getUserStories: jest.fn(async () => []),
    getHighlights: jest.fn(async () => []),
  },
}));

jest.mock('../services/userService.js', () => ({
  __esModule: true,
  getUserService: () => ({
    getUserProfile: jest.fn(async () => ({ uid: 'u1', username: 'testuser', displayName: 'Test User' })),
    getRelationshipState: jest.fn(async () => ({ isFollowing: false })),
    getMutualFriends: jest.fn(async () => []),
    areFriends: jest.fn(async () => false),
    getFriendRequests: jest.fn(async () => ({ requests: [] })),
    isBlocked: jest.fn(async () => ({ blocked: false })),
    isMuted: jest.fn(async () => ({ muted: false })),
    isRestricted: jest.fn(async () => ({ restricted: false })),
  }),
  default: {
    getUserProfile: jest.fn(async () => ({ uid: 'u1', username: 'testuser', displayName: 'Test User' })),
  },
}));

jest.mock('../services/reputationService.js', () => ({
  __esModule: true,
  default: { getReputationProfile: jest.fn(async () => null) },
}));
jest.mock('../services/achievementService.js', () => ({
  __esModule: true,
  default: { getUserAchievements: jest.fn(async () => []) },
}));
jest.mock('../services/titleService.js', () => ({
  __esModule: true,
  default: { getUserTitles: jest.fn(async () => []) },
}));
jest.mock('../services/creatorService.js', () => ({
  __esModule: true,
  default: { getCreatorProfile: jest.fn(async () => null) },
}));
jest.mock('../services/passportService.js', () => ({
  __esModule: true,
  default: { getPassport: jest.fn(async () => null) },
}));
jest.mock('../services/walletService.js', () => ({
  __esModule: true,
  default: { getWalletOverview: jest.fn(async () => null) },
}));
jest.mock('../services/rankingService.js', () => ({
  __esModule: true,
  default: { getUserBadges: jest.fn(async () => null), getCreatorRank: jest.fn(async () => null) },
  getRankingService: () => ({
    getUserBadges: jest.fn(async () => null),
    getCreatorRank: jest.fn(async () => null),
  }),
}));
jest.mock('../firebase/firebase.js', () => ({
  __esModule: true,
  getFirestoreInstance: jest.fn(async () => ({})),
  getAuthInstance: jest.fn(async () => ({})),
  getStorageInstance: jest.fn(async () => ({})),
  getFunctionsInstance: jest.fn(async () => ({})),
  getFirebaseManager: () => ({}),
  db: {},
  auth: {},
  storage: {},
  default: {},
}));

jest.mock('../services/firestoreService.js', () => ({
  __esModule: true,
  getFirestoreService: () => ({
    getPostsByUser: jest.fn(async () => ({ posts: [] })),
  }),
}));

jest.mock('../services/analyticsService.js', () => ({
  __esModule: true,
  default: {
    getUserAnalytics: jest.fn(async () => ({})),
    trackProfileView: jest.fn(async () => {}),
  },
}));

jest.mock('../services/monetizationService.js', () => ({
  __esModule: true,
  getMonetizationService: () => ({
    sendTip: jest.fn(async () => ({ success: true })),
  }),
}));

jest.mock('../services/levelSystemService.js', () => ({
  __esModule: true,
  LEVEL_GATES: { CREATOR_DASHBOARD: 3 },
  levelSystemService: {
    getLevelInfo: jest.fn(async () => ({ level: 1 })),
  },
}));

// The profile store loads services through dynamic import(), which jest.mock
// cannot intercept under the ESM runtime. Register them with unstable_mockModule
// (static context/logger mocks above still use jest.mock).
jest.unstable_mockModule('../services/userService.js', () => {
  const userMock = {
    getUserProfile: jest.fn(async () => ({ uid: 'u1', username: 'testuser', displayName: 'Test User' })),
    getRelationshipState: jest.fn(async () => ({ isFollowing: false })),
    getMutualFriends: jest.fn(async () => []),
    areFriends: jest.fn(async () => false),
  };
  return { __esModule: true, getUserService: () => userMock, default: userMock };
});
jest.unstable_mockModule('../services/firestoreService.js', () => {
  const fsMock = { getPostsByUser: jest.fn(async () => ({ posts: [] })) };
  return { __esModule: true, getFirestoreService: () => fsMock, firestoreService: fsMock };
});
jest.unstable_mockModule('../services/storyService.js', () => {
  const storyMock = { getUserStories: jest.fn(async () => []), getHighlights: jest.fn(async () => []) };
  return { __esModule: true, getStoryService: () => storyMock, default: storyMock };
});
jest.unstable_mockModule('../services/analyticsService.js', () => {
  const a = {
    getUserAnalytics: jest.fn(async () => ({})),
    trackProfileView: jest.fn(async () => {}),
    getCreatorRanking: jest.fn(async () => null),
  };
  return { __esModule: true, getAnalyticsService: () => a, default: a };
});
jest.unstable_mockModule('../services/monetizationService.js', () => ({
  __esModule: true,
  getMonetizationService: () => ({
    sendTip: jest.fn(async () => ({ success: true })),
    getBalance: jest.fn(async () => null),
    getUserPosition: jest.fn(async () => null),
  }),
}));
jest.unstable_mockModule('../services/reputationService.js', () => ({
  __esModule: true,
  default: { getReputationProfile: jest.fn(async () => null) },
}));
jest.unstable_mockModule('../services/achievementService.js', () => ({
  __esModule: true,
  default: { getUserAchievements: jest.fn(async () => []) },
}));
jest.unstable_mockModule('../services/titleService.js', () => ({
  __esModule: true,
  default: { getUserTitles: jest.fn(async () => []) },
}));
jest.unstable_mockModule('../services/creatorService.js', () => ({
  __esModule: true,
  default: { getCreatorProfile: jest.fn(async () => null) },
}));
jest.unstable_mockModule('../services/passportService.js', () => ({
  __esModule: true,
  default: { getPassport: jest.fn(async () => null) },
}));
jest.unstable_mockModule('../services/walletService.js', () => ({
  __esModule: true,
  default: { getWalletOverview: jest.fn(async () => null) },
}));
jest.unstable_mockModule('../services/rankingService.js', () => {
  const r = { getUserBadges: jest.fn(async () => null), getCreatorRank: jest.fn(async () => null) };
  return { __esModule: true, getRankingService: () => r, default: r };
});
jest.unstable_mockModule('../firebase/firebase.js', () => ({
  __esModule: true,
  getFirestoreInstance: jest.fn(async () => ({})),
  getAuthInstance: jest.fn(async () => ({})),
  getStorageInstance: jest.fn(async () => ({})),
  getFunctionsInstance: jest.fn(async () => ({})),
  getFirebaseManager: () => ({}),
  db: {}, auth: {}, storage: {}, default: {},
}));

import ProfileMyScreen from '../screens/Profile/ProfileMyScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import ProfilePublicScreen from '../screens/Profile/ProfilePublicScreen';

describe('Profile Screens Render Test', () => {
  it('renders ProfileMyScreen without throwing', () => {
    expect(() => {
      render(
        <MemoryRouter initialEntries={['/profile']}>
          <ProfileMyScreen />
        </MemoryRouter>
      );
    }).not.toThrow();
  });

  it('renders ProfileScreen without throwing', () => {
    expect(() => {
      render(
        <MemoryRouter initialEntries={['/profile/testuser']}>
          <ProfileScreen />
        </MemoryRouter>
      );
    }).not.toThrow();
  });

  it('renders ProfilePublicScreen without throwing', () => {
    expect(() => {
      render(
        <MemoryRouter initialEntries={['/profile/public/testuser']}>
          <ProfilePublicScreen />
        </MemoryRouter>
      );
    }).not.toThrow();
  });
});
