// src/services/reputationService.js — ARVDOUL REPUTATION, INFLUENCE & CONTRIBUTION ENGINE (Part 2)
// Measures genuine trust, impact, and ecosystem value. Zero Pay-to-Legitimacy.

import {
  getReputationBand,
  getInfluenceBand,
  getContributionBand,
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
   *
   * Every dimension is derived from a stored, server-authoritative field. When a
   * dimension is absent the service reports it as unavailable (`null` score,
   * `available: false`) instead of inventing a plausible-but-false baseline.
   */
  async getReputationProfile(userId, fallbackData = null) {
    if (!userId) return this._getUnavailableProfile();

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

      const readScore = (...candidates) => {
        for (const value of candidates) {
          if (value !== undefined && value !== null && value !== '') {
            const num = Number(value);
            if (!Number.isNaN(num)) return Math.max(0, Math.min(100, num));
          }
        }
        return null;
      };

      const repScore = readScore(data.reputationScore, data.reputation);
      const infScore = readScore(data.influenceScore, data.influence);
      const conScore = readScore(data.contributionScore, data.contribution);

      const dimension = (score, bandFn) => (
        score === null
          ? { score: null, band: null, color: null, description: null, available: false }
          : { score, band: bandFn(score).label, color: bandFn(score).color, description: bandFn(score).description, available: true }
      );

      const reputation = dimension(repScore, getReputationBand);
      const influence = dimension(infScore, getInfluenceBand);
      const contribution = dimension(conScore, getContributionBand);

      // Trust factors (audit items safe for display). Only positive, evidence-backed
      // signals; never a synthetic "Good Standing" placeholder.
      const trustFactors = [];
      if (data.isVerified) {
        trustFactors.push({ id: 'verified', label: 'Identity Verified', icon: 'ShieldCheck', positive: true });
      }
      if ((data.activeDaysCount || 0) >= 7) {
        trustFactors.push({ id: 'active', label: 'Consistent Citizen', icon: 'Flame', positive: true });
      }
      if (data.policyStanding === 'good') {
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
        available: reputation.available || influence.available || contribution.available,
        reputation,
        influence,
        contribution,
        trustFactors,
        activeDaysCount: Number(data.activeDaysCount) || null,
        activeStreak: Number(data.activeStreak) || null,
        level: Number(data.level) || null,
      };

      this._cache.set(userId, { profile, timestamp: Date.now() });
      return profile;
    } catch (err) {
      logger.warn('[ReputationService] Failed to load reputation profile:', { userId, error: err.message });
      return this._getUnavailableProfile();
    }
  }

  _getUnavailableProfile() {
    const unavailable = { score: null, band: null, color: null, description: null, available: false };
    return {
      available: false,
      reputation: unavailable,
      influence: unavailable,
      contribution: unavailable,
      trustFactors: [],
      activeDaysCount: null,
      activeStreak: null,
      level: null,
    };
  }

  invalidate(userId) {
    if (userId) this._cache.delete(userId);
  }
}

export const reputationService = new ReputationService();
export default reputationService;
