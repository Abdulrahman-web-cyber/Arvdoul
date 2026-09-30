// src/__tests__/part2MasterBlueprint.test.js — ARVDOUL PART 2 MASTER BLUEPRINT TEST SUITE
// Validates Progression, Achievements, Titles, Reputation, Citizenship, Creator Tiers, and Economy.

import {
  ACHIEVEMENTS_CATALOG,
  TITLES_CATALOG,
  REPUTATION_BANDS,
  INFLUENCE_BANDS,
  CONTRIBUTION_BANDS,
  CREATOR_TIERS,
  TRANSACTION_STATES,
  getReputationBand,
  getInfluenceBand,
  getContributionBand,
  getCitizenTier,
  getCreatorCapabilities,
  LEVEL_GATES,
} from '../shared/levelConfig.cjs';
import achievementService from '../services/achievementService.js';
import titleService from '../services/titleService.js';
import creatorService from '../services/creatorService.js';
import passportService from '../services/passportService.js';

describe('Part 2: Master Blueprint Architecture & Single Source of Truth', () => {
  describe('Achievements Catalog Integrity', () => {
    test('ACHIEVEMENTS_CATALOG has all required fields for every item', () => {
      expect(ACHIEVEMENTS_CATALOG.length).toBeGreaterThanOrEqual(15);

      ACHIEVEMENTS_CATALOG.forEach((ach) => {
        expect(typeof ach.id).toBe('string');
        expect(ach.id.length).toBeGreaterThan(0);
        expect(typeof ach.title).toBe('string');
        expect(typeof ach.description).toBe('string');
        expect(typeof ach.category).toBe('string');
        expect(typeof ach.points).toBe('number');
        expect(ach.points).toBeGreaterThan(0);
        expect(typeof ach.rarity).toBe('string');
        expect(ach.icon).toBeDefined();
      });
    });

    test('enrichAchievements accurately calculates progress based on metrics', () => {
      const mockMetrics = {
        level: 12,
        activeStreak: 30,
        activeDaysCount: 45,
        postsCount: 15,
        likesCount: 120,
        commentsCount: 30,
        friendsCount: 10,
      };

      const enriched = achievementService.enrichAchievements([], mockMetrics);
      expect(Array.isArray(enriched)).toBe(true);

      const lvl10Ach = enriched.find((a) => a.id === 'established_citizen');
      expect(lvl10Ach).toBeDefined();
      expect(lvl10Ach.unlocked).toBe(true);
      expect(lvl10Ach.progress).toBe(100);

      const streak30Ach = enriched.find((a) => a.id === 'active_month');
      expect(streak30Ach).toBeDefined();
      expect(streak30Ach.unlocked).toBe(true);

      const ascendantAch = enriched.find((a) => a.id === 'century_ascendant');
      expect(ascendantAch).toBeDefined();
      expect(ascendantAch.unlocked).toBe(false);
      expect(ascendantAch.progress).toBeLessThan(100);
    });
  });

  describe('Titles Catalog & Multidimensional Provenance', () => {
    test('TITLES_CATALOG covers all required civic and creative domains', () => {
      const domains = new Set(Object.values(TITLES_CATALOG).map((t) => t.domain));
      expect(domains.has('civic')).toBe(true);
      expect(domains.has('creation')).toBe(true);
      expect(domains.has('community')).toBe(true);
      expect(domains.has('historical')).toBe(true);
    });

    test('Enforces Zero Pay-to-Legitimacy: Royal and High Civic titles require multidimensional standing', () => {
      const kingTitle = TITLES_CATALOG['king'];
      expect(kingTitle).toBeDefined();
      expect(kingTitle.criteria.minLevel).toBe(90);
      expect(kingTitle.criteria.minReputation).toBe(95);
      expect(kingTitle.criteria.minActiveDays).toBe(365);

      // Ineligible profile (insufficient reputation, days, and level)
      const ineligible = titleService.checkEligibility('king', {
        level: 75,
        reputationScore: 50, // Low trust score
        activeDaysCount: 200,
        contributionScore: 100,
      });
      expect(ineligible.eligible).toBe(false);
      expect(ineligible.reasons.some((r) => r.includes('Reputation'))).toBe(true);

      // Fully qualified profile
      const qualified = titleService.checkEligibility('king', {
        level: 95,
        reputationScore: 98,
        activeDaysCount: 400,
        contributionScore: 95,
        influenceScore: 95,
        achievementsCount: 30,
        policyStanding: 'good',
      });
      expect(qualified.eligible).toBe(true);
      expect(qualified.reasons.length).toBe(0);
    });
  });

  describe('Reputation, Influence, and Contribution Bands', () => {
    test('getReputationBand correctly maps scores to trust bands', () => {
      expect(getReputationBand(10).label).toBe('Unestablished');
      expect(getReputationBand(25).label).toBe('Developing');
      expect(getReputationBand(50).label).toBe('Established');
      expect(getReputationBand(65).label).toBe('Trusted');
      expect(getReputationBand(80).label).toBe('Highly Trusted');
      expect(getReputationBand(95).label).toBe('Exceptional');
    });

    test('getInfluenceBand correctly maps scores', () => {
      expect(getInfluenceBand(10).label).toBe('Emerging');
      expect(getInfluenceBand(30).label).toBe('Growing Presence');
      expect(getInfluenceBand(55).label).toBe('Resonant Voice');
      expect(getInfluenceBand(75).label).toBe('Community Beacon');
      expect(getInfluenceBand(90).label).toBe('National Reach');
    });

    test('getContributionBand correctly maps scores', () => {
      expect(getContributionBand(10).label).toBe('Participant');
      expect(getContributionBand(30).label).toBe('Community Contributor');
      expect(getContributionBand(55).label).toBe('Active Helper');
      expect(getContributionBand(75).label).toBe('Distinguished Contributor');
      expect(getContributionBand(90).label).toBe('Pillar of Arvdoul');
    });

    test('getCitizenTier reflects level and active days', () => {
      expect(getCitizenTier(1, 1).tier).toBe('Resident');
      expect(getCitizenTier(12, 10).tier).toBe('Citizen');
      expect(getCitizenTier(35, 60).tier).toBe('Statesperson');
      expect(getCitizenTier(60, 150).tier).toBe('Senator');
      expect(getCitizenTier(85, 300).tier).toBe('Chancellor');
      expect(getCitizenTier(100, 400).tier).toBe('Founder');
    });
  });

  describe('Creator Accreditation Gating', () => {
    test('isEligibleToApply enforces Level 5 minimum threshold', () => {
      const underLevel = creatorService.isEligibleToApply({ level: 3, policyStanding: 'good' });
      expect(underLevel.eligible).toBe(false);
      expect(underLevel.reasons.some((r) => r.includes(`Level ${LEVEL_GATES.creatorProfile}`))).toBe(true);

      const eligible = creatorService.isEligibleToApply({ level: 5, policyStanding: 'good' });
      expect(eligible.eligible).toBe(true);

      const badStanding = creatorService.isEligibleToApply({ level: 10, policyStanding: 'restricted' });
      expect(badStanding.eligible).toBe(false);
      expect(badStanding.reasons.some((r) => r.includes('policy standing'))).toBe(true);
    });

    test('getCreatorCapabilities unlocks capabilities progressively by tier', () => {
      const noneTier = getCreatorCapabilities({ creatorTier: 'NONE', level: 1 });
      expect(noneTier.canMonetize).toBe(false);
      expect(noneTier.payoutCommissionRate).toBe(0.15);

      const partnerTier = getCreatorCapabilities({ creatorTier: 'partner', level: 10 });
      expect(partnerTier.canMonetize).toBe(true);
      expect(partnerTier.hasPrioritySupport).toBe(true);
      expect(partnerTier.payoutCommissionRate).toBe(0.05);
    });
  });

  describe('Digital Passport Generation', () => {
    test('PassportService generates authorized citizen artifact with ARV prefix', async () => {
      const mockProfile = {
        id: 'user_abcdef123456',
        displayName: 'Aria Vance',
        username: 'ariavance',
        level: 15,
        activeDaysCount: 42,
        activeStreak: 14,
        reputationScore: 82,
        influenceScore: 65,
        contributionScore: 70,
        isVerified: true,
        achievements: [],
        titles: [],
      };

      const passport = await passportService.getPassport('user_abcdef123456', 'user_abcdef123456', mockProfile);
      expect(passport).toBeDefined();
      expect(passport.citizenId).toBe('ARV-USER_ABC');
      expect(passport.displayName).toBe('Aria Vance');
      expect(passport.username).toBe('ariavance');
      expect(passport.level).toBe(15);
      expect(passport.reputation.band).toBe('Highly Trusted');
      expect(passport.influence.band).toBe('Resonant Voice');
      expect(passport.contribution.band).toBe('Distinguished Contributor');
      expect(passport.citizenTier.tier).toBe('Statesperson');
    });
  });
});
