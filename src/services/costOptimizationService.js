/**
 * src/services/costOptimizationService.js - ARVDOUL CLOUD COST OPTIMIZATION v8.0
 *
 * Implements:
 * 1. Read Query Profile Analysis: Analyzes database usage frequency.
 * 2. Cache TTL Recommendations: Suggests dynamic local and edge storage caching TTL rules.
 * 3. CDN Egress Optimization: Identifies opportunities to compress static assets or increase CDN caching ratios.
 */

import { logger } from '../utils/Logger.js';
import { costMonitoringService } from './costMonitoringService.js';

class CostOptimizationService {
  constructor() {
    this.queryFrequencyLog = new Map(); // queryName -> array of timestamps
  }

  /**
   * Tracks and profiles individual database queries to check for high-frequency patterns.
   * @param {string} queryName - name of the query
   */
  profileQueryExecution(queryName) {
    if (!queryName) return;

    const now = Date.now();
    const timestamps = this.queryFrequencyLog.get(queryName) || [];
    const oneMinuteAgo = now - 60000;

    // Filter old timestamps
    const activeTimes = timestamps.filter(ts => ts > oneMinuteAgo);
    activeTimes.push(now);

    this.queryFrequencyLog.set(queryName, activeTimes);

    if (activeTimes.length > 50) {
      logger.warn(`[CostOptimization] High-frequency database query profiled: "${queryName}". Suggested cache rules.`, {
        callsPerMinute: activeTimes.length
      });
    }
  }

  /**
   * Evaluates the query frequency and provides cost-saving recommendations.
   * @returns {Array<object>} array of actionable recommendations
   */
  generateCostRecommendations() {
    const recommendations = [];
    const forecast = costMonitoringService.getDailyBudgetForecast();

    // Recommend scaling cache if spend is high
    if (forecast.utilizationPercentage > 75) {
      recommendations.push({
        id: 'opt_scale_cache_ttl',
        severity: 'HIGH',
        category: 'DATABASE_CACHE',
        message: 'Daily cloud budget utilization is high. Consider raising RedisCacheManager and local TTL values by 150%.',
        potentialSavingsUSD: forecast.currentDailySpendUSD * 0.25
      });
    }

    // Profile query frequencies for specific caching suggestions
    this.queryFrequencyLog.forEach((timestamps, queryName) => {
      if (timestamps.length > 100) {
        recommendations.push({
          id: `opt_high_freq_${queryName}`,
          severity: 'MEDIUM',
          category: 'DYNAMIC_CACHE_RECOMMENDATION',
          message: `Query "${queryName}" is executed extremely frequently (${timestamps.length} calls/min). Add L1 memory cache layer.`,
          potentialSavingsUSD: timestamps.length * 0.0001
        });
      }
    });

    // Check for heavy media downloads needing aggressive CDN caching
    recommendations.push({
      id: 'opt_media_compression',
      severity: 'LOW',
      category: 'CDN_EGRESS_OPTIMIZATION',
      message: 'Ensure image compression and webp conversion are active on the edge node to reduce egress network transfer fees.',
      potentialSavingsUSD: 5.00
    });

    logger.info('[CostOptimization] Cost optimization audit complete. Recommendations compiled:', recommendations);
    return recommendations;
  }

  /**
   * Clears historical profiling data.
   */
  resetProfiling() {
    this.queryFrequencyLog.clear();
    logger.info('[CostOptimization] Historical query execution metrics cleared.');
  }
}

export const costOptimizationService = new CostOptimizationService();
export default costOptimizationService;
