// src/__tests__/levelSystem.test.js

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
    expect(info.title).toBe('Arrival');
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

  test('rank bands match the blueprint table', () => {
    expect(getRankTitle(1)).toBe('Arrival');
    expect(getRankTitle(4)).toBe('Arrival');
    expect(getRankTitle(5)).toBe('Resident');
    expect(getRankTitle(10)).toBe('Established');
    expect(getRankTitle(20)).toBe('Builder');
    expect(getRankTitle(40)).toBe('Advanced');
    expect(getRankTitle(70)).toBe('Sovereign');
    expect(getRankTitle(100)).toBe('Ascendant');
  });

  test('perks unlock at the correct levels', () => {
    expect(getPerksForLevel(4).some((p) => p.title === 'Live Streaming')).toBe(false);
    expect(getPerksForLevel(5).some((p) => p.title === 'Live Streaming')).toBe(true);
    expect(getPerksForLevel(10).some((p) => p.title === 'Creator Withdrawals')).toBe(true);
    expect(getPerksForLevel(19).some((p) => p.title === 'Builder Identity')).toBe(false);
    expect(getPerksForLevel(20).some((p) => p.title === 'Builder Identity')).toBe(true);
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

describe('awardExperience contract (server-authoritative)', () => {
  // XP, levels and coin balances must only ever be written by the
  // awardExperience Cloud Function. The client is verified here to (a) delegate
  // to the callable and (b) fail closed when the callable is unavailable,
  // never applying a local balance change.
  let callableImpl;

  beforeEach(() => {
    jest.resetModules();
    callableImpl = async () => ({ data: { success: true, xpAwarded: 10, leveledUp: false, newLevel: 1, coinReward: 0 } });
    jest.unstable_mockModule('firebase/functions', () => ({
      getFunctions: jest.fn(() => ({})),
      httpsCallable: jest.fn(() => (...args) => callableImpl(...args)),
    }));
  });

  test('delegates to the awardExperience Cloud Function', async () => {
    const seen = [];
    callableImpl = async (payload) => {
      seen.push(payload);
      return { data: { success: true, xpAwarded: 10, leveledUp: false, newLevel: 1, coinReward: 0 } };
    };
    const fresh = await import('../services/levelSystemService.js');
    const res = await fresh.levelSystemService.awardExperience({
      userId: 'uid1',
      action: 'post_created',
    });
    expect(res).toEqual({ success: true, xpAwarded: 10, leveledUp: false, newLevel: 1, coinReward: 0 });
    expect(seen).toEqual([{ action: 'post_created', count: 1, source: null }]);
  });

  test('surfaces the server level-up payload untouched', async () => {
    callableImpl = async () => ({
      data: { success: true, xpAwarded: 20, leveledUp: true, newLevel: 2, coinReward: 10 },
    });
    const fresh = await import('../services/levelSystemService.js');
    const res = await fresh.levelSystemService.awardExperience({
      userId: 'uid1',
      action: 'daily_login',
    });
    expect(res.leveledUp).toBe(true);
    expect(res.newLevel).toBe(2);
    expect(res.coinReward).toBe(10);
  });

  test('fails closed when the callable is unavailable (no local XP minting)', async () => {
    callableImpl = async () => {
      throw new Error('functions/unavailable');
    };
    const fresh = await import('../services/levelSystemService.js');
    await expect(
      fresh.levelSystemService.awardExperience({ userId: 'uid1', action: 'post_created' })
    ).rejects.toThrow('LEVEL_SERVER_UNAVAILABLE');
  });

  test('a non-success server response is not treated as an award', async () => {
    callableImpl = async () => ({ data: { success: false } });
    const fresh = await import('../services/levelSystemService.js');
    await expect(
      fresh.levelSystemService.awardExperience({ userId: 'uid1', action: 'post_created' })
    ).rejects.toThrow('LEVEL_SERVER_UNAVAILABLE');
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

  test('citizenship tiers escalate with level and active days', async () => {
    const { getCitizenTier } = await import('../services/levelSystemService.js');
    expect(getCitizenTier(1, 0).tier).toBe('Resident');
    expect(getCitizenTier(10, 7).tier).toBe('Citizen');
    expect(getCitizenTier(25, 30).tier).toBe('Statesperson');
    expect(getCitizenTier(50, 90).tier).toBe('Senator');
    expect(getCitizenTier(75, 180).tier).toBe('Chancellor');
    expect(getCitizenTier(100, 365).tier).toBe('Founder');
  });

  test('creator capabilities are decoupled from raw level', async () => {
    const { getCreatorCapabilities } = await import('../services/levelSystemService.js');
    // Basic user
    const basic = getCreatorCapabilities({ level: 1, followerCount: 10 });
    expect(basic.canReceiveTips).toBe(true);
    expect(basic.canStreamLive).toBe(false);
    expect(basic.canMonetize).toBe(false);

    // Level 10 or verified creator
    const streamUser = getCreatorCapabilities({ level: 10, followerCount: 50 });
    expect(streamUser.canStreamLive).toBe(true);

    const verifiedCreator = getCreatorCapabilities({ isCreator: true, isVerified: true, followerCount: 200 });
    expect(verifiedCreator.canStreamLive).toBe(true);
    expect(verifiedCreator.canSellMerch).toBe(true);
  });
});
