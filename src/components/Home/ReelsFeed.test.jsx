// Basic production sanity test for ReelsFeed — ensures component renders without crash
import React from 'react';
import { render } from '@testing-library/react';

// Mock firebase completely to prevent ESM and Firestore query errors
jest.mock('../../firebase/firebase', () => ({
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  onSnapshot: jest.fn((q, callback) => {
    // Return unsubscribe function
    return () => {};
  }),
  doc: jest.fn(),
  updateDoc: jest.fn(),
  arrayUnion: jest.fn(),
  arrayRemove: jest.fn()
}));

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user123' },
    addCoins: jest.fn(),
    followUser: jest.fn()
  })
}));

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'dark'
  })
}));

// Mock useIntersectionObserver hook to avoid ref integration errors in jsdom
jest.mock('../../hooks/useIntersectionObserver', () => () => ({
  isIntersecting: true
}));

// Mock CacheManager to avoid ESM loading issue
jest.mock('../../utils/CacheManager', () => ({
  CacheManager: {
    set: jest.fn(),
    get: jest.fn()
  }
}));

jest.mock('../../services/commentService.js', () => ({
  getCommentService: () => ({
    getCommentsByPost: jest.fn(async () => ({ success: true, comments: [] })),
    subscribeToPostComments: jest.fn(() => () => {}),
    createComment: jest.fn(async () => ({ success: true })),
    likeComment: jest.fn(async () => ({})),
    removeLikeDislike: jest.fn(async () => ({})),
    deleteComment: jest.fn(async () => ({})),
    updateComment: jest.fn(async () => ({})),
  }),
}));

import ReelsFeed from './ReelsFeed';

describe('ReelsFeed', () => {
  it('renders feed container without throwing', () => {
    render(<ReelsFeed initialQueryLimit={2} />);
    expect(document.body).toBeTruthy();
  });

  it('exports default component', () => {
    expect(typeof ReelsFeed).toBe('function');
  });
});
