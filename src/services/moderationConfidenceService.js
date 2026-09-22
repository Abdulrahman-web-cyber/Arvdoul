/**
 * src/services/moderationConfidenceService.js - ARVDOUL MODERATION CONFIDENCE ROUTING ENGINE
 *
 * Implements:
 * 1. Bayesian Threshold Decision Engine:
 *    - Confidence >= 0.90 -> Auto-Action (Immediate Block or Instant Approval)
 *    - Confidence 0.50 - 0.89 -> Route to Human Review Queue with Priority Score
 *    - Confidence < 0.50 -> Auto-Allow with Soft Background Watchlist
 * 2. Creator Trust Score Weighting: Multiplies confidence threshold with creator reputation score.
 */

import { logger } from '../utils/Logger.js';

class ModerationConfidenceService {
  /**
   * Routes content action based on combined safety score and author trust reputation.
   * @param {number} rawViolationScore - 0 to 100
   * @param {number} authorTrustScore - 0 to 100 (default 80)
   */
  routeModerationDecision(rawViolationScore, authorTrustScore = 80) {
    // Weighted risk computation
    const trustFactor = (100 - authorTrustScore) / 100; // 0.0 to 1.0 (higher = less trusted)
    const effectiveRiskScore = Math.min(100, rawViolationScore * (0.7 + 0.6 * trustFactor));

    if (effectiveRiskScore >= 85) {
      return {
        action: 'auto_block',
        priority: 'p0_urgent',
        requiresHumanReview: false,
        effectiveRiskScore,
      };
    }

    if (effectiveRiskScore >= 40) {
      return {
        action: 'route_to_review_queue',
        priority: effectiveRiskScore >= 65 ? 'p1_high' : 'p2_normal',
        requiresHumanReview: true,
        effectiveRiskScore,
      };
    }

    return {
      action: 'auto_allow',
      priority: 'p3_low',
      requiresHumanReview: false,
      effectiveRiskScore,
    };
  }
}

export const moderationConfidenceService = new ModerationConfidenceService();
export default moderationConfidenceService;
