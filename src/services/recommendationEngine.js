// src/services/recommendationEngine.js

import { logger } from '../utils/Logger.js';

export const RECOMMENDATION_CONFIG = {
  WEIGHTS: {
    RECENCY: 0.30,
    CREATOR_AFFINITY: 0.35,
    ENGAGEMENT_VELOCITY: 0.25,
    TOPIC_ALIGNMENT: 0.10,
  },
  DEFAULT_HALF_LIFE_HOURS: 18,
  DIVERSITY_WINDOW_SIZE: 5,
  MAX_SAME_CREATOR_IN_WINDOW: 2,
  AFFINITY_ACTION_WEIGHTS: {
    like: 2,
    comment: 5,
    share: 10,
    tip: 15,
    profile_visit: 3,
    complete_view: 4,
    skip: -3,
    mute: -10,
  },
};

export class RecommendationEngine {
  constructor(config = {}) {
    this.config = { ...RECOMMENDATION_CONFIG, ...config };
    this.affinityCache = new Map(); // userId -> { creatorId -> score }
  }

  /**
   * Calculates exponential time decay score between 0.0 and 1.0.
   * Formula: e^(-ln(2) * age / halfLife) = 2^(-age / halfLife)
   */
  calculateTimeDecay(publishedAt, halfLifeHours = this.config.DEFAULT_HALF_LIFE_HOURS) {
    if (!publishedAt) return 0.5;
    const now = Date.now();
    const publishedTime = typeof publishedAt === 'number' 
      ? publishedAt 
      : publishedAt?.toMillis?.() || new Date(publishedAt).getTime();
    
    if (isNaN(publishedTime)) return 0.5;

    const ageHours = Math.max(0, (now - publishedTime) / (1000 * 60 * 60));
    return Math.pow(0.5, ageHours / halfLifeHours);
  }

  /**
   * Computes creator affinity score based on user interaction history.
   */
  calculateAffinityScore(creatorId, userInteractions = {}) {
    if (!creatorId || !userInteractions) return 0.1;

    // Check pre-calculated affinities
    const interactions = userInteractions[creatorId] || userInteractions;
    if (typeof interactions === 'number') {
      return Math.min(1.0, Math.max(0.0, interactions / 100));
    }

    let rawScore = 0;
    const weights = this.config.AFFINITY_ACTION_WEIGHTS;

    if (interactions.likes) rawScore += interactions.likes * weights.like;
    if (interactions.comments) rawScore += interactions.comments * weights.comment;
    if (interactions.shares) rawScore += interactions.shares * weights.share;
    if (interactions.tips) rawScore += interactions.tips * weights.tip;
    if (interactions.profileVisits) rawScore += interactions.profileVisits * weights.profile_visit;
    if (interactions.skips) rawScore += interactions.skips * weights.skip;
    if (interactions.isFollowed) rawScore += 25;

    // Normalize to 0..1 range with smooth sigmoid or hyperbolic tangent
    return Math.min(1.0, Math.max(0.05, Math.tanh(rawScore / 30)));
  }

  /**
   * Computes engagement velocity score (interactions per hour since creation).
   */
  calculateVelocityScore(candidate) {
    const publishedTime = candidate.createdAt?.toMillis?.() 
      || (typeof candidate.createdAt === 'number' ? candidate.createdAt : new Date(candidate.createdAt || Date.now()).getTime());
    const ageHours = Math.max(0.2, (Date.now() - publishedTime) / (1000 * 60 * 60));

    const totalEngagements = (candidate.likesCount || 0) * 1.0 +
      (candidate.commentsCount || 0) * 2.0 +
      (candidate.sharesCount || 0) * 3.0 +
      (candidate.tipsCount || 0) * 5.0;

    const velocity = totalEngagements / ageHours;
    // Logarithmic scaling for engagement spikes
    return Math.min(1.0, Math.log10(1 + velocity) / 2.5);
  }

  /**
   * Calculates topic overlap between user interests and candidate tags.
   */
  calculateTopicScore(candidateTags = [], userInterests = []) {
    if (!userInterests || userInterests.length === 0) return 0.3; // Default baseline
    if (!candidateTags || candidateTags.length === 0) return 0.2;

    const interestSet = new Set(userInterests.map(i => String(i).toLowerCase()));
    let matches = 0;

    for (const tag of candidateTags) {
      if (interestSet.has(String(tag).toLowerCase())) {
        matches++;
      }
    }

    return Math.min(1.0, matches / Math.min(candidateTags.length, 3));
  }

  /**
   * Computes full composite ranking score for a candidate post.
   */
  computeCandidateScore(candidate, userContext = {}) {
    const {
      userInteractions = {},
      userInterests = [],
      isColdStart = false,
    } = userContext;

    const timeDecay = this.calculateTimeDecay(candidate.createdAt, candidate.halfLifeHours);
    const affinity = isColdStart ? 0.2 : this.calculateAffinityScore(candidate.userId || candidate.creatorId, userInteractions);
    const velocity = this.calculateVelocityScore(candidate);
    const topic = this.calculateTopicScore(candidate.tags || candidate.hashtags, userInterests);

    const weights = this.config.WEIGHTS;
    const compositeScore = (
      timeDecay * weights.RECENCY +
      affinity * weights.CREATOR_AFFINITY +
      velocity * weights.ENGAGEMENT_VELOCITY +
      topic * weights.TOPIC_ALIGNMENT
    );

    // Generate explainable reasons
    const reasons = [];
    if (affinity > 0.6) reasons.push('creator_affinity');
    if (velocity > 0.5) reasons.push('trending_velocity');
    if (topic > 0.5) reasons.push('topic_match');
    if (timeDecay > 0.8) reasons.push('fresh_content');
    if (isColdStart && reasons.length === 0) reasons.push('popular_starter');

    return {
      score: Number(compositeScore.toFixed(4)),
      components: {
        timeDecay: Number(timeDecay.toFixed(3)),
        affinity: Number(affinity.toFixed(3)),
        velocity: Number(velocity.toFixed(3)),
        topic: Number(topic.toFixed(3)),
      },
      reasons: reasons.length > 0 ? reasons : ['recommended_for_you'],
    };
  }

  /**
   * Re-ranks candidate posts and applies diversity sliding-window constraints.
   */
  rankCandidates(candidates = [], userContext = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return [];
    }

    // 1. Score all candidates
    const scored = candidates.map(candidate => {
      const scoring = this.computeCandidateScore(candidate, userContext);
      return {
        ...candidate,
        _rankingScore: scoring.score,
        _rankingComponents: scoring.components,
        recommendationReasons: scoring.reasons,
      };
    });

    // 2. Sort descending by score
    scored.sort((a, b) => b._rankingScore - a._rankingScore);

    // 3. Apply sliding-window diversity interleaving
    return this.injectDiversity(scored);
  }

  /**
   * Anti-fatigue diversity interleaving: avoids clustering items from the same author.
   */
  injectDiversity(rankedItems = []) {
    const result = [];
    const pool = [...rankedItems];
    const windowSize = this.config.DIVERSITY_WINDOW_SIZE;
    const maxSame = this.config.MAX_SAME_CREATOR_IN_WINDOW;

    while (pool.length > 0) {
      // Find the best next candidate that satisfies author frequency constraint in recent window
      const recentWindow = result.slice(-windowSize);
      const recentCreators = {};
      for (const item of recentWindow) {
        const creator = item.userId || item.creatorId || 'unknown';
        recentCreators[creator] = (recentCreators[creator] || 0) + 1;
      }

      let selectedIndex = -1;
      for (let i = 0; i < pool.length; i++) {
        const creator = pool[i].userId || pool[i].creatorId || 'unknown';
        if ((recentCreators[creator] || 0) < maxSame) {
          selectedIndex = i;
          break;
        }
      }

      // If all remaining candidates violate the window, fallback to highest scored
      if (selectedIndex === -1) {
        selectedIndex = 0;
      }

      result.push(pool.splice(selectedIndex, 1)[0]);
    }

    return result;
  }

  /**
   * Extracts emerging trending topics and hashtags from a collection of posts.
   */
  extractTrendingKeywords(posts = [], limit = 10) {
    const frequencyMap = new Map();
    const stopWords = new Set(['the', 'and', 'a', 'to', 'in', 'is', 'it', 'you', 'that', 'this', 'for', 'with', 'on']);

    for (const post of posts) {
      // Hashtags
      if (Array.isArray(post.tags)) {
        for (const tag of post.tags) {
          const cleanTag = `#${String(tag).replace(/^#/, '').toLowerCase()}`;
          frequencyMap.set(cleanTag, (frequencyMap.get(cleanTag) || 0) + 3);
        }
      }

      // Title words
      if (post.title || post.caption || post.content) {
        const text = `${post.title || ''} ${post.caption || ''} ${post.content || ''}`;
        const words = text.toLowerCase().match(/\b[a-z]{3,15}\b/g) || [];
        for (const word of words) {
          if (!stopWords.has(word)) {
            frequencyMap.set(word, (frequencyMap.get(word) || 0) + 1);
          }
        }
      }
    }

    return Array.from(frequencyMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([keyword, weight]) => ({ keyword, weight }));
  }
}

export const recommendationEngine = new RecommendationEngine();
export default recommendationEngine;
