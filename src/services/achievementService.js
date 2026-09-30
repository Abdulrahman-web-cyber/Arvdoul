// src/services/achievementService.js — ARVDOUL ACHIEVEMENTS ENGINE (Part 2)
// Server-validated, idempotent, categorized, auditable, and persistent.

import { ACHIEVEMENTS_CATALOG } from './levelSystemService.js';
import { callFunction, FUNCTIONS } from './callableService.js';
import { getFirestoreInstance } from '../firebase/firebase.js';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { logger } from '../utils/Logger.js';

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
      const snap = await getDocs(colRef);

      const items = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        // A missing grant timestamp stays unknown; never stamp "now".
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
   * Resolves the canonical metric for an achievement's criteria from known
   * user stats. Returns `{ current: null }` whenever the metric is unknown so
   * callers fail closed rather than fabricating a zero.
   */
  getCriteriaMetric(ach, userStats = {}) {
    const c = ach?.criteria;
    const pick = (keys) => {
      for (const k of keys) {
        if (userStats[k] !== undefined && userStats[k] !== null) return userStats[k];
      }
      return null;
    };
    if (!c) return { current: null, target: null };
    if (c.minLevel) return { current: pick(['level']), target: c.minLevel };
    if (c.minStreak) return { current: pick(['activeStreak', 'longestStreak']), target: c.minStreak };
    if (c.minPosts) return { current: pick(['postsCount', 'postCount']), target: c.minPosts };
    if (c.minLikes) return { current: pick(['likesCount']), target: c.minLikes };
    if (c.commentsCount) return { current: pick(['commentsCount']), target: c.commentsCount };
    if (c.friendsCount) return { current: pick(['friendsCount']), target: c.friendsCount };
    return { current: null, target: null };
  }

  /**
   * Threshold satisfaction from known metrics only. An unknown metric can
   * never satisfy a requirement.
   */
  isSatisfied(ach, userStats = {}) {
    const { current, target } = this.getCriteriaMetric(ach, userStats);
    if (current === null || target === null || target <= 0) return false;
    const c = Number(current);
    const t = Number(target);
    if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0) return false;
    return c >= t;
  }

  /**
   * Pure evaluation helper: blends user earned items or metrics with catalog to return enriched achievements.
   * @param {Array<Object>} earned
   * @param {Object} userStats
   * @returns {Array<Object>}
   */
  enrichAchievements(earned = [], userStats = {}) {
    const earnedMap = new Map((earned || []).map((e) => [e.id, e]));

    // Null-safe progress. A metric that is unknown (null/undefined) yields a
    // null progress rather than a fabricated 0 or a ratio built from an assumed
    // default. Only known values produce a real percentage.
    const ratio = (current, target) => {
      if (target === null || target === undefined || target <= 0) return null;
      if (current === null || current === undefined) return null;
      const c = Number(current);
      const t = Number(target);
      if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0) return null;
      return Math.min(100, Math.round((c / t) * 100));
    };

    return ACHIEVEMENTS_CATALOG.map((ach) => {
      const isEarned = earnedMap.has(ach.id);
      const userEarnedData = isEarned ? earnedMap.get(ach.id) : null;

      // Calculate progress percentage where applicable
      let progress = isEarned ? 100 : null;
      if (!isEarned) {
        const { current, target } = this.getCriteriaMetric(ach, userStats);
        progress = ratio(current, target);
      }

      // Unlocked when the server granted the achievement, or when a known
      // metric has crossed the threshold. An unknown metric (null progress)
      // can never satisfy the threshold, so it stays locked.
      const unlocked = isEarned || (progress !== null && progress >= 100);

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
