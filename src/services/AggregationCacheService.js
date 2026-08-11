/**
 * src/services/AggregationCacheService.js - ARVDOUL AGGREGATION CACHING ENGINE
 *
 * Implements:
 * 1. Count / Sum / Average Aggregation Caching: Intercepts expensive queries and stores computed metrics in fast cache.
 * 2. Event-driven and mutation-based cache invalidation.
 * 3. TTL with sliding expiration for high-traffic analytical endpoints.
 */

import { cacheManager } from '../utils/CacheManager.js';
import { logger } from '../utils/Logger.js';

class AggregationCacheService {
  constructor() {
    this.DEFAULT_AGGREGATION_TTL_MS = 60 * 1000; // 1 minute default TTL
  }

  /**
   * Generates a deterministic key for an aggregation query.
   */
  _buildKey(collectionName, type, filterObj = {}) {
    const sortedFilter = Object.keys(filterObj)
      .sort()
      .map((k) => `${k}=${filterObj[k]}`)
      .join('&');
    return `${collectionName}:${type}:${sortedFilter || 'all'}`;
  }

  /**
   * Retrieves a cached aggregation or executes the fetcher to compute it.
   */
  async getOrCompute(collectionName, aggregationType, filterObj, computeFn, ttlMs) {
    const key = this._buildKey(collectionName, aggregationType, filterObj);
    const cached = cacheManager.get('aggregations', key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    try {
      const computed = await computeFn();
      cacheManager.set('aggregations', key, computed, ttlMs || this.DEFAULT_AGGREGATION_TTL_MS);
      return computed;
    } catch (err) {
      logger.error(`[AggregationCache] Compute failed for ${key}:`, { error: err.message });
      throw err;
    }
  }

  /**
   * Invalidates aggregations related to a specific collection or filter pattern.
   */
  invalidateCollection(collectionName) {
    cacheManager.invalidatePattern(`aggregations:${collectionName}:*`);
    logger.debug(`[AggregationCache] Invalidated aggregation cache for collection: ${collectionName}`);
  }
}

export const aggregationCacheService = new AggregationCacheService();
export default aggregationCacheService;
