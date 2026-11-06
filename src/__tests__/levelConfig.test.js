// src/__tests__/levelConfig.test.js

import fs from 'node:fs';

import {
  LEVELS,
  MAX_LEVEL,
  LEVEL_GATES,
  getLevelInfo,
  getLevelUpReward,
  getCitizenTier,
  getPerksForLevel,
  meetsLevelGate,
  getRoyalEligibility,
  ROYAL_ELIGIBILITY,
} from '../shared/levelConfig.cjs';

describe('shared levelConfig - curve integrity', () => {
  test('curve spans 100 strictly increasing levels', () => {
    expect(LEVELS).toHaveLength(100);
    expect(MAX_LEVEL).toBe(100);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].xpRequired).toBeGreaterThan(LEVELS[i - 1].xpRequired);
    }
  });

  test('every level has a non-negative integer coin reward', () => {
    for (const l of LEVELS) {
      expect(Number.isInteger(l.coinReward)).toBe(true);
      expect(l.coinReward).toBeGreaterThanOrEqual(0);
    }
  });

  test('max level is reachable and reports isMaxLevel with 100% progress', () => {
    const info = getLevelInfo(LEVELS[99].xpRequired);
    expect(info.level).toBe(100);
    expect(info.isMaxLevel).toBe(true);
    expect(info.progress).toBe(100);
    expect(info.nextLevelXp).toBeNull();
    expect(info.xpToNext).toBe(0);
  });

  test('xpToNext is the exact distance to the next threshold', () => {
    // Level 2 starts at 100, level 3 at 300.
    expect(getLevelInfo(150).level).toBe(2);
    expect(getLevelInfo(150).xpToNext).toBe(150);
    expect(getLevelInfo(299).level).toBe(2);
    expect(getLevelInfo(300).level).toBe(3);
  });
});

describe('shared levelConfig - level-up rewards', () => {
  test('multi-level jump sums every reward crossed', () => {
    const single = getLevelUpReward(1, 2);
    const multi = getLevelUpReward(1, 4);
    expect(single).toBe(LEVELS[1].coinReward);
    expect(multi).toBe(LEVELS[1].coinReward + LEVELS[2].coinReward + LEVELS[3].coinReward);
  });

  test('no reward when no level is gained', () => {
    expect(getLevelUpReward(5, 5)).toBe(0);
    expect(getLevelUpReward(5, 4)).toBe(0);
  });
});

describe('shared levelConfig - citizenship tiers', () => {
  test('a tier needs BOTH level and active days', () => {
    // Plenty of days but no level must not grant a high tier.
    expect(getCitizenTier(1, 365).tier).toBe('Resident');
    // Plenty of level but no days must not either.
    expect(getCitizenTier(100, 0).tier).toBe('Resident');
  });

  test('the highest satisfied tier wins', () => {
    expect(getCitizenTier(40, 365).tier).toBe('Senator');
    expect(getCitizenTier(100, 365).tier).toBe('Founder');
  });
});

describe('shared levelConfig - gated unlocks', () => {
  test('each gate has a matching perk at the same level', () => {
    const perkLevels = getPerksForLevel(MAX_LEVEL).map((p) => p.minLevel);
    for (const gate of ['advancedEditor', 'liveStreaming', 'withdrawals', 'customBadge']) {
      expect(perkLevels).toContain(LEVEL_GATES[gate]);
    }
  });

  test('meetsLevelGate enforces the threshold exactly', () => {
    expect(meetsLevelGate('withdrawals', 10)).toBe(true);
    expect(meetsLevelGate('withdrawals', 9)).toBe(false);
    expect(meetsLevelGate('liveStreaming', 5)).toBe(true);
    expect(meetsLevelGate('liveStreaming', 4)).toBe(false);
  });

  test('an unknown gate never passes', () => {
    expect(meetsLevelGate('doesNotExist', 100)).toBe(false);
  });

  test('passport stamps read their thresholds from the gate table', () => {
    expect(LEVEL_GATES.civicVanguard).toBe(10);
    expect(LEVEL_GATES.diplomaticEnvoy).toBe(15);
    const src = fs.readFileSync(
      new URL('../services/passportService.js', import.meta.url),
      'utf8'
    );
    // A literal `level >= 10` in a service is the same bug as one in JSX.
    expect(src).not.toMatch(/level\s*>=\s*(10|15)\b/);
    expect(src).toContain('LEVEL_GATES.civicVanguard');
    expect(src).toContain('LEVEL_GATES.diplomaticEnvoy');
  });
});
describe('shared levelConfig - royal eligibility (level is not enough)', () => {
  const fullDuke = {
    level: 70,
    activeDaysCount: 180,
    reputation: 85,
    contribution: 80,
    influence: 70,
    achievementsCount: 10,
    policyStanding: 'good',
  };

  test('level 70 alone does not grant Duke', () => {
    const r = getRoyalEligibility('duke', { level: 70 });
    expect(r.eligible).toBe(false);
    expect(r.missing).toContain('reputation');
    expect(r.missing).toContain('contribution');
  });

  test('all dimensions satisfied grants Duke', () => {
    expect(getRoyalEligibility('duke', fullDuke).eligible).toBe(true);
  });

  test('one missing dimension blocks eligibility', () => {
    const r = getRoyalEligibility('duke', { ...fullDuke, influence: 0 });
    expect(r.eligible).toBe(false);
    expect(r.missing).toEqual(['influence']);
  });

  test('King is strictly rarer than Duke', () => {
    expect(ROYAL_ELIGIBILITY.king.minLevel).toBeGreaterThan(ROYAL_ELIGIBILITY.duke.minLevel);
    expect(ROYAL_ELIGIBILITY.king.minReputation).toBeGreaterThan(ROYAL_ELIGIBILITY.duke.minReputation);
    // A fully-qualified Duke is still not a King.
    expect(getRoyalEligibility('king', fullDuke).eligible).toBe(false);
  });

  test('unknown titles never pass', () => {
    expect(getRoyalEligibility('emperor', fullDuke).eligible).toBe(false);
  });

  test('good standing is required and fails closed when absent', () => {
    // A caller that forgets to pass a standing must NOT silently grant a title.
    const { policyStanding, ...noStanding } = fullDuke;
    const r = getRoyalEligibility('duke', noStanding);
    expect(r.eligible).toBe(false);
    expect(r.missing).toContain('policyStanding');

    // The account vocabulary ('active') satisfies the requirement too.
    expect(getRoyalEligibility('duke', { ...noStanding, accountStatus: 'active' }).eligible).toBe(true);
    // A suspended/banned standing blocks it.
    expect(getRoyalEligibility('duke', { ...noStanding, accountStatus: 'suspended' }).eligible).toBe(false);
    // A bad policy standing blocks it.
    expect(getRoyalEligibility('duke', { ...fullDuke, policyStanding: 'restricted' }).eligible).toBe(false);
  });
});
