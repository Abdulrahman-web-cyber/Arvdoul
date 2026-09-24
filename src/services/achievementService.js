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
        earnedAt: d.data().earnedAt?.toDate?.() || new Date(),
      }));

      this._cache.set(userId, { items, timestamp: Date.now() });
      return items;
    } catch (err) {
      logger.warn('[AchievementService] Failed to load user achievements:', { userId, error: err.message });
      return [];
    }
  }

  /**
   * Merge the catalog with user's earned items to produce complete gallery state
   * (unlocked vs locked with criteria and progress).
   */
  async getEnrichedAchievements(userId, userStats = {}) {
    const earned = await this.getUserAchievements(userId);
    const earnedMap = new Map(earned.map((e) => [e.id, e]));

    return ACHIEVEMENTS_CATALOG.map((ach) => {
      const isEarned = earnedMap.has(ach.id);
      const userEarnedData = isEarned ? earnedMap.get(ach.id) : null;

      // Calculate progress percentage where applicable
      let progress = isEarned ? 100 : 0;
      if (!isEarned && ach.criteria) {
        const c = ach.criteria;
        if (c.minLevel) {
          progress = Math.min(100, Math.round(((userStats.level || 1) / c.minLevel) * 100));
        } else if (c.minStreak) {
          progress = Math.min(100, Math.round(((userStats.activeStreak || 0) / c.minStreak) * 100));
        } else if (c.minPosts) {
          progress = Math.min(100, Math.round(((userStats.postsCount || userStats.postCount || 0) / c.minPosts) * 100));
        } else if (c.minLikes) {
          progress = Math.min(100, Math.round(((userStats.likesCount || 0) / c.minLikes) * 100));
        } else if (c.commentsCount) {
          progress = Math.min(100, Math.round(((userStats.commentsCount || 0) / c.commentsCount) * 100));
        } else if (c.friendsCount) {
          progress = Math.min(100, Math.round(((userStats.friendsCount || 0) / c.friendsCount) * 100));
        }
      }

      return {
        ...ach,
        unlocked: isEarned,
        earnedAt: userEarnedData?.earnedAt || null,
        progress,
      };
    });
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
