/**
 * src/__tests__/vibesStudioAndDrafts.test.jsx
 *
 * Tests IndexedDB/memory Vibe drafts isolation & lifecycle plus CreateStory
 * Vibes Studio flows: lazy camera prompt, Text Vibe mode, 6-tier audience
 * picker, shared-renderer Preview modal (zero-publish), and draft recovery.
 */

import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import vibeDraftService from '../services/vibeDraftService.js';
import CreateStory from '../screens/CreateStory.jsx';

jest.mock('../lib/utils', () => ({
  cn: (...args) => args.filter(Boolean).join(' '),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'creator_1', displayName: 'Aria Creator', photoURL: '' },
  }),
}));

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: 'dark' }),
}));

jest.mock('../hooks/useFeatureFlag.js', () => ({
  useFeatureFlag: () => true,
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}));

const mockCreateStory = jest.fn(async () => ({ success: true, storyId: 'vibe_123' }));
const mockCancelUpload = jest.fn(async () => {});
const mockGetCloseCircle = jest.fn(async () => []);

jest.mock('../services/storyService', () => ({
  __esModule: true,
  default: {
    createStory: (...a) => mockCreateStory(...a),
    cancelUpload: (...a) => mockCancelUpload(...a),
    getCloseCircle: (...a) => mockGetCloseCircle(...a),
  },
  getStoryService: () => ({
    createStory: (...a) => mockCreateStory(...a),
    cancelUpload: (...a) => mockCancelUpload(...a),
    getCloseCircle: (...a) => mockGetCloseCircle(...a),
  }),
}));

describe('vibeDraftService persistence & account isolation', () => {
  test('saves, retrieves, lists, and deletes drafts scoped strictly by userId', async () => {
    const savedA = await vibeDraftService.saveDraft('user_a', {
      type: 'text',
      content: 'User A morning draft',
      visibility: 'close_circle',
    });
    await vibeDraftService.saveDraft('user_b', {
      type: 'text',
      content: 'User B private draft',
      visibility: 'private',
    });

    const listA = await vibeDraftService.listDrafts('user_a');
    const listB = await vibeDraftService.listDrafts('user_b');

    expect(listA.some((d) => d.id === savedA.id && d.content === 'User A morning draft')).toBe(true);
    expect(listA.some((d) => d.content === 'User B private draft')).toBe(false);
    expect(listB.some((d) => d.content === 'User B private draft')).toBe(true);

    // Cross-user get/delete refuses foreign userId
    expect(await vibeDraftService.getDraft('user_b', savedA.id)).toBeNull();

    // Update preserves idempotencyKey
    const updatedA = await vibeDraftService.saveDraft('user_a', {
      id: savedA.id,
      idempotencyKey: savedA.idempotencyKey,
      type: 'text',
      content: 'Updated text',
    });
    expect(updatedA.idempotencyKey).toBe(savedA.idempotencyKey);

    await vibeDraftService.deleteDraft('user_a', savedA.id);
    expect(await vibeDraftService.getDraft('user_a', savedA.id)).toBeNull();
  });
});

describe('CreateStory Vibes Studio UI & Flows', () => {
  beforeEach(() => {
    mockCreateStory.mockClear();
  });

  test('renders lazy camera prompt with Choose Media and Enable Camera', async () => {
    render(
      <MemoryRouter>
        <CreateStory />
      </MemoryRouter>
    );

    expect(await screen.findByText('Create a Vibe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose Media' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable Camera' })).toBeInTheDocument();
  });

  test('supports Text Vibe composition, Preview without publishing, and Audience picker options', async () => {
    render(
      <MemoryRouter>
        <CreateStory />
      </MemoryRouter>
    );

    // Switch to TEXT mode
    const textButtons = screen.getAllByRole('button', { name: 'TEXT' });
    fireEvent.click(textButtons[0]);

    const textarea = screen.getByLabelText('Text Vibe content');
    fireEvent.change(textarea, { target: { value: 'Shipping Vibes Part 1' } });

    // Open Preview modal — must NOT trigger createStory publish
    fireEvent.click(screen.getByRole('button', { name: 'Preview Vibe' }));
    expect(screen.getByRole('dialog', { name: 'Vibe preview' })).toBeInTheDocument();
    expect(mockCreateStory).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close Vibe preview' }));

    // Open Audience modal and verify all 6 options render
    fireEvent.click(screen.getByRole('button', { name: 'Choose Vibe audience' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose Vibe audience' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Public')).toBeInTheDocument();
    expect(within(dialog).getByText('Followers')).toBeInTheDocument();
    expect(within(dialog).getByText('Connections')).toBeInTheDocument();
    expect(within(dialog).getByText('Close Circle')).toBeInTheDocument();
    expect(within(dialog).getByText('Selected Users')).toBeInTheDocument();
    expect(within(dialog).getByText('Only Me')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByText('Connections'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm Audience' }));

    // Publish sends visibility: 'connections'
    const publishBtns = screen.getAllByRole('button', { name: /Publish Vibe/i });
    fireEvent.click(publishBtns[0]);

    await waitFor(() => expect(mockCreateStory).toHaveBeenCalledTimes(1));
    expect(mockCreateStory.mock.calls[0][0].visibility).toBe('connections');
    expect(mockCreateStory.mock.calls[0][0].type).toBe('text');
  });
});
