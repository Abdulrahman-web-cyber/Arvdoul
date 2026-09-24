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
      expect(Object.keys(ACHIEVEMENTS_CATALOG).length).toBeGreaterThanOrEqual(15);

      Object.entries(ACHIEVEMENTS_CATALOG).forEach(([id, ach]) => {
        expect(ach.id).toBe(id);
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

      const lvl10Ach = enriched.find((a) => a.id === 'reach_level_10');
      expect(lvl10Ach).toBeDefined();
      expect(lvl10Ach.unlocked).toBe(true);
      expect(lvl10Ach.progress).toBe(100);

      const streak30Ach = enriched.find((a) => a.id === 'streak_30_days');
      expect(streak30Ach).toBeDefined();
      expect(streak30Ach.unlocked).toBe(true);

      const lvl50Ach = enriched.find((a) => a.id === 'reach_level_50');
      expect(lvl50Ach).toBeDefined();
      expect(lvl50Ach.unlocked).toBe(false);
      expect(lvl50Ach.progress).toBeLessThan(100);
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
      expect(kingTitle.criteria.minLevel).toBe(75);
      expect(kingTitle.criteria.minReputation).toBe(90);
      expect(kingTitle.criteria.minActiveDays).toBe(180);

      // Ineligible profile
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
        level: 80,
        reputationScore: 95,
        activeDaysCount: 200,
        contributionScore: 90,
      });
      expect(qualified.eligible).toBe(true);
      expect(qualified.reasons.length).toBe(0);
    });
  });

  describe('Reputation, Influence, and Contribution Bands', () => {
    test('getReputationBand correctly maps scores to trust bands', () => {
      expect(getReputationBand(10).label).toBe('Untrusted');
      expect(getReputationBand(50).label).toBe('Neutral');
      expect(getReputationBand(65).label).toBe('Established');
      expect(getReputationBand(75).label).toBe('Trusted');
      expect(getReputationBand(88).label).toBe('Highly Trusted');
      expect(getReputationBand(98).label).toBe('Exceptional');
    });

    test('getInfluenceBand correctly maps scores', () => {
      expect(getInfluenceBand(5).label).toBe('Minimal');
      expect(getInfluenceBand(25).label).toBe('Emerging');
      expect(getInfluenceBand(50).label).toBe('Notable');
      expect(getInfluenceBand(75).label).toBe('Prominent');
      expect(getInfluenceBand(95).label).toBe('Sovereign');
    });

    test('getContributionBand correctly maps scores', () => {
      expect(getContributionBand(5).label).toBe('Observer');
      expect(getContributionBand(30).label).toBe('Contributor');
      expect(getContributionBand(55).label).toBe('Builder');
      expect(getContributionBand(75).label).toBe('Pillar');
      expect(getContributionBand(95).label).toBe('Keystone');
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
      const noneTier = getCreatorCapabilities({ creatorTier: 'NONE' });
      expect(noneTier.canMonetize).toBe(false);
      expect(noneTier.payoutCommissionRate).toBe(0.30);

      const partnerTier = getCreatorCapabilities({ creatorTier: 'PARTNER' });
      expect(partnerTier.canMonetize).toBe(true);
      expect(partnerTier.hasPrioritySupport).toBe(true);
      expect(partnerTier.payoutCommissionRate).toBe(0.15);
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
      };

      const passport = await passportService.getPassport('user_abcdef123456', 'user_abcdef123456', mockProfile);
      expect(passport).toBeDefined();
      expect(passport.citizenId).toBe('ARV-USER_ABC');
      expect(passport.displayName).toBe('Aria Vance');
      expect(passport.username).toBe('ariavance');
      expect(passport.level).toBe(15);
      expect(passport.reputation.band).toBe('Trusted');
      expect(passport.influence.band).toBe('Notable');
      expect(passport.contribution.band).toBe('Builder');
      expect(passport.citizenTier.tier).toBe('Citizen');
    });
  });
});
