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

    const level = Number(profile.level) || 1;
    const activeDaysCount = Number(profile.activeDaysCount) || 1;
    const activeStreak = Number(profile.activeStreak) || 1;

    const citizenTier = getCitizenTier(level, activeDaysCount);
    const rankTitle = getRankTitle(level);
    const repScore = Number(profile.reputationScore || profile.reputation || 50);
    const infScore = Number(profile.influenceScore || profile.influence || 20);
    const conScore = Number(profile.contributionScore || profile.contribution || 25);

    const reputationBand = getReputationBand(repScore);
    const influenceBand = getInfluenceBand(infScore);
    const contributionBand = getContributionBand(conScore);

    // Load achievements if viewer is permitted
    let verifiedAchievements = [];
    if (capabilities.canViewAchievements || isOwner) {
      try {
        verifiedAchievements = await achievementService.getUserAchievements(targetUserId);
      } catch (e) {
        verifiedAchievements = [];
      }
    }

    // Load titles if permitted
    let earnedTitles = [];
    try {
      earnedTitles = await titleService.getUserTitles(targetUserId);
    } catch (e) {
      earnedTitles = [];
    }

    const citizenId = `ARV-${targetUserId.slice(0, 8).toUpperCase()}`;
    const issueDate = profile.createdAt?.toDate?.()
      ? profile.createdAt.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
      : 'Genesis Era';

    return {
      userId: targetUserId,
      citizenId,
      issueDate,
      displayName: profile.displayName || profile.name || 'Citizen of Arvdoul',
      username: profile.username || 'citizen',
      photoURL: profile.photoURL || null,
      primaryTitle: profile.primaryTitle || profile.activeTitle?.name || citizenTier.tier,
      activeTitle: profile.activeTitle || null,
      rankTitle,
      citizenTier,
      level,
      activeDaysCount,
      activeStreak,
      reputation: {
        score: repScore,
        band: reputationBand.label,
        color: reputationBand.color,
      },
      influence: {
        score: infScore,
        band: influenceBand.label,
        color: influenceBand.color,
      },
      contribution: {
        score: conScore,
        band: contributionBand.label,
        color: contributionBand.color,
      },
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
