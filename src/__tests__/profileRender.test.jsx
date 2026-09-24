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
