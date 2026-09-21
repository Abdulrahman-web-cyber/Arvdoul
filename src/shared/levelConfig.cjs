/**
 * shared/levelConfig.cjs — SINGLE SOURCE OF TRUTH for the Arvdoul level system.
 *
 * Consumed by BOTH:
 *   - the client  (src/services/levelSystemService.js, ESM import of a .cjs file)
 *   - Cloud Functions (functions/levelSystem.js, CommonJS require)
 *
 * It is deliberately written as CommonJS with zero runtime dependencies so the
 * same bytes execute in the browser bundle and in the Node 22 function runtime.
 * Previously the level curve, XP rules and reward tables were duplicated in both
 * trees and had already drifted; never reintroduce a second copy.
 */

/* Level curve — 100 levels scaling progressively with mathematical consistency. */
const LEVELS = Array.from({ length: 100 }, (_, i) => {
  const level = i + 1;
  const xpRequired = 50 * level * (level - 1);
  let coinReward = 0;
  if (level > 1) {
    if (level <= 15) {
      // Preserve exact legacy coin rewards for levels 2-15
      const legacyRewards = [0, 10, 20, 30, 40, 50, 60, 70, 80, 100, 120, 140, 160, 180, 200];
      coinReward = legacyRewards[level - 1] || (level * 10);
    } else {
      // Progressive scaling for levels 16 to 100
      coinReward = 200 + (level - 15) * 15;
      if (level % 10 === 0) coinReward += 100;
      if (level === 50) coinReward += 500;
      if (level === 100) coinReward += 2500;
    }
  }
  return { level, xpRequired, coinReward };
});

/* Rank bands across all 100 levels - the blueprint's normative table. */
const RANK_TITLES = [
  { minLevel: 1, title: 'Arrival' },
  { minLevel: 5, title: 'Resident' },
  { minLevel: 10, title: 'Established' },
  { minLevel: 20, title: 'Builder' },
  { minLevel: 30, title: 'Rising' },
  { minLevel: 40, title: 'Advanced' },
  { minLevel: 50, title: 'Elite' },
  { minLevel: 60, title: 'Vanguard' },
  { minLevel: 70, title: 'Sovereign' },
  { minLevel: 80, title: 'Apex' },
  { minLevel: 90, title: 'Legendary' },
  { minLevel: 100, title: 'Ascendant' },
];

/* Digital Citizenship tiers for platform governance and nation standing. */
const CITIZEN_TIERS = [
  { minLevel: 1, minDays: 0, tier: 'Resident', icon: '🌱', description: 'Registered Arvdoul platform resident' },
  { minLevel: 5, minDays: 7, tier: 'Citizen', icon: '🏛️', description: 'Full democratic voting and community participant' },
  { minLevel: 15, minDays: 30, tier: 'Statesperson', icon: '📜', description: 'Established community pillar and trusted contributor' },
  { minLevel: 30, minDays: 90, tier: 'Senator', icon: '⚖️', description: 'Platform legislative voter and policy proposer' },
  { minLevel: 60, minDays: 180, tier: 'Chancellor', icon: '👑', description: 'High governing council member' },
  { minLevel: 100, minDays: 365, tier: 'Founder', icon: '⭐', description: 'Permanent Founding Citizen of Arvdoul' },
];

/* Feature perks unlocked by level, aligned with the blueprint's unlock
 * framework (section 22). Profile-presentation unlocks and functional gates
 * share this one table so the UI can never advertise a perk that the server
 * does not honour. */
const LEVEL_PERKS = [
  { minLevel: 2, icon: '✏️', title: 'Profile Status', description: 'Set a status and add extra identity customization.' },
  { minLevel: 3, icon: '📄', title: 'Shareable Profile Card', description: 'Share your profile and achievement card.' },
  { minLevel: 5, icon: '🔴', title: 'Live Streaming', description: 'Go live to your followers with viewer chat.' },
  { minLevel: 5, icon: '📌', title: 'Highlights', description: 'Pin content and create profile highlights.' },
  { minLevel: 7, icon: '🎁', title: 'Gift & Tip Boost', description: 'Higher daily gift and tip earning multiplier.' },
  { minLevel: 10, icon: '💸', title: 'Creator Withdrawals', description: 'Withdraw your coin earnings to real money.' },
  { minLevel: 10, icon: '📊', title: 'Basic Personal Analytics', description: 'See your own audience and engagement analytics.' },
  { minLevel: 12, icon: '🏷️', title: 'Custom Badge', description: 'Personalize your profile badge color.' },
  { minLevel: 15, icon: '✅', title: 'Verified Priority', description: 'Priority support and verification review.' },
  { minLevel: 15, icon: '🎨', title: 'Custom Accent', description: 'Custom profile accent and presentation options.' },
  { minLevel: 20, icon: '🏗️', title: 'Builder Identity', description: 'Builder identity, community creation, and creator application eligibility.' },
  { minLevel: 25, icon: '📇', title: 'Enhanced Identity Card', description: 'Collections and an expanded identity showcase.' },
  { minLevel: 30, icon: '🏛️', title: 'Citizen Council', description: 'Submit and vote on constitutional governance proposals.' },
  { minLevel: 50, icon: '💎', title: 'Cornerstone Presentation', description: 'Rare cosmetic categories and an elite profile showcase.' },
  { minLevel: 75, icon: '🛰️', title: 'Nation Founder Circle', description: 'Host platform-wide global events and spaces.' },
  { minLevel: 100, icon: '⭐', title: 'Ascendant Identity', description: 'Unique profile presentation and the highest standard capabilities.' },
];

/* XP award rules (per unit of the action). `dailyCap` prevents farming. */
const XP_RULES = Object.freeze({
  post_created: { xp: 10, dailyCap: 100 },
  comment_created: { xp: 5, dailyCap: 50 },
  like_received: { xp: 1, dailyCap: 50 },
  follow_received: { xp: 15, dailyCap: 150 },
  daily_login: { xp: 20, dailyCap: 20 },
  gift_received: { xp: 2, dailyCap: 100 },
  live_minute: { xp: 1, dailyCap: 60 },
});

/**
 * Level thresholds at which privileged features unlock. Every gate in the app
 * (client UI and server enforcement) must read from this object so a perk can
 * never be displayed at one level and enforced at another.
 */
const LEVEL_GATES = Object.freeze({
  publicFollowers: 3,
  creatorProfile: 5,
  advancedEditor: 2,
  liveStreaming: 5,
  giftBoost: 7,
  withdrawals: 10,
  customBadge: 12,
  verifiedPriority: 15,
  earlyAccessStudio: 20,
  citizenCouncil: 30,
  sovereign: 50,
  founderCircle: 75,
  transcendent: 100,
});

/**
 * Multidimensional eligibility for civic/royal titles (blueprint 31-32).
 * Level alone is deliberately insufficient: reputation, contribution,
 * influence and sustained active days are all required. Use these rules
 * instead of hard-coding thresholds into UI.
 */
const ROYAL_ELIGIBILITY = Object.freeze({
  duke: Object.freeze({
    minLevel: 70,
    minActiveDays: 180,
    minReputation: 85,
    minContribution: 80,
    minInfluence: 70,
    minAchievements: 10,
    requiresGoodStanding: true,
  }),
  king: Object.freeze({
    minLevel: 90,
    minActiveDays: 365,
    minReputation: 95,
    minContribution: 90,
    minInfluence: 90,
    minAchievements: 25,
    requiresGoodStanding: true,
  }),
});

const MAX_LEVEL = LEVELS[LEVELS.length - 1].level;

/**
 * Pure: evaluate eligibility for a civic/royal title.
 * `stats` carries the independently-tracked dimensions; a missing dimension
 * fails its requirement (no silent pass-through).
 *
 * @returns {{eligible: boolean, title: string, missing: string[]}}
 */
function getRoyalEligibility(titleName, stats = {}) {
  const rule = ROYAL_ELIGIBILITY[titleName];
  if (!rule) return { eligible: false, title: titleName, missing: ['unknown title'] };

  const level = Number(stats.level) || 0;
  const activeDays = Number(stats.activeDaysCount) || 0;
  const reputation = Number(stats.reputation) || 0;
  const contribution = Number(stats.contribution) || 0;
  const influence = Number(stats.influence) || 0;
  const achievements = Number(stats.achievementsCount) || 0;
  const standing = stats.policyStanding || stats.accountStanding;

  const missing = [];
  if (level < rule.minLevel) missing.push('level');
  if (activeDays < rule.minActiveDays) missing.push('activeDays');
  if (reputation < rule.minReputation) missing.push('reputation');
  if (contribution < rule.minContribution) missing.push('contribution');
  if (influence < rule.minInfluence) missing.push('influence');
  if (achievements < rule.minAchievements) missing.push('achievements');
  if (rule.requiresGoodStanding && standing !== undefined && standing !== null && standing !== 'good') {
    missing.push('policyStanding');
  }

  return { eligible: missing.length === 0, title: titleName, missing };
}

/** Pure: rank title for a level. */
function getRankTitle(level) {
  let title = RANK_TITLES[0].title;
  for (const rank of RANK_TITLES) {
    if (level >= rank.minLevel) title = rank.title;
  }
  return title;
}

/** Pure: perks unlocked at a level. */
function getPerksForLevel(level) {
  return LEVEL_PERKS.filter((p) => level >= p.minLevel);
}

/** Pure: compute level info from total XP. */
function getLevelInfo(experience) {
  const xp = Math.max(0, Number(experience) || 0);
  let level = LEVELS[0].level;
  let current = LEVELS[0];
  let next = LEVELS[1] || null;

  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i].xpRequired) {
      current = LEVELS[i];
      level = current.level;
      next = LEVELS[i + 1] || null;
    } else {
      break;
    }
  }

  const isMaxLevel = !next;
  const xpIntoLevel = xp - current.xpRequired;
  const xpToNext = next ? Math.max(0, next.xpRequired - xp) : 0;
  const span = next ? next.xpRequired - current.xpRequired : 1;
  const progress = next ? Math.min(100, Math.max(0, (xpIntoLevel / span) * 100)) : 100;

  return {
    level,
    title: getRankTitle(level),
    currentLevelXp: current.xpRequired,
    nextLevelXp: next ? next.xpRequired : null,
    xpIntoLevel,
    xpToNext,
    progress: Math.round(progress * 10) / 10,
    isMaxLevel,
  };
}

/** Pure: total coin rewards across all reached levels (for display). */
function getLifetimeRewards(level) {
  return LEVELS.filter((l) => l.level <= level).reduce((sum, l) => sum + l.coinReward, 0);
}

/** Pure: coin reward granted when advancing from `beforeLevel` to `afterLevel`. */
function getLevelUpReward(beforeLevel, afterLevel) {
  if (afterLevel <= beforeLevel) return 0;
  return LEVELS.filter((l) => l.level > beforeLevel && l.level <= afterLevel).reduce(
    (sum, l) => sum + l.coinReward,
    0
  );
}

/**
 * Pure: highest citizen tier the account has reached.
 * A tier requires BOTH the level and the number of active days; meeting only
 * one of the two is not enough (otherwise a brand-new level-1 account would
 * reach Founder purely through elapsed days).
 */
function getCitizenTier(level = 1, activeDaysCount = 0) {
  const lvl = Math.max(1, Number(level) || 1);
  const days = Math.max(0, Number(activeDaysCount) || 0);
  let matched = CITIZEN_TIERS[0];
  for (const c of CITIZEN_TIERS) {
    if (lvl >= c.minLevel && days >= c.minDays) {
      matched = c;
    }
  }
  return matched;
}

/**
 * Pure: creator capabilities, decoupled from raw XP grinding so approved
 * creators can stream/monetize without hitting a raw level threshold.
 */
function getCreatorCapabilities(profile) {
  if (!profile) {
    return {
      isCreator: false,
      creatorTier: 'standard',
      canStream: false,
      canStreamLive: false,
      canMonetize: false,
      canReceiveTips: false,
      canWithdraw: false,
      canCreateShop: false,
      canSellMerch: false,
    };
  }

  const isCreator = Boolean(profile.isCreator || profile.creatorTier || profile.creatorStatus === 'approved');
  const level = profile.level || 1;
  const followers = profile.followerCount || 0;
  const isVerified = Boolean(profile.isVerified || profile.verified || profile.verificationBadge);
  const tier = profile.creatorTier || (isCreator ? 'creator' : 'standard');

  return {
    isCreator,
    creatorTier: tier,
    canStream: isCreator || level >= LEVEL_GATES.liveStreaming,
    canStreamLive: isCreator || level >= LEVEL_GATES.liveStreaming,
    canMonetize: isCreator || tier === 'creator' || tier === 'partner' || level >= LEVEL_GATES.liveStreaming,
    canReceiveTips: isCreator || followers >= 10 || level >= 3,
    canCreateShop: isCreator || level >= 3,
    canSellMerch: isCreator || level >= 3,
    canWithdraw: isVerified || tier === 'partner' || tier === 'elite' || level >= LEVEL_GATES.withdrawals,
  };
}

/** Pure: does a given capability gate pass? Reads LEVEL_GATES. */
function meetsLevelGate(gateName, level) {
  const required = LEVEL_GATES[gateName];
  if (required === undefined) return false;
  return (Number(level) || 1) >= required;
}

/**
 * The single definition of the profile identity badge. A creator badge
 * outranks the civic one; the civic label comes from the canonical citizen
 * tiers so a profile can never claim a standing its level has not reached.
 */
function getIdentityBadge(level, options = {}) {
  const lvl = Math.max(1, Number(level) || 1);
  const { isCreator = false, activeDaysCount = 0 } = options;

  if (isCreator || lvl >= LEVEL_GATES.creatorProfile) {
    return {
      kind: 'creator',
      label: lvl >= LEVEL_GATES.verifiedPriority ? 'Top Creator' : 'Creator',
      tone: 'amber',
    };
  }

  return {
    kind: 'citizen',
    label: getCitizenTier(lvl, activeDaysCount).tier,
    tone: lvl >= LEVEL_GATES.publicFollowers ? 'emerald' : 'slate',
  };
}

/** Level-band gradient token for a level badge, keyed off the canonical ranks. */
function getLevelBandColor(level) {
  const lvl = Math.max(1, Number(level) || 1);
  if (lvl >= 75) return 'from-fuchsia-400 via-purple-500 to-indigo-600';
  if (lvl >= 50) return 'from-yellow-400 via-amber-500 to-orange-500';
  if (lvl >= 30) return 'from-red-400 via-rose-500 to-pink-600';
  if (lvl >= 20) return 'from-purple-400 via-pink-500 to-rose-500';
  if (lvl >= 10) return 'from-blue-400 via-cyan-500 to-teal-500';
  if (lvl >= 5) return 'from-green-400 via-emerald-500 to-teal-500';
  return 'from-gray-400 via-gray-500 to-gray-600';
}

module.exports = {
  LEVELS,
  RANK_TITLES,
  CITIZEN_TIERS,
  LEVEL_PERKS,
  XP_RULES,
  LEVEL_GATES,
  ROYAL_ELIGIBILITY,
  MAX_LEVEL,
  getRankTitle,
  getPerksForLevel,
  getLevelInfo,
  getLifetimeRewards,
  getLevelUpReward,
  getCitizenTier,
  getCreatorCapabilities,
  meetsLevelGate,
  getRoyalEligibility,
  getIdentityBadge,
  getLevelBandColor,
};