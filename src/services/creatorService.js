// src/services/creatorService.js — ARVDOUL CREATOR SYSTEM (Part 2)
// Capability-based, professional workspace, gated onboarding.

import {
  getCreatorCapabilities,
  CREATOR_TIERS,
  LEVEL_GATES,
} from './levelSystemService.js';
import { callFunction, FUNCTIONS } from './callableService.js';
import { getFirestoreInstance } from '../firebase/firebase.js';
import { doc, getDoc } from 'firebase/firestore';
import { logger } from '../utils/Logger.js';

class CreatorService {
  constructor() {
    this._cache = new Map();
  }

  /**
   * Evaluates creator capabilities from profile.
   */
  getCapabilities(profile) {
    return getCreatorCapabilities(profile);
  }

  /**
   * Get creator tiers metadata.
   */
  getTiers() {
    return CREATOR_TIERS;
  }

  /**
   * Check whether an account is eligible to apply for Creator status.
   */
  isEligibleToApply(userProfile) {
    if (!userProfile) return { eligible: false, reasons: ['Sign in required'] };
    const level = Number(userProfile.level) || 1;
    const reasons = [];

    if (level < LEVEL_GATES.creatorProfile) {
      reasons.push(`Requires Level ${LEVEL_GATES.creatorProfile} (Current: ${level})`);
    }
    if (userProfile.policyStanding && userProfile.policyStanding !== 'good') {
      reasons.push('Account must be in good policy standing');
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Fetches official creator profile document.
   */
  async getCreatorProfile(userId) {
    if (!userId) return null;

    try {
      const db = await getFirestoreInstance();
      const snap = await getDoc(doc(db, 'creator_profiles', userId));
      if (!snap.exists()) return null;
      return {
        id: snap.id,
        ...snap.data(),
        appliedAt: snap.data().appliedAt?.toDate?.() || null,
        approvedAt: snap.data().approvedAt?.toDate?.() || null,
      };
    } catch (err) {
      logger.warn('[CreatorService] Failed to load creator profile:', { userId, error: err.message });
      return null;
    }
  }

  /**
   * Submits creator onboarding application through server-authoritative callable.
   */
  async applyForCreator({ category, bio, links = [] }) {
    try {
      const res = await callFunction(FUNCTIONS.APPLY_FOR_CREATOR, {
        category,
        bio,
        links,
      });
      return res;
    } catch (err) {
      logger.error('[CreatorService] applyForCreator failed:', err);
      throw err;
    }
  }
}

export const creatorService = new CreatorService();
export default creatorService;
