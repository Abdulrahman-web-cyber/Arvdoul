/**
 * src/services/levelSystemService.js
 * ARVDOUL LEVEL SYSTEM — real XP progression engine
 *
 * The platform already stored `user.level` / `user.experience` /
 * `user.experienceToNextLevel` and monetizationService.getUserLevel()
 * could READ a static 15-level table — but NOTHING ever awarded XP or
 * computed level-ups. This service is that missing system:
 *
 *  - XP award rules per action (posts, comments, likes, follows, login…)
 *  - Level curve aligned 1:1 with the monetization LEVELS table
 *    (xpRequired + coinReward), so getUserLevel() stays consistent
 *  - Atomic Firestore transaction: XP += amount, detect level-up(s),
 *    persist level + experience + experienceToNextLevel, credit coin
 *    rewards (idempotency-keyed)
 *  - Per-action daily XP caps (anti-farming) + per-call idempotency
 *  - Honest rank titles + real feature perks (live ≥5 matches
 *    liveService, withdrawals ≥10 matches WITHDRAWAL_MIN_LEVEL)
 *  - Pure helpers (getLevelInfo) fully unit-tested
 */

import { logger } from '../utils/Logger.js';

/** Level curve — 100 levels scaling progressively with mathematical consistency. */
export const LEVELS = Array.from({ length: 100 }, (_, i) => {
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

/** Honest rank titles per level band across all 100 levels. */
export const RANK_TITLES = [
  { minLevel: 1, title: 'Newcomer' },
  { minLevel: 3, title: 'Explorer' },
  { minLevel: 5, title: 'Creator' },
  { minLevel: 7, title: 'Rising Star' },
  { minLevel: 10, title: 'Pro Creator' },
  { minLevel: 13, title: 'Elite Creator' },
  { minLevel: 15, title: 'Arvdoul Legend' },
  { minLevel: 25, title: 'Vanguard' },
  { minLevel: 40, title: 'Sovereign' },
  { minLevel: 55, title: 'Apex Creator' },
  { minLevel: 70, title: 'Paragon' },
  { minLevel: 85, title: 'Ascendant' },
  { minLevel: 100, title: 'Transcendent Legend' },
];

/**
 * Digital Citizenship tiers for platform governance, democratic participation,
 * and nation standing.
 */
export const CITIZEN_TIERS = [
  { minLevel: 1, minDays: 0, tier: 'Resident', icon: '🌱', description: 'Registered Arvdoul platform resident' },
  { minLevel: 5, minDays: 7, tier: 'Citizen', icon: '🏛️', description: 'Full democratic voting and community participant' },
  { minLevel: 15, minDays: 30, tier: 'Statesperson', icon: '📜', description: 'Established community pillar and trusted contributor' },
  { minLevel: 30, minDays: 90, tier: 'Senator', icon: '⚖️', description: 'Platform legislative voter and policy proposer' },
  { minLevel: 60, minDays: 180, tier: 'Chancellor', icon: '👑', description: 'High governing council member' },
  { minLevel: 100, minDays: 365, tier: 'Founder', icon: '⭐', description: 'Permanent Founding Citizen of Arvdoul' },
];

/** Pure: resolve citizen tier from level and active days. */
export function getCitizenTier(level = 1, activeDaysCount = 0) {
  let matched = CITIZEN_TIERS[0];
  for (const c of CITIZEN_TIERS) {
    if (level >= c.minLevel || activeDaysCount >= c.minDays) {
      matched = c;
    }
  }
  return matched;
}

/**
 * Decouples creator capabilities from raw XP grinding.
 * Allows creators with approved status, creator tier, or minimum audience
 * to stream, monetize, sell in shop, and receive tips without needing raw level 10.
 */
export function getCreatorCapabilities(profile) {
  if (!profile) {
    return {
      isCreator: false,
      creatorTier: 'standard',
      canStream: false,
      canMonetize: false,
      canReceiveTips: false,
      canWithdraw: false,
      canCreateShop: false,
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
    // Live streaming: Available to all creators or anyone level >= 5
    canStream: isCreator || level >= 5,
    canStreamLive: isCreator || level >= 5,
    // Monetization: Available to creators or anyone level >= 5
    canMonetize: isCreator || tier === 'creator' || tier === 'partner' || level >= 5,
    // Tips: Available to any creator, or users with >= 10 followers, or level >= 3
    canReceiveTips: isCreator || followers >= 10 || level >= 3,
    // Creator Shop: Available to creators or level >= 3
    canCreateShop: isCreator || level >= 3,
    canSellMerch: isCreator || level >= 3,
    // Payouts & withdrawals: Available to verified creators, partner tier, or level >= 10
    canWithdraw: isVerified || tier === 'partner' || tier === 'elite' || level >= 10,
  };
}

/**
 * Real feature perks unlocked by level across the 100-level roadmap.
 */
export const LEVEL_PERKS = [
  { minLevel: 2, icon: '🎨', title: 'Advanced Editor', description: 'Unlock the full video & audio editor suite.' },
  { minLevel: 5, icon: '🔴', title: 'Live Streaming', description: 'Go live to your followers with viewer chat.' },
  { minLevel: 7, icon: '🎁', title: 'Gift & Tip Boost', description: 'Higher daily gift/tip earning multiplier.' },
  { minLevel: 10, icon: '💸', title: 'Creator Withdrawals', description: 'Withdraw your coin earnings to real money.' },
  { minLevel: 12, icon: '🏷️', title: 'Custom Badge', description: 'Personalize your profile badge color.' },
  { minLevel: 15, icon: '👑', title: 'Verified Priority', description: 'Priority support and verification review.' },
  { minLevel: 20, icon: '⚡', title: 'Early Access Studio', description: 'Beta access to new AI generative creator tools.' },
  { minLevel: 30, icon: '🏛️', title: 'Citizen Council', description: 'Submit and vote on constitutional governance proposals.' },
  { minLevel: 50, icon: '💎', title: 'Arvdoul Sovereign', description: 'Exclusive diamond avatar border and sovereign crest.' },
  { minLevel: 75, icon: '🪐', title: 'Nation Founder Circle', description: 'Host platform-wide global events and spaces.' },
  { minLevel: 100, icon: '🌟', title: 'Transcendent Legend', description: 'Permanent monument in Arvdoul Hall of Fame.' },
];

/**
 * XP award rules (per unit of the action). `dailyCap` prevents farming.
 */
export const XP_RULES = Object.freeze({
  post_created: { xp: 10, dailyCap: 100 },
  comment_created: { xp: 5, dailyCap: 50 },
  like_received: { xp: 1, dailyCap: 50 },
  follow_received: { xp: 15, dailyCap: 150 },
  daily_login: { xp: 20, dailyCap: 20 },
  gift_received: { xp: 2, dailyCap: 100 },
  live_minute: { xp: 1, dailyCap: 60 },
});

const MAX_LEVEL = LEVELS[LEVELS.length - 1].level;

/** Pure: rank title for a level. */
export function getRankTitle(level) {
  let title = RANK_TITLES[0].title;
  for (const rank of RANK_TITLES) {
    if (level >= rank.minLevel) title = rank.title;
  }
  return title;
}

/** Pure: perks unlocked at a level. */
export function getPerksForLevel(level) {
  return LEVEL_PERKS.filter((p) => level >= p.minLevel);
}

/**
 * Pure: compute level info from total XP.
 * @param {number} experience - total lifetime XP
 * @returns {{ level, title, currentLevelXp, nextLevelXp, xpIntoLevel, xpToNext, progress, isMaxLevel }}
 */
export function getLevelInfo(experience) {
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
export function getLifetimeRewards(level) {
  return LEVELS.filter((l) => l.level <= level).reduce((sum, l) => sum + l.coinReward, 0);
}

class LevelSystemService {
  constructor() {
    this._cache = new Map(); // userId -> levelInfo (short TTL, invalidated on award)
  }

  _cacheKey(userId) {
    return `level_${userId}`;
  }

  /** Read-only level info (cached 60s). Pure math; never throws. */
  async getLevelInfo(userId) {
    if (!userId) return getLevelInfo(0);
    const cached = this._cache.get(this._cacheKey(userId));
    if (cached && Date.now() - cached.at < 60_000) return cached.info;

    try {
      const { getFirestoreInstance } = await import('../firebase/firebase.js');
      const fstore = await import('firebase/firestore');
      const db = await getFirestoreInstance();
      const snap = await fstore.getDoc(fstore.doc(db, 'users', userId));
      const experience = snap.exists() ? snap.data().experience || 0 : 0;
      const info = getLevelInfo(experience);
      this._cache.set(this._cacheKey(userId), { info, at: Date.now() });
      return info;
    } catch (err) {
      logger.warn('[LevelSystem] Level info unavailable - returning base info:', { error: err.message });
      return getLevelInfo(0);
    }
  }

  /**
   * Awards XP for an action and processes level-ups atomically.
   *
   * Prefers the server-authoritative Cloud Function
   * (`functions/levelSystem.js awardExperience`) so XP cannot be farmed by
   * tampering with client code; falls back to the local atomic transaction
   * when the function is unreachable (offline / local dev).
   *
   * @param {Object} opts
   * @param {string} opts.userId
   * @param {keyof XP_RULES} opts.action
   * @param {number} [opts.count=1]
   * @param {string} [opts.source] - entity id (post/comment/etc) for idempotency
   * @returns {Promise<{success: boolean, xpAwarded: number, leveledUp: boolean,
   *                   newLevel: number, coinReward: number, info: Object}>}
   */
  async awardExperience({ userId, action, count = 1, source = null }) {
    const rule = XP_RULES[action];
    if (!rule) {
      throw new Error(`LEVEL_UNKNOWN_ACTION: "${action}" is not a registered XP action`);
    }
    if (!userId) throw new Error('LEVEL_NO_USER: userId is required');

    // Server-authoritative path first (best-effort, never blocks the caller).
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const func = httpsCallable(getFunctions(), 'awardExperience');
        const res = await func({ action, count, source });
        const data = res.data;
        if (data && data.success) {
          this._cache.delete(this._cacheKey(userId));
          if (data.leveledUp) {
            logger.info('[LevelSystem] Level up (server)!', {
              userId,
              newLevel: data.newLevel,
              coinReward: data.coinReward,
            });
          }
          return data;
        }
      } catch (err) {
        logger.warn('[LevelSystem] Server award unavailable - falling back to local transaction:', {
          error: err.message,
        });
      }
    }

    // Idempotency: same action+source within 24h must not re-award.
    const idempotencyKey = source ? `${action}:${source}` : null;

    try {
      const { getFirestoreInstance } = await import('../firebase/firebase.js');
      const fstore = await import('firebase/firestore');
      const db = await getFirestoreInstance();

      const userRef = fstore.doc(db, 'users', userId);
      let result = null;

      await fstore.runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef);
        const data = userSnap.exists() ? userSnap.data() : {};

        // 1. Daily cap enforcement (anti-farming) - the counter tracks XP,
        //    so the cap is compared in XP units.
        const today = new Date().toISOString().slice(0, 10);
        const counters = data.xpCounters || {};
        const todayEntry = counters[today] || {};
        const usedTodayXp = todayEntry[action] || 0;
        const cap = rule.dailyCap;
        const allowed = Math.max(0, Math.min(count, Math.floor((cap - usedTodayXp) / rule.xp)));
        if (allowed <= 0) {
          result = {
            success: true,
            xpAwarded: 0,
            leveledUp: false,
            newLevel: data.level || 1,
            coinReward: 0,
            capped: true,
          };
          return;
        }

        // 2. Idempotency check
        const recent = data.xpAwards || {};
        if (idempotencyKey && recent[idempotencyKey] === today) {
          result = {
            success: true,
            xpAwarded: 0,
            leveledUp: false,
            newLevel: data.level || 1,
            coinReward: 0,
            duplicate: true,
          };
          return;
        }

        // 3. Apply XP
        const xpAwarded = allowed * rule.xp;
        const experience = (data.experience || 0) + xpAwarded;
        const before = getLevelInfo(data.experience || 0);
        const after = getLevelInfo(experience);
        const leveledUp = after.level > before.level;
        const coinReward = leveledUp
          ? LEVELS.filter((l) => l.level > before.level && l.level <= after.level).reduce(
              (sum, l) => sum + l.coinReward,
              0
            )
          : 0;

        // 4. Persist atomically
        const patch = {
          experience,
          level: after.level,
          experienceToNextLevel: after.isMaxLevel ? null : after.xpToNext,
          updatedAt: fstore.serverTimestamp(),
        };
        if (idempotencyKey) {
          patch[`xpAwards.${idempotencyKey}`] = today;
        }
        const nextCounters = { ...counters };
        nextCounters[today] = { ...todayEntry, [action]: usedTodayXp + xpAwarded };
        patch.xpCounters = nextCounters;
        if (leveledUp) patch.lastLevelUpAt = fstore.serverTimestamp();

        tx.set(userRef, patch, { merge: true });

        // 5. Credit coin rewards (same transaction, keeps ledger atomic)
        if (coinReward > 0) {
          const ledgerRef = fstore.doc(db, 'coin_ledger', `${userId}_levelup_${after.level}_${Date.now()}`);
          tx.set(ledgerRef, {
            userId,
            amount: coinReward,
            type: 'level_up_reward',
            reason: `Level ${after.level} reward`,
            createdAt: fstore.serverTimestamp(),
          });
          tx.set(userRef, { coins: fstore.increment(coinReward) }, { merge: true });
        }

        result = {
          success: true,
          xpAwarded,
          leveledUp,
          newLevel: after.level,
          coinReward,
          info: after,
        };
      });

      this._cache.delete(this._cacheKey(userId));
      if (result.leveledUp) {
        logger.info('[LevelSystem] Level up!', {
          userId,
          newLevel: result.newLevel,
          coinReward: result.coinReward,
        });
      }
      return result;
    } catch (err) {
      logger.error('[LevelSystem] Award XP failed:', { error: err.message, userId, action });
      throw err;
    }
  }

  /** Invalidates the cached level for a user. */
  invalidate(userId) {
    this._cache.delete(this._cacheKey(userId));
  }

  /**
   * Server-authoritative daily active day ledger and continuous streak tracking.
   * Atomic Firestore transaction: checks lastActiveDay vs today/yesterday,
   * updates activeStreak and activeDaysCount, writes to active_days_ledger collection,
   * and awards daily_login XP.
   *
   * @param {Object} opts
   * @param {string} opts.userId
   * @returns {Promise<{success: boolean, activeStreak: number, activeDaysCount: number, alreadyRecordedToday: boolean}>}
   */
  async recordActiveDay({ userId }) {
    if (!userId) return { success: false, error: 'User ID required' };

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const yesterdayDate = new Date(Date.now() - 86400000);
    const yesterday = yesterdayDate.toISOString().slice(0, 10);

    // Try Cloud Function callable first if available
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { getFunctions, httpsCallable } = await import('firebase/functions');
        const func = httpsCallable(getFunctions(), 'recordActiveDay');
        const res = await func({ userId });
        if (res.data?.success) {
          this._cache.delete(this._cacheKey(userId));
          return res.data;
        }
      } catch (err) {
        // Fallback to atomic Firestore transaction
      }
    }

    try {
      const { getFirestoreInstance } = await import('../firebase/firebase.js');
      const fstore = await import('firebase/firestore');
      const db = await getFirestoreInstance();

      const userRef = fstore.doc(db, 'users', userId);
      const ledgerRef = fstore.doc(db, 'active_days_ledger', `${userId}_${today}`);

      let result = null;

      await fstore.runTransaction(db, async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) return;

        const data = userSnap.data();
        const lastActiveDay = data.lastActiveDay || null;

        // If already logged today, keep existing streak
        if (lastActiveDay === today) {
          result = {
            success: true,
            activeStreak: data.activeStreak || 1,
            activeDaysCount: data.activeDaysCount || 1,
            alreadyRecordedToday: true,
            lastActiveDay: today,
          };
          return;
        }

        let newStreak = 1;
        if (lastActiveDay === yesterday) {
          // Consecutive day active!
          newStreak = (data.activeStreak || 0) + 1;
        } else {
          // Streak reset or fresh start
          newStreak = 1;
        }

        const newDaysCount = (data.activeDaysCount || 0) + 1;

        // Write immutable ledger entry for auditability
        tx.set(ledgerRef, {
          uid: userId,
          userId,
          date: today,
          streak: newStreak,
          totalDays: newDaysCount,
          status: 'verified',
          createdAt: fstore.serverTimestamp(),
        }, { merge: true });

        // Update user document with server-authoritative fields
        tx.set(userRef, {
          lastActiveDay: today,
          activeStreak: newStreak,
          activeDaysCount: newDaysCount,
          lastActive: fstore.serverTimestamp(),
          updatedAt: fstore.serverTimestamp(),
        }, { merge: true });

        result = {
          success: true,
          activeStreak: newStreak,
          activeDaysCount: newDaysCount,
          alreadyRecordedToday: false,
          lastActiveDay: today,
        };
      });

      // Best effort: award daily_login XP if not already recorded today
      if (result && !result.alreadyRecordedToday) {
        try {
          await this.awardExperience({ userId, action: 'daily_login', source: today });
        } catch {}
      }

      this._cache.delete(this._cacheKey(userId));
      return result || { success: false };
    } catch (err) {
      logger.warn('[LevelSystem] recordActiveDay fallback failed:', { error: err.message });
      return { success: false, error: err.message };
    }
  }
}

export const levelSystemService = new LevelSystemService();
export default levelSystemService;
