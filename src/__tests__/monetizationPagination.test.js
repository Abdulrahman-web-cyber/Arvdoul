/**
 * Cursor pagination contract for the monetization read model (V2-01).
 *
 * Firestore is mocked at the SDK boundary so the test asserts the real service
 * logic: the query clauses it builds, how it derives `nextCursor`, and how
 * callers unwrap the `{ items, nextCursor }` page shape.
 */

import { jest } from '@jest/globals';

const builtQueries = [];

jest.unstable_mockModule('firebase/firestore', () => ({
  collection: (db, name) => ({ __collection: name }),
  doc: (db, ...segments) => ({ __doc: segments }),
  getDoc: jest.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: jest.fn(async () => ({ docs: [] })),
  query: (ref, ...clauses) => {
    const q = { ref, clauses };
    builtQueries.push(q);
    return q;
  },
  where: (field, op, value) => ({ __where: [field, op, value] }),
  orderBy: (field, dir) => ({ __orderBy: [field, dir] }),
  limit: (n) => ({ __limit: n }),
  addDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}));

jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: jest.fn(async () => ({})),
  auth: {},
}));

const firestore = await import('firebase/firestore');
const { getMonetizationService } = await import('../services/monetizationService.js');

const service = () => {
  const svc = getMonetizationService();
  svc.db = {};
  svc._ensureInitialized = jest.fn(async () => {});
  return svc;
};

const txDoc = (id, iso) => ({
  id,
  data: () => ({
    userId: 'u1',
    amount: 5,
    type: 'credit',
    reason: 'ad_reward',
    createdAt: { toDate: () => new Date(iso) },
  }),
});

describe('monetizationService.getTransactionHistory (cursor pagination)', () => {
  beforeEach(() => {
    builtQueries.length = 0;
  });

  test('first page has no createdAt cursor and returns items + nextCursor', async () => {
    const docs = Array.from({ length: 15 }, (_, i) => txDoc(`tx${i}`, `2026-01-${String(20 - i).padStart(2, '0')}T00:00:00Z`));
    firestore.getDocs.mockResolvedValueOnce({ docs });

    const page = await service().getTransactionHistory('u1', 15);

    expect(page.items).toHaveLength(15);
    expect(page.nextCursor).toBe('2026-01-06T00:00:00.000Z');
    const clauses = builtQueries.at(-1).clauses;
    expect(clauses.some((c) => c.__where?.[0] === 'createdAt')).toBe(false);
    expect(clauses.some((c) => c.__where?.[0] === 'userId')).toBe(true);
    expect(clauses.some((c) => c.__orderBy?.[0] === 'createdAt')).toBe(true);
    expect(clauses.some((c) => c.__limit === 15)).toBe(true);
  });

  test('a subsequent page filters by createdAt < cursor', async () => {
    firestore.getDocs.mockResolvedValueOnce({ docs: [txDoc('tx0', '2026-01-05T00:00:00Z')] });

    await service().getTransactionHistory('u1', 15, '2026-01-06T00:00:00.000Z');

    const clauses = builtQueries.at(-1).clauses;
    const cursorClause = clauses.find((c) => c.__where?.[0] === 'createdAt');
    expect(cursorClause.__where[1]).toBe('<');
    expect(cursorClause.__where[2]).toEqual(new Date('2026-01-06T00:00:00.000Z'));
  });

  test('a short page terminates pagination (nextCursor null)', async () => {
    firestore.getDocs.mockResolvedValueOnce({ docs: [txDoc('tx0', '2026-01-05T00:00:00Z')] });

    const page = await service().getTransactionHistory('u1', 15);

    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBeNull();
  });

  test('a missing userId yields an empty page without querying', async () => {
    const page = await service().getTransactionHistory('', 15);
    expect(page).toEqual({ items: [], nextCursor: null });
    expect(builtQueries).toHaveLength(0);
  });
});

describe('monetizationService.getCoinLeaderboard (cursor pagination)', () => {
  beforeEach(() => {
    builtQueries.length = 0;
  });

  test('returns ranked items and a coins cursor', async () => {
    const docs = Array.from({ length: 10 }, (_, i) => ({
      id: `u${i}`,
      data: () => ({ displayName: `User ${i}`, coins: 1000 - i * 10 }),
    }));
    firestore.getDocs.mockResolvedValueOnce({ docs });

    const page = await service().getCoinLeaderboard(10);

    expect(page.items).toHaveLength(10);
    expect(page.items[0]).toMatchObject({ userId: 'u0', coins: 1000 });
    expect(page.nextCursor).toBe(910);
    const clauses = builtQueries.at(-1).clauses;
    expect(clauses.some((c) => c.__orderBy?.[0] === 'coins')).toBe(true);
    expect(clauses.some((c) => c.__where?.[0] === 'coins')).toBe(false);
  });

  test('a cursor page filters coins < cursor', async () => {
    firestore.getDocs.mockResolvedValueOnce({ docs: [{ id: 'u9', data: () => ({ coins: 800 }) }] });

    await service().getCoinLeaderboard(10, 910);

    const cursorClause = builtQueries.at(-1).clauses.find((c) => c.__where?.[0] === 'coins');
    expect(cursorClause.__where[1]).toBe('<');
    expect(cursorClause.__where[2]).toBe(910);
  });
});

describe('monetizationService.getMonetizationStats', () => {
  test('counts transactions from the paginated page shape', async () => {
    firestore.getDocs.mockResolvedValueOnce({ docs: [txDoc('a', '2026-01-01T00:00:00Z'), txDoc('b', '2026-01-01T00:00:00Z')] });
    const svc = service();
    svc.getBalance = jest.fn(async () => 42);
    svc.getUserLevel = jest.fn(async () => ({ level: 3, progress: 10 }));

    const stats = await svc.getMonetizationStats('u1');

    expect(stats.balance).toBe(42);
    expect(stats.totalTransactions).toBe(2);
  });
});
