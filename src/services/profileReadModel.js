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
 * First numeric standing candidate clamped to 0..100, else null. Used by every
 * surface that renders reputation/influence/contribution bands (passport,
 * reputation screen). Absent data stays `null` so the surface can show an
 * explicit unavailable state instead of a fabricated score.
 */
export function readStandingScore(...candidates) {
  for (const value of candidates) {
    if (value === undefined || value === null || value === '') continue;
    const num = Number(value);
    if (!Number.isNaN(num)) return Math.max(0, Math.min(100, num));
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
 * The canonical identity/count derivation shared by every profile surface.
 * ProfileMyScreen, ProfilePublicScreen and ProfilePreviewScreen each grew their
 * own copy of the same chain (id/uid, handle, display name, avatar, follower /
 * following / post counts, level, verified + creator flags, coins) with subtly
 * different candidate ordering and fallbacks — the drift AGENTS.md warns about.
 * Callers now supply only their own candidate ordering and the two literal
 * fallbacks; the ordering rules (placeholder rejection, `user_` handle
 * rejection, `deriveHandle` on email/display name) live here once.
 *
 * @param {object} profile  The raw profile document.
 * @param {object} opts
 * @param {object} [opts.viewer]            Auth/store user, for owner-side fallbacks.
 * @param {string[]} [opts.handleCandidates] Explicit handle candidates, in priority order.
 * @param {string[]} [opts.handleFallbacks]  Values to run through `deriveHandle` if no candidate wins.
 * @param {string} [opts.handleFallback]     Literal last-resort handle.
 * @param {string[]} [opts.displayCandidates]
 * @param {string} [opts.displayFallback]    Literal last-resort display name.
 * @param {string[]} [opts.followerCandidates]
 * @param {string[]} [opts.followingCandidates]
 * @param {string[]} [opts.postCandidates]
 * @param {Array<*>} [opts.levelCandidates]
 * @param {Array<*>} [opts.coinCandidates]
 * @param {string}  [opts.userId]            Route/owner uid, used when the profile has none.
 * @param {boolean} [opts.withCoins]         Include the `coins` count (false for surfaces that never show it).
 */
export function deriveProfileIdentity(profile = {}, opts = {}) {
  const {
    viewer = {},
    handleCandidates = [],
    handleFallbacks = [],
    handleFallback = 'citizen',
    displayCandidates = [],
    displayFallback = 'Citizen',
    followerCandidates = [],
    followingCandidates = [],
    postCandidates = [],
    levelCandidates = [],
    coinCandidates = [],
    userId = null,
    withCoins = true,
  } = opts;

  const resolvedId = profile.id || profile.uid || viewer.uid || userId || null;
  let handle = pickHandle(handleCandidates);
  if (!handle) {
    for (const value of handleFallbacks) {
      handle = deriveHandle(value);
      if (handle) break;
    }
  }
  if (!handle) handle = handleFallback;

  const displayName = pickDisplayName(displayCandidates, { fallback: displayFallback });
  const level = resolveLevelValue(...levelCandidates);

  const identity = {
    id: resolvedId,
    uid: profile.uid || profile.id || viewer.uid || userId || null,
    username: handle,
    displayName,
    level,
    photoURL: resolveAvatarUrl(profile.photoURL || viewer.photoURL, displayName, resolvedId),
    followerCount: resolveCount(...followerCandidates),
    followingCount: resolveCount(...followingCandidates),
    postCount: resolveCount(...postCandidates),
    isVerified: resolveVerifiedFlag(profile) || Boolean(viewer.isVerified),
    isCreator: resolveCreatorFlag(profile, viewer, level),
  };
  if (withCoins) identity.coins = resolveCount(...coinCandidates);
  return identity;
}

/**
 * Extended identity-card fields gated by the `profileInfo` scope. The public
 * projection (`displayName`, `username`, `photoURL`) is intentionally NOT in
 * this list — a viewer must always be able to identify whom they are looking at
 * so the follow/block affordance works; only the descriptive card is gated.
 */
export const IDENTITY_INFO_FIELDS = Object.freeze([
  'bio',
  'location',
  'website',
  'pronouns',
  'profession',
  'education',
  'birthday',
  'gender',
]);

/**
 * Creator-suite fields gated by the `creatorInfo` scope: the creative
 * classification, the public business contact and the patronage note. Without
 * this the scope was a dead control (settable in EditProfile/Settings, enforced
 * nowhere) and a creator's business email was world-readable.
 */
export const CREATOR_INFO_FIELDS = Object.freeze([
  'creatorCategory',
  'inquiriesEmail',
  'tipMessage',
]);

/**
 * Financial fields. `economicStatus` (default ONLY_ME) gates the coin treasury,
 * but the spread left every other money field on the object, so a viewer denied
 * economic status still read earnings/totalEarned/coinBalance off the profile.
 */
export const ECONOMIC_FIELDS = Object.freeze([
  'coins',
  'coinBalance',
  'balance',
  'earnings',
  'totalEarned',
  'lifetimeEarnings',
  'withdrawableBalance',
]);

/**
 * Standing fields gated by the `activity` scope ("Civic Standing & Badges" in
 * settings). `canViewActivity` was resolved by the engine and exposed on the
 * projection but applied to nothing, so the scope hid no level, reputation,
 * streak or badge. Absent standing stays null/empty so the surface renders an
 * unavailable state rather than a fabricated Level 1.
 */
export const STANDING_FIELDS = Object.freeze([
  'level',
  'levelBand',
  'experience',
  'xp',
  'experienceToNextLevel',
  'activeStreak',
  'longestStreak',
  'activeDays',
  'activeDaysCount',
  'reputation',
  'reputationScore',
  'reputationTier',
  'influence',
  'influenceScore',
  'contribution',
  'contributionScore',
]);

/** Badge fields gated by their own `achievements` scope. */
export const ACHIEVEMENT_FIELDS = Object.freeze(['achievements', 'achievementsCount']);

/** Title fields gated by their own `titles` scope. */
export const TITLE_FIELDS = Object.freeze(['titles', 'activeTitle', 'primaryTitle']);

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
  // Absent capability map (a component that forgot to pass it) must fail closed
  // for the identity card, matching the sections below. The owner always sees it.
  const mayViewIdentity = isOwner || Boolean(caps.canViewIdentity);
  const hideIdentity = blocked || !mayViewIdentity;
  // Presence has its own scope; a blocked viewer never sees it. The raw
  // `isOnline`/`lastActive` fields are masked alongside the `presence` object so
  // a consumer cannot read around the gate (ProfileHeroSection reads
  // `profile.isOnline` directly).
  const presenceVisible = !blocked && (isOwner || Boolean(caps.canViewPresence));
  const mayViewCreator = isOwner || Boolean(caps.canViewCreatorInfo);
  const mayViewStanding = isOwner || Boolean(caps.canViewActivity);
  const mayViewAchievements = isOwner || Boolean(caps.canViewAchievements);
  const mayViewTitles = isOwner || Boolean(caps.canViewTitles);
  const projected = {
    ...profile,
    coins: mayViewEconomic ? profile.coins : null,
    // Safety flags come from the engine so the UI reflects the same decision
    // that gated the sections (N007). A blocked viewer loses the bio/counts.
    isBlocked: blocked,
    isBlockedByTarget: Boolean(caps.isBlockedBy),
    isBlockedByViewer: Boolean(caps.isBlocking),
    isRestricted: blocked || Boolean(caps.isRestricted),
    followerCount: blocked ? 0 : profile.followerCount,
    followingCount: blocked ? 0 : profile.followingCount,
    postCount: blocked ? 0 : profile.postCount,
    canViewIdentity: Boolean(caps.canViewIdentity),
    canViewCreatorInfo: Boolean(caps.canViewCreatorInfo),
    canViewActivity: Boolean(caps.canViewActivity),
    canViewAchievements: Boolean(caps.canViewAchievements),
    canViewTitles: Boolean(caps.canViewTitles),
    canViewFollowersList: Boolean(caps.canViewFollowers),
    canViewFollowingList: Boolean(caps.canViewFollowing),
    links: caps.canViewLinks ? (profile.links || []) : [],
    presence: presenceVisible ? profile.presence : OFFLINE_PRESENCE,
    isOnline: presenceVisible ? profile.isOnline : false,
    lastActive: presenceVisible ? profile.lastActive : null,
  };
  // The `profileInfo` scope gates the descriptive identity card. Masking it here
  // (rather than in each screen) is what makes the control real: the About screen
  // renders bio/location/website/links straight from the projected profile.
  if (hideIdentity) {
    for (const field of IDENTITY_INFO_FIELDS) {
      if (field in projected) projected[field] = '';
    }
  }
  // `creatorInfo` gates the creator suite; mask at the same single point so a
  // narrowed scope hides the business contact and patronage note everywhere.
  if (!mayViewCreator) {
    for (const field of CREATOR_INFO_FIELDS) {
      if (field in projected) projected[field] = '';
    }
  }
  // `economicStatus` gates the whole money surface, not just `coins`.
  if (!mayViewEconomic) {
    for (const field of ECONOMIC_FIELDS) {
      if (field in projected) projected[field] = null;
    }
  }
  // `activity` gates civic standing (level, reputation, streak). Without this
  // the scope was resolved but enforced nowhere, so the "Civic Standing &
  // Badges" control hid nothing.
  if (!mayViewStanding) {
    for (const field of STANDING_FIELDS) {
      if (!(field in projected)) continue;
      projected[field] = Array.isArray(projected[field]) ? [] : null;
    }
  }
  // Badges and titles are separate scopes (the settings UI writes `achievements`
  // and `titles` alongside `activity`), so they are masked independently — a
  // viewer allowed the level but denied badges must not read the badges.
  if (!mayViewAchievements) {
    for (const field of ACHIEVEMENT_FIELDS) {
      if (!(field in projected)) continue;
      projected[field] = Array.isArray(projected[field]) ? [] : null;
    }
  }
  if (!mayViewTitles) {
    for (const field of TITLE_FIELDS) {
      if (!(field in projected)) continue;
      projected[field] = Array.isArray(projected[field]) ? [] : null;
    }
  }
  return projected;
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
  readStandingScore,
  resolveCreatorFlag,
  resolveVerifiedFlag,
  deriveProfileIdentity,
  projectProfileForViewer,
};
