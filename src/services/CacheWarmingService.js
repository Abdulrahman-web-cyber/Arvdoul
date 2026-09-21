// src/services/CacheWarmingService.js

import { redisCacheManager } from './RedisCacheManager.js';
import { logger } from '../utils/Logger.js';

class CacheWarmingService {
  constructor() {
    this.isWarming = false;
    this.lastWarmTime = 0;
  }

  /**
   * Prewarms critical platform data.
   */
  async warmInitialData(currentUser = null) {
    if (this.isWarming || Date.now() - this.lastWarmTime < 60000) return;
    this.isWarming = true;

    try {
      logger.info('[CacheWarming] Starting proactive cache warming.');
      const { getFirestoreInstance } = await import('../firebase/firebase.js');
      const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
      const db = await getFirestoreInstance();

      // 1. Warm Trending Posts
      const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(20));
      const postsSnap = await getDocs(postsQuery);
      const posts = postsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      await redisCacheManager.setDistributed('feed', 'home_recent', posts, 5 * 60 * 1000);

      // 2. Warm Active Stories/Vibes
      const storiesQuery = query(collection(db, 'stories'), orderBy('createdAt', 'desc'), limit(20));
      const storiesSnap = await getDocs(storiesQuery);
      const stories = storiesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      await redisCacheManager.setDistributed('stories', 'active_vibes', stories, 3 * 60 * 1000);

      // 3. Warm User Profile if authenticated
      if (currentUser?.uid) {
        const { doc, getDoc } = await import('firebase/firestore');
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          await redisCacheManager.setDistributed('user', currentUser.uid, { id: userDoc.id, ...userDoc.data() }, 10 * 60 * 1000);
        }
      }

      this.lastWarmTime = Date.now();
      logger.info('[CacheWarming] Cache warming completed successfully.');
    } catch (err) {
      logger.warn('[CacheWarming] Warming skipped or partially completed:', { error: err.message });
    } finally {
      this.isWarming = false;
    }
  }
}

export const cacheWarmingService = new CacheWarmingService();
export default cacheWarmingService;
