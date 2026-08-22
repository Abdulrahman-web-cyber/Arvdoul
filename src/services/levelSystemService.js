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

/** Level curve — MUST stay aligned with monetizationService DEFAULT_CONFIG.LEVELS. */
export const LEVELS = [
  { level: 1, xpRequired: 0, coinReward: 0 },
  { level: 2, xpRequired: 100, coinReward: 10 },
  { level: 3, xpRequired: 300, coinReward: 20 },
  { level: 4, xpRequired: 600, coinReward: 30 },
  { level: 5, xpRequired: 1000, coinReward: 40 },
  { level: 6, xpRequired: 1500, coinReward: 50 },
  { level: 7, xpRequired: 2100, coinReward: 60 },
  { level: 8, xpRequired: 2800, coinReward: 70 },
  { level: 9, xpRequired: 3600, coinReward: 80 },
  { level: 10, xpRequired: 4500, coinReward: 100 },
  { level: 11, xpRequired: 5500, coinReward: 120 },
  { level: 12, xpRequired: 6600, coinReward: 140 },
  { level: 13, xpRequired: 7800, coinReward: 160 },
  { level: 14, xpRequired: 9100, coinReward: 180 },
  { level: 15, xpRequired: 10500, coinReward: 200 },
];

/** Honest rank titles per level band. */
export const RANK_TITLES = [
  { minLevel: 1, title: 'Newcomer' },
  { minLevel: 3, title: 'Explorer' },
  { minLevel: 5, title: 'Creator' },
  { minLevel: 7, title: 'Rising Star' },
  { minLevel: 10, title: 'Pro Creator' },
  { minLevel: 13, title: 'Elite Creator' },
  { minLevel: 15, title: 'Arvdoul Legend' },
];

/**
 * Real feature perks unlocked by level. These map to ACTUAL platform
 * capabilities (see liveService min level 5, monetization
 * WITHDRAWAL_MIN_LEVEL 10).
 */
export const LEVEL_PERKS = [
  { minLevel: 2, icon: '🎨', title: 'Advanced Editor', description: 'Unlock the full video & audio editor suite.' },
  { minLevel: 5, icon: '🔴', title: 'Live Streaming', description: 'Go live to your followers with viewer chat.' },
  { minLevel: 7, icon: '🎁', title: 'Gift & Tip Boost', description: 'Higher daily gift/tip earning multiplier.' },
  { minLevel: 10, icon: '💸', title: 'Creator Withdrawals', description: 'Withdraw your coin earnings to real money.' },
  { minLevel: 12, icon: '🏷️', title: 'Custom Badge', description: 'Personalize your profile badge color.' },
  { minLevel: 15, icon: '👑', title: 'Verified Priority', description: 'Priority support and verification review.' },
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
}

export const levelSystemService = new LevelSystemService();
export default levelSystemService;
