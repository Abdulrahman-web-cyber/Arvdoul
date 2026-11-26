/**
 * src/__tests__/progressionAndSocialGraphFixes.test.jsx
 *
 * Regression & cost-optimization coverage for:
 * 1. LevelNumeralBadge: Arrival (1-9) and Decade 3 (30-39) render refined Sapphire/Indigo
 *    and Amethyst palettes with zero greenish hues and valid Lvl labels.
 * 2. ProfileProgression: Uses canonical BRAND_GRADIENT without green progress tint,
 *    supports dark & light liquid-glass themes, and stays strictly honest on null/0 values.
 * 3. socialGraphService: Filters follow_requests with status == 'pending', caches & reuses
 *    complete edges in edgeCache, refuses to pollute edgeCache on partial includes,
 *    and deduplicates/caches getHiddenAuthorIds until invalidate(uid).
 * 4. userService: Honors 3-30 character username bounds from PROFILE_CONSTRAINTS and
 *    respects excludeUserId in checkUsernameAvailability.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BRAND_GRADIENT } from '../design-system/tokens.js';
import { PROFILE_CONSTRAINTS } from '../config/profileContracts.js';
import LevelNumeralBadge from '../components/profile/LevelNumeralBadge.jsx';
import ProfileProgression from '../components/profile/ProfileProgression.jsx';

const mockGetDocs = jest.fn();
const mockGetDoc = jest.fn();
const mockWhere = jest.fn((field, op, value) => ({ type: 'where', field, op, value }));
const mockQuery = jest.fn((...args) => ({ type: 'query', args }));
const mockCollection = jest.fn((_db, name) => ({ type: 'collection', name }));
const mockDoc = jest.fn((_db, col, id) => ({ type: 'doc', col, id }));
const mockOrderBy = jest.fn((field) => ({ type: 'orderBy', field }));
const mockLimit = jest.fn((n) => ({ type: 'limit', n }));
const mockStartAfter = jest.fn((c) => ({ type: 'startAfter', c }));
const mockDocumentId = jest.fn(() => '__name__');

jest.unstable_mockModule('../firebase/firebase.js', () => ({
  __esModule: true,
  default: {},
  db: {},
  auth: { currentUser: { uid: 'viewer-1' } },
  storage: {},
  getFirestoreInstance: async () => ({}),
  getAuthInstance: async () => ({ currentUser: { uid: 'viewer-1' } }),
}));

jest.unstable_mockModule('firebase/firestore', () => ({
  getDocs: (...args) => mockGetDocs(...args),
  getDoc: (...args) => mockGetDoc(...args),
  addDoc: jest.fn(async () => ({ id: 'mock-id' })),
  setDoc: jest.fn(async () => {}),
  updateDoc: jest.fn(async () => {}),
  deleteDoc: jest.fn(async () => {}),
  runTransaction: jest.fn(async (_db, fn) => fn({ get: mockGetDoc, set: jest.fn(), update: jest.fn(), delete: jest.fn() })),
  writeBatch: jest.fn(() => ({ set: jest.fn(), update: jest.fn(), delete: jest.fn(), commit: jest.fn(async () => {}) })),
  where: (...args) => mockWhere(...args),
  query: (...args) => mockQuery(...args),
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
  orderBy: (...args) => mockOrderBy(...args),
  limit: (...args) => mockLimit(...args),
  startAfter: (...args) => mockStartAfter(...args),
  documentId: (...args) => mockDocumentId(...args),
  serverTimestamp: jest.fn(() => 'MOCK_TS'),
  increment: jest.fn((n) => n),
  deleteField: jest.fn(() => 'DELETE_FIELD'),
  onSnapshot: jest.fn(() => () => {}),
  getCountFromServer: jest.fn(async () => ({ data: () => ({ count: 0 }) })),
  Timestamp: { now: () => ({ toDate: () => new Date(), toMillis: () => Date.now() }), fromDate: (d) => d },
}));

jest.unstable_mockModule('../utils/Logger.js', () => {
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

let socialGraphService;
let getUserService;

beforeAll(async () => {
  ({ socialGraphService } = await import('../services/socialGraphService.js'));
  ({ getUserService } = await import('../services/userService.js'));
});

describe('LevelNumeralBadge & ProfileProgression visual identity fixes', () => {
  const GREEN_HEXES = ['#ECFDF5', '#052E22', '#16A34A', '#34D399', '#10B981', '#0F766E', '#F0FDFA', '#042F2E', '#0D9488'];

  test('Arrival badge (level 1-9) and Decade 3 badge render without greenish hues', () => {
    const { container: darkArrival } = render(
      <LevelNumeralBadge level={3} theme="dark" size="md" />
    );
    const { container: lightArrival } = render(
      <LevelNumeralBadge level={1} theme="light" size="sm" />
    );
    const { container: decadeThree } = render(
      <LevelNumeralBadge level={35} theme="dark" size="md" />
    );

    expect(screen.getByLabelText('Level 3')).toBeInTheDocument();
    expect(screen.getByLabelText('Level 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Level 35')).toBeInTheDocument();

    for (const root of [darkArrival, lightArrival, decadeThree]) {
      const html = root.innerHTML.toUpperCase();
      for (const green of GREEN_HEXES) {
        expect(html).not.toContain(green);
      }
      expect(root.querySelector('linearGradient')).not.toBeNull();
    }
  });

  test('ProfileProgression uses canonical BRAND_GRADIENT with zero green hue math and preserves honesty', () => {
    const { container } = render(
      <MemoryRouter>
        <ProfileProgression
          level={1}
          experience={45}
          reputation={88}
          streak={7}
          theme="dark"
        />
      </MemoryRouter>
    );

    const styleTag = document.getElementById('arvdoul-profile-progression-styles');
    expect(styleTag).not.toBeNull();
    expect(styleTag.textContent).toContain(BRAND_GRADIENT);
    expect(styleTag.textContent).not.toContain('hsl(142');
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
  });
});

describe('Social graph batching, follow_requests filtering & hidden-author caching', () => {
  beforeEach(() => {
    socialGraphService.clearCache();
    mockGetDocs.mockReset();
    mockGetDoc.mockReset();
    mockWhere.mockClear();
  });

  test('getEdgeSet filters follow_requests by status == pending and reuses full edgeCache entries', async () => {
    mockGetDocs.mockImplementation(async () => ({
      docs: [],
      forEach: () => {},
    }));

    const first = await socialGraphService.getEdgeSet('viewer-1', ['target-1', 'target-2']);
    expect(first.get('target-1')?.requestStatus).toBeNull();

    const statusFilters = mockWhere.mock.calls.filter(([field, op, val]) => field === 'status' && op === '==' && val === 'pending');
    expect(statusFilters.length).toBeGreaterThanOrEqual(1);

    const callsAfterFirst = mockGetDocs.mock.calls.length;
    expect(callsAfterFirst).toBe(7);

    // Repeat full call OR partial follow-only call (like ConnectionsScreen follow states) hits edgeCache -> 0 extra reads
    await socialGraphService.getEdgeSet('viewer-1', ['target-1', 'target-2'], { include: ['follow'] });
    expect(mockGetDocs.mock.calls.length).toBe(callsAfterFirst);
  });

  test('partial getEdgeSet({ include: ["follow"] }) does not pollute edgeCache with false block state', async () => {
    mockGetDocs.mockImplementation(async (q) => {
      const colArg = q.args.find((a) => a?.type === 'collection');
      if (colArg?.name === 'blocks') {
        return {
          docs: [],
          forEach: (cb) => cb({ data: () => ({ blockerId: 'viewer-1', blockedId: 'blocked-user' }) }),
        };
      }
      return { docs: [], forEach: () => {} };
    });

    await socialGraphService.getEdgeSet('viewer-1', ['blocked-user'], { include: ['follow'] });
    const fullEdge = await socialGraphService.getRelationship('viewer-1', 'blocked-user');
    expect(fullEdge.isBlocking).toBe(true);
    expect(fullEdge.isBlocked).toBe(true);
  });

  test('getHiddenAuthorIds deduplicates concurrent calls and caches until invalidate(uid)', async () => {
    mockGetDocs.mockImplementation(async () => ({
      docs: [],
      forEach: () => {},
    }));

    const [a, b] = await Promise.all([
      socialGraphService.getHiddenAuthorIds('viewer-1'),
      socialGraphService.getHiddenAuthorIds('viewer-1'),
    ]);
    expect(a.size).toBe(0);
    expect(b.size).toBe(0);
    expect(mockGetDocs.mock.calls.length).toBe(3);

    // Cached repeat -> 0 reads
    await socialGraphService.getHiddenAuthorIds('viewer-1');
    expect(mockGetDocs.mock.calls.length).toBe(3);

    // After invalidation -> re-reads cleanly
    socialGraphService.invalidate('viewer-1');
    await socialGraphService.getHiddenAuthorIds('viewer-1');
    expect(mockGetDocs.mock.calls.length).toBe(6);
  });
});

describe('userService username constraints & self-exclusion', () => {
  beforeEach(() => {
    getUserService().usernameCache.clear();
    mockGetDoc.mockReset();
  });

  test('accepts valid 21-30 char usernames and rejects >30 char usernames', async () => {
    expect(PROFILE_CONSTRAINTS.USERNAME.MAX_LENGTH).toBe(30);
    const valid25 = 'a_valid_creator_handle_25';
    expect(valid25.length).toBe(25);

    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ userId: 'self-uid' }),
    });

    const svc = getUserService();
    const selfOwned = await svc.checkUsernameAvailability(valid25, 'self-uid');
    expect(selfOwned.available).toBe(true);

    const otherViewer = await svc.checkUsernameAvailability(valid25, 'other-uid');
    expect(otherViewer.available).toBe(false);

    const tooLong31 = 'a'.repeat(31);
    const overLimit = await svc.checkUsernameAvailability(tooLong31, 'self-uid');
    expect(overLimit.available).toBe(false);
    expect(overLimit.error).toMatch(/max 30/i);
  });
});
