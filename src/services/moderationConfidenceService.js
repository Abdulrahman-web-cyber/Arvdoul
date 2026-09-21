// src/services/moderationConfidenceService.js

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
