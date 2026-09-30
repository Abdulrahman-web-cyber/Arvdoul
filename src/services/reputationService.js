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
  // Canonical reputation profile; null when the domain has no data for this
  // citizen. Never a fabricated score/band.
  async getReputationProfile(userId, fallbackData = null) {
    if (!userId) return null;

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

      // Scores are server-authoritative and optional. When a score is absent the
      // dimension is reported as unknown (null) rather than a plausible default.
      const toScore = (raw) => {
        if (raw === null || raw === undefined || raw === '') return null;
        const n = Number(raw);
        return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
      };
      const repScore = toScore(data.reputationScore ?? data.reputation);
      const infScore = toScore(data.influenceScore ?? data.influence);
      const conScore = toScore(data.contributionScore ?? data.contribution);

      const repBand = repScore === null ? null : getReputationBand(repScore);
      const infBand = infScore === null ? null : getInfluenceBand(infScore);
      const conBand = conScore === null ? null : getContributionBand(conScore);

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
        reputation: repBand
          ? { score: repScore, band: repBand.label, color: repBand.color, description: repBand.description }
          : null,
        influence: infBand
          ? { score: infScore, band: infBand.label, color: infBand.color }
          : null,
        contribution: conBand
          ? { score: conScore, band: conBand.label, color: conBand.color }
          : null,
        trustFactors,
        activeDaysCount: Number.isFinite(Number(data.activeDaysCount)) ? Number(data.activeDaysCount) : null,
        activeStreak: Number.isFinite(Number(data.activeStreak)) ? Number(data.activeStreak) : null,
        level: Number.isFinite(Number(data.level)) && Number(data.level) > 0 ? Number(data.level) : null,
      };

      // Cache only real standings; an unknown profile must not be cached as truth.
      if (repScore !== null || infScore !== null || conScore !== null) {
        this._cache.set(userId, { profile, timestamp: Date.now() });
      }
      return profile;
    } catch (err) {
      logger.warn('[ReputationService] Failed to load reputation profile:', { userId, error: err.message });
      return null;
    }
  }

  invalidate(userId) {
    if (userId) this._cache.delete(userId);
  }
}

export const reputationService = new ReputationService();
export default reputationService;
