// src/services/levelSystemService.js

import { logger } from '../utils/Logger.js';
import {
  LEVELS,
  RANK_TITLES,
  CITIZEN_TIERS,
  LEVEL_PERKS,
  XP_RULES,
  LEVEL_GATES,
  ROYAL_ELIGIBILITY,
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
  getPrestigeInfo,
} from '../shared/levelConfig.cjs';

// The curve, reward tables, XP rules and gating thresholds live in ONE place:
// src/shared/levelConfig.cjs, which is also required by functions/levelSystem.js.
// Re-export them so existing imports (`from '../services/levelSystemService'`)
// keep working without a second copy drifting out of sync.
export {
  LEVELS,
  RANK_TITLES,
  CITIZEN_TIERS,
  LEVEL_PERKS,
  XP_RULES,
  LEVEL_GATES,
  ROYAL_ELIGIBILITY,
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
   * tampering with client code. There is no local fallback: if the function is
   * unreachable the award fails and the caller retries later.
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
        logger.warn('[LevelSystem] Server award unavailable:', { error: err.message });
      }
    }

    // No client-side fallback. XP, level and coin balances are
    // server-authoritative: a client transaction could be forged or replayed,
    // so if the callable is unreachable the award is refused rather than
    // applied locally. Callers surface this as a retryable error.
    throw new Error(
      'LEVEL_SERVER_UNAVAILABLE: XP awards require the awardExperience Cloud Function.'
    );
  }

  /** Invalidates the cached level for a user. */
  invalidate(userId) {
    this._cache.delete(this._cacheKey(userId));
  }

  /**
   * Records today's activity and advances the streak. Delegates entirely to the
   * `recordActiveDay` Cloud Function: the streak counters and the
   * active_days_ledger audit entry are server-authoritative, so there is no
   * client-side path that can fabricate an active day.
   *
   * @param {Object} opts
   * @param {string} opts.userId
   * @returns {Promise<{success: boolean, activeStreak: number, activeDaysCount: number, alreadyRecordedToday: boolean}>}
   */
  async recordActiveDay({ userId }) {
    if (!userId) return { success: false, error: 'User ID required' };

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
        logger.warn('[LevelSystem] recordActiveDay callable failed:', { error: err.message });
      }
    }

    // Active-day and streak counters are server-authoritative; the callable
    // above is the only permitted writer.
    throw new Error(
      'LEVEL_SERVER_UNAVAILABLE: active-day recording requires the recordActiveDay Cloud Function.'
    );
  }
}

export const levelSystemService = new LevelSystemService();
export default levelSystemService;
