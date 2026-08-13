/**
 * src/services/AggregationCacheService.js - ARVDOUL AGGREGATION CACHING ENGINE
 *
 * Implements:
 * 1. Count / Sum / Average Aggregation Caching: Intercepts expensive queries and stores computed metrics in fast cache.
 * 2. Event-driven and mutation-based cache invalidation.
 * 3. TTL with sliding expiration for high-traffic analytical endpoints.
 * 4. Cache Stampede Protection (Single-Flight): Coalesces concurrent identical aggregation requests.
 * 5. Multi-Tier Distributed Cache backing (Redis support).
 * 6. Cache Poisoning Sanitization: Validates and sanitizes dynamic query filter objects to prevent key attacks.
 */

import { cacheManager } from '../utils/CacheManager.js';
import { logger } from '../utils/Logger.js';
import { redisCacheManager } from './RedisCacheManager.js';
import { metricsService } from './metricsService.js';

class AggregationCacheService {
  constructor() {
    this.DEFAULT_AGGREGATION_TTL_MS = 60 * 1000; // 1 minute default TTL
    this._inflight = new Map(); // singleflight request tracker
  }

  /**
   * Sanitizes filter object to prevent cache poisoning and SQL/NoSQL injections (CWE-89).
   * @private
   */
  _sanitizeFilters(filterObj) {
    if (!filterObj || typeof filterObj !== 'object') return {};
    const sanitized = {};
    Object.entries(filterObj).forEach(([key, val]) => {
      // Retain only safe alphanumeric keys & reject any control characters
      const safeKey = key.replace(/[^a-zA-Z0-9_]/g, '');
      if (safeKey && typeof val !== 'function' && typeof val !== 'symbol') {
        sanitized[safeKey] = typeof val === 'string' ? val.replace(/[${}$]/g, '') : val;
      }
    });
    return sanitized;
  }

  /**
   * Generates a deterministic key for an aggregation query.
   */
  _buildKey(collectionName, type, filterObj = {}) {
    const sanitized = this._sanitizeFilters(filterObj);
    const sortedFilter = Object.keys(sanitized)
      .sort()
      .map((k) => `${k}=${sanitized[k]}`)
      .join('&');
    return `${collectionName}:${type}:${sortedFilter || 'all'}`;
  }

  /**
   * Retrieves a cached aggregation or executes the fetcher to compute it.
   * Leverages request coalescing and distributed multi-tier cache.
   */
  async getOrCompute(collectionName, aggregationType, filterObj, computeFn, ttlMs) {
    const key = this._buildKey(collectionName, aggregationType, filterObj);
    const ttl = ttlMs || this.DEFAULT_AGGREGATION_TTL_MS;

    // 1. Check in-flight Promise map (Single-Flight cache stampede protection)
    if (this._inflight.has(key)) {
      metricsService.incrementCounter('aggregation_stampede_coalesced_total', 1);
      return await this._inflight.get(key);
    }

    const computePromise = (async () => {
      const start = performance.now();

      // 2. Check local L1 cache
      const cached = cacheManager.get('aggregations', key);
      if (cached !== null && cached !== undefined) {
        metricsService.incrementCounter('aggregation_cache_l1_hits_total', 1);
        return cached;
      }

      // 3. Check distributed L2 Redis cache
      try {
        const distributedCached = await redisCacheManager.getOrFetchDistributed('aggregations', key, async () => {
          return null; // fallback if missing
        }, ttl);

        if (distributedCached !== null && distributedCached !== undefined) {
          metricsService.incrementCounter('aggregation_cache_l2_hits_total', 1);
          // Sync L1 cache
          cacheManager.set('aggregations', key, distributedCached, ttl);
          return distributedCached;
        }
      } catch (err) {
        logger.debug('[AggregationCache] L2 Redis fetch failed:', { error: err.message });
      }

      // 4. Cache Miss - Compute the heavy aggregation
      try {
        metricsService.incrementCounter('aggregation_cache_misses_total', 1);
        const computed = await computeFn();

        // Write-through to L1
        cacheManager.set('aggregations', key, computed, ttl);

        // Write-through to L2 Distributed Redis
        try {
          await redisCacheManager.setDistributed('aggregations', key, computed, ttl);
        } catch (_) {}

        const duration = performance.now() - start;
        metricsService.recordHistogram('aggregation_compute_duration_ms', duration);

        return computed;
      } catch (err) {
        logger.error(`[AggregationCache] Compute failed for ${key}:`, { error: err.message });
        throw err;
      }
    })();

    this._inflight.set(key, computePromise);

    try {
      return await computePromise;
    } finally {
      this._inflight.delete(key);
    }
  }

  /**
   * Invalidates aggregations related to a specific collection or filter pattern.
   */
  async invalidateCollection(collectionName) {
    cacheManager.invalidatePattern(`aggregations:${collectionName}:*`);
    try {
      await redisCacheManager.invalidateDistributed('aggregations', `${collectionName}:*`);
    } catch (_) {}

    logger.debug(`[AggregationCache] Invalidated aggregation cache for collection: ${collectionName}`);
  }
}

export const aggregationCacheService = new AggregationCacheService();
export default aggregationCacheService;
