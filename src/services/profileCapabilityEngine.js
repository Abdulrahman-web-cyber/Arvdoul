/**
 * src/services/profileCapabilityEngine.js - ARVDOUL ACTION CAPABILITY ENGINE
 * 
 * Part 1 Master Blueprint (Section 16 & 17) - Centralized Capability & Social Graph Engine.
 * Authoritatively resolves permissions and action capabilities for any viewer-target pair.
 * 
 * No client component should make ad-hoc authorization guesses.
 * All capabilities derive from viewer context, target profile state, resolved relationship,
 * privacy contracts, and safety state.
 */

import { VISIBILITY_SCOPES, DEFAULT_PROFILE_PRIVACY, canViewProfileSection } from '../config/profileContracts.js';

export const RELATIONSHIP_STATES = Object.freeze({
  NONE: 'NONE',
  FOLLOWING: 'FOLLOWING',
  FOLLOWED_BY: 'FOLLOWED_BY',
  MUTUAL: 'MUTUAL',
  REQUESTED: 'REQUESTED',
  PENDING: 'PENDING',
  BLOCKED: 'BLOCKED',
  BLOCKED_BY: 'BLOCKED_BY',
  MUTED: 'MUTED',
  RESTRICTED: 'RESTRICTED'
});

export const ACCOUNT_STATES = Object.freeze({
  ACTIVE: 'ACTIVE',
  PRIVATE: 'PRIVATE',
  SUSPENDED: 'SUSPENDED',
  DEACTIVATED: 'DEACTIVATED',
  DELETED: 'DELETED',
  RESTRICTED: 'RESTRICTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  UNAVAILABLE: 'UNAVAILABLE'
});

/**
 * Resolves the primary relationship state enum between two users
 * @param {Object} relationship
 * @returns {string} One of RELATIONSHIP_STATES
 */
export function resolveRelationshipState(relationship = {}) {
  if (relationship.isBlocking) return RELATIONSHIP_STATES.BLOCKED;
  if (relationship.isBlockedBy) return RELATIONSHIP_STATES.BLOCKED_BY;
  if (relationship.isRestricted) return RELATIONSHIP_STATES.RESTRICTED;
  if (relationship.requestStatus === 'pending') return RELATIONSHIP_STATES.PENDING;
  if (relationship.requestStatus === 'requested') return RELATIONSHIP_STATES.REQUESTED;
  if (relationship.isMutualFriend || (relationship.isFollowing && relationship.isFollower)) {
    return RELATIONSHIP_STATES.MUTUAL;
  }
  if (relationship.isFollowing) return RELATIONSHIP_STATES.FOLLOWING;
  if (relationship.isFollower) return RELATIONSHIP_STATES.FOLLOWED_BY;
  if (relationship.isMuted) return RELATIONSHIP_STATES.MUTED;
  return RELATIONSHIP_STATES.NONE;
}

/**
 * Resolves comprehensive capabilities for a viewer interacting with a target profile.
 * 
 * @param {Object} params
 * @param {Object} params.viewer - { uid, email, isVerified, ... }
 * @param {Object} params.target - { uid, id, isPrivate, accountStatus, privacy, ... }
 * @param {Object} params.relationship - { isOwner, isFollowing, isFollower, isMutualFriend, isBlocking, isBlockedBy, isBlocked, isMuted, isRestricted, ... }
 * @param {string|null} [params.viewAs] - Optional owner simulation mode: 'public' | 'follower' | 'connection'
 * @returns {Object} Full capability map conforming to Blueprint Section 16
 */
export function resolveCapabilities({ viewer, target, relationship = {}, viewAs = null }) {
  const viewerUid = viewer?.uid || null;
  const targetUid = target?.uid || target?.id || null;
  const isActualOwner = Boolean(viewerUid && targetUid && viewerUid === targetUid);

  // If owner is simulating another perspective using "View As"
  let effectiveRelation = 'PUBLIC';
  let isSimulatedOwner = isActualOwner;

  if (isActualOwner && viewAs) {
    if (viewAs === 'public') {
      effectiveRelation = 'PUBLIC';
      isSimulatedOwner = false;
    } else if (viewAs === 'follower') {
      effectiveRelation = 'FOLLOWER';
      isSimulatedOwner = false;
    } else if (viewAs === 'connection') {
      effectiveRelation = 'CONNECTION';
      isSimulatedOwner = false;
    }
  } else if (isActualOwner) {
    effectiveRelation = 'OWNER';
  } else if (relationship.isMutualFriend) {
    effectiveRelation = 'CONNECTION';
  } else if (relationship.isFollowing) {
    effectiveRelation = 'FOLLOWER';
  } else {
    effectiveRelation = 'PUBLIC';
  }

  // Account lifecycle checks
  const accountState = (target?.accountStatus || target?.accountState || ACCOUNT_STATES.ACTIVE).toUpperCase();
  const isAccountActive = accountState === ACCOUNT_STATES.ACTIVE;
  const isSuspendedOrDeleted = accountState === ACCOUNT_STATES.SUSPENDED || 
                               accountState === ACCOUNT_STATES.DELETED || 
                               accountState === ACCOUNT_STATES.DEACTIVATED;

  // Block & Safety enforcement
  const isBlocking = Boolean(relationship.isBlocking || relationship.isBlocked);
  const isBlockedBy = Boolean(relationship.isBlockedBy);
  const isBlocked = Boolean(isBlocking || isBlockedBy);
  const isMuted = Boolean(relationship.isMuted);
  const isRestricted = Boolean(relationship.isRestricted);

  const perspective = viewAs || (isActualOwner ? 'owner' : effectiveRelation.toLowerCase());

  // Target privacy model
  const isPrivateAccount = Boolean(target?.isPrivate);
  const targetPrivacy = target?.privacy || DEFAULT_PROFILE_PRIVACY;

  // If blocked or account is unavailable/deleted, profile access is strictly restricted
  if (isBlocked || isSuspendedOrDeleted) {
    return {
      isOwner: isSimulatedOwner,
      perspective,
      canViewProfile: isActualOwner && !isBlockedBy,
      canViewIdentity: isActualOwner && !isBlockedBy,
      canViewContent: false,
      canViewFollowers: false,
      canViewFollowing: false,
      canViewEconomicStatus: false,
      canFollow: false,
      canUnfollow: false,
      canMessage: false,
      canCall: false,
      canTip: false,
      canSubscribe: false,
      canSupport: false,
      canShare: !isSuspendedOrDeleted && !isBlocked,
      canReport: !isActualOwner && !isSuspendedOrDeleted,
      canBlock: !isActualOwner && !isBlocking,
      canUnblock: isBlocking,
      canMute: !isActualOwner && !isMuted,
      canUnmute: isMuted,
      canRestrict: !isActualOwner && !isRestricted,
      canUnrestrict: isRestricted,
      canEditProfile: isSimulatedOwner,
      canViewAnalytics: false,
      canViewAs: isActualOwner,
      isBlocked,
      isBlocking,
      isBlockedBy,
      isMuted,
      isRestricted,
      effectiveRelation,
      accountState
    };
  }

  // Content visibility
  // If private account: visible only if owner, follower, or connection
  const hasAccessToPrivateProfile = isSimulatedOwner || 
    effectiveRelation === 'FOLLOWER' || 
    effectiveRelation === 'CONNECTION';

  const canViewContent = (!isPrivateAccount || hasAccessToPrivateProfile) && isAccountActive;

  // Section-specific granular permissions using authoritative profileContracts
  const canViewFollowers = canViewProfileSection('followersList', targetPrivacy, effectiveRelation) && canViewContent;
  const canViewFollowing = canViewProfileSection('followingList', targetPrivacy, effectiveRelation) && canViewContent;
  const canViewActivity = canViewProfileSection('activity', targetPrivacy, effectiveRelation) && canViewContent;
  const canViewAchievements = canViewProfileSection('achievements', targetPrivacy, effectiveRelation) && canViewContent;
  const canViewTitles = canViewProfileSection('titles', targetPrivacy, effectiveRelation) && canViewContent;
  const canViewCommunities = canViewProfileSection('communities', targetPrivacy, effectiveRelation) && canViewContent;
  const canViewCollections = canViewProfileSection('collections', targetPrivacy, effectiveRelation) && canViewContent;
  const canViewLinks = canViewProfileSection('links', targetPrivacy, effectiveRelation);
  const canViewPresence = canViewProfileSection('presence', targetPrivacy, effectiveRelation);
  const canViewEconomicStatus = isSimulatedOwner || canViewProfileSection('economicStatus', targetPrivacy, effectiveRelation);

  // Follow / Unfollow actions
  const isFollowing = Boolean(relationship.isFollowing);
  const isPendingRequest = relationship.requestStatus === 'pending';
  const canFollow = !isActualOwner && !isFollowing && !isPendingRequest && isAccountActive;
  const canUnfollow = !isActualOwner && isFollowing && isAccountActive;
  const canCancelRequest = !isActualOwner && isPendingRequest && isAccountActive;

  // Messaging: Allowed if authenticated, not blocked, not restricted, and account is active
  // If private account, only followers/connections can message unless target explicitly allows
  const canMessage = Boolean(
    viewerUid && 
    !isActualOwner && 
    !isBlocked && 
    !isRestricted && 
    isAccountActive && 
    (!isPrivateAccount || hasAccessToPrivateProfile)
  );

  return {
    isOwner: isSimulatedOwner,
    perspective,
    canViewProfile: true,
    canViewIdentity: true,
    canViewContent,
    canViewFollowers,
    canViewFollowing,
    canViewActivity,
    canViewAchievements,
    canViewTitles,
    canViewCommunities,
    canViewCollections,
    canViewLinks,
    canViewPresence,
    canViewEconomicStatus,
    canFollow,
    canUnfollow,
    canCancelRequest,
    canMessage,
    canCall: Boolean(!isActualOwner && !isBlocked && !isRestricted && isAccountActive),
    canTip: Boolean(!isActualOwner && !isBlocked && isAccountActive),
    canSubscribe: !isActualOwner && isAccountActive,
    canSupport: !isActualOwner && isAccountActive,
    canShare: true,
    canReport: !isActualOwner,
    canBlock: !isActualOwner && !isBlocking,
    canUnblock: isBlocking,
    canMute: !isActualOwner && !isMuted,
    canUnmute: isMuted,
    canRestrict: !isActualOwner && !isRestricted,
    canUnrestrict: isRestricted,
    canEditProfile: isSimulatedOwner,
    canViewAnalytics: isSimulatedOwner,
    canViewAs: isActualOwner,
    isBlocked: false,
    isBlocking: false,
    isBlockedBy: false,
    isMuted,
    isRestricted,
    effectiveRelation,
    accountState
  };
}

export default {
  RELATIONSHIP_STATES,
  ACCOUNT_STATES,
  resolveRelationshipState,
  resolveCapabilities
};
