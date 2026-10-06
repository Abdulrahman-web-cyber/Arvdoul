// src/services/profileReadModel.js
//
// Canonical read model for the profile surfaces. Every screen previously
// re-implemented the same derivations (placeholder-name/handle rejection,
// avatar fallback, count/level coercion, creator/verified flags, and the
// capability-driven masking of economic status, links and presence). Divergence
// between those copies is what AUDIT V3 A-3 / N018 flagged. This module owns
// them once; screens supply only their own candidate ordering and fallbacks.

import { getSafeAvatarUrl } from '../utils/avatarUtils.js';
import { LEVEL_GATES } from '../shared/levelConfig.cjs';

const PLACEHOLDER_NAMES = new Set(['user', 'creator']);

export const OFFLINE_PRESENCE = Object.freeze({ isOnline: false, status: 'offline', lastActive: null });

/** Trimmed string, or null when the value is not a usable string. */
export function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** True when a display name is the generic placeholder rather than a real name. */
export function isPlaceholderName(value) {
  const cleaned = normalizeString(value);
  return cleaned !== null && PLACEHOLDER_NAMES.has(cleaned.toLowerCase());
}

/** True when a handle is a synthetic `user_*` id or a generic placeholder. */
export function isPlaceholderHandle(value) {
  const cleaned = normalizeString(value);
  if (cleaned === null) return true;
  return cleaned.startsWith('user_') || PLACEHOLDER_NAMES.has(cleaned.toLowerCase());
}

/**
 * Derive a handle from an email or display name. Returns null when the derived
 * value is itself a placeholder, so callers can fall through to their fallback.
 */
export function deriveHandle(value) {
  const cleaned = normalizeString(value);
  if (cleaned === null) return null;
  const derived = cleaned.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!derived || isPlaceholderHandle(derived)) return null;
  return derived;
}

/** First usable handle from the candidates, else null. */
export function pickHandle(candidates) {
  for (const candidate of candidates) {
    const cleaned = normalizeString(candidate);
    if (cleaned !== null && !isPlaceholderHandle(cleaned)) return cleaned;
  }
  return null;
}

/**
 * First non-placeholder display name from the candidates, else the fallback.
 * `rejectPlaceholder: false` keeps a literal "User"/"Creator" the owner set.
 */
export function pickDisplayName(candidates, { fallback = 'Creator', rejectPlaceholder = true } = {}) {
  for (const candidate of candidates) {
    const cleaned = normalizeString(candidate);
    if (cleaned === null) continue;
    if (rejectPlaceholder && isPlaceholderName(cleaned)) continue;
    return cleaned;
  }
  return fallback;
}

/** Avatar with a real photo, else a deterministic SVG; never a broken URL. */
export function resolveAvatarUrl(photoURL, displayName, userId) {
  return getSafeAvatarUrl(photoURL, displayName || 'User', userId || '');
}

/** First numeric candidate (0 counts), else 0. */
export function resolveCount(...candidates) {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === '') continue;
    const num = Number(candidate);
    if (!Number.isNaN(num)) return num;
  }
  return 0;
}

/** First positive numeric candidate, else null — absent standing stays unknown. */
export function resolveLevelValue(...candidates) {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null || candidate === '') continue;
    const num = Number(candidate);
    if (!Number.isNaN(num) && num > 0) return num;
  }
  return null;
}

/**
 * Creator standing. An explicit `isCreator`/`creatorStatus` on the profile or
 * the signed-in viewer wins; otherwise the canonical level gate decides.
 */
export function resolveCreatorFlag(profile = {}, viewer = {}, level = null) {
  if (profile?.isCreator || viewer?.isCreator) return true;
  if (profile?.creatorStatus === 'approved') return true;
  const rawTier = typeof profile?.creatorTier === 'string' ? profile.creatorTier.toLowerCase() : '';
  if (rawTier && rawTier !== 'standard' && rawTier !== 'none') return true;
  return level !== null && level >= LEVEL_GATES.creatorProfile;
}

export function resolveVerifiedFlag(profile = {}) {
  return Boolean(profile?.isVerified || profile?.verified);
}

/**
 * Apply the capability decision exactly once. The view layer must consume the
 * result rather than re-checking privacy, so a section can never render while
 * the engine reports it hidden.
 */
export function projectProfileForViewer(profile, capabilities = {}, { isOwner = false } = {}) {
  if (!profile) return profile;
  const caps = capabilities || {};
  const mayViewEconomic = isOwner || Boolean(caps.canViewEconomicStatus);
  const blocked = Boolean(caps.isBlocked);
  return {
    ...profile,
    coins: mayViewEconomic ? profile.coins : null,
    // Safety flags come from the engine so the UI reflects the same decision
    // that gated the sections (N007). A blocked viewer loses the bio/counts.
    isBlocked: blocked,
    isBlockedByTarget: Boolean(caps.isBlockedBy),
    isBlockedByViewer: Boolean(caps.isBlocking),
    isRestricted: blocked || Boolean(caps.isRestricted),
    bio: blocked ? '' : profile.bio,
    followerCount: blocked ? 0 : profile.followerCount,
    followingCount: blocked ? 0 : profile.followingCount,
    postCount: blocked ? 0 : profile.postCount,
    canViewActivity: Boolean(caps.canViewActivity),
    canViewAchievements: Boolean(caps.canViewAchievements),
    canViewTitles: Boolean(caps.canViewTitles),
    canViewFollowersList: Boolean(caps.canViewFollowers),
    canViewFollowingList: Boolean(caps.canViewFollowing),
    links: caps.canViewLinks ? (profile.links || []) : [],
    presence: caps.canViewPresence ? profile.presence : OFFLINE_PRESENCE,
  };
}

export default {
  OFFLINE_PRESENCE,
  normalizeString,
  isPlaceholderName,
  isPlaceholderHandle,
  deriveHandle,
  pickHandle,
  pickDisplayName,
  resolveAvatarUrl,
  resolveCount,
  resolveLevelValue,
  resolveCreatorFlag,
  resolveVerifiedFlag,
  projectProfileForViewer,
};
