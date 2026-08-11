/**
 * src/services/policyAuthoringService.js - ARVDOUL COMMUNITY GUIDELINES & POLICY ENGINE
 *
 * Implements:
 * 1. Policy Versioning & Changelog Registry: Tracks revisions of terms of service, safety policies, and copyright rules.
 * 2. Mandatory User Acceptance Gate: Forces re-acceptance on major policy updates (e.g. Terms v2.0).
 * 3. Policy Policy Rules Manifest.
 */

import { logger } from '../utils/Logger.js';

class PolicyAuthoringService {
  constructor() {
    this.currentPolicyVersion = '2.4.0';
    this.policies = [
      {
        id: 'safety_guidelines',
        title: 'Community Safety & Respect Guidelines',
        version: '2.4.0',
        lastUpdated: '2026-06-01',
        requiresExplicitConsent: true,
        summary: 'Prohibits violent extremism, child sexual exploitation, hate speech, financial fraud, and harassment.',
      },
      {
        id: 'terms_of_service',
        title: 'Arvdoul Terms of Service',
        version: '2.4.0',
        lastUpdated: '2026-06-01',
        requiresExplicitConsent: true,
        summary: 'Governs platform usage, coin purchases, content ownership, and dispute arbitration.',
      },
      {
        id: 'creator_monetization',
        title: 'Creator Monetization & Coin Payout Terms',
        version: '1.8.0',
        lastUpdated: '2026-05-15',
        requiresExplicitConsent: true,
        summary: 'Covers revenue splits, 1099-K tax requirements, chargeback liabilities, and withdrawal thresholds.',
      },
    ];
  }

  getPolicies() {
    return this.policies;
  }

  getPolicyVersion() {
    return this.currentPolicyVersion;
  }

  /**
   * Checks if a user has accepted the latest mandatory policy version.
   */
  hasAcceptedLatestPolicy(userProfile) {
    if (!userProfile) return false;
    return userProfile.acceptedPolicyVersion === this.currentPolicyVersion;
  }

  /**
   * Records user policy agreement in Firestore.
   */
  async recordPolicyAcceptance(userId) {
    try {
      const { getFirestoreInstance } = await import('../firebase/firebase.js');
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const db = await getFirestoreInstance();

      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        acceptedPolicyVersion: this.currentPolicyVersion,
        policyAcceptedAt: serverTimestamp(),
      });

      logger.info(`[PolicyAuthoring] User ${userId} accepted policy v${this.currentPolicyVersion}`);
      return { success: true };
    } catch (err) {
      logger.error(`[PolicyAuthoring] Failed to record policy acceptance for ${userId}:`, { error: err.message });
      throw err;
    }
  }
}

export const policyAuthoringService = new PolicyAuthoringService();
export default policyAuthoringService;
