// src/services/reputationService.js — ARVDOUL REPUTATION, INFLUENCE & CONTRIBUTION ENGINE (Part 2)
// Measures genuine trust, impact, and ecosystem value. Zero Pay-to-Legitimacy.

import {
  getReputationBand,
  getInfluenceBand,
  getContributionBand,
  REPUTATION_BANDS,
  INFLUENCE_BANDS,
  CONTRIBUTION_BANDS,
} from './levelSystemService.js';
import { getFirestoreInstance } from '../firebase/firebase.js';
import { doc, getDoc } from 'firebase/firestore';
import { logger } from '../utils/Logger.js';

class ReputationService {
  constructor() {
    this._cache = new Map();
    this.TTL_MS = 60_000;
  }

  /**
   * Evaluates user profile attributes and calculates unified standing breakdown.
   * Safe public representation with zero exposure of internal anti-abuse heuristics.
   */
  async getReputationProfile(userId, fallbackData = null) {
    if (!userId) return this._getDefaultProfile();

    const cached = this._cache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.TTL_MS) {
      return cached.profile;
    }

    try {
      let data = fallbackData;
      if (!data) {
        const db = await getFirestoreInstance();
        const snap = await getDoc(doc(db, 'users', userId));
        data = snap.exists() ? snap.data() : {};
      }

      const repScore = Math.max(0, Math.min(100, Number(data.reputationScore || data.reputation || 50)));
      const infScore = Math.max(0, Math.min(100, Number(data.influenceScore || data.influence || 20)));
      const conScore = Math.max(0, Math.min(100, Number(data.contributionScore || data.contribution || 25)));

      const repBand = getReputationBand(repScore);
      const infBand = getInfluenceBand(infScore);
      const conBand = getContributionBand(conScore);

      // Trust factors (audit items safe for display)
      const trustFactors = [];
      if (data.isVerified) {
        trustFactors.push({ id: 'verified', label: 'Identity Verified', icon: 'ShieldCheck', positive: true });
      }
      if ((data.activeDaysCount || 0) >= 7) {
        trustFactors.push({ id: 'active', label: 'Consistent Citizen', icon: 'Flame', positive: true });
      }
      if (data.policyStanding === 'good' || !data.policyStanding) {
        trustFactors.push({ id: 'standing', label: 'Good Policy Standing', icon: 'CheckCircle', positive: true });
      }
      if ((data.commentsCount || 0) >= 10 || (data.postsCount || 0) >= 5) {
        trustFactors.push({ id: 'community', label: 'Constructive Participation', icon: 'Users', positive: true });
      }
      if (data.isCreator) {
        trustFactors.push({ id: 'creator', label: 'Accredited Creator', icon: 'Award', positive: true });
      }

      const profile = {
        userId,
        reputation: {
          score: repScore,
          band: repBand.label,
          color: repBand.color,
          description: repBand.description,
        },
        influence: {
          score: infScore,
          band: infBand.label,
          color: infBand.color,
        },
        contribution: {
          score: conScore,
          band: conBand.label,
          color: conBand.color,
        },
        trustFactors,
        activeDaysCount: Number(data.activeDaysCount) || 1,
        activeStreak: Number(data.activeStreak) || 1,
        level: Number(data.level) || 1,
      };

      this._cache.set(userId, { profile, timestamp: Date.now() });
      return profile;
    } catch (err) {
      logger.warn('[ReputationService] Failed to load reputation profile:', { userId, error: err.message });
      return this._getDefaultProfile();
    }
  }

  _getDefaultProfile() {
    const repBand = getReputationBand(50);
    const infBand = getInfluenceBand(20);
    const conBand = getContributionBand(20);
    return {
      reputation: { score: 50, band: repBand.label, color: repBand.color, description: repBand.description },
      influence: { score: 20, band: infBand.label, color: infBand.color },
      contribution: { score: 20, band: conBand.label, color: conBand.color },
      trustFactors: [{ id: 'standing', label: 'Good Standing', icon: 'CheckCircle', positive: true }],
      activeDaysCount: 1,
      activeStreak: 1,
      level: 1,
    };
  }

  invalidate(userId) {
    if (userId) this._cache.delete(userId);
  }
}

export const reputationService = new ReputationService();
export default reputationService;
