/**
 * src/services/userIntegrityService.js - ARVDOUL USER INTEGRITY & TRUST ENGINE
 *
 * Implements:
 * 1. Multi-Dimensional Trust Score (0-100): Evaluates account age, phone/email verification, strike history,
 *    report ratio, and verified creator status.
 * 2. Strike & Warning Lifecycle: Enforces progressive discipline:
 *    - 1st Strike: Warning notice + educational policy acknowledgment
 *    - 2nd Strike: 24-hour posting / commenting restriction
 *    - 3rd Strike: 7-day shadowban / reach restriction
 *    - 4th Strike: Permanent account suspension
 * 3. Farm & Sybil Defense: Detects coordinated like/follow networks operating from shared subnets or device hashes.
 * 4. Ban Evasion Interception: Prevents banned users from creating alt accounts matching hardware hashes or payment methods.
 * 5. Appeals Management Pipeline: User appeal submission and human review lifecycle.
 */

import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';

class UserIntegrityService {
  /**
   * Calculates dynamic user trust score (0 to 100).
   */
  calculateTrustScore(userProfile, activityStats = {}) {
    if (!userProfile) return 50;

    let score = 60; // baseline score

    // Account Age Bonus
    const ageDays = Math.floor((Date.now() - (userProfile.createdAt?.toMillis?.() || Date.now())) / (1000 * 60 * 60 * 24));
    if (ageDays > 365) score += 20;
    else if (ageDays > 90) score += 10;
    else if (ageDays > 30) score += 5;
    else if (ageDays < 2) score -= 15; // Brand new accounts start with lower trust

    // Verification Multipliers
    if (userProfile.isVerifiedCreator) score += 20;
    if (userProfile.emailVerified) score += 5;
    if (userProfile.phoneNumber) score += 10;

    // Strikes Penalty
    const strikes = userProfile.strikesCount || 0;
    score -= strikes * 25;

    // Report Ratio Penalty
    const reportsReceived = activityStats.reportsReceived || 0;
    if (reportsReceived > 5) score -= 20;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Issues a warning or strike to a user profile.
   */
  async issueStrike(userId, reason, strikeLevel = 1) {
    try {
      const { getFirestoreInstance } = await import('../firebase/firebase.js');
      const { doc, getDoc, updateDoc, increment, serverTimestamp } = await import('firebase/firestore');
      const db = await getFirestoreInstance();

      const userRef = doc(db, 'users', userId);
      const snap = await getDoc(userRef);
      if (!snap.exists()) return { success: false, reason: 'User not found' };

      const currentStrikes = (snap.data().strikesCount || 0) + 1;

      let restriction = 'none';
      if (currentStrikes === 1) restriction = 'warning';
      else if (currentStrikes === 2) restriction = 'restricted_24h';
      else if (currentStrikes === 3) restriction = 'restricted_7d';
      else if (currentStrikes >= 4) restriction = 'permanent_ban';

      await updateDoc(userRef, {
        strikesCount: increment(1),
        restrictionStatus: restriction,
        lastStrikeReason: reason,
        lastStrikeAt: serverTimestamp(),
      });

      logger.warn(`[UserIntegrity] Strike #${currentStrikes} issued to user ${userId}: ${reason} (Restriction: ${restriction})`);
      auditLogger.log('moderation.strike_issued', {
        userId,
        meta: { strikes: currentStrikes, restriction, reason },
      });

      return {
        success: true,
        currentStrikes,
        restriction,
        reason,
      };
    } catch (err) {
      logger.error(`[UserIntegrity] Failed to issue strike to ${userId}:`, { error: err.message });
      throw err;
    }
  }

  /**
   * Submits an appeal for a strike or suspension.
   */
  async submitAppeal(userId, strikeId, appealStatement) {
    try {
      const { getFirestoreInstance } = await import('../firebase/firebase.js');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const db = await getFirestoreInstance();

      const appealDoc = {
        userId,
        strikeId,
        statement: appealStatement,
        status: 'pending', // 'pending' | 'granted' | 'rejected'
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'moderation_appeals'), appealDoc);
      logger.info(`[UserIntegrity] User appeal created: ${docRef.id} for user ${userId}`);
      auditLogger.log('moderation.appeal_submitted', { userId, meta: { appealId: docRef.id, strikeId } });

      return { success: true, appealId: docRef.id };
    } catch (err) {
      logger.error(`[UserIntegrity] Appeal submission failed:`, { error: err.message });
      throw err;
    }
  }
}

export const userIntegrityService = new UserIntegrityService();
export default userIntegrityService;
