/**
 * src/__tests__/domainAuthority.test.js
 *
 * Behavioural guards for the digital-nation domain authority. These lock the
 * "no fabricated values" invariants at the service layer, where the old code
 * coerced absent data into plausible defaults:
 *
 *   - levelSystemService.getActiveDayInfo is the canonical active-day reader and
 *     reports an unrecorded counter as null, never 0 or 1
 *   - achievementService.enrichAchievements never invents progress from an
 *     unknown metric and never stamps a missing grant date as "now"
 *   - titleService.checkEligibility fails closed on unknown metrics instead of
 *     assuming level 1 / zero contribution
 *   - passportService numeric projection emits null and omits bands when a
 *     dimension is absent
 */

import { jest } from '@jest/globals';

// One hermetic, no-document Firestore layer for the whole file. A missing user
// document is exactly the "unknown" case every service must handle honestly.
jest.unstable_mockModule('../firebase/firebase.js', () => ({
  getFirestoreInstance: jest.fn(async () => ({ fake: true })),
  getFunctionsInstance: jest.fn(async () => ({ __mock: true })),
  getAuthInstance: jest.fn(async () => ({ currentUser: null })),
  auth: { currentUser: null },
}));
jest.unstable_mockModule('firebase/firestore', () => ({
  doc: (_db, ...segments) => ({ id: segments.join('/') }),
  getDoc: async () => ({ exists: () => false, data: () => ({}), id: 'none' }),
  collection: (_db, name) => ({ name }),
  getDocs: async () => ({ docs: [], size: 0, empty: true, forEach: () => {} }),
  query: (...args) => ({ args }),
  where: (f, o, v) => ({ f, o, v }),
  limit: (n) => ({ n }),
  serverTimestamp: () => 0,
  increment: (n) => n,
}));
jest.unstable_mockModule('firebase/functions', () => ({
  getFunctions: () => ({ __mock: true }),
  httpsCallable: () => async () => ({ data: { success: true } }),
}));

describe('levelSystemService.getActiveDayInfo', () => {
  test('reports unrecorded counters as null (never 0/1)', async () => {
    const { levelSystemService } = await import('../services/levelSystemService.js');
    const info = await levelSystemService.getActiveDayInfo('u1');
    expect(info).toEqual({ activeStreak: null, activeDaysCount: null, lastActiveDay: null });
  });

  test('no userId yields the unknown shape', async () => {
    const { levelSystemService } = await import('../services/levelSystemService.js');
    await expect(levelSystemService.getActiveDayInfo('')).resolves.toEqual({
      activeStreak: null,
      activeDaysCount: null,
      lastActiveDay: null,
    });
  });
});

describe('achievementService.enrichAchievements', () => {
  test('unknown metrics yield null progress and nothing is marked unlocked', async () => {
    const { default: achievementService } = await import('../services/achievementService.js');
    const enriched = achievementService.enrichAchievements([], {});
    for (const a of enriched) {
      expect(a.unlocked).toBe(false);
    }
    const lvl10 = enriched.find((a) => a.id === 'established_citizen');
    expect(lvl10.progress).toBeNull();
  });

  test('an earned (server-granted) item is unlocked with its real date only', async () => {
    const { default: achievementService } = await import('../services/achievementService.js');
    const enriched = achievementService.enrichAchievements(
      [{ id: 'arrival_complete', earnedAt: null }],
      {}
    );
    const earned = enriched.find((a) => a.id === 'arrival_complete');
    expect(earned.unlocked).toBe(true);
    expect(earned.earnedAt).toBeNull();
  });

  test('known metrics still compute real thresholds (no regression)', async () => {
    const { default: achievementService } = await import('../services/achievementService.js');
    const enriched = achievementService.enrichAchievements([], { level: 12, activeStreak: 30 });
    const lvl10 = enriched.find((a) => a.id === 'established_citizen');
    expect(lvl10.progress).toBe(100);
    expect(lvl10.unlocked).toBe(true);
    const ascendant = enriched.find((a) => a.id === 'century_ascendant');
    expect(ascendant.unlocked).toBe(false);
    expect(ascendant.progress).toBeLessThan(100);
  });
});

describe('titleService.checkEligibility', () => {
  test('unknown metrics fail closed (missing metric cannot satisfy a criterion)', async () => {
    const { default: titleService } = await import('../services/titleService.js');
    const gated = Object.values(titleService.getCatalog()).find(
      (t) => t.criteria && t.criteria.minLevel
    );
    const res = titleService.checkEligibility(gated.id, { level: null });
    expect(res.eligible).toBe(false);
    expect(res.reasons.join(' ')).toContain(`Level ${gated.criteria.minLevel}`);
  });
});

describe('passportService numeric projection', () => {
  test('absent dimensions produce null and omit their bands', async () => {
    const { default: passportService } = await import('../services/passportService.js');
    const passport = await passportService.getPassport('u1', 'u1', {
      id: 'u1',
      displayName: 'Ada',
    });
    expect(passport.level).toBeNull();
    expect(passport.activeDaysCount).toBeNull();
    expect(passport.activeStreak).toBeNull();
    expect(passport.citizenTier).toBeNull();
    expect(passport.rankTitle).toBeNull();
    expect(passport.reputation).toBeNull();
    expect(passport.issueDate).toBeNull();
    // Identity is verbatim; no invented placeholder.
    expect(passport.displayName).toBe('Ada');
  });

  test('a non-owner viewer never receives the target PII', async () => {
    const { default: passportService } = await import('../services/passportService.js');
    const passport = await passportService.getPassport('target', 'visitor', {
      id: 'target',
      displayName: 'Ada',
      email: 'ada@example.com',
      phoneNumber: '+15550001234',
    });
    expect(passport.isOwner).toBe(false);
    expect(passport.email).toBeUndefined();
    expect(passport.phoneNumber).toBeUndefined();
  });
});
