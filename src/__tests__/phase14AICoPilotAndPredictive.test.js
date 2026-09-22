/**
 * src/__tests__/phase14AICoPilotAndPredictive.test.js
 * Verification test suite for Phase 14:
 * - Autonomous AI Creation Co-Pilot Studio
 * - Predictive Audience Engagement & Trajectory Forecasting
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  AICoPilotDirectorService,
  CONTENT_FORMATS,
} from '../services/aiCoPilotDirectorService.js';
import {
  PredictiveAnalyticsService,
} from '../services/predictiveAnalyticsService.js';

describe('Phase 14: Autonomous AI Co-Pilot & Predictive Intelligence', () => {
  describe('1. Autonomous AI Co-Pilot Director (Feature 46)', () => {
    let director;

    beforeEach(() => {
      director = new AICoPilotDirectorService();
    });

    it('generates structured creative scripts with multi-scene storyboards', () => {
      const script = director.generateCreativeScript({
        topic: 'Decentralized Creator Monetization',
        format: CONTENT_FORMATS.REEL,
        tone: 'inspirational',
      });

      expect(script.id).toBeDefined();
      expect(script.hook).toContain('Decentralized Creator Monetization');
      expect(script.scenes.length).toBe(3);
      expect(script.scenes[0]).toHaveProperty('visualCue');
      expect(script.scenes[0]).toHaveProperty('voiceover');
      expect(script.scenes[0]).toHaveProperty('soundEffect');
      expect(script.suggestedHashtags.length).toBeGreaterThan(0);
    });

    it('evaluates hook potency and provides actionable recommendations', () => {
      // Weak hook
      const weakAnalysis = director.analyzeHookAndReadability('I went to the store and saw a cat today.');
      expect(weakAnalysis.grade).toBe('NEEDS_IMPROVEMENT');
      expect(weakAnalysis.recommendations.length).toBeGreaterThan(0);

      // Strong hook with power word, question, and number
      const strongAnalysis = director.analyzeHookAndReadability(
        'The #1 secret mistake that is destroying your reach: how to fix it in 3 steps?'
      );
      expect(strongAnalysis.hookScore).toBeGreaterThanOrEqual(70);
      expect(strongAnalysis.powerWordsDetected).toBeGreaterThan(0);
      expect(strongAnalysis.grade).toBe('EXCELLENT');
    });

    it('generates multi-modal visual and audio synthesis prompts', () => {
      const prompts = director.generateAssetPrompts('Cyberpunk Hologram Avatar', 'neo-futuristic');
      expect(prompts.imagePrompt).toContain('Cyberpunk Hologram Avatar');
      expect(prompts.aspectRatio).toBe('9:16');
      expect(prompts.audioPrompt.tempoBpm).toBe(124);
      expect(prompts.audioPrompt.genre).toBeDefined();
    });

    it('flags policy violations during pre-flight check', () => {
      const cleanContent = 'Hey everyone, check out my new 3D digital art reel!';
      expect(director.preFlightSafetyCheck(cleanContent).isSafe).toBe(true);

      const unsafeContent = 'Sensitive info leak: 123-45-6789 contact me';
      const unsafeCheck = director.preFlightSafetyCheck(unsafeContent);
      expect(unsafeCheck.isSafe).toBe(false);
      expect(unsafeCheck.flaggedReason).toBe('POTENTIAL_POLICY_OR_PII_VIOLATION');
    });
  });

  describe('2. Predictive Analytics & Forecasting (Feature 47)', () => {
    let predictive;

    beforeEach(() => {
      predictive = new PredictiveAnalyticsService();
    });

    it('forecasts 24h and 7d trajectory with confidence intervals', () => {
      const forecast = predictive.forecastEngagementTrajectory({
        views: 200,
        likes: 40,
        shares: 10,
        comments: 15,
      }, 30);

      expect(forecast.projected24h.views).toBeGreaterThan(200);
      expect(forecast.projected7d.views).toBeGreaterThan(forecast.projected24h.views);
      expect(forecast.projected24h.confidenceInterval[0]).toBeLessThan(forecast.projected24h.views);
      expect(forecast.projected24h.confidenceInterval[1]).toBeGreaterThan(forecast.projected24h.views);
      expect(['EXPONENTIAL_VIRAL', 'STEADY_GROWTH', 'LINEAR']).toContain(forecast.trajectoryTier);
    });

    it('identifies top global publishing windows', () => {
      const windows = predictive.getOptimalPublishingWindows();
      expect(windows.topWindows.length).toBe(3);
      expect(windows.topWindows[0].trafficIndex).toBeGreaterThan(windows.topWindows[2].trafficIndex);
      expect(windows.recommendation).toBeDefined();
    });

    it('evaluates creator churn probability and suggests interventions', () => {
      // Active creator
      const healthy = predictive.evaluateCreatorChurnRisk({
        daysSinceLastPost: 2,
        recentViewsTrend: 0.1,
      });
      expect(healthy.status).toBe('HEALTHY');
      expect(healthy.churnProbability).toBeLessThan(0.4);

      // Inactive at-risk creator
      const atRisk = predictive.evaluateCreatorChurnRisk({
        daysSinceLastPost: 35,
        recentViewsTrend: -0.4,
        interactionDropRate: 0.5,
      });
      expect(atRisk.status).toBe('HIGH_CHURN_RISK');
      expect(atRisk.churnProbability).toBeGreaterThanOrEqual(0.7);
      expect(atRisk.suggestedIntervention).toContain('Creator Re-Engagement');
    });

    it('computes collaboration synergy based on audience overlap ratio', () => {
      const audienceA = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9', 'u10'];
      // Audience B shares 3 out of 10 followers (30% overlap -> sweet spot)
      const audienceB = ['u1', 'u2', 'u3', 'u11', 'u12', 'u13', 'u14', 'u15', 'u16', 'u17'];

      const synergy = predictive.computeCollaborationSynergy(audienceA, audienceB);
      expect(synergy.mutualFollowersCount).toBe(3);
      expect(synergy.overlapRatio).toBeCloseTo(0.3, 1);
      expect(synergy.synergyScore).toBeGreaterThanOrEqual(0.9);
      expect(synergy.recommendation).toContain('HIGH_SYNERGY');
    });
  });
});
