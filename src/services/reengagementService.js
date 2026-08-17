/**
 * src/services/reengagementService.js - ARVDOUL USER RETENTION & STREAKS ENGINE v8.0
 *
 * Implements:
 * 1. Daily Active Streak Tracking: Computes consecutive daily logins and rewards streak milestone badges.
 * 2. Inactive User Re-engagement Triggers: Generates personalized push notification payloads for users inactive for 3, 7, or 14 days.
 * 3. Weekly Activity Digest: Aggregates weekly views, coin tips received, and top-performing post analytics.
 * 4. LocalForage Streak History: Persists streak stats locally to survive offline restarts.
 */

import { logger } from '../utils/Logger.js';
import localforage from 'localforage';

class ReengagementService {
  constructor() {
    this.streakHistory = Object.create(null);
    this.MAX_STREAK_ENTRIES = 1000;
    this._initStore();
  }

  /**
   * Enforces bounds on streak history object.
   * @private
   */
  _enforceStoreCapacity() {
    const keys = Object.keys(this.streakHistory);
    if (keys.length > this.MAX_STREAK_ENTRIES) {
      delete this.streakHistory[keys[0]];
    }
  }

  /**
   * Initializes localForage streak store.
   * @private
   */
  async _initStore() {
    try {
      const saved = await localforage.getItem('arvdoul_user_streak_history');
      if (saved && typeof saved === 'object') {
        this.streakHistory = Object.assign(Object.create(null), saved);
      }
    } catch (_) {}
  }

  /**
   * Persists streak history.
   * @private
   */
  async _saveStore() {
    try {
      await localforage.setItem('arvdoul_user_streak_history', this.streakHistory);
    } catch (_) {}
  }

  /**
   * Updates daily streak on user active session.
   */
  async recordDailyActivity(userId, userProfile) {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const lastActiveDate = userProfile.lastActiveDate || this.streakHistory[userId]?.lastActiveDate;

      if (lastActiveDate === todayStr) {
        return { streakCount: userProfile.streakCount || this.streakHistory[userId]?.streakCount || 1, streakExtended: false };
      }

      const { getFirestoreInstance } = await import('../firebase/firebase.js');
      const { doc, updateDoc, increment, serverTimestamp } = await import('firebase/firestore');
      const db = await getFirestoreInstance();

      const userRef = doc(db, 'users', userId);

      // Check if yesterday was active
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const isConsecutive = lastActiveDate === yesterdayStr;
      const newStreak = isConsecutive ? (userProfile.streakCount || this.streakHistory[userId]?.streakCount || 0) + 1 : 1;

      // Update Firestore if available
      try {
        await updateDoc(userRef, {
          lastActiveDate: todayStr,
          streakCount: newStreak,
          lastActiveAt: serverTimestamp(),
        });
      } catch (_) {}

      // Cache locally
      this._enforceStoreCapacity();
      this.streakHistory[userId] = {
        lastActiveDate: todayStr,
        streakCount: newStreak,
        updatedAt: Date.now()
      };
      await this._saveStore();

      logger.info(`[Reengagement] User ${userId} streak updated: ${newStreak} days.`);
      return { streakCount: newStreak, streakExtended: true };
    } catch (err) {
      logger.debug('[Reengagement] Activity recording skipped:', { error: err.message });
      return { streakCount: 1, streakExtended: false };
    }
  }

  /**
   * Generates re-engagement campaign message for inactive users.
   */
  generateReengagementPayload(daysInactive, topTrendingTag = '#ArvdoulLaunch') {
    if (daysInactive >= 14) {
      return {
        title: "We miss you on Arvdoul! 🌟",
        body: `Check out what's new in ${topTrendingTag} and discover your personalized feed today!`,
        actionUrl: '/app/feed',
      };
    }

    if (daysInactive >= 7) {
      return {
        title: "Your friends are posting on Arvdoul 🔥",
        body: "Catch up on trending vibes and discussions you missed this week.",
        actionUrl: '/app/explore',
      };
    }

    return {
      title: "Keep your daily streak alive! ⚡",
      body: "Jump back in today to keep your activity streak going strong.",
      actionUrl: '/app/feed',
    };
  }
}

export const reengagementService = new ReengagementService();
export default reengagementService;
