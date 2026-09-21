// src/services/reengagementService.js

import { logger } from '../utils/Logger.js';

class ReengagementService {
  /**
   * Records daily activity for streak purposes.
   *
   * Streak state has a single source of truth: the `recordActiveDay` Cloud
   * Function, which owns `activeStreak` / `activeDaysCount` / `lastActiveDay`
   * on the user document. This method previously kept a second, divergent
   * `streakCount` / `lastActiveDate` copy in Firestore and localStorage, which
   * meant the profile could show two different streak numbers. It now only
   * asks the server to record the day and reports the authoritative result.
   */
  async recordDailyActivity(userId) {
    if (!userId) return { streakCount: 0, streakExtended: false };
    try {
      const { levelSystemService } = await import('./levelSystemService.js');
      const result = await levelSystemService.recordActiveDay({ userId });
      return {
        streakCount: result?.activeStreak || 0,
        activeDaysCount: result?.activeDaysCount || 0,
        streakExtended: !result?.alreadyRecordedToday,
      };
    } catch (err) {
      logger.debug('[Reengagement] Activity recording skipped:', { error: err.message });
      return { streakCount: 0, streakExtended: false };
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
        actionUrl: '/home',
      };
    }

    if (daysInactive >= 7) {
      return {
        title: "Your friends are posting on Arvdoul 🔥",
        body: "Catch up on trending vibes and discussions you missed this week.",
        actionUrl: '/search',
      };
    }

    return {
      title: "Keep your daily streak alive! ⚡",
      body: "Jump back in today to keep your activity streak going strong.",
      actionUrl: '/home',
    };
  }
}

export const reengagementService = new ReengagementService();
export default reengagementService;
