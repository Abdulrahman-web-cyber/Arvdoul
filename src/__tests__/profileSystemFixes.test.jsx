import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockGetPostsByUser = jest.fn();
const mockGetUserPostsCount = jest.fn();

jest.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { uid: 'u1', email: 'citizen@example.com' },
  }),
}));

jest.mock('../utils/deviceCapabilities.js', () => ({
  getAdaptiveTuning: () => ({ isLiteMode: false }),
}));

jest.mock('../hooks/useFeatureFlag.js', () => ({
  useFeatureFlag: () => true,
}));

jest.mock('../services/firestoreService.js', () => ({
  __esModule: true,
  firestoreService: {
    getPostsByUser: (...args) => mockGetPostsByUser(...args),
    getUserPostsCount: (...args) => mockGetUserPostsCount(...args),
  },
  getFirestoreService: () => ({
    getPostsByUser: (...args) => mockGetPostsByUser(...args),
    getUserPostsCount: (...args) => mockGetUserPostsCount(...args),
  }),
}));

jest.mock('../services/userService.js', () => ({
  __esModule: true,
  getUserService: () => ({
    isBlocked: jest.fn(async () => ({ blocked: false })),
    isMuted: jest.fn(async () => ({ muted: false })),
    isRestricted: jest.fn(async () => ({ restricted: false })),
  }),
}));

import LevelNumeralBadge from '../components/profile/LevelNumeralBadge.jsx';
import ProfileOptionsMenu from '../components/profile/ProfileOptionsMenu.jsx';
import { useProfileStore } from '../store/profileStore.js';

describe('Profile system fixes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProfileStore.setState({
      profile: { uid: 'u1', id: 'u1', postCount: 0 },
      posts: [],
      postsCount: null,
      postsHasMore: true,
      postsCursor: null,
      postsLoading: false,
      postsError: null,
    });
  });

  test('LevelNumeralBadge renders explicit Lvl {n} identification at sm and md sizes', () => {
    const { rerender } = render(<LevelNumeralBadge level={1} size="sm" theme="light" />);
    expect(screen.getByText('Lvl')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByLabelText('Level 1')).toBeInTheDocument();

    rerender(<LevelNumeralBadge level={14} size="md" theme="dark" />);
    expect(screen.getByText('Lvl')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByLabelText('Level 14')).toBeInTheDocument();
  });

  test('profileStore.loadPosts reconciles stale postCount from loaded posts and getUserPostsCount', async () => {
    mockGetPostsByUser.mockResolvedValue({
      success: true,
      posts: [
        { id: 'p1', status: 'published', isDeleted: false },
        { id: 'p2', status: 'published', isDeleted: false },
        { id: 'p3', status: 'scheduled', isDeleted: false },
      ],
      hasMore: false,
      nextCursor: null,
    });
    mockGetUserPostsCount.mockResolvedValue(2);

    await act(async () => {
      await useProfileStore.getState().loadPosts('u1');
    });

    const state = useProfileStore.getState();
    expect(state.postsCount).toBe(2);
    expect(state.profile.postCount).toBe(2);
  });

  test('profileStore.loadPosts queries total count via getUserPostsCount when paginated hasMore is true', async () => {
    mockGetPostsByUser.mockResolvedValue({
      success: true,
      posts: [
        { id: 'p1', status: 'published', isDeleted: false },
        { id: 'p2', status: 'published', isDeleted: false },
      ],
      hasMore: true,
      nextCursor: 'p2',
    });
    mockGetUserPostsCount.mockResolvedValue(27);

    await act(async () => {
      await useProfileStore.getState().loadPosts('u1', { limit: 2, viewerId: 'u1' });
    });

    const state = useProfileStore.getState();
    expect(mockGetUserPostsCount).toHaveBeenCalledWith('u1', expect.objectContaining({ viewerId: 'u1' }));
    expect(state.postsCount).toBe(27);
    expect(state.profile.postCount).toBe(27);
  });

  test('ProfileOptionsMenu renders iOS grouped action sheet cleanly without decorative Preview pills', () => {
    render(
      <MemoryRouter>
        <ProfileOptionsMenu
          profile={{ uid: 'u1', id: 'u1', username: 'citizen' }}
          isOwner={true}
          theme="dark"
          onClose={jest.fn()}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('dialog', { name: 'Profile options' })).toBeInTheDocument();
    expect(screen.getByText('Identity & Sharing')).toBeInTheDocument();
    expect(screen.getByText('Perspectives & Studio')).toBeInTheDocument();
    expect(screen.getByText('View Profile As...')).toBeInTheDocument();
    expect(screen.queryByText(/^Preview$/i)).not.toBeInTheDocument();
  });
});
