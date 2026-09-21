// src/services/viralPredictionService.js

import { logger } from '../utils/Logger.js';

class ViralPredictionService {
  /**
   * Evaluates post viral potential based on early engagement velocity.
   */
  predictViralPotential(stats = {}, postAgeMinutes = 10) {
    const views = stats.views || 1;
    const likes = stats.likes || 0;
    const shares = stats.shares || 0;

    const likeRatio = likes / views;
    const shareRatio = shares / views;

    // Viral coefficient formula
    const viralCoefficient = (likeRatio * 1.5 + shareRatio * 5.0) * Math.min(postAgeMinutes / 5, 2.0);

    const isHighViralPotential = viralCoefficient > 0.35 && views >= 20;

    if (isHighViralPotential) {
      logger.info('[ViralPrediction] High-potential viral content identified!', { viralCoefficient, stats });
    }

    return {
      viralCoefficient: parseFloat(viralCoefficient.toFixed(3)),
      isHighViralPotential,
      recommendedDistributionTier: isHighViralPotential ? 'expanded_discovery' : 'standard',
    };
  }
}

export const viralPredictionService = new ViralPredictionService();
export default viralPredictionService;
