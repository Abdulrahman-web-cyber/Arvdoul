/**
 * The profile feed grid's like count must not double-count a post that arrived
 * already liked by the viewer. The server increments `posts/{id}.likes` in the
 * same transaction that writes the viewer's `liked_posts/{id}` marker, so the
 * reported count already includes the viewer's own like. The grid used to add a
 * flat `+1` whenever the local like overlay was true — and the overlay is now
 * seeded from the server's `isLiked`, so every pre-liked post rendered one too
 * many likes. This pins the baseline-delta behaviour.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { uid: 'viewer' } }),
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

// The service chain (firestoreService -> CountersManager -> Logger) is ESM.
// Under CI's Node 22 Jest cannot `require()` that ESM module, so mock the
// logger the way the other component tests do.
jest.mock('../utils/Logger.js', () => {
  class Logger {
    constructor() {}
    debug() {} info() {} warn() {} error() {} fatal() {}
  }
  return {
    Logger,
    logger: new Logger(),
    setCorrelationId: jest.fn(),
    getCorrelationId: jest.fn(),
  };
});

// The grid loads the service with a dynamic `import()`. On CI's Node 22 that
// resolves to a different module instance than a static import, so obtain the
// same instance the component sees and spy on that.
import ProfileFeedGrid from '../components/profile/ProfileFeedGrid';

let firestoreService;
let likeSpy;
let unlikeSpy;

beforeAll(async () => {
  ({ firestoreService } = await import('../services/firestoreService.js'));
});

beforeEach(() => {
  likeSpy = jest.spyOn(firestoreService, 'likePost').mockResolvedValue({ success: true });
  unlikeSpy = jest.spyOn(firestoreService, 'unlikePost').mockResolvedValue({ success: true });
  jest.spyOn(firestoreService, 'savePost').mockResolvedValue({ success: true });
  jest.spyOn(firestoreService, 'unsavePost').mockResolvedValue({ success: true });
  jest.spyOn(firestoreService, 'sharePost').mockResolvedValue({ success: true });
});

afterEach(() => {
  jest.restoreAllMocks();
});

const renderGrid = (posts) =>
  render(
    <MemoryRouter>
      <ProfileFeedGrid posts={posts} activeTab="posts" viewMode="masonry" />
    </MemoryRouter>
  );

const likesFor = (id) => document.querySelector(`[data-testid="like-count-${id}"]`)?.textContent;

describe('ProfileFeedGrid like count is server-authoritative', () => {
  test('a post already liked by the viewer is not double-counted', async () => {
    renderGrid([{ id: 'p1', type: 'photo', likes: 10, isLiked: true, media: ['x.jpg'] }]);
    await waitFor(() => expect(likesFor('p1')).toBe('10'));
  });

  test('a post not liked by the viewer shows the raw server count', async () => {
    renderGrid([{ id: 'p2', type: 'photo', likes: 10, isLiked: false, media: ['x.jpg'] }]);
    await waitFor(() => expect(likesFor('p2')).toBe('10'));
  });

  test('liking a post this session moves the count by exactly one', async () => {
    renderGrid([{ id: 'p3', type: 'photo', likes: 10, isLiked: false, media: ['x.jpg'] }]);
    await waitFor(() => expect(likesFor('p3')).toBe('10'));
    fireEvent.click(screen.getByTestId('like-button-p3'));
    await waitFor(() => expect(likesFor('p3')).toBe('11'));
    expect(likeSpy).toHaveBeenCalledWith('p3', 'viewer');
  });

  test('unliking a pre-liked post moves the count by exactly one', async () => {
    renderGrid([{ id: 'p4', type: 'photo', likes: 10, isLiked: true, media: ['x.jpg'] }]);
    await waitFor(() => expect(likesFor('p4')).toBe('10'));
    fireEvent.click(screen.getByTestId('like-button-p4'));
    await waitFor(() => expect(likesFor('p4')).toBe('9'));
    expect(unlikeSpy).toHaveBeenCalledWith('p4', 'viewer');
  });
});
