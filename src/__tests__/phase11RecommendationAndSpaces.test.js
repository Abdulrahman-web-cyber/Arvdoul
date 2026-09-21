// src/__tests__/phase11RecommendationAndSpaces.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  RecommendationEngine,
  recommendationEngine,
} from '../services/recommendationEngine.js';
import {
  SpacesOrchestrator,
  SPACE_ROLES,
  SPACE_STATUS,
} from '../services/spacesOrchestrator.js';

describe('Phase 11: Recommendation Engine & Collaborative Spaces', () => {
  describe('1. Recommendation Engine (Feature 40)', () => {
    let engine;

    beforeEach(() => {
      engine = new RecommendationEngine();
    });

    it('calculates exponential time decay correctly', () => {
      const now = Date.now();
      // Fresh post (0 hours old) should have score close to 1.0
      const freshScore = engine.calculateTimeDecay(now, 18);
      expect(freshScore).toBeCloseTo(1.0, 1);

      // Post 18 hours old with half life 18 should be ~0.5
      const halfLifePost = now - 18 * 60 * 60 * 1000;
      const halfScore = engine.calculateTimeDecay(halfLifePost, 18);
      expect(halfScore).toBeCloseTo(0.5, 1);

      // Post 36 hours old should be ~0.25
      const twoHalfLives = now - 36 * 60 * 60 * 1000;
      const quarterScore = engine.calculateTimeDecay(twoHalfLives, 18);
      expect(quarterScore).toBeCloseTo(0.25, 1);
    });

    it('computes affinity score based on user interactions', () => {
      const interactions = {
        likes: 5,
        comments: 2,
        shares: 1,
        tips: 1,
        isFollowed: true,
      };
      const score = engine.calculateAffinityScore('creator_123', interactions);
      expect(score).toBeGreaterThan(0.7);
      expect(score).toBeLessThanOrEqual(1.0);
    });

    it('penalizes skips in affinity calculations', () => {
      const normalInteractions = { likes: 1 };
      const penalizedInteractions = { likes: 1, skips: 4 };

      const normalScore = engine.calculateAffinityScore('creator_a', normalInteractions);
      const penalizedScore = engine.calculateAffinityScore('creator_b', penalizedInteractions);

      expect(penalizedScore).toBeLessThan(normalScore);
    });

    it('scores candidates with explainable reasons', () => {
      const candidate = {
        id: 'post_1',
        userId: 'creator_99',
        createdAt: Date.now() - 3600 * 1000,
        likesCount: 150,
        commentsCount: 30,
        tags: ['technology', 'ai'],
      };

      const userContext = {
        userInteractions: { creator_99: { likes: 10, comments: 3 } },
        userInterests: ['ai', 'design'],
      };

      const result = engine.computeCandidateScore(candidate, userContext);
      expect(result.score).toBeGreaterThan(0);
      expect(result.components).toHaveProperty('timeDecay');
      expect(result.components).toHaveProperty('affinity');
      expect(result.components).toHaveProperty('velocity');
      expect(result.components).toHaveProperty('topic');
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('enforces author diversity interleaving to prevent feed fatigue', () => {
      // 5 posts from creator_spam, 2 posts from creator_other
      const candidates = [
        { id: '1', userId: 'creator_spam', createdAt: Date.now(), likesCount: 100 },
        { id: '2', userId: 'creator_spam', createdAt: Date.now(), likesCount: 90 },
        { id: '3', userId: 'creator_spam', createdAt: Date.now(), likesCount: 80 },
        { id: '4', userId: 'creator_spam', createdAt: Date.now(), likesCount: 70 },
        { id: '5', userId: 'creator_spam', createdAt: Date.now(), likesCount: 60 },
        { id: '6', userId: 'creator_other', createdAt: Date.now(), likesCount: 50 },
        { id: '7', userId: 'creator_third', createdAt: Date.now(), likesCount: 40 },
      ];

      const ranked = engine.rankCandidates(candidates, {});
      // In first 3 items, creator_spam should not appear 3 times in a row
      const firstThree = ranked.slice(0, 3).map(p => p.userId);
      const spamCount = firstThree.filter(u => u === 'creator_spam').length;
      expect(spamCount).toBeLessThanOrEqual(2);
    });

    it('extracts top trending keywords from post text and hashtags', () => {
      const posts = [
        { tags: ['#arvdoul', '#tech'], caption: 'Welcome to the future of social' },
        { tags: ['#tech', '#future'], caption: 'Next gen audio spaces' },
        { tags: ['#arvdoul'], caption: 'Future social architecture' },
      ];

      const keywords = engine.extractTrendingKeywords(posts, 5);
      expect(keywords.length).toBeGreaterThan(0);
      const tagKeywords = keywords.map(k => k.keyword);
      expect(tagKeywords).toContain('#arvdoul');
      expect(tagKeywords).toContain('#tech');
    });
  });

  describe('2. Spaces Orchestrator (Feature 41)', () => {
    let orchestrator;

    beforeEach(() => {
      orchestrator = new SpacesOrchestrator();
    });

    it('creates space session with host stage privileges', () => {
      const session = orchestrator.createSpaceSession('space_101', {
        title: 'Tech Talk Live',
        hostId: 'user_host',
        topic: 'Engineering',
      });

      expect(session.id).toBe('space_101');
      expect(session.hostId).toBe('user_host');
      expect(session.status).toBe(SPACE_STATUS.LIVE);
      expect(session.participantCount).toBe(1);
      expect(session.speakerCount).toBe(1);
    });

    it('manages listener joins and hand-raising queue', () => {
      orchestrator.createSpaceSession('space_101', { hostId: 'user_host' });

      // Join listener
      orchestrator.joinSpace('space_101', 'user_listener_1');
      let snapshot = orchestrator.getSpaceSnapshot('space_101');
      expect(snapshot.participantCount).toBe(2);
      expect(snapshot.speakerCount).toBe(1);

      // Raise hand
      const queue = orchestrator.raiseHand('space_101', 'user_listener_1');
      expect(queue.some(q => q.userId === 'user_listener_1')).toBe(true);

      // Host elevates listener to speaker
      orchestrator.elevateToSpeaker('space_101', 'user_host', 'user_listener_1');
      snapshot = orchestrator.getSpaceSnapshot('space_101');
      expect(snapshot.speakerCount).toBe(2);
      expect(snapshot.handRaiseQueue.length).toBe(0);

      // Host demotes speaker back to listener
      orchestrator.demoteToListener('space_101', 'user_host', 'user_listener_1');
      snapshot = orchestrator.getSpaceSnapshot('space_101');
      expect(snapshot.speakerCount).toBe(1);
    });

    it('rejects unauthorized moderation attempts by standard listeners', () => {
      orchestrator.createSpaceSession('space_101', { hostId: 'user_host' });
      orchestrator.joinSpace('space_101', 'user_listener_1');
      orchestrator.joinSpace('space_101', 'user_listener_2');

      expect(() => {
        orchestrator.elevateToSpeaker('space_101', 'user_listener_1', 'user_listener_2');
      }).toThrow('Only hosts and co-hosts have stage moderation privileges');
    });

    it('transfers host ownership when host leaves with active speakers', () => {
      orchestrator.createSpaceSession('space_101', { hostId: 'user_host' });
      orchestrator.joinSpace('space_101', 'user_cohost');
      orchestrator.elevateToSpeaker('space_101', 'user_host', 'user_cohost');

      // Host leaves
      const updated = orchestrator.leaveSpace('space_101', 'user_host');
      expect(updated.hostId).toBe('user_cohost');
      expect(updated.status).toBe(SPACE_STATUS.LIVE);
    });

    it('handles speaking indicators and live tipping', () => {
      orchestrator.createSpaceSession('space_101', { hostId: 'user_host' });
      orchestrator.joinSpace('space_101', 'user_listener');

      // Speaker indicator
      const updated = orchestrator.setSpeakingState('space_101', 'user_host', {
        isSpeaking: true,
        volume: 75,
      });
      expect(updated).toBe(true);

      // Tipping
      const tipResult = orchestrator.sendTip('space_101', 'user_listener', 'user_host', 50);
      expect(tipResult.amount).toBe(50);
      expect(tipResult.newPool).toBe(50);

      // Ephemeral Reaction
      const reaction = orchestrator.sendReaction('space_101', 'user_listener', '🔥');
      expect(reaction.emoji).toBe('🔥');
      expect(reaction.userId).toBe('user_listener');
    });
  });
});
