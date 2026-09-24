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

/**
 * Part 2: Categorized Canonical Achievements Catalog.
 * Server-validated, versioned, auditable, and idempotent.
 */
const ACHIEVEMENTS_CATALOG = Object.freeze([
  // Progression
  {
    id: 'arrival_complete',
    category: 'progression',
    title: 'Arrival Complete',
    description: 'Advance from Arrival to Resident standing (Level 5).',
    icon: '🌱',
    points: 50,
    rarity: 'Common',
    criteriaVersion: 1,
    criteria: { minLevel: 5 },
  },
  {
    id: 'established_citizen',
    category: 'progression',
    title: 'Established Citizen',
    description: 'Reach Level 10 and unlock creator withdrawals.',
    icon: '🏛️',
    points: 100,
    rarity: 'Uncommon',
    criteriaVersion: 1,
    criteria: { minLevel: 10 },
  },
  {
    id: 'builder_rank',
    category: 'progression',
    title: 'Master Builder',
    description: 'Reach Level 20 and unlock community creation.',
    icon: '🏗️',
    points: 250,
    rarity: 'Rare',
    criteriaVersion: 1,
    criteria: { minLevel: 20 },
  },
  {
    id: 'century_ascendant',
    category: 'progression',
    title: 'Ascendant Century',
    description: 'Reach the pinnacle Level 100 and attain Ascendant citizenship.',
    icon: '⭐',
    points: 1000,
    rarity: 'Mythic',
    criteriaVersion: 1,
    criteria: { minLevel: 100 },
  },
  {
    id: 'active_week',
    category: 'progression',
    title: 'Weekly Dedication',
    description: 'Maintain a verified 7-day active participation streak.',
    icon: '🔥',
    points: 75,
    rarity: 'Common',
    criteriaVersion: 1,
    criteria: { minStreak: 7 },
  },
  {
    id: 'active_month',
    category: 'progression',
    title: 'Monthly Constancy',
    description: 'Maintain a verified 30-day active participation streak.',
    icon: '⚡',
    points: 300,
    rarity: 'Rare',
    criteriaVersion: 1,
    criteria: { minStreak: 30 },
  },
  {
    id: 'century_streak',
    category: 'progression',
    title: 'Centurion Streak',
    description: 'Reach 100 consecutive active calendar days in Arvdoul.',
    icon: '👑',
    points: 1000,
    rarity: 'Legendary',
    criteriaVersion: 1,
    criteria: { minStreak: 100 },
  },

  // Creation
  {
    id: 'first_broadcast',
    category: 'creation',
    title: 'First Signal',
    description: 'Publish your first verified post or spark to the nation.',
    icon: '📡',
    points: 25,
    rarity: 'Common',
    criteriaVersion: 1,
    criteria: { minPosts: 1 },
  },
  {
    id: 'prolific_creator',
    category: 'creation',
    title: 'Prolific Voice',
    description: 'Publish 50 original creations across posts, sparks, and stories.',
    icon: '📜',
    points: 200,
    rarity: 'Uncommon',
    criteriaVersion: 1,
    criteria: { minPosts: 50 },
  },
  {
    id: 'viral_moment',
    category: 'creation',
    title: 'National Resonance',
    description: 'Achieve 1,000 genuine likes across your creations.',
    icon: '💫',
    points: 350,
    rarity: 'Rare',
    criteriaVersion: 1,
    criteria: { minLikes: 1000 },
  },

  // Creator
  {
    id: 'creator_status',
    category: 'creator',
    title: 'Accredited Creator',
    description: 'Complete creator onboarding and obtain verified Creator status.',
    icon: '🎨',
    points: 150,
    rarity: 'Uncommon',
    criteriaVersion: 1,
    criteria: { isCreator: true },
  },
  {
    id: 'first_live_stream',
    category: 'creator',
    title: 'Live Broadcaster',
    description: 'Host your first live broadcast session.',
    icon: '🔴',
    points: 100,
    rarity: 'Uncommon',
    criteriaVersion: 1,
    criteria: { hostedLive: true },
  },

  // Community
  {
    id: 'civic_voter',
    category: 'community',
    title: 'Civic Participant',
    description: 'Participate and cast votes in 5 community proposals or polls.',
    icon: '🗳️',
    points: 100,
    rarity: 'Common',
    criteriaVersion: 1,
    criteria: { pollVotes: 5 },
  },
  {
    id: 'helpful_citizen',
    category: 'community',
    title: 'Guardian of Peace',
    description: 'Provide 25 constructive and verified community comments.',
    icon: '🤝',
    points: 150,
    rarity: 'Uncommon',
    criteriaVersion: 1,
    criteria: { commentsCount: 25 },
  },

  // Exploration & Social
  {
    id: 'nation_explorer',
    category: 'exploration',
    title: 'Nation Explorer',
    description: 'Discover and inspect 20 distinct citizen profiles.',
    icon: '🧭',
    points: 50,
    rarity: 'Common',
    criteriaVersion: 1,
    criteria: { profilesVisited: 20 },
  },
  {
    id: 'social_architect',
    category: 'social',
    title: 'Social Architect',
    description: 'Establish 20 mutual connections in the social graph.',
    icon: '🌐',
    points: 200,
    rarity: 'Rare',
    criteriaVersion: 1,
    criteria: { friendsCount: 20 },
  },

  // Economy
  {
    id: 'first_patron',
    category: 'economy',
    title: 'Generous Patron',
    description: 'Support a creator by sending your first coin gift.',
    icon: '🎁',
    points: 50,
    rarity: 'Common',
    criteriaVersion: 1,
    criteria: { giftsSent: 1 },
  },
  {
    id: 'coin_magnate',
    category: 'economy',
    title: 'Sovereign Reserve',
    description: 'Accumulate a verified total of 2,500 coins earned through creation.',
    icon: '🪙',
    points: 500,
    rarity: 'Rare',
    criteriaVersion: 1,
    criteria: { lifetimeCoinsEarned: 2500 },
  },

  // Citizenship & Historical
  {
    id: 'passport_holder',
    category: 'citizenship',
    title: 'Passport Holder',
    description: 'Establish your official Arvdoul Digital Passport.',
    icon: '📘',
    points: 100,
    rarity: 'Common',
    criteriaVersion: 1,
    criteria: { hasPassport: true },
  },
  {
    id: 'state_noble',
    category: 'citizenship',
    title: 'Crown Recognized',
    description: 'Qualify for and attain the civic rank of Duke or King/Queen.',
    icon: '👑',
    points: 1000,
    rarity: 'Mythic',
    criteriaVersion: 1,
    criteria: { isRoyal: true },
  },
  {
    id: 'founding_pioneer',
    category: 'historical',
    title: 'Pioneer Citizen',
    description: 'One of the founding members of the Arvdoul Digital Nation.',
    icon: '🛡️',
    points: 250,
    rarity: 'Legendary',
    criteriaVersion: 1,
    criteria: { isPioneer: true },
  },
]);

/**
 * Part 2: Standardized Titles Catalog by Domain.
 * Represents recognized civic, creator, community, economic, and historical standing.
 * Strictly non-purchasable with zero pay-to-legitimacy.
 */
const TITLES_CATALOG = Object.freeze({
  // Creation Domain
  creator: {
    id: 'creator',
    domain: 'creation',
    name: 'Creator',
    icon: '🎨',
    description: 'Recognized creator producing original works in Arvdoul.',
    minLevel: 5,
    criteria: { isCreator: true },
  },
  visionary: {
    id: 'visionary',
    domain: 'creation',
    name: 'Visionary',
    icon: '🔮',
    description: 'Forward-thinking creator shaping cultural movements.',
    minLevel: 30,
    criteria: { minLevel: 30, minCreations: 50 },
  },
  builder: {
    id: 'builder',
    domain: 'creation',
    name: 'Builder',
    icon: '🏗️',
    description: 'Active platform contributor building tools and communities.',
    minLevel: 20,
    criteria: { minLevel: 20 },
  },

  // Community Domain
  helper: {
    id: 'helper',
    domain: 'community',
    name: 'Helper',
    icon: '🤝',
    description: 'Trusted citizen supporting newcomers and answering questions.',
    minLevel: 5,
    criteria: { minContribution: 20 },
  },
  mentor: {
    id: 'mentor',
    domain: 'community',
    name: 'Mentor',
    icon: '📜',
    description: 'Guiding light providing educational and community leadership.',
    minLevel: 25,
    criteria: { minContribution: 60, minReputation: 60 },
  },
  community_leader: {
    id: 'community_leader',
    domain: 'community',
    name: 'Community Leader',
    icon: '🏛️',
    description: 'Elected or recognized head of an active Arvdoul community.',
    minLevel: 35,
    criteria: { minContribution: 80, minInfluence: 60 },
  },

  // Civic / Ceremonial Domain (strictly governed by multidimensional criteria)
  resident: {
    id: 'resident',
    domain: 'civic',
    name: 'Resident',
    icon: '🌱',
    description: 'Registered platform resident of Arvdoul.',
    minLevel: 1,
    criteria: { minLevel: 1 },
  },
  citizen: {
    id: 'citizen',
    domain: 'civic',
    name: 'Citizen',
    icon: '🏛️',
    description: 'Full voting citizen of the digital nation.',
    minLevel: 5,
    criteria: { minLevel: 5, minActiveDays: 7 },
  },
  statesperson: {
    id: 'statesperson',
    domain: 'civic',
    name: 'Statesperson',
    icon: '📜',
    description: 'Established civic pillar and trusted community contributor.',
    minLevel: 15,
    criteria: { minLevel: 15, minActiveDays: 30 },
  },
  senator: {
    id: 'senator',
    domain: 'civic',
    name: 'Senator',
    icon: '⚖️',
    description: 'Platform legislative voter and constitutional policy proposer.',
    minLevel: 30,
    criteria: { minLevel: 30, minActiveDays: 90 },
  },
  chancellor: {
    id: 'chancellor',
    domain: 'civic',
    name: 'Chancellor',
    icon: '👑',
    description: 'High governing council member of the nation.',
    minLevel: 60,
    criteria: { minLevel: 60, minActiveDays: 180 },
  },
  duke: {
    id: 'duke',
    domain: 'civic',
    name: 'Duke',
    icon: '⚜️',
    description: 'Noble rank requiring proven reputation, high contribution, and sustained active days.',
    minLevel: 70,
    criteria: ROYAL_ELIGIBILITY.duke,
  },
  king: {
    id: 'king',
    domain: 'civic',
    name: 'King / Queen',
    icon: '👑',
    description: 'Highest ceremonial sovereign rank. Demands apex trust, exceptional civic contribution, and years of standing.',
    minLevel: 90,
    criteria: ROYAL_ELIGIBILITY.king,
  },

  // Historical Domain
  founder: {
    id: 'founder',
    domain: 'historical',
    name: 'Founding Citizen',
    icon: '⭐',
    description: 'Pioneer citizen present during Arvdoul genesis.',
    minLevel: 1,
    criteria: { isFounder: true },
  },
  pioneer: {
    id: 'pioneer',
    domain: 'historical',
    name: 'Pioneer',
    icon: '🛡️',
    description: 'Early adopter who shaped the early network.',
    minLevel: 1,
    criteria: { isPioneer: true },
  },
});

/**
 * Public Reputation Standing Bands.
 * Measures trust, integrity, conduct, and reliability.
 * Internal security and risk formulas remain unexposed.
 */
const REPUTATION_BANDS = Object.freeze([
  { minScore: 90, label: 'Exceptional', color: 'emerald', description: 'Impeccable conduct, verified authenticity, trusted community pillar.' },
  { minScore: 75, label: 'Highly Trusted', color: 'blue', description: 'Consistently positive track record and high integrity.' },
  { minScore: 60, label: 'Trusted', color: 'cyan', description: 'Established positive platform history and good standing.' },
  { minScore: 40, label: 'Established', color: 'indigo', description: 'Active citizen with verified account integrity.' },
  { minScore: 20, label: 'Developing', color: 'amber', description: 'Building trust and community participation.' },
  { minScore: 0,  label: 'Unestablished', color: 'slate', description: 'New account or unverified conduct record.' },
]);

function getReputationBand(score = 0) {
  const num = Math.max(0, Math.min(100, Number(score) || 0));
  for (const band of REPUTATION_BANDS) {
    if (num >= band.minScore) return band;
  }
  return REPUTATION_BANDS[REPUTATION_BANDS.length - 1];
}

/**
 * Influence Bands: Genuine reach and impact (not raw followers).
 */
const INFLUENCE_BANDS = Object.freeze([
  { minScore: 85, label: 'National Reach', color: 'fuchsia' },
  { minScore: 70, label: 'Community Beacon', color: 'purple' },
  { minScore: 50, label: 'Resonant Voice', color: 'blue' },
  { minScore: 25, label: 'Growing Presence', color: 'cyan' },
  { minScore: 0,  label: 'Emerging', color: 'slate' },
]);

function getInfluenceBand(score = 0) {
  const num = Math.max(0, Math.min(100, Number(score) || 0));
  for (const band of INFLUENCE_BANDS) {
    if (num >= band.minScore) return band;
  }
  return INFLUENCE_BANDS[INFLUENCE_BANDS.length - 1];
}

/**
 * Contribution Bands: Ecosystem value (not money spent).
 */
const CONTRIBUTION_BANDS = Object.freeze([
  { minScore: 85, label: 'Pillar of Arvdoul', color: 'emerald' },
  { minScore: 70, label: 'Distinguished Contributor', color: 'teal' },
  { minScore: 50, label: 'Active Helper', color: 'green' },
  { minScore: 25, label: 'Community Contributor', color: 'cyan' },
  { minScore: 0,  label: 'Participant', color: 'slate' },
]);

function getContributionBand(score = 0) {
  const num = Math.max(0, Math.min(100, Number(score) || 0));
  for (const band of CONTRIBUTION_BANDS) {
    if (num >= band.minScore) return band;
  }
  return CONTRIBUTION_BANDS[CONTRIBUTION_BANDS.length - 1];
}

/**
 * Creator Tiers & Classification.
 */
const CREATOR_TIERS = Object.freeze({
  standard: { id: 'standard', name: 'Standard Citizen', commissionRate: 0.15 },
  creator: { id: 'creator', name: 'Accredited Creator', commissionRate: 0.12 },
  advanced: { id: 'advanced', name: 'Advanced Creator', commissionRate: 0.10 },
  professional: { id: 'professional', name: 'Professional Creator', commissionRate: 0.08 },
  elite: { id: 'elite', name: 'Elite Creator', commissionRate: 0.06 },
  partner: { id: 'partner', name: 'Partner Creator', commissionRate: 0.05 },
});

/**
 * Financial Ledger Transaction States (Blueprint §39).
 */
const TRANSACTION_STATES = Object.freeze({
  INITIATED: 'INITIATED',
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
  DISPUTED: 'DISPUTED',
  HELD: 'HELD',
});

/**
 * Prestige info beyond Level 100.
 */
function getPrestigeInfo(level = 1) {
  const lvl = Math.max(1, Number(level) || 1);
  if (lvl <= 100) return { isPrestige: false, prestigeRank: 0, prestigeRoman: null };
  const prestigeRank = Math.floor((lvl - 100) / 10) + 1;
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][prestigeRank - 1] || `${prestigeRank}`;
  return { isPrestige: true, prestigeRank, prestigeRoman: roman };
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
  ACHIEVEMENTS_CATALOG,
  TITLES_CATALOG,
  REPUTATION_BANDS,
  INFLUENCE_BANDS,
  CONTRIBUTION_BANDS,
  CREATOR_TIERS,
  TRANSACTION_STATES,
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
  getReputationBand,
  getInfluenceBand,
  getContributionBand,
  getPrestigeInfo,
};
