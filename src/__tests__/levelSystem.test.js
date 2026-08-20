/**
 * src/__tests__/levelSystem.test.js
 * Real assertions for the level system:
 *  - pure curve math (boundaries, max level, progress)
 *  - rank titles + perks
 *  - awardExperience with a mocked Firestore layer: XP accrual,
 *    level-up + coin reward, daily caps, idempotency
 */

import { jest } from '@jest/globals';
import {
  getLevelInfo,
  getRankTitle,
  getPerksForLevel,
  getLifetimeRewards,
  LEVELS,
  XP_RULES,
  levelSystemService,
} from '../services/levelSystemService.js';

describe('level curve (pure math)', () => {
  test('level 1 at 0 XP with 0 progress', () => {
    const info = getLevelInfo(0);
    expect(info.level).toBe(1);
    expect(info.title).toBe('Newcomer');
    expect(info.progress).toBe(0);
    expect(info.xpToNext).toBe(100);
  });

  test('boundary: exactly 100 XP is level 2', () => {
    const info = getLevelInfo(100);
    expect(info.level).toBe(2);
    expect(info.xpIntoLevel).toBe(0);
  });

  test('mid-level progress is computed correctly', () => {
    // Level 2 spans 100..300, so 200 XP = 50% progress
    const info = getLevelInfo(200);
    expect(info.level).toBe(2);
    expect(info.progress).toBe(50);
  });

  test('max level caps progress at 100 and isMaxLevel', () => {
    const max = LEVELS[LEVELS.length - 1];
    const info = getLevelInfo(max.xpRequired + 99999);
    expect(info.level).toBe(max.level);
    expect(info.isMaxLevel).toBe(true);
    expect(info.progress).toBe(100);
    expect(info.nextLevelXp).toBeNull();
  });

  test('negative/NaN XP is clamped to level 1', () => {
    expect(getLevelInfo(-50).level).toBe(1);
    expect(getLevelInfo('abc').level).toBe(1);
  });

  test('rank titles escalate with level', () => {
    expect(getRankTitle(2)).toBe('Newcomer');
    expect(getRankTitle(5)).toBe('Creator');
    expect(getRankTitle(10)).toBe('Pro Creator');
    expect(getRankTitle(15)).toBe('Arvdoul Legend');
  });

  test('perks unlock at the correct levels', () => {
    expect(getPerksForLevel(4).some((p) => p.title === 'Live Streaming')).toBe(false);
    expect(getPerksForLevel(5).some((p) => p.title === 'Live Streaming')).toBe(true);
    expect(getPerksForLevel(10).some((p) => p.title === 'Creator Withdrawals')).toBe(true);
  });

  test('lifetime rewards accumulate coin rewards', () => {
    expect(getLifetimeRewards(1)).toBe(0);
    expect(getLifetimeRewards(2)).toBe(10);
    expect(getLifetimeRewards(3)).toBe(30); // 10 + 20
  });

  test('every registered XP action has a positive award and a cap', () => {
    for (const [action, rule] of Object.entries(XP_RULES)) {
      expect(rule.xp).toBeGreaterThan(0);
      expect(rule.dailyCap).toBeGreaterThanOrEqual(rule.xp);
      expect(typeof action).toBe('string');
    }
  });
});

describe('awardExperience (mocked Firestore)', () => {
  // In-memory fake user doc + transaction runner
  let userDoc;
  let ledger;
  let txWrites;

  function makeFakeFirestore() {
    return {
      doc: (db, collection, id) => ({ path: `${collection}/${id}`, id, collection }),
      serverTimestamp: () => ({ __ts: Date.now() }),
      increment: (n) => ({ __inc: n }),
      getDoc: async (ref) => ({
        exists: () => userDoc !== null,
        data: () => userDoc,
      }),
      runTransaction: async (db, fn) => {
        // The service uses tx.get / tx.set only
        const tx = {
          get: async (ref) => ({
            exists: () => userDoc !== null,
            data: () => userDoc,
          }),
          set: (ref, data, opts) => {
            txWrites.push({ ref: ref.path, data, opts });
            if (ref.path === 'users/uid1') {
              if (opts?.merge) {
                // Real Firestore merge semantics: dotted keys become nested
                // objects, increments apply to numbers.
                const merged = { ...userDoc };
                for (const [key, value] of Object.entries(data)) {
                  if (value && typeof value === 'object' && '__inc' in value) {
                    merged[key] = (merged[key] || 0) + value.__inc;
                  } else if (key.includes('.')) {
                    const [parent, child] = key.split('.');
                    merged[parent] = { ...(merged[parent] || {}), [child]: value };
                  } else {
                    merged[key] = value;
                  }
                }
                userDoc = merged;
              } else {
                userDoc = data;
              }
            } else {
              ledger.push({ path: ref.path, data });
            }
          },
        };
        await fn(tx);
      },
    };
  }

  beforeEach(() => {
    userDoc = {
      level: 1,
      experience: 0,
      coins: 50,
      xpCounters: {},
    };
    ledger = [];
    txWrites = [];

    const fake = makeFakeFirestore();
    jest.unstable_mockModule('../firebase/firebase.js', () => ({
      getFirestoreInstance: jest.fn(async () => ({ fake: true })),
    }));
    jest.unstable_mockModule('firebase/firestore', () => fake);
  });

  test('awards XP and persists experience', async () => {
    const fresh = await import('../services/levelSystemService.js');
    const res = await fresh.levelSystemService.awardExperience({
      userId: 'uid1',
      action: 'post_created',
    });
    expect(res.success).toBe(true);
    expect(res.xpAwarded).toBe(10);
    expect(res.leveledUp).toBe(false);
    expect(userDoc.experience).toBe(10);
    expect(userDoc.level).toBe(1);
  });

  test('level-up at 100 XP credits the coin reward', async () => {
    userDoc.experience = 95;
    userDoc.level = 1;
    const fresh = await import('../services/levelSystemService.js');
    const res = await fresh.levelSystemService.awardExperience({
      userId: 'uid1',
      action: 'daily_login', // 20 XP -> 115 total -> level 2
    });
    expect(res.leveledUp).toBe(true);
    expect(res.newLevel).toBe(2);
    expect(res.coinReward).toBe(10);
    expect(userDoc.coins).toBe(60);
    // A level-up ledger entry was written
    expect(ledger.some((l) => l.data.type === 'level_up_reward')).toBe(true);
  });

  test('daily cap prevents farming', async () => {
    const fresh = await import('../services/levelSystemService.js');
    const svc = fresh.levelSystemService;
    // comment_created: 5 XP, cap 50 -> 10 awards max
    for (let i = 0; i < 12; i++) {
      await svc.awardExperience({ userId: 'uid1', action: 'comment_created', source: `c${i}` });
    }
    expect(userDoc.experience).toBe(50); // capped at 50
  });

  test('idempotency: same source never double-awards within a day', async () => {
    const fresh = await import('../services/levelSystemService.js');
    const svc = fresh.levelSystemService;
    await svc.awardExperience({ userId: 'uid1', action: 'like_received', source: 'post_123' });
    const res2 = await svc.awardExperience({ userId: 'uid1', action: 'like_received', source: 'post_123' });
    expect(res2.duplicate).toBe(true);
    expect(res2.xpAwarded).toBe(0);
    expect(userDoc.experience).toBe(1);
  });

  test('unknown actions are rejected', async () => {
    const fresh = await import('../services/levelSystemService.js');
    await expect(
      fresh.levelSystemService.awardExperience({ userId: 'uid1', action: 'not_real' })
    ).rejects.toThrow('LEVEL_UNKNOWN_ACTION');
  });

  test('missing userId is rejected', async () => {
    const fresh = await import('../services/levelSystemService.js');
    await expect(
      fresh.levelSystemService.awardExperience({ action: 'daily_login' })
    ).rejects.toThrow('LEVEL_NO_USER');
  });
});
