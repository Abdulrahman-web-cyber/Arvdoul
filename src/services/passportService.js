// src/services/passportService.js
//
// The institutional digital-nation identity artifact.

import {
  getCitizenTier,
  getRankTitle,
  getReputationBand,
  getInfluenceBand,
  getContributionBand,
  getRoyalEligibility,
} from './levelSystemService.js';
import { getProfileUrl, getPassportUrl } from '../utils/shareUtils.js';
import { resolveCapabilities } from './profileCapabilityEngine.js';
import { pickDisplayName, resolveVerifiedFlag, resolveCreatorFlag } from './profileReadModel.js';
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
      try {
        const { getUserService } = await import('./userService.js');
        profile = await getUserService().getUserProfile(targetUserId);
      } catch (err) {
        logger.warn('[PassportService] Failed to load target profile', { targetUserId, error: err?.message });
        profile = { id: targetUserId };
      }
    }

    // Resolve the relationship (owner / follower / connection / blocked)
    // from the follow + block graph instead of assuming an empty relationship.
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
          const { default: achievementService } = await import('./achievementService.js');
          verifiedAchievements = await achievementService.getUserAchievements(targetUserId);
        } catch (e) {
          verifiedAchievements = [];
        }
      }
    }
    if (!Array.isArray(verifiedAchievements)) verifiedAchievements = [];

    // Titles: only if the viewer is permitted.
    let earnedTitles = [];
    if (capabilities.canViewTitles || isOwner) {
      if (Array.isArray(profile.titles)) {
        earnedTitles = profile.titles;
      } else {
        try {
          const { default: titleService } = await import('./titleService.js');
          earnedTitles = await titleService.getUserTitles(targetUserId);
        } catch (e) {
          earnedTitles = [];
        }
      }
    }
    if (!Array.isArray(earnedTitles)) earnedTitles = [];

    const isVerified = resolveVerifiedFlag(profile);
    const isCreator = resolveCreatorFlag(profile, {}, level);

    const citizenId = `ARV-${targetUserId.slice(0, 8).toUpperCase()}`;
    const issueDate = profile.createdAt?.toDate?.()
      ? profile.createdAt.toDate().toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
      : null;

    // Evaluate multidimensional royal eligibility strictly from levelConfig
    const royalStats = {
      level: level ?? 0,
      activeDaysCount: activeDaysCount ?? 0,
      reputationScore: reputation?.score ?? 0,
      influenceScore: influence?.score ?? 0,
      contributionScore: contribution?.score ?? 0,
      achievementsCount: verifiedAchievements.length,
      policyStanding: profile.policyStanding || 'good',
    };
    const dukeEligibility = getRoyalEligibility('duke', royalStats);
    const kingEligibility = getRoyalEligibility('king', royalStats);

    // Derive sovereign visa & event stamps based on authenticated milestones
    const visaStamps = this._deriveVisaStamps({
      profile,
      level,
      activeDaysCount,
      activeStreak,
      verifiedAchievements,
      earnedTitles,
      isCreator,
      isVerified,
      issueDate,
    });

    const sanitizedUsername = (profile.username || 'CITIZEN').toUpperCase().replace(/[^A-Z0-9]/g, '<');
    const mrtdLine1 = `P<ARV${sanitizedUsername.padEnd(20, '<')}`.slice(0, 44);
    const mrtdLine2 = `${citizenId.replace(/[^A-Z0-9]/g, '<')}5ARV0001014M9912316<<<<<<<<<<<<<<02`.slice(0, 44);

    return {
      userId: targetUserId,
      citizenId,
      issueDate,
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
      passportUrl: getPassportUrl(targetUserId),
      isOwner,
      capabilities,
      isVerified,
      isCreator,
      creatorTier: profile.creatorTier || null,
      royalEligibility: {
        duke: dukeEligibility,
        king: kingEligibility,
        isPeerOfRealm: dukeEligibility.eligible || kingEligibility.eligible,
      },
      visaStamps,
      nationalMotto: 'Veritas, Civitas, Concordia',
      mrtdLines: [mrtdLine1, mrtdLine2],
    };
  }

  /**
   * Derive verified digital visa stamps for the passport.
   * @private
   */
  _deriveVisaStamps({
    profile,
    level,
    activeDaysCount,
    activeStreak,
    verifiedAchievements,
    earnedTitles,
    isCreator,
    isVerified,
    issueDate,
  }) {
    const stamps = [];

    // 1. Genesis / Founding Era Stamp
    if (profile.createdAt || issueDate) {
      stamps.push({
        id: 'stamp_genesis',
        code: 'ARV-GEN-01',
        title: 'Genesis Citizen',
        ministry: 'Ministry of State Registry',
        category: 'Founding',
        issuedAt: issueDate || 'Genesis Era',
        verified: true,
        sealType: 'gold',
        icon: '🏛️',
        description: 'Certified founding citizen registered during the national genesis epoch.',
      });
    }

    // 2. Sovereign Border Clearance
    stamps.push({
      id: 'stamp_border',
      code: 'ARV-SBC-PASS',
      title: 'Border Clearance',
      ministry: 'Sovereign Border Agency',
      category: 'Security',
      issuedAt: 'Perpetual',
      verified: true,
      sealType: 'emerald',
      icon: '🛡️',
      description: 'Permanent right of passage and cryptographic peer clearance across Arvdoul.',
    });

    // 3. Civic Vanguard Stamp (Level 10+ or 7+ day streak)
    const hasVanguard = (level !== null && level >= 10) || (activeStreak !== null && activeStreak >= 7);
    stamps.push({
      id: 'stamp_vanguard',
      code: 'ARV-CVG-010',
      title: 'Civic Vanguard',
      ministry: 'Chancellery of Civic Merit',
      category: 'Civic',
      issuedAt: hasVanguard ? (issueDate || 'Epoch I') : null,
      verified: hasVanguard,
      sealType: 'indigo',
      icon: '⚔️',
      description: hasVanguard
        ? 'Commended for civic discipline and persistent participation in the commonwealth.'
        : 'Requires Level 10 or a 7-day sustained citizenship streak to unlock.',
    });

    // 4. Creative Laureate Visa
    const hasCreative = isCreator || (profile.reelsCount > 0) || (profile.videosCount > 0);
    stamps.push({
      id: 'stamp_creative',
      code: 'ARV-CLM-005',
      title: 'Creative Laureate',
      ministry: 'Guild of Sovereign Media',
      category: 'Creative',
      issuedAt: hasCreative ? (issueDate || 'Epoch I') : null,
      verified: hasCreative,
      sealType: 'amber',
      icon: '🎨',
      description: hasCreative
        ? 'Recognized cultural producer contributing artistic media and audio to the nation.'
        : 'Requires publishing sovereign videos, audio tracks, or creator status.',
    });

    // 5. Diplomatic Envoy Stamp (Level 15+ or verified citizen)
    const hasDiplomatic = isVerified || (level !== null && level >= 15);
    stamps.push({
      id: 'stamp_diplomatic',
      code: 'ARV-DIP-015',
      title: 'Diplomatic Envoy',
      ministry: 'Diplomatic Mission Corps',
      category: 'Diplomatic',
      issuedAt: hasDiplomatic ? (issueDate || 'Epoch I') : null,
      verified: hasDiplomatic,
      sealType: 'ruby',
      icon: '📜',
      description: hasDiplomatic
        ? 'Granted diplomatic audience and cross-community representation credentials.'
        : 'Requires verified identity credentials or Level 15 citizenship standing.',
    });

    // 6. National Honors Ribbon Stamp
    const hasHonors = (verifiedAchievements && verifiedAchievements.length >= 3) || (earnedTitles && earnedTitles.length >= 1);
    stamps.push({
      id: 'stamp_honors',
      code: 'ARV-NHL-003',
      title: 'Honors Legion',
      ministry: 'High Council of Honors',
      category: 'Prestige',
      issuedAt: hasHonors ? (issueDate || 'Epoch I') : null,
      verified: hasHonors,
      sealType: 'gold',
      icon: '👑',
      description: hasHonors
        ? 'Bestowed for distinguished service and decorated achievements in Arvdoul.'
        : 'Requires at least 3 verified achievements or an earned national title.',
    });

    return stamps;
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
