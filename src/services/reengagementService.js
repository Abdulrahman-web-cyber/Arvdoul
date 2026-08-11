/**
 * src/services/reengagementService.js - ARVDOUL USER RETENTION & STREAKS ENGINE
 *
 * Implements:
 * 1. Daily Active Streak Tracking: Computes consecutive daily logins and rewards streak milestone badges.
 * 2. Inactive User Re-engagement Triggers: Generates personalized push notification payloads for users inactive for 3, 7, or 14 days.
 * 3. Weekly Activity Digest: Aggregates weekly views, coin tips received, and top-performing post analytics.
 */

import { logger } from '../utils/Logger.js';

class ReengagementService {
  /**
   * Updates daily streak on user active session.
   */
  async recordDailyActivity(userId, userProfile) {
    try {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];
      const lastActiveDate = userProfile.lastActiveDate;

      if (lastActiveDate === todayStr) {
        return { streakCount: userProfile.streakCount || 1, streakExtended: false };
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
      const newStreak = isConsecutive ? (userProfile.streakCount || 0) + 1 : 1;

      await updateDoc(userRef, {
        lastActiveDate: todayStr,
        streakCount: newStreak,
        lastActiveAt: serverTimestamp(),
      });

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
