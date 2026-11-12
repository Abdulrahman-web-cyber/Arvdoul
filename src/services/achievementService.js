// src/services/achievementService.js
//
// Server-validated, idempotent, categorized, auditable, and persistent.

import { ACHIEVEMENTS_CATALOG } from './levelSystemService.js';
import { callFunction, FUNCTIONS } from './callableService.js';
import { getFirestoreInstance } from '../firebase/firebase.js';
import { collection, getDocs, query, limit } from "firebase/firestore";
import { logger } from '../utils/Logger.js';

// Hard ceiling for a user's earned-achievements list read.
const ACHIEVEMENTS_MAX_READ = 200;

class AchievementService {
  constructor() {
    this._cache = new Map(); // userId -> { items, timestamp }
    this.TTL_MS = 60_000;
  }

  /**
   * Returns the static canonical catalog of all registered achievements.
   */
  getCatalog() {
    return ACHIEVEMENTS_CATALOG;
  }

  /**
   * Group the catalog by categories: progression, creation, creator, community,
   * exploration, social, economy, citizenship, historical.
   */
  getCatalogByCategory() {
    const grouped = {};
    for (const ach of ACHIEVEMENTS_CATALOG) {
      if (!grouped[ach.category]) grouped[ach.category] = [];
      grouped[ach.category].push(ach);
    }
    return grouped;
  }

  /**
   * Fetch a user's earned achievements from the authoritative subcollection.
   * @param {string} userId
   * @returns {Promise<Array<Object>>}
   */
  async getUserAchievements(userId) {
    if (!userId) return [];

    const cached = this._cache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.TTL_MS) {
      return cached.items;
    }

    try {
      const db = await getFirestoreInstance();
      const colRef = collection(db, 'achievements', userId, 'items');
      const snap = await getDocs(query(colRef, limit(ACHIEVEMENTS_MAX_READ)));

      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        earnedAt: d.data().earnedAt?.toDate?.() || null,
      }));

      this._cache.set(userId, { items, timestamp: Date.now() });
      return items;
    } catch (err) {
      logger.warn('[AchievementService] Failed to load user achievements:', { userId, error: err.message });
      return [];
    }
  }

  /**
   * Pure evaluation helper: blends user earned items or metrics with catalog to return enriched achievements.
   * @param {Array<Object>} earned
   * @param {Object} userStats
   * @returns {Array<Object>}
   */
  enrichAchievements(earned = [], userStats = {}) {
    const earnedMap = new Map((earned || []).map((e) => [e.id, e]));

    return ACHIEVEMENTS_CATALOG.map((ach) => {
      const isEarned = earnedMap.has(ach.id);
      const userEarnedData = isEarned ? earnedMap.get(ach.id) : null;

      // Progress percentage is only meaningful for a numeric-ratio criterion
      // (level, streak, posts, likes, comments, friends). A boolean/gate
      // criterion (isCreator, isRoyal, hostedLive, hasPassport, …) has no
      // measurable fraction, so its progress stays `null` (unknown) rather than
      // a fabricated `0%` that claims a measured empty run.
      let progress = isEarned ? 100 : null;
      if (!isEarned && ach.criteria) {
        const c = ach.criteria;
        const ratio = (current, target) => {
          const cur = Number(current);
          const tgt = Number(target);
          if (!Number.isFinite(cur) || cur <= 0 || !Number.isFinite(tgt) || tgt <= 0) return null;
          return Math.min(100, Math.round((cur / tgt) * 100));
        };
        if (c.minLevel) progress = ratio(userStats.level, c.minLevel);
        else if (c.minStreak) progress = ratio(userStats.activeStreak, c.minStreak);
        else if (c.minPosts) progress = ratio(userStats.postsCount ?? userStats.postCount, c.minPosts);
        else if (c.minLikes) progress = ratio(userStats.likesCount, c.minLikes);
        else if (c.commentsCount) progress = ratio(userStats.commentsCount, c.commentsCount);
        else if (c.friendsCount) progress = ratio(userStats.friendsCount, c.friendsCount);
      }

      const unlocked = isEarned || progress === 100;

      return {
        ...ach,
        unlocked,
        earnedAt: userEarnedData?.earnedAt || null,
        progress,
      };
    });
  }

  /**
   * Merge the catalog with user's earned items to produce complete gallery state
   * (unlocked vs locked with criteria and progress).
   */
  async getEnrichedAchievements(userId, userStats = {}) {
    const earned = await this.getUserAchievements(userId);
    return this.enrichAchievements(earned, userStats);
  }

  /**
   * Triggers server-authoritative achievement evaluation.
   * Idempotent: checks criteria server-side and awards only newly earned items.
   */
  async evaluateAchievements(userId) {
    if (!userId) return { newlyEarnedCount: 0, newlyEarned: [] };

    try {
      const res = await callFunction(FUNCTIONS.EVALUATE_ACHIEVEMENTS, {});
      if (res?.success) {
        this._cache.delete(userId);
        return res;
      }
      return { newlyEarnedCount: 0, newlyEarned: [] };
    } catch (err) {
      logger.warn('[AchievementService] evaluateAchievements failed:', err?.message);
      return { newlyEarnedCount: 0, newlyEarned: [], error: err.message };
    }
  }

  /**
   * Invalidate local cache for a user.
   */
  invalidate(userId) {
    if (userId) this._cache.delete(userId);
  }
}

export const achievementService = new AchievementService();
export default achievementService;
