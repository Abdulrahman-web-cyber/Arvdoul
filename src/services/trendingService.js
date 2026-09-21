// src/services/trendingService.js

import { redisCacheManager } from './RedisCacheManager.js';
import { logger } from '../utils/Logger.js';

class TrendingService {
  /**
   * Computes engagement velocity score for a post or reel.
   * Score = (Likes * 1.0 + Comments * 2.5 + Shares * 4.0 + Views * 0.1) / (AgeInHours + 2)^1.5
   */
  calculateVelocityScore(stats = {}, createdAtMillis = Date.now()) {
    const likes = stats.likes || 0;
    const comments = stats.comments || 0;
    const shares = stats.shares || 0;
    const views = stats.views || 0;

    const weightedInteractions = likes * 1.0 + comments * 2.5 + shares * 4.0 + views * 0.1;
    const ageInHours = Math.max((Date.now() - createdAtMillis) / (1000 * 60 * 60), 0.1);

    // Gravity decay exponent 1.5 (Hacker News / Reddit style gravity)
    const gravityScore = weightedInteractions / Math.pow(ageInHours + 2, 1.5);
    return parseFloat(gravityScore.toFixed(4));
  }

  /**
   * Fetches top trending topics and hashtags from cache or Firestore.
   */
  async getTrendingTopics(limitCount = 20) {
    return await redisCacheManager.getOrFetchDistributed(
      'trending',
      'topics_global',
      async () => {
        try {
          const { getFirestoreInstance } = await import('../firebase/firebase.js');
          const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
          const db = await getFirestoreInstance();

          const q = query(collection(db, 'trending_topics'), orderBy('velocityScore', 'desc'), limit(limitCount));
          const snap = await getDocs(q);

          // No fabricated topics: trending is real signal or nothing.
          return snap.empty ? [] : snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (err) {
          logger.debug('[TrendingService] Fallback trending:', { error: err.message });
          return [];
        }
      },
      3 * 60 * 1000 // 3 minutes TTL
    );
  }
}

export const trendingService = new TrendingService();
export default trendingService;
