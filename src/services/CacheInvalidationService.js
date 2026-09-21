// src/services/CacheInvalidationService.js

import { redisCacheManager } from './RedisCacheManager.js';
import { cacheManager } from '../utils/CacheManager.js';
import { logger } from '../utils/Logger.js';

class CacheInvalidationService {
  /**
   * Invalidates caches when a post is created, updated, or deleted.
   */
  async onPostMutated(postId, authorId, action = 'update') {
    logger.debug(`[CacheInvalidation] Invalidating caches for post: ${postId}, action: ${action}`);
    await Promise.all([
      redisCacheManager.invalidateDistributed('posts', postId),
      redisCacheManager.invalidateDistributed('feed', '*'),
      redisCacheManager.invalidateDistributed('aggregations', 'posts:*'),
    ]);
    if (authorId) {
      cacheManager.invalidatePattern(`user_posts:${authorId}:*`);
    }
  }

  /**
   * Invalidates caches when a comment is added or deleted.
   */
  async onCommentMutated(postId) {
    logger.debug(`[CacheInvalidation] Invalidating comment caches for post: ${postId}`);
    await redisCacheManager.invalidateDistributed('comments', postId);
  }

  /**
   * Invalidates caches when a user profile is updated.
   */
  async onUserProfileUpdated(userId) {
    logger.debug(`[CacheInvalidation] Invalidating user profile cache: ${userId}`);
    await redisCacheManager.invalidateDistributed('user', userId);
    cacheManager.invalidateUser(userId);
  }

  /**
   * Invalidates relationship and follower caches.
   */
  async onRelationshipChanged(sourceUserId, targetUserId) {
    logger.debug(`[CacheInvalidation] Relationship changed between ${sourceUserId} and ${targetUserId}`);
    cacheManager.invalidatePattern(`network:${sourceUserId}:*`);
    cacheManager.invalidatePattern(`network:${targetUserId}:*`);
    await redisCacheManager.invalidateDistributed('feed', `home_${sourceUserId}`);
  }
}

export const cacheInvalidationService = new CacheInvalidationService();
export default cacheInvalidationService;
