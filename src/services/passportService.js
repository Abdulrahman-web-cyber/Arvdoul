// src/services/passportService.js — ARVDOUL PASSPORT & CITIZENSHIP ENGINE (Part 2)
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

    // Resolve viewer capabilities using Part 1 canonical engine
    const isOwner = viewerUserId === targetUserId;
    const capabilities = resolveCapabilities({
      viewer: { uid: viewerUserId },
      target: profile,
      relationship: {
        isBlocked: false,
        isRestricted: false,
        isFollower: false,
        isMutualFriend: false,
        areFriends: false,
      },
    });

    // Authoritative numeric projection. Every dimension is server-optional; an
    // absent score is reported as unknown (null) and its band omitted, never
    // replaced by a plausible default (no pay-to-legitimacy, no fabricated trust).
    // 0-100 dimensions are clamped to the band scale; a non-finite value is
    // unknown, not zero.
    const toScore = (raw) => {
      if (raw === null || raw === undefined || raw === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
    };

    // Level and streak counters are not 0-100 bands: accept any finite
    // non-negative server value as-is (clamping would fabricate a different
    // number), otherwise report unknown.
    const toCount = (raw) => {
      if (raw === null || raw === undefined || raw === '') return null;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };

    const level = toCount(profile.level);
    const activeDaysCount = toCount(profile.activeDaysCount);
    const activeStreak = toCount(profile.activeStreak);

    const citizenTier = level === null ? null : getCitizenTier(level, activeDaysCount);
    const rankTitle = level === null ? null : getRankTitle(level);

    const repScore = toScore(profile.reputationScore ?? profile.reputation);
    const infScore = toScore(profile.influenceScore ?? profile.influence);
    const conScore = toScore(profile.contributionScore ?? profile.contribution);

    const reputationBand = repScore === null ? null : getReputationBand(repScore);
    const influenceBand = infScore === null ? null : getInfluenceBand(infScore);
    const contributionBand = conScore === null ? null : getContributionBand(conScore);

    // Load achievements if viewer is permitted
    let verifiedAchievements = Array.isArray(profile.achievements) ? profile.achievements : null;
    if (verifiedAchievements === null && (capabilities.canViewAchievements || isOwner)) {
      try {
        verifiedAchievements = await achievementService.getUserAchievements(targetUserId);
      } catch (e) {
        verifiedAchievements = [];
      }
    }
    if (!Array.isArray(verifiedAchievements)) {
      verifiedAchievements = [];
    }

    // Load titles only when the capability engine authorizes the titles
    // surface (fail-closed). An unauthorized viewer must not cause a title read.
    let earnedTitles = Array.isArray(profile.titles) ? profile.titles : null;
    if (earnedTitles === null && (capabilities.canViewTitles || isOwner)) {
      try {
        earnedTitles = await titleService.getUserTitles(targetUserId);
      } catch (e) {
        earnedTitles = [];
      }
    }
    if (!Array.isArray(earnedTitles)) {
      earnedTitles = [];
    }

    const citizenId = `ARV-${targetUserId.slice(0, 8).toUpperCase()}`;
    const issueDate = profile.createdAt?.toDate?.()
      ? profile.createdAt.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
      : null;

    return {
      userId: targetUserId,
      citizenId,
      issueDate,
      // Identity is reported verbatim; a missing name is unknown, not a
      // plausible placeholder.
      displayName: profile.displayName || profile.name || null,
      username: profile.username || null,
      photoURL: profile.photoURL || null,
      primaryTitle: profile.primaryTitle || profile.activeTitle?.name || citizenTier?.tier || null,
      activeTitle: profile.activeTitle || null,
      rankTitle,
      citizenTier,
      level,
      activeDaysCount,
      activeStreak,
      reputation: reputationBand
        ? { score: repScore, band: reputationBand.label, color: reputationBand.color }
        : null,
      influence: influenceBand
        ? { score: infScore, band: influenceBand.label, color: influenceBand.color }
        : null,
      contribution: contributionBand
        ? { score: conScore, band: contributionBand.label, color: contributionBand.color }
        : null,
      achievements: verifiedAchievements,
      titles: earnedTitles,
      passportUrl: getProfileUrl(targetUserId),
      isOwner,
      capabilities,
      isVerified: Boolean(profile.isVerified),
      isCreator: Boolean(profile.isCreator),
      creatorTier: profile.creatorTier || null,
    };
  }
}

export const passportService = new PassportService();
export default passportService;
