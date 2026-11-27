/**
 * src/__tests__/vibesFeedAndViewer.test.jsx
 *
 * Tests InFeedStoriesModule (Home Vibes strip) and StoriesScreen (Vibes directory,
 * fullscreen Viewer keyboard/close/delete, and Archive modal).
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InFeedStoriesModule from '../components/feed/InFeedStoriesModule.jsx';
import StoriesScreen from '../screens/StoriesScreen.jsx';

jest.mock('../lib/utils', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'viewer_1', displayName: 'Viewer One', photoURL: '' },
  }),
}));

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark' }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const mockGetStoriesFeed = jest.fn();
const mockGetCachedFeedSnapshot = jest.fn(() => null);
const mockGetStoryByIdForDeepLink = jest.fn();
const mockGetStoryInsights = jest.fn();
const mockGetStoryViewers = jest.fn();
const mockReportStoryView = jest.fn(async () => {});
const mockReportStoryCompletion = jest.fn(async () => {});
const mockDeleteStory = jest.fn(async () => ({ success: true }));
const mockGetArchivedStories = jest.fn();
const mockDeleteArchivedStory = jest.fn(async () => ({ success: true }));
const mockTrackStoryAnalytics = jest.fn(async () => {});
const mockSendVibeGift = jest.fn(async () => ({ success: true, newBalance: 725, coinsSpent: 25 }));
const mockGetBalance = jest.fn(async () => 750);

jest.mock('../services/monetizationService', () => ({
  __esModule: true,
  getMonetizationService: () => ({
    getBalance: (...a) => mockGetBalance(...a),
    sendVibeGift: (...a) => mockSendVibeGift(...a),
  }),
}));

jest.mock('../services/storyService', () => ({
  __esModule: true,
  default: {
    getStoriesFeed: (...a) => mockGetStoriesFeed(...a),
    getCachedFeedSnapshot: (...a) => mockGetCachedFeedSnapshot(...a),
    getStoryByIdForDeepLink: (...a) => mockGetStoryByIdForDeepLink(...a),
    getStoryInsights: (...a) => mockGetStoryInsights(...a),
    getStoryViewers: (...a) => mockGetStoryViewers(...a),
    reportStoryView: (...a) => mockReportStoryView(...a),
    reportStoryCompletion: (...a) => mockReportStoryCompletion(...a),
    deleteStory: (...a) => mockDeleteStory(...a),
    getArchivedStories: (...a) => mockGetArchivedStories(...a),
    deleteArchivedStory: (...a) => mockDeleteArchivedStory(...a),
    trackStoryAnalytics: (...a) => mockTrackStoryAnalytics(...a),
  },
  getStoryService: () => ({
    getStoriesFeed: (...a) => mockGetStoriesFeed(...a),
    getCachedFeedSnapshot: (...a) => mockGetCachedFeedSnapshot(...a),
    getStoryByIdForDeepLink: (...a) => mockGetStoryByIdForDeepLink(...a),
    getStoryInsights: (...a) => mockGetStoryInsights(...a),
    getStoryViewers: (...a) => mockGetStoryViewers(...a),
    reportStoryView: (...a) => mockReportStoryView(...a),
    reportStoryCompletion: (...a) => mockReportStoryCompletion(...a),
    deleteStory: (...a) => mockDeleteStory(...a),
    getArchivedStories: (...a) => mockGetArchivedStories(...a),
    deleteArchivedStory: (...a) => mockDeleteArchivedStory(...a),
    trackStoryAnalytics: (...a) => mockTrackStoryAnalytics(...a),
  }),
  buildVibeDeepLink: (id) => `https://arvdoul.app/stories?vibeId=${id}`,
}));

jest.mock('../services/socialGraphService.js', () => ({
  getSocialGraphService: () => ({
    hydrateProfiles: async (ids) =>
      ids.map((id) => ({
        id,
        displayName: id === 'viewer_1' ? 'Viewer One' : 'Nadia Vance',
        username: id === 'viewer_1' ? 'viewer_one' : 'nadiavance',
        photoURL: '',
        isVerified: id !== 'viewer_1',
      })),
    getEdgeSet: async () => new Map(),
  }),
}));

describe('InFeedStoriesModule Home Vibes strip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders creators with unseen/seen states and Own Vibe ring', async () => {
    mockGetStoriesFeed.mockResolvedValue({
      groups: [
        {
          userId: 'viewer_1',
          stories: [{ id: 'own_1', type: 'text', content: 'Mine', seen: true, createdAt: new Date() }],
        },
        {
          userId: 'creator_2',
          stories: [{ id: 's_2', type: 'text', content: 'Hello', seen: false, createdAt: new Date() }],
        },
      ],
      hasMore: false,
      cached: false,
    });

    render(
      <MemoryRouter>
        <InFeedStoriesModule />
      </MemoryRouter>
    );

    expect(await screen.findByText('Your Vibe')).toBeInTheDocument();
    expect(screen.getByText('Nadia')).toBeInTheDocument();
  });

  test('renders error banner with working Retry on feed failure', async () => {
    mockGetStoriesFeed.mockRejectedValueOnce(new Error('Network offline'));

    render(
      <MemoryRouter>
        <InFeedStoriesModule />
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Network offline');

    mockGetStoriesFeed.mockResolvedValueOnce({ groups: [], hasMore: false, cached: false });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(screen.getByText('No active Vibes right now')).toBeInTheDocument();
    });
  });
});

describe('StoriesScreen Directory, Fullscreen Viewer & Archive', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('opens creator Vibe viewer, navigates via keyboard, closes on Escape, and deletes own Vibe cleanly', async () => {
    mockGetStoriesFeed.mockResolvedValue({
      groups: [
        {
          userId: 'viewer_1',
          stories: [
            { id: 'own_s1', type: 'text', content: 'Slide One', seen: false, visibility: 'close_circle', createdAt: new Date() },
            { id: 'own_s2', type: 'text', content: 'Slide Two', seen: false, visibility: 'public', createdAt: new Date() },
          ],
        },
      ],
      hasMore: false,
      cached: false,
    });

    render(
      <MemoryRouter initialEntries={['/stories']}>
        <Routes>
          <Route path="/stories" element={<StoriesScreen />} />
        </Routes>
      </MemoryRouter>
    );

    const card = await screen.findByRole('button', { name: 'Open Vibe by Viewer One' });
    fireEvent.click(card);

    const viewerDialog = await screen.findByRole('dialog', { name: /Viewing Vibes by Viewer One/i });
    expect(within(viewerDialog).getByText('Slide One')).toBeInTheDocument();
    expect(within(viewerDialog).getByText('Close Circle')).toBeInTheDocument();

    // Advance slide via ArrowRight
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(await within(viewerDialog).findByText('Slide Two')).toBeInTheDocument();

    // Open Delete confirmation dialog and confirm deletion
    fireEvent.click(within(viewerDialog).getByRole('button', { name: 'Delete this Vibe' }));
    const confirmDialog = await screen.findByRole('alertdialog', { name: 'Delete Vibe confirmation' });
    expect(confirmDialog).toBeInTheDocument();

    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(mockDeleteStory).toHaveBeenCalledWith('own_s2'));

    // Close viewer via Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Viewing Vibes/i })).not.toBeInTheDocument();
    });
  });

  test('deep-link ?archive=open opens Archive modal and allows deleting an archived Vibe', async () => {
    mockGetStoriesFeed.mockResolvedValue({ groups: [], hasMore: false, cached: false });
    mockGetArchivedStories.mockResolvedValue({
      stories: [
        { id: 'arch_1', storyId: 'arch_1', type: 'text', content: 'Archived memory', createdAt: new Date() },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/stories?archive=open']}>
        <Routes>
          <Route path="/stories" element={<StoriesScreen />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('dialog', { name: 'Vibe memories archive' })).toBeInTheDocument();
    expect(await screen.findByText('Archived memory')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Delete archived Vibe' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockDeleteArchivedStory).toHaveBeenCalledWith('arch_1'));
  });

  test('deep-link ?vibeId= opens exact slide and allows sending gift via single-source Vibe Gift Picker', async () => {
    mockGetStoriesFeed.mockResolvedValue({
      groups: [
        {
          userId: 'creator_2',
          stories: [
            { id: 's_first', userId: 'creator_2', type: 'text', content: 'First Slide', seen: true, createdAt: new Date() },
            { id: 's_target', userId: 'creator_2', type: 'text', content: 'Target Deep Link Slide', seen: false, createdAt: new Date() },
          ],
        },
      ],
      hasMore: false,
      cached: false,
    });

    render(
      <MemoryRouter initialEntries={['/stories?vibeId=s_target']}>
        <Routes>
          <Route path="/stories" element={<StoriesScreen />} />
        </Routes>
      </MemoryRouter>
    );

    const viewerDialog = await screen.findByRole('dialog', { name: /Viewing Vibes by Nadia Vance/i });
    expect(within(viewerDialog).getByText('Target Deep Link Slide')).toBeInTheDocument();

    // Open Gift Picker
    fireEvent.click(within(viewerDialog).getByRole('button', { name: 'Send Gift on this Vibe' }));
    const giftDialog = await screen.findByRole('dialog', { name: 'Send Vibe Gift' });
    expect(await within(giftDialog).findByText('750 Coins')).toBeInTheDocument();

    // Choose Star (25 coins) and send
    fireEvent.click(within(giftDialog).getByRole('button', { name: /Star/i }));
    fireEvent.click(within(giftDialog).getByRole('button', { name: 'Send Star' }));

    await waitFor(() => expect(mockSendVibeGift).toHaveBeenCalledWith('s_target', 'star'));
  });

  test('owner Insights drawer displays Viewers, Reactions, and Gifts tabs from getStoryViewers/insights', async () => {
    mockGetStoriesFeed.mockResolvedValue({
      groups: [
        {
          userId: 'viewer_1',
          stories: [
            { id: 'own_insight', userId: 'viewer_1', type: 'text', content: 'Insights Slide', seen: true, createdAt: new Date() },
          ],
        },
      ],
      hasMore: false,
      cached: false,
    });
    mockGetStoryViewers.mockResolvedValue({
      viewers: [
        { userId: 'creator_2', profile: { id: 'creator_2', displayName: 'Nadia Vance', username: 'nadiavance' }, completed: true },
      ],
      reactors: [
        { userId: 'creator_2', displayName: 'Nadia Vance', username: 'nadiavance', reaction: '❤️' },
      ],
      gifts: [
        { id: 'g1', senderId: 'creator_2', displayName: 'Nadia Vance', giftType: 'star', coins: 25 },
      ],
      insights: { viewsCount: 12, uniqueViewersCount: 10, totalReactions: 4, totalReplies: 2, totalGiftsCoins: 25 },
      showReactionDetails: true,
    });

    render(
      <MemoryRouter initialEntries={['/stories?vibeId=own_insight']}>
        <Routes>
          <Route path="/stories" element={<StoriesScreen />} />
        </Routes>
      </MemoryRouter>
    );

    const viewerDialog = await screen.findByRole('dialog', { name: /Viewing Vibes by Viewer One/i });
    fireEvent.click(within(viewerDialog).getByRole('button', { name: 'See who viewed this Vibe' }));

    const insightsDialog = await screen.findByRole('dialog', { name: 'Vibe viewers' });
    expect(await within(insightsDialog).findByText('Nadia Vance')).toBeInTheDocument();

    fireEvent.click(within(insightsDialog).getByRole('button', { name: /Reactions \(1\)/i }));
    expect(within(insightsDialog).getByText('Nadia Vance')).toBeInTheDocument();

    fireEvent.click(within(insightsDialog).getByRole('button', { name: /Gifts \(1\)/i }));
    expect(within(insightsDialog).getByText(/\+25\s*Coins/i)).toBeInTheDocument();
  });
});
