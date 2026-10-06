// src/services/passportService.js
//
// The institutional digital-nation identity artifact.

import {
  getCitizenTier,
  getRankTitle,
  getReputationBand,
  getInfluenceBand,
  getContributionBand,
} from './levelSystemService.js';
import { getProfileUrl } from '../utils/shareUtils.js';
import { resolveCapabilities } from './profileCapabilityEngine.js';
import { pickDisplayName, resolveVerifiedFlag, resolveCreatorFlag } from './profileReadModel.js';
import achievementService from './achievementService.js';
import titleService from './titleService.js';
import { getFirestoreInstance } from '../firebase/firebase.js';
import { doc, getDoc } from 'firebase/firestore';
import { logger } from '../utils/Logger.js';

class PassportService {
  /**
   * Builds the authorized Digital Nation Passport projection.
   * Enforces viewer privacy prior to rendering.
   *
   * @param {string} targetUserId
   * @param {string} viewerUserId
   * @param {Object} [cachedTargetProfile=null]
   * @returns {Promise<Object>}
   */
  async getPassport(targetUserId, viewerUserId, cachedTargetProfile = null) {
    if (!targetUserId) throw new Error('targetUserId is required');

    let profile = cachedTargetProfile;
    if (!profile) {
      const db = await getFirestoreInstance();
      const snap = await getDoc(doc(db, 'users', targetUserId));
      profile = snap.exists() ? { id: snap.id, ...snap.data() } : { id: targetUserId };
    }

    // Resolve the relationship (owner / follower / connection / blocked)
    // from the follow + block graph instead of assuming an empty relationship.
    // An empty relationship made every passport render as if it were the
    // viewer's own, bypassing the privacy gates below.
    const isOwner = viewerUserId === targetUserId;
    const relationship = await this._resolveRelationship(viewerUserId, targetUserId);

    // Resolve viewer capabilities using Part 1 canonical engine
    const capabilities = resolveCapabilities({
      viewer: { uid: viewerUserId },
      target: profile,
      relationship,
    });

    const hasLevel = profile.level !== undefined && profile.level !== null;
    const level = hasLevel ? Number(profile.level) : null;
    const hasActiveDays = profile.activeDaysCount !== undefined && profile.activeDaysCount !== null;
    const activeDaysCount = hasActiveDays ? Number(profile.activeDaysCount) : null;
    const activeStreak = profile.activeStreak !== undefined && profile.activeStreak !== null
      ? Number(profile.activeStreak)
      : null;

    const citizenTier = level !== null ? getCitizenTier(level, activeDaysCount || 0) : null;
    const rankTitle = level !== null ? getRankTitle(level) : null;

    const readScore = (...candidates) => {
      for (const value of candidates) {
        if (value !== undefined && value !== null && value !== '') {
          const num = Number(value);
          if (!Number.isNaN(num)) return Math.max(0, Math.min(100, num));
        }
      }
      return null;
    };

    const dimension = (score, bandFn) => (
      score === null
        ? { score: null, band: null, color: null, available: false }
        : { score, band: bandFn(score).label, color: bandFn(score).color, available: true }
    );

    // Standing dimensions are gated by the viewer's capabilities: a viewer who
    // may not see achievements also may not read the (achievement-derived)
    // standing scores. Absent data is reported unavailable, never defaulted.
    const canSeeStanding = Boolean(capabilities.canViewAchievements || isOwner);
    const reputation = canSeeStanding ? dimension(readScore(profile.reputationScore, profile.reputation), getReputationBand) : { score: null, band: null, color: null, available: false };
    const influence = canSeeStanding ? dimension(readScore(profile.influenceScore, profile.influence), getInfluenceBand) : { score: null, band: null, color: null, available: false };
    const contribution = canSeeStanding ? dimension(readScore(profile.contributionScore, profile.contribution), getContributionBand) : { score: null, band: null, color: null, available: false };

    // Achievements: only if the viewer is permitted.
    let verifiedAchievements = [];
    if (capabilities.canViewAchievements || isOwner) {
      if (Array.isArray(profile.achievements)) {
        verifiedAchievements = profile.achievements;
      } else {
        try {
          verifiedAchievements = await achievementService.getUserAchievements(targetUserId);
        } catch (e) {
          verifiedAchievements = [];
        }
      }
    }
    if (!Array.isArray(verifiedAchievements)) verifiedAchievements = [];

    // Titles: only if the viewer is permitted (previously loaded for everyone).
    let earnedTitles = [];
    if (capabilities.canViewTitles || isOwner) {
      if (Array.isArray(profile.titles)) {
        earnedTitles = profile.titles;
      } else {
        try {
          earnedTitles = await titleService.getUserTitles(targetUserId);
        } catch (e) {
          earnedTitles = [];
        }
      }
    }
    if (!Array.isArray(earnedTitles)) earnedTitles = [];

    const citizenId = `ARV-${targetUserId.slice(0, 8).toUpperCase()}`;
    const issueDate = profile.createdAt?.toDate?.()
      ? profile.createdAt.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
      : null;

    return {
      userId: targetUserId,
      citizenId,
      issueDate,
      // No invented holder name: when the profile has none, report absence
      // rather than presenting a synthetic generic citizen name.
      displayName: pickDisplayName([profile.displayName, profile.name], { fallback: null }),
      username: profile.username || null,
      photoURL: profile.photoURL || null,
      primaryTitle: profile.primaryTitle || profile.activeTitle?.name || citizenTier?.tier || null,
      activeTitle: profile.activeTitle || null,
      rankTitle,
      citizenTier,
      level,
      activeDaysCount,
      activeStreak,
      reputation,
      influence,
      contribution,
      achievements: verifiedAchievements,
      titles: earnedTitles,
      passportUrl: getProfileUrl(targetUserId),
      isOwner,
      capabilities,
      isVerified: resolveVerifiedFlag(profile),
      isCreator: resolveCreatorFlag(profile, {}, level),
      creatorTier: profile.creatorTier || null,
    };
  }

  /**
   * Resolve the relationship between viewer and target. Delegates to the
   * canonical userService.getRelationshipState so the passport gates see the
   * same follow/block graph as every other surface, rather than a second
   * hand-rolled read.
   * @private
   */
  async _resolveRelationship(viewerUserId, targetUserId) {
    if (!viewerUserId || viewerUserId === targetUserId) {
      return { isFollower: false, isFollowing: false, isMutualFriend: false, isBlocked: false };
    }
    try {
      const { getRelationshipState } = await import('./userService.js');
      const rel = await getRelationshipState(viewerUserId, targetUserId);
      return {
        isFollowing: Boolean(rel?.isFollowing),
        isFollower: Boolean(rel?.isFollower),
        isMutualFriend: Boolean(rel?.isMutualFriend),
        isBlocked: Boolean(rel?.isBlocked),
      };
    } catch (e) {
      logger.warn('[PassportService] Relationship resolution failed; failing closed', {
        viewerUserId, targetUserId, error: e?.message,
      });
      // Fail closed: assume blocked rather than granting access.
      return { isFollower: false, isFollowing: false, isMutualFriend: false, isBlocked: true };
    }
  }
}

export const passportService = new PassportService();
export default passportService;
