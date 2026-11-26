/**
 * Zustand store with Immer for profile state management.
 * Manages profile data, posts, follow status, and more.
 * 
 * Features:
 * - Profile loading with caching
 * - Follow/unfollow with optimistic updates
 * - Posts pagination
 * - Highlights and stories
 * - Level, balance, and position tracking
 * 
 * @author ARVDOUL Engineering Team
 * @version 1.0.0
 */

import { create } from 'zustand';
import { LOCAL_POSTS_KEY } from '../utils/localContentCache.js';
import { immer } from 'zustand/middleware/immer';
import { toast } from 'sonner';
import { useAppStore } from './appStore.js';
import { pickDisplayName, pickHandle, deriveHandle, resolveActorName } from '../services/profileReadModel.js';
import { getUserService } from '../services/userService.js';
import { socialGraphService } from '../services/socialGraphService.js';
import { getMonetizationService } from '../services/monetizationService.js';
import { getAnalyticsService } from '../services/analyticsService.js';
import { firestoreService } from '../services/firestoreService.js';
import { getStoryService } from '../services/storyService.js';

/**
 * Whether a profile grid read must use the approved-follower query shape — i.e.
 * omit the `authorIsPrivate == false` constraint the public shape requires.
 *
 * A private author's grid is only listable through the rule's follower branch
 * (`followEdgeExists(uid(), authorId)`), which the rule proves from the
 * constrained `authorId`; adding `authorIsPrivate == false` would exclude the
 * private author's own posts and return an empty grid. Only use this shape when
 * the target is private AND the viewer already follows it — everyone else keeps
 * the public shape, so an unconstrained (denied) list is never issued.
 */
function isApprovedFollowerView(get, userId, options) {
  const state = get();
  const profile = options.profile || state.profile;
  if (!profile || (profile.id !== userId && profile.uid !== userId)) return false;
  if (profile.isPrivate !== true) return false;
  const viewerUid = state.viewerUid || useAppStore.getState().currentUser?.uid || null;
  if (!viewerUid || viewerUid === userId) return false;
  return state.followStatus?.isFollowing === true;
}

const initialState = {
  // Profile data
  profile: null,
  viewerUid: null,
  loading: false,
  error: null,
  isOwner: false,
  
  // Follow status
  followStatus: null,
  followStatusTargetId: null,
  followLoading: false,
  
  // Mutual friends
  mutualFriends: [],
  // Distinguishes a resolved empty list ("No mutual friends") from an
  // unresolved/failed read. Without it the card rendered a failed fetch as a
  // measured "No mutual friends".
  mutualFriendsResolved: false,
  mutualFriendsLoading: false,
  
  // Posts
  posts: [],
  postsCount: null,
  postsLikesCount: null,
  postsLoading: false,
  postsHasMore: true,
  postsCursor: null,
  postsError: null,
  friendCount: null,
  
  // Highlights
  highlights: [],
  highlightsLoading: false,
  highlightsError: null,
  
  // Stories
  stories: [],
  storiesLoading: false,
  storiesError: null,
  
  // Creator info
  level: null,
  experience: null,
  levelInfo: null,
  levelLoading: false,
  
  // Balance
  // Unknown until the economy service resolves; zero is a real balance.
  balance: null,
  balanceLoading: false,
  
  // Position
  position: null,
  positionLoading: false,

  // Saved Posts
  savedPosts: [],
  savedLoading: false,
  savedError: null,

  // Shop Items
  shopItems: [],
  shopLoading: false,
  
  // UI state
  activeTab: 'posts',
  refreshKey: 0,
  // Monotonic request token. Every loadProfile call takes a new value and any
  // in-flight response whose token is stale is discarded, so a slow response
  // for a previous account or route cannot overwrite current state.
  requestSeq: 0,
  // Per-loader tokens for the same guard on the secondary profile loaders
  // (posts, highlights, saved, stories, level, balance, position). Without
  // these, switching accounts while one of them is in flight lets the old
  // account's data land in the new account's store (audit §26).
  loadSeq: {},
};

// Module-level deduplication and bounded LRU SWR cache so revisiting
// profiles paints instantly on low-RAM devices without leaking across accounts
// or viewAs perspectives.
const MAX_SWR_PROFILE_ENTRIES = 15;
const SWR_FRESH_MS = 60_000;
const SWR_MAX_AGE_MS = 300_000;

let _inFlightProfileKey = null;
let _inFlightProfilePromise = null;
let _lastCompletedProfileKey = null;
let _lastCompletedProfileAt = 0;
let _activeSwrKey = null;
let _activeSwrAliasKey = null;
const _swrProfileCache = new Map();
const _trackedProfileViews = new Set();
const _secondaryInflight = new Map();

function withStoreTimeout(promise, ms, label = 'Profile request') {
  let timerId;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timerId = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]).finally(() => {
    if (timerId) clearTimeout(timerId);
  });
}

function buildViewTrackKey(viewerId, targetUid) {
  const today = new Date().toISOString().slice(0, 10);
  return `${viewerId}::${targetUid}::${today}`;
}

function buildSwrKey(userId, currentUserId, viewAs) {
  return `${String(userId || '').trim()}::${currentUserId ? String(currentUserId).trim() : ''}::${viewAs || 'default'}`;
}

function readSwrEntry(key) {
  if (!key) return null;
  const entry = _swrProfileCache.get(key);
  if (!entry) return null;
  const age = Date.now() - (entry.timestamp || 0);
  if (age > SWR_MAX_AGE_MS) {
    _swrProfileCache.delete(key);
    return null;
  }
  // Refresh LRU recency
  _swrProfileCache.delete(key);
  _swrProfileCache.set(key, entry);
  return { entry, isFresh: age <= SWR_FRESH_MS };
}

function writeSwrEntry(key, patch, { touchTimestamp = false } = {}) {
  if (!key || !patch) return;
  const prev = _swrProfileCache.get(key) || {};
  const next = {
    ...prev,
    ...patch,
    timestamp: touchTimestamp ? Date.now() : (prev.timestamp || Date.now()),
  };
  _swrProfileCache.delete(key);
  _swrProfileCache.set(key, next);
  while (_swrProfileCache.size > MAX_SWR_PROFILE_ENTRIES) {
    const oldestKey = _swrProfileCache.keys().next().value;
    _swrProfileCache.delete(oldestKey);
  }
}

function syncActiveSwrCache(targetUid, patch) {
  if (!targetUid) return;
  const matchesPrimary = _activeSwrKey && _activeSwrKey.startsWith(`${targetUid}::`);
  const matchesAlias = _activeSwrAliasKey && _activeSwrAliasKey.startsWith(`${targetUid}::`);
  if (matchesPrimary) writeSwrEntry(_activeSwrKey, patch);
  if (matchesAlias && _activeSwrAliasKey !== _activeSwrKey) {
    writeSwrEntry(_activeSwrAliasKey, patch);
  }
}

function applySwrToDraft(state, entry, userId, currentUserId) {
  const cachedProfile = entry.profile;
  const resolvedId = cachedProfile?.id || cachedProfile?.uid || userId;
  state.profile = cachedProfile || null;
  state.viewerUid = currentUserId || null;
  state.loading = false;
  state.error = null;
  state.isOwner = Boolean(currentUserId && (resolvedId === currentUserId || userId === currentUserId));
  state.followStatus = entry.followStatus ?? null;
  state.followStatusTargetId = entry.followStatusTargetId ?? resolvedId ?? null;
  state.mutualFriends = Array.isArray(entry.mutualFriends) ? entry.mutualFriends : [];
  state.mutualFriendsResolved = Boolean(entry.mutualFriendsResolved);
  state.friendCount = entry.friendCount ?? null;
  state.level = entry.level ?? cachedProfile?.level ?? null;
  state.experience = entry.experience ?? null;
  state.balance = state.isOwner ? (entry.balance ?? null) : null;
  state.position = entry.position ?? null;
  if (Array.isArray(entry.posts)) {
    state.posts = entry.posts;
    state.postsCount = entry.postsCount ?? null;
    state.postsLikesCount = entry.postsLikesCount ?? null;
    state.postsHasMore = entry.postsHasMore ?? false;
    state.postsCursor = entry.postsCursor ?? null;
    state.postsError = null;
  }
  if (Array.isArray(entry.highlights)) {
    state.highlights = entry.highlights;
  }
  if (Array.isArray(entry.stories)) {
    state.stories = entry.stories;
  }
}

export function isSwrFreshForTarget(userId, currentUserId, viewAs = 'default') {
  const hit = readSwrEntry(buildSwrKey(userId, currentUserId, viewAs));
  return Boolean(hit && hit.isFresh);
}

export function patchCachedProfile(userId, updates = {}) {
  if (!userId || !updates || typeof updates !== 'object') return;
  const target = String(userId).trim();
  const targetLower = target.toLowerCase();
  for (const [key, entry] of _swrProfileCache.entries()) {
    const cachedUid = entry?.profile?.id || entry?.profile?.uid;
    const cachedUsername = entry?.profile?.username?.toLowerCase?.();
    if (
      key.startsWith(`${target}::`) ||
      cachedUid === target ||
      (cachedUsername && `@${cachedUsername}` === targetLower) ||
      (cachedUsername && cachedUsername === targetLower)
    ) {
      writeSwrEntry(
        key,
        { profile: { ...(entry.profile || {}), ...updates } },
        { touchTimestamp: true }
      );
    }
  }
}

export function invalidateProfileCache(userId) {
  if (!userId) return;
  const target = String(userId).trim();
  const targetLower = target.toLowerCase();
  for (const [key, entry] of [..._swrProfileCache.entries()]) {
    const cachedUid = entry?.profile?.id || entry?.profile?.uid;
    const cachedUsername = entry?.profile?.username?.toLowerCase?.();
    if (
      key.startsWith(`${target}::`) ||
      cachedUid === target ||
      (cachedUsername && `@${cachedUsername}` === targetLower) ||
      (cachedUsername && cachedUsername === targetLower)
    ) {
      _swrProfileCache.delete(key);
    }
  }
  if (_lastCompletedProfileKey && _lastCompletedProfileKey.startsWith(`${target}::`)) {
    _lastCompletedProfileKey = null;
    _lastCompletedProfileAt = 0;
  }
  if (_inFlightProfileKey && _inFlightProfileKey.startsWith(`${target}::`)) {
    _inFlightProfileKey = null;
    _inFlightProfilePromise = null;
  }
}

export const useProfileStore = create(
  immer((set, get) => ({
    ...initialState,

    // Take a fresh token for a named loader. Any response that resolves after a
    // newer load started (or after clear()) sees a mismatched token and is
    // discarded, so a slow account-A response can never populate account B.
    _startLoad: (key) => {
      const seq = (get().loadSeq?.[key] || 0) + 1;
      set((state) => {
        state.loadSeq[key] = seq;
      });
      return seq;
    },
    _isLoadCurrent: (key, seq) => get().loadSeq?.[key] === seq,

    /**
     * Synchronously seed the store with the already-hydrated AuthContext owner
     * profile snapshot so navigating to /profile paints immediately on frame 1
     * while the authoritative background refresh reconciles counts and slices.
     */
    hydrateOwnerSnapshot: (userId, authProfile) => {
      if (!userId || !authProfile || typeof authProfile !== 'object') return false;
      const profileUid = authProfile.uid || authProfile.id;
      if (profileUid && profileUid !== userId) return false;
      const current = get();
      if (
        current.profile &&
        (current.profile.uid === userId || current.profile.id === userId) &&
        !current.error
      ) {
        return true;
      }
      set((state) => {
        state.profile = { ...authProfile, id: userId, uid: userId };
        state.viewerUid = userId;
        state.isOwner = true;
        state.loading = false;
        state.error = null;
        if (typeof authProfile.level === 'number' && Number.isFinite(authProfile.level)) {
          state.level = authProfile.level;
        }
        if (typeof authProfile.friendCount === 'number' && Number.isFinite(authProfile.friendCount)) {
          state.friendCount = authProfile.friendCount;
        }
      });
      return true;
    },

    /**
     * Load user profile with all related data
     * @param {string} userId - User ID to load
     * @param {string} currentUserId - Current logged in user ID
     * @param {Object} [options={}] - Query options (e.g. viewAs)
     */
    loadProfile: async (userId, currentUserId, options = {}) => {
      if (!userId) return;

      const dedupeKey = buildSwrKey(userId, currentUserId, options?.viewAs);
      let swrHit = null;
      if (!options?.force) {
        if (_inFlightProfileKey === dedupeKey && _inFlightProfilePromise) {
          return _inFlightProfilePromise;
        }
        if (
          _lastCompletedProfileKey === dedupeKey &&
          Date.now() - _lastCompletedProfileAt < 2000 &&
          get().profile &&
          !get().error
        ) {
          return;
        }
        swrHit = readSwrEntry(dedupeKey);
      } else {
        _inFlightProfileKey = null;
        _inFlightProfilePromise = null;
        _lastCompletedProfileKey = null;
        _lastCompletedProfileAt = 0;
        _swrProfileCache.delete(dedupeKey);
      }

      const isBackgroundRevalidate = Boolean(swrHit && swrHit.entry?.profile && !swrHit.isFresh);

      if (swrHit?.entry?.profile) {
        _activeSwrKey = dedupeKey;
        const cachedUid = swrHit.entry.profile.id || swrHit.entry.profile.uid;
        _activeSwrAliasKey = cachedUid ? buildSwrKey(cachedUid, currentUserId, options?.viewAs) : null;
        set((state) => {
          applySwrToDraft(state, swrHit.entry, userId, currentUserId);
        });
        if (swrHit.isFresh) {
          _lastCompletedProfileKey = dedupeKey;
          _lastCompletedProfileAt = Date.now();
          const isOwnerHit = Boolean(currentUserId && (cachedUid === currentUserId || userId === currentUserId));
          if (!isOwnerHit && currentUserId && cachedUid && !options?.viewAs) {
            const viewKey = buildViewTrackKey(currentUserId, cachedUid);
            if (!_trackedProfileViews.has(viewKey)) {
              if (_trackedProfileViews.size > 200) _trackedProfileViews.clear();
              _trackedProfileViews.add(viewKey);
              getAnalyticsService().trackProfileView(currentUserId, cachedUid)
                .then((ok) => { if (ok === false) _trackedProfileViews.delete(viewKey); })
                .catch((e) => {
                  _trackedProfileViews.delete(viewKey);
                  console.warn('Profile view not tracked', e?.message);
                });
            }
          }
          return;
        }
      }

      const prevProfile = get().profile;
      const prevId = prevProfile?.id || prevProfile?.uid;
      const prevUsername = prevProfile?.username?.toLowerCase();
      const normalizedTarget = String(userId).replace(/^@/, '').toLowerCase().trim();
      const isSwitchingTarget = Boolean(
        !isBackgroundRevalidate &&
        prevProfile &&
        prevId !== userId &&
        prevId?.toLowerCase() !== normalizedTarget &&
        prevUsername !== normalizedTarget
      );
      if (isSwitchingTarget) {
        _lastCompletedProfileKey = null;
        _lastCompletedProfileAt = 0;
      }

      const requestId = get().requestSeq + 1;
      set((state) => {
        state.requestSeq = requestId;
        state.viewerUid = currentUserId || null;
        if (!isBackgroundRevalidate) {
          // Every profile target/refresh invalidates older secondary loaders.
          // Otherwise a slow posts/highlights/stories response can land after a
          // newer route has begun loading, even when the profile request token
          // itself correctly rejects the stale profile response.
          for (const key of ['posts', 'highlights', 'saved', 'shop', 'stories', 'level', 'balance', 'position', 'followStatus', 'mutualFriends']) {
            state.loadSeq[key] = (state.loadSeq[key] || 0) + 1;
          }
          state.loading = true;
          state.error = null;
          // A new profile load invalidates any prior mutual-friends result.
          state.mutualFriends = [];
          state.mutualFriendsResolved = false;
        }
        if (isSwitchingTarget) {
          state.profile = null;
          state.isOwner = Boolean(currentUserId && userId === currentUserId);
          state.level = null;
          state.balance = null;
          state.position = null;
          state.friendCount = null;
          state.posts = [];
          state.postsCount = null;
          state.postsLikesCount = null;
          state.postsHasMore = true;
          state.postsCursor = null;
          state.postsError = null;
          state.highlights = [];
          state.stories = [];
          state.savedPosts = [];
          state.followStatus = null;
          state.followStatusTargetId = null;
          state.experience = null;
          state.levelInfo = null;
        }
      });

      const runLoad = (async () => {
      
      try {
        const userService = getUserService();
        const monetizationService = getMonetizationService();
        const analyticsService = getAnalyticsService();

        const isOwner = userId === currentUserId;

        // Fetch profile with requester context and viewAs projection
        const profile = await userService.getUserProfile(userId, currentUserId, options);
        const resolvedUid = profile?.id || profile?.uid || userId;

        // Drop a stale response (account switch / newer navigation) — N013.
        if (get().requestSeq !== requestId) return;

        // Resolve base profile immediately so Hero + Metrics render without waiting
        // for Cloud Functions (getMutualFriends) or secondary economy calls.
        const appStoreUser = useAppStore.getState().currentUser;
        const appCurrentUser = isOwner && appStoreUser?.uid === currentUserId ? appStoreUser : null;
        const effectiveUid = isOwner ? currentUserId : null;
        const fallbackDisplayName = isOwner
          ? pickDisplayName(
              [appCurrentUser?.displayName, appCurrentUser?.name, deriveHandle(appCurrentUser?.email)],
              { fallback: resolveActorName([], effectiveUid || userId) }
            )
          : resolveActorName([], userId);
        const fallbackUsername = isOwner
          ? pickHandle([appCurrentUser?.username, deriveHandle(appCurrentUser?.email)])
          : null;

        const baseResolvedProfile = profile ? {
          ...profile,
          displayName: isOwner
            ? pickDisplayName([profile.displayName, appCurrentUser?.displayName], { fallback: fallbackDisplayName })
            : pickDisplayName([profile.displayName, profile.name], { fallback: resolveActorName([], resolvedUid || userId) }),
          username: pickHandle([profile.username]) || fallbackUsername,
        } : {
          id: userId || effectiveUid || null,
          uid: userId || effectiveUid || null,
          username: fallbackUsername,
          displayName: fallbackDisplayName,
          bio: isOwner && typeof appCurrentUser?.bio === 'string' ? appCurrentUser.bio : '',
          photoURL: isOwner ? (appCurrentUser?.photoURL || null) : null,
          isVerified: false,
          isCreator: false,
          canViewActivity: false,
          canViewAchievements: false,
          canViewTitles: false,
          canViewFollowersList: false,
          canViewFollowingList: false,
          canViewFriendsList: false,
        };

        const existingLikesCount = get().postsLikesCount;
        if (typeof existingLikesCount === 'number' && (baseResolvedProfile.id === userId || baseResolvedProfile.uid === userId)) {
          baseResolvedProfile.likesReceived = existingLikesCount;
        }

        const initialBalance = isOwner && typeof baseResolvedProfile.coins === 'number' && Number.isFinite(baseResolvedProfile.coins)
          ? baseResolvedProfile.coins
          : null;
        const rawBaseXp = baseResolvedProfile.experience ?? baseResolvedProfile.xp ?? null;

        set((state) => {
          state.profile = baseResolvedProfile;
          state.loading = false;
          state.error = null;
          state.isOwner = isOwner;
          state.followStatusTargetId = resolvedUid || userId;
          state.level = baseResolvedProfile.level ?? null;
          state.experience = rawBaseXp !== null && Number.isFinite(Number(rawBaseXp)) ? Number(rawBaseXp) : null;
          if (initialBalance !== null) state.balance = initialBalance;
        });

        const canReadFriendsCount =
          Boolean(resolvedUid) &&
          !profile?.isBlocked &&
          (isOwner || profile?.canViewFriendsList === true);

        // Fetch viewer-scoped follow status, mutual friends, friend count, balance, and position in parallel
        // with bounded timeouts so slow Cloud Functions or Remote Config never block completion.
        const [followSettled, mutualSettled, friendCountSettled, balanceSettled, positionSettled] = await Promise.allSettled([
          (!isOwner && currentUserId)
            ? withStoreTimeout(userService.getFollowStatus(currentUserId, resolvedUid), 4500, 'followStatus')
            : Promise.resolve(null),
          (!isOwner && currentUserId && canReadFriendsCount)
            ? withStoreTimeout(userService.getMutualFriends(currentUserId, resolvedUid), 4500, 'mutualFriends')
            : Promise.resolve({ mutualFriends: [] }),
          canReadFriendsCount && typeof socialGraphService.getFriendCount === 'function'
            ? withStoreTimeout(socialGraphService.getFriendCount(resolvedUid), 4500, 'friendCount')
            : Promise.resolve(null),
          isOwner
            ? (initialBalance !== null && !options?.force
                ? Promise.resolve(initialBalance)
                : monetizationService.getBalance(resolvedUid, { forceRefresh: Boolean(options?.force) }))
            : Promise.resolve(null),
          monetizationService.getUserPosition(resolvedUid, profile?.gender),
        ]);

        let followStatus = null;
        if (followSettled.status === 'fulfilled') {
          followStatus = followSettled.value;
        } else {
          console.warn('Could not fetch follow status:', followSettled.reason);
        }

        let mutualFriends = [];
        let mutualFriendsResolved = false;
        if (!isOwner && currentUserId) {
          if (mutualSettled.status === 'fulfilled') {
            const mutualResult = mutualSettled.value;
            mutualFriends = mutualResult?.mutualFriends?.slice(0, 5) || [];
            mutualFriendsResolved = true;
          } else {
            console.warn('Could not fetch mutual friends:', mutualSettled.reason);
          }
        } else {
          mutualFriendsResolved = true;
        }

        const friendCount =
          friendCountSettled.status === 'fulfilled' && typeof friendCountSettled.value === 'number'
            ? friendCountSettled.value
            : null;

        const level = baseResolvedProfile?.level ?? null;

        let balance = null;
        if (isOwner) {
          if (balanceSettled.status === 'fulfilled') {
            const balanceResult = balanceSettled.value;
            balance = typeof balanceResult === 'number' ? balanceResult : null;
          } else {
            console.warn('Could not fetch balance:', balanceSettled.reason);
          }
        }

        let position = null;
        if (positionSettled.status === 'fulfilled') {
          position = positionSettled.value;
        } else {
          console.warn('Could not fetch position:', positionSettled.reason);
        }

        const resolvedProfile = profile ? {
          ...baseResolvedProfile,
          ...(friendCount !== null && canReadFriendsCount ? { friendCount } : {}),
        } : baseResolvedProfile;

        // Drop a stale response (account switch / newer navigation) — N013.
        if (get().requestSeq !== requestId) return;

        set((state) => {
          state.profile = resolvedProfile;
          state.loading = false;
          state.error = null;
          state.isOwner = isOwner;
          state.followStatus = followStatus;
          state.followStatusTargetId = resolvedUid || userId;
          state.mutualFriends = mutualFriends;
          state.mutualFriendsResolved = mutualFriendsResolved;
          state.friendCount = friendCount;
          state.level = resolvedProfile.level ?? level ?? null;
          const rawXp = resolvedProfile.experience ?? resolvedProfile.xp ?? null;
          state.experience = rawXp !== null && Number.isFinite(Number(rawXp)) ? Number(rawXp) : null;
          state.balance = balance;
          state.position = position;
        });

        const swrPayload = {
          profile: resolvedProfile,
          followStatus,
          followStatusTargetId: resolvedUid || userId,
          mutualFriends,
          mutualFriendsResolved,
          friendCount,
          level: resolvedProfile.level ?? level ?? null,
          experience:
            resolvedProfile.experience !== undefined && resolvedProfile.experience !== null && Number.isFinite(Number(resolvedProfile.experience))
              ? Number(resolvedProfile.experience)
              : resolvedProfile.xp !== undefined && resolvedProfile.xp !== null && Number.isFinite(Number(resolvedProfile.xp))
                ? Number(resolvedProfile.xp)
                : null,
          balance,
          position,
        };
        const aliasKey = resolvedUid ? buildSwrKey(resolvedUid, currentUserId, options?.viewAs) : null;
        _activeSwrKey = dedupeKey;
        _activeSwrAliasKey = aliasKey;
        writeSwrEntry(dedupeKey, swrPayload, { touchTimestamp: true });
        if (aliasKey && aliasKey !== dedupeKey) {
          writeSwrEntry(aliasKey, swrPayload, { touchTimestamp: true });
        }

        _lastCompletedProfileKey = dedupeKey;
        _lastCompletedProfileAt = Date.now();
        
        // Track profile view once using resolvedUid (never raw @handle)
        if (!isOwner && currentUserId && resolvedUid && !options?.viewAs) {
          const viewKey = buildViewTrackKey(currentUserId, resolvedUid);
          if (!_trackedProfileViews.has(viewKey)) {
            if (_trackedProfileViews.size > 200) _trackedProfileViews.clear();
            _trackedProfileViews.add(viewKey);
            analyticsService.trackProfileView(currentUserId, resolvedUid)
              .then((ok) => { if (ok === false) _trackedProfileViews.delete(viewKey); })
              .catch((e) => {
                _trackedProfileViews.delete(viewKey);
                console.warn('Profile view not tracked', e?.message);
              });
          }
        }
      } catch (error) {
        if (isBackgroundRevalidate) {
          console.warn('Background profile revalidation failed:', error?.message);
          return;
        }
        console.warn('Load profile handled gracefully with fallback:', error?.message);
        const effectiveUid = currentUserId || null;
        const isOwner = Boolean(currentUserId && (!userId || userId === effectiveUid));
        const appStoreUser = useAppStore.getState().currentUser;
        const localAuth = isOwner && appStoreUser?.uid === currentUserId ? appStoreUser : {};

        const rawDisplayName = isOwner ? (localAuth.displayName || localAuth.name) : null;
        const fallbackDisplayName = isOwner
          ? pickDisplayName(
              [rawDisplayName, deriveHandle(localAuth.email)],
              { fallback: resolveActorName([], effectiveUid || userId) }
            )
          : resolveActorName([], userId);
        const fallbackUsername = isOwner
          ? pickHandle([localAuth.username, deriveHandle(localAuth.email)])
          : null;

        const fallbackProfile = {
          id: userId || effectiveUid || null,
          uid: userId || effectiveUid || null,
          username: fallbackUsername,
          displayName: fallbackDisplayName,
          bio: isOwner && typeof localAuth.bio === 'string' ? localAuth.bio : '',
          photoURL: isOwner ? (localAuth.photoURL || null) : null,
          isVerified: false,
          isCreator: false,
          canViewActivity: false,
          canViewAchievements: false,
          canViewTitles: false,
          canViewFollowersList: false,
          canViewFollowingList: false,
          canViewFriendsList: false,
        };

        if (get().requestSeq !== requestId) return;

        set((state) => {
          state.profile = fallbackProfile;
          state.loading = false;
          state.error = error?.message || 'Profile unavailable';
          state.isOwner = isOwner;
          state.friendCount = null;
          state.balance = null;
          state.level = null;
          state.experience = null;
          state.levelInfo = null;
        });
      }
      })();

      _inFlightProfileKey = dedupeKey;
      _inFlightProfilePromise = runLoad;
      try {
        return await runLoad;
      } finally {
        if (_inFlightProfilePromise === runLoad) {
          _inFlightProfileKey = null;
          _inFlightProfilePromise = null;
        }
      }
    },
    
    /**
     * Refresh profile data
     * @param {string} userId - User ID to refresh
     * @param {string} currentUserId - Current logged in user ID
     */
    refreshProfile: async (userId, currentUserId) => {
      set((state) => {
        state.refreshKey += 1;
      });
      await get().loadProfile(userId, currentUserId, { force: true });
    },

    /**
     * Update user profile with optimistic state and validation
     * @param {string} userId - User ID
     * @param {Object} updates - Profile changes
     */
    updateProfile: async (userId, updates) => {
      if (!userId || !updates) return;
      const previousProfile = get().profile;

      // Optimistic update
      set((state) => {
        if (state.profile) {
          state.profile = { ...state.profile, ...updates };
        }
      });

      try {
        const userService = (await import('../services/userService.js')).getUserService();
        await userService.updateUserProfile(userId, updates);
        toast.success('Profile updated successfully!');
      } catch (error) {
        console.error('❌ Update profile failed, rolling back:', error);
        set((state) => {
          state.profile = previousProfile;
          state.error = error.message;
        });
        toast.error(error.message || 'Failed to update profile');
        throw error;
      }
    },

    /**
     * Upload and update user avatar
     * @param {string} userId - User ID
     * @param {File|Blob} file - Avatar file
     */
    updateAvatar: async (userId, file) => {
      if (!userId || !file) return;
      const previousPhotoURL = get().profile?.photoURL;

      try {
        const userService = (await import('../services/userService.js')).getUserService();
        const uploadResult = await userService.uploadAvatar(userId, file);
        const newPhotoURL = uploadResult?.downloadURL || uploadResult?.photoURL || uploadResult?.url || uploadResult;

        set((state) => {
          if (state.profile && newPhotoURL) {
            state.profile.photoURL = newPhotoURL;
          }
        });
        const appCurrentUser = useAppStore.getState().currentUser;
        if (newPhotoURL && appCurrentUser && (appCurrentUser.uid === userId || appCurrentUser.id === userId)) {
          useAppStore.getState().setCurrentUser({ ...appCurrentUser, photoURL: newPhotoURL });
        }
        toast.success('Avatar updated successfully!');
        return newPhotoURL;
      } catch (error) {
        console.error('❌ Update avatar failed:', error);
        set((state) => {
          if (state.profile) {
            state.profile.photoURL = previousPhotoURL;
          }
        });
        toast.error(error.message || 'Failed to upload avatar');
        throw error;
      }
    },

    /**
     * Load user posts
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     */
    loadPosts: async (userId, options = {}) => {
      if (!userId) return;
      const viewerId = get().viewerUid || useAppStore.getState().currentUser?.uid || null;
      const inflightKey = `posts::${userId}::${viewerId || 'anon'}::${options.viewAs || 'default'}::${options.limit || 12}`;
      if (!options.force && _secondaryInflight.has(inflightKey)) {
        return _secondaryInflight.get(inflightKey);
      }

      const __seq = get()._startLoad('posts');
      set((state) => {
        state.postsLoading = true;
        state.postsError = null;
      });

      const task = (async () => {
        try {
          const constrainAuthorIsPrivate = !isApprovedFollowerView(get, userId, options);
          const queryOpts = {
            limit: options.limit || 12,
            viewerId,
            constrainAuthorIsPrivate,
            ...options,
            ...(options.force ? { cacheFirst: false, forceRefresh: true } : {}),
          };
          const result = await withStoreTimeout(
            firestoreService.getPostsByUser(userId, queryOpts),
            8000,
            'posts'
          );

          let userPosts = result?.posts || [];
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              const localPosts = JSON.parse(localStorage.getItem(LOCAL_POSTS_KEY) || '[]');
              const localUserPosts = viewerId === userId && (!options.viewAs || options.viewAs === 'owner')
                ? localPosts.filter((p) => p && p.authorId === userId &&
                    p.isDeleted !== true && p.status !== 'deleted' && p.status !== 'scheduled')
                : [];
              if (localUserPosts.length > 0) {
                const existingIds = new Set(userPosts.map(p => p.id));
                for (const lp of localUserPosts) {
                  if (!existingIds.has(lp.id)) {
                    userPosts.unshift(lp);
                    existingIds.add(lp.id);
                  }
                }
              }
            }
          } catch (e) {
            console.warn('Local post merge into profile failed', e?.message);
          }

          const livePosts = (userPosts || []).filter(
            (p) => p && p.isDeleted !== true && p.status !== 'deleted' && p.status !== 'scheduled'
          );
          const liveLoadedCount = livePosts.length;
          let nextPostsCount = null;
          if (result && result.hasMore === false) {
            // When all pages are loaded (including 0 posts), the loaded count is exact.
            nextPostsCount = liveLoadedCount;
          } else if (typeof firestoreService.getUserPostsCount === 'function') {
            const counted = await firestoreService.getUserPostsCount(userId, queryOpts).catch(() => null);
            if (typeof counted === 'number' && Number.isFinite(counted)) {
              nextPostsCount = Math.max(counted, liveLoadedCount);
            } else if (liveLoadedCount > 0) {
              nextPostsCount = liveLoadedCount;
            }
          }

          const loadedLikesTotal = livePosts.reduce((sum, p) => {
            const likes = Number(p?.likes ?? p?.stats?.likes ?? p?.likesCount ?? 0);
            return sum + (Number.isFinite(likes) && likes > 0 ? likes : 0);
          }, 0);
          let nextLikesCount = null;
          if (result && result.hasMore === false) {
            nextLikesCount = loadedLikesTotal;
          } else if (typeof firestoreService.getUserTotalPostLikes === 'function') {
            const aggregatedLikes = await firestoreService.getUserTotalPostLikes(userId, queryOpts).catch(() => null);
            if (typeof aggregatedLikes === 'number' && Number.isFinite(aggregatedLikes)) {
              nextLikesCount = Math.max(aggregatedLikes, loadedLikesTotal);
            }
          }

          if (!get()._isLoadCurrent('posts', __seq)) return;
          set((state) => {
            state.posts = userPosts;
            if (nextPostsCount !== null) {
              state.postsCount = nextPostsCount;
              if (state.profile && (state.profile.id === userId || state.profile.uid === userId)) {
                const existingCount = Number(state.profile.postCount);
                if (!result?.hasMore || !Number.isFinite(existingCount) || nextPostsCount > existingCount) {
                  state.profile.postCount = nextPostsCount;
                }
              }
            }
            if (typeof nextLikesCount === 'number' && Number.isFinite(nextLikesCount)) {
              state.postsLikesCount = nextLikesCount;
              if (state.profile && (state.profile.id === userId || state.profile.uid === userId)) {
                state.profile.likesReceived = nextLikesCount;
              }
            }
            state.postsLoading = false;
            state.postsHasMore = result.hasMore || false;
            state.postsCursor = result.nextCursor || null;
          });
          syncActiveSwrCache(userId, {
            posts: userPosts,
            postsCount: nextPostsCount,
            postsLikesCount: nextLikesCount,
            postsHasMore: result?.hasMore || false,
            postsCursor: result?.nextCursor || null,
          });
        } catch (error) {
          console.error('❌ Load posts failed:', error);
          if (!get()._isLoadCurrent('posts', __seq)) return;
          set((state) => {
            state.postsLoading = false;
            state.postsError = error.message || 'Failed to load posts';
          });
        } finally {
          if (_secondaryInflight.get(inflightKey) === task) {
            _secondaryInflight.delete(inflightKey);
          }
        }
      })();

      _secondaryInflight.set(inflightKey, task);
      return task;
    },
    
    /**
     * Load more posts (pagination)
     * @param {string} userId - User ID
     */
    loadMorePosts: async (userId) => {
      const { postsCursor, postsHasMore, postsLoading } = get();
      
      if (!postsHasMore || postsLoading || !postsCursor) return;

      const __seq = get()._startLoad('posts');
      set((state) => {
        state.postsLoading = true;
      });

      try {
        const fsSvc = (await import('../services/firestoreService.js')).firestoreService;

        const result = await fsSvc.getPostsByUser(userId, {
          limit: 12,
          cursor: postsCursor,
          viewerId: get().viewerUid || useAppStore.getState().currentUser?.uid || null,
          constrainAuthorIsPrivate: !isApprovedFollowerView(get, userId, {}),
        });

        if (!get()._isLoadCurrent('posts', __seq)) return;
        set((state) => {
          // Drop ids already in the feed: a post created between pages can
          // reappear on the next cursor page and would otherwise duplicate.
          const seen = new Set(state.posts.map((p) => p.id));
          const fresh = (result.posts || []).filter((p) => p && !seen.has(p.id));
          state.posts = [...state.posts, ...fresh];
          const livePosts = state.posts.filter(
            (p) => p && p.isDeleted !== true && p.status !== 'deleted' && p.status !== 'scheduled'
          );
          const liveCount = livePosts.length;
          if (state.postsCount !== null || (!result.hasMore && liveCount > 0)) {
            const reconciled = Math.max(state.postsCount || 0, liveCount);
            state.postsCount = reconciled;
            if (state.profile && (state.profile.id === userId || state.profile.uid === userId)) {
              const existingCount = Number(state.profile.postCount);
              if (!Number.isFinite(existingCount) || reconciled > existingCount) {
                state.profile.postCount = reconciled;
              }
            }
          }
          if (!result.hasMore) {
            const fullLikesTotal = livePosts.reduce((sum, p) => {
              const likes = Number(p?.likes ?? p?.stats?.likes ?? p?.likesCount ?? 0);
              return sum + (Number.isFinite(likes) && likes > 0 ? likes : 0);
            }, 0);
            state.postsLikesCount = fullLikesTotal;
            if (state.profile && (state.profile.id === userId || state.profile.uid === userId)) {
              state.profile.likesReceived = fullLikesTotal;
            }
          }
          state.postsLoading = false;
          state.postsHasMore = result.hasMore || false;
          state.postsCursor = result.nextCursor || null;
        });
      } catch (error) {
        console.error('❌ Load more posts failed:', error);
        if (!get()._isLoadCurrent('posts', __seq)) return;
        set((state) => {
          state.postsLoading = false;
          state.postsError = error.message || 'Failed to load more posts';
        });
      }
    },
    
    /**
     * Load user highlights
     * @param {string} userId - User ID
     */
    loadHighlights: async (userId) => {
      if (!userId) return;
      const inflightKey = `highlights::${userId}`;
      if (_secondaryInflight.has(inflightKey)) return _secondaryInflight.get(inflightKey);
      const __seq = get()._startLoad('highlights');
      set((state) => {
        state.highlightsLoading = true;
        state.highlightsError = null;
      });

      const task = (async () => {
        try {
          const storyService = getStoryService();
          const highlightsRes = await withStoreTimeout(storyService.getHighlights(userId), 6000, 'highlights');
          const highlights = Array.isArray(highlightsRes)
            ? highlightsRes
            : (Array.isArray(highlightsRes?.highlights) ? highlightsRes.highlights : []);

          if (!get()._isLoadCurrent('highlights', __seq)) return;
          set((state) => {
            state.highlights = highlights;
            state.highlightsLoading = false;
          });
          syncActiveSwrCache(userId, { highlights });
        } catch (error) {
          console.error('❌ Load highlights failed:', error);
          if (!get()._isLoadCurrent('highlights', __seq)) return;
          set((state) => {
            state.highlightsLoading = false;
            state.highlightsError = error.message || 'Failed to load highlights';
          });
        } finally {
          if (_secondaryInflight.get(inflightKey) === task) _secondaryInflight.delete(inflightKey);
        }
      })();
      _secondaryInflight.set(inflightKey, task);
      return task;
    },

    /**
     * Load user saved posts
     * @param {string} userId - User ID
     */
    loadSavedPosts: async (userId) => {
      if (!userId) return;
      const inflightKey = `saved::${userId}`;
      if (_secondaryInflight.has(inflightKey)) return _secondaryInflight.get(inflightKey);
      const __seq = get()._startLoad('saved');
      set((state) => {
        state.savedLoading = true;
        state.savedError = null;
      });
      const task = (async () => {
        try {
          const { getFirestoreService } = await import('../services/firestoreService.js');
          const res = await withStoreTimeout(getFirestoreService().getSavedPosts(userId), 6000, 'saved posts');
          const posts = Array.isArray(res) ? res : res?.posts || [];
          if (!get()._isLoadCurrent('saved', __seq)) return;
          set((state) => {
            state.savedPosts = posts;
            state.savedLoading = false;
          });
        } catch (error) {
          console.error('❌ Load saved posts failed:', error);
          if (!get()._isLoadCurrent('saved', __seq)) return;
          set((state) => {
            state.savedLoading = false;
            state.savedError = error.message || 'Failed to load saved posts';
          });
        } finally {
          if (_secondaryInflight.get(inflightKey) === task) _secondaryInflight.delete(inflightKey);
        }
      })();
      _secondaryInflight.set(inflightKey, task);
      return task;
    },

    /**
     * Load creator shop items
     * @param {string} [userId] - Creator user ID
     */
    loadShopItems: async (userId) => {
      const __seq = get()._startLoad('shop');
      set((state) => {
        state.shopLoading = true;
      });
      try {
        const { marketplaceService } = await import('../services/marketplaceService.js');
        const items = await marketplaceService.getProducts();
        if (!get()._isLoadCurrent('shop', __seq)) return;
        set((state) => {
          state.shopItems = items || [];
          state.shopLoading = false;
        });
      } catch (error) {
        console.error('❌ Load shop items failed:', error);
        if (!get()._isLoadCurrent('shop', __seq)) return;
        set((state) => {
          state.shopLoading = false;
        });
      }
    },
    
    /**
     * Load user stories
     * @param {string} userId - User ID
     */
    loadStories: async (userId) => {
      if (!userId) return;
      const inflightKey = `stories::${userId}`;
      if (_secondaryInflight.has(inflightKey)) return _secondaryInflight.get(inflightKey);
      const __seq = get()._startLoad('stories');
      set((state) => {
        state.storiesLoading = true;
        state.storiesError = null;
      });

      const task = (async () => {
        try {
          const storyService = getStoryService();
          const storiesRes = await withStoreTimeout(
            typeof storyService.getUserStories === 'function'
              ? storyService.getUserStories(userId)
              : storyService.getStoriesFeed(userId, {}),
            6000,
            'stories'
          );

          const rawList = Array.isArray(storiesRes)
            ? storiesRes
            : Array.isArray(storiesRes?.stories)
              ? storiesRes.stories
              : Array.isArray(storiesRes?.groups)
                ? storiesRes.groups.flatMap((g) => (Array.isArray(g?.stories) ? g.stories : [g]))
                : [];

          const userStories = rawList.filter(
            (s) => s && (
              s.userId === userId ||
              s.authorId === userId ||
              s.ownerId === userId ||
              s.uid === userId
            )
          );

          if (!get()._isLoadCurrent('stories', __seq)) return;
          set((state) => {
            state.stories = userStories;
            state.storiesLoading = false;
          });
          syncActiveSwrCache(userId, { stories: userStories });
        } catch (error) {
          console.error('❌ Load stories failed:', error);
          if (!get()._isLoadCurrent('stories', __seq)) return;
          set((state) => {
            state.storiesLoading = false;
            state.storiesError = error.message || 'Failed to load stories';
          });
        } finally {
          if (_secondaryInflight.get(inflightKey) === task) _secondaryInflight.delete(inflightKey);
        }
      })();
      _secondaryInflight.set(inflightKey, task);
      return task;
    },
    
    /**
     * Load user level
     * @param {string} userId - User ID
     */
    loadLevel: async (userId) => {
      if (!userId) return;
      const __seq = get()._startLoad('level');      
      set((state) => {
        state.levelLoading = true;
      });
      
      try {
        const monetizationService = (await import('../services/monetizationService.js')).getMonetizationService();
        const levelData = await monetizationService.getUserLevel(userId);
        
        if (!get()._isLoadCurrent('level', __seq)) return;
        set((state) => {
          // Absent progression data stays null (honest unavailable state); a
          // fabricated `|| 1` here would mis-state standing through
          // ProfileMyScreen's creator gate.
          state.level = levelData?.level ?? null;
          state.experience = levelData?.experience ?? null;
          state.levelInfo = levelData ?? null;
          state.levelLoading = false;
        });
      } catch (error) {
        console.error('❌ Load level failed:', error);
        if (!get()._isLoadCurrent('level', __seq)) return;
        set((state) => {
          state.levelLoading = false;
        });
      }
    },
    
    /**
     * Load user balance
     * @param {string} userId - User ID
     */
    loadBalance: async (userId) => {
      if (!userId) return;
      const __seq = get()._startLoad('balance');      
      set((state) => {
        state.balanceLoading = true;
      });
      
      try {
        const monetizationService = (await import('../services/monetizationService.js')).getMonetizationService();
        const balanceData = await monetizationService.getBalance(userId);
        
        if (!get()._isLoadCurrent('balance', __seq)) return;
        set((state) => {
          // `getBalance` returns a number (or null when unknown); never coerce
          // an unknown balance to 0.
          state.balance = typeof balanceData === 'number' ? balanceData : null;
          state.balanceLoading = false;
        });
      } catch (error) {
        console.error('❌ Load balance failed:', error);
        if (!get()._isLoadCurrent('balance', __seq)) return;
        set((state) => {
          state.balanceLoading = false;
        });
      }
    },
    
    /**
     * Load user position
     * @param {string} userId - User ID
     */
    loadPosition: async (userId) => {
      if (!userId) return;
      const __seq = get()._startLoad('position');      
      set((state) => {
        state.positionLoading = true;
      });
      
      try {
        const monetizationService = (await import('../services/monetizationService.js')).getMonetizationService();
        const positionData = await monetizationService.getUserPosition(userId);
        
        if (!get()._isLoadCurrent('position', __seq)) return;
        set((state) => {
          state.position = positionData;
          state.positionLoading = false;
        });
      } catch (error) {
        console.error('❌ Load position failed:', error);
        if (!get()._isLoadCurrent('position', __seq)) return;
        set((state) => {
          state.positionLoading = false;
        });
      }
    },
    
    /**
     * Load follow status
     * @param {string} followerId - Follower user ID
     * @param {string} followingId - Following user ID
     */
    loadFollowStatus: async (followerId, followingId) => {
      if (!followerId || !followingId) return;
      const __seq = get()._startLoad('followStatus');
      
      try {
        const userService = (await import('../services/userService.js')).getUserService();
        const followStatus = await userService.getFollowStatus(followerId, followingId);
        if (!get()._isLoadCurrent('followStatus', __seq)) return;
        set((state) => {
          state.followStatus = followStatus;
          state.followStatusTargetId = followingId;
        });
      } catch (error) {
        console.error('❌ Load follow status failed:', error);
      }
    },
    
    /**
     * Load mutual friends
     * @param {string} userId - Current user ID
     * @param {string} otherUserId - Other user ID
     */
    loadMutualFriends: async (userId, otherUserId) => {
      if (!userId || !otherUserId) return;
      const __seq = get()._startLoad('mutualFriends');
      
      set((state) => {
        state.mutualFriendsLoading = true;
        // A fresh fetch invalidates the prior result until it resolves.
        state.mutualFriendsResolved = false;
      });
      
      try {
        const userService = getUserService();
        const result = await userService.getMutualFriends(userId, otherUserId);
        if (!get()._isLoadCurrent('mutualFriends', __seq)) return;
        set((state) => {
          state.mutualFriends = result?.mutualFriends?.slice(0, 5) || [];
          state.mutualFriendsResolved = true;
          state.mutualFriendsLoading = false;
        });
      } catch (error) {
        console.error('❌ Load mutual friends failed:', error);
        if (!get()._isLoadCurrent('mutualFriends', __seq)) return;
        // Leave `mutualFriendsResolved` false so the card stays hidden rather
        // than claiming a measured "No mutual friends".
        set((state) => {
          state.mutualFriendsLoading = false;
        });
      }
    },
    
    /**
     * Follow a user with optimistic update
     * @param {string} followerId - Follower user ID
     * @param {string} followingId - Following user ID
     */
    follow: async (followerId, followingId) => {
      if (!followerId || !followingId) return;
      // Idempotent & concurrency-safe: ignore double-taps while loading or
      // already following.
      if (get().followLoading) return;
      if (get().followStatusTargetId === followingId && get().followStatus?.isFollowing === true) return;

      const activeProfileId = get().profile?.uid || get().profile?.id;
      const isCurrentProfileTarget = activeProfileId === followingId || (!activeProfileId && (!get().followStatusTargetId || get().followStatusTargetId === followingId));
      const previousFollowStatus = (get().followStatusTargetId === followingId || !get().followStatusTargetId) ? get().followStatus : null;
      const previousFollowerCount = isCurrentProfileTarget ? (get().profile?.followerCount ?? null) : null;

      set((state) => {
        state.followLoading = true;
        if (isCurrentProfileTarget) {
          state.followStatusTargetId = followingId;
          state.followStatus = { ...state.followStatus, isFollowing: true, requestStatus: null };
          if (state.profile && typeof state.profile.followerCount === 'number' && Number.isFinite(state.profile.followerCount)) {
            state.profile.followerCount += 1;
          }
        }
      });
      
      try {
        const userService = (await import('../services/userService.js')).getUserService();
        const result = await userService.followUser(followerId, followingId);
        if (result?.requested || result?.requestStatus === 'pending') {
          set((state) => {
            state.followLoading = false;
            if (state.followStatusTargetId === followingId) {
              state.followStatus = { isFollowing: false, requestStatus: 'pending' };
            }
            if ((state.profile?.uid || state.profile?.id) === followingId || (state.profile && !(state.profile.uid || state.profile.id) && state.followStatusTargetId === followingId)) {
              state.profile.followerCount = previousFollowerCount;
            }
          });
          toast.success('Follow request sent');
          return { requested: true, requestStatus: 'pending' };
        }
        
        set((state) => {
          state.followLoading = false;
          if (state.followStatusTargetId === followingId) {
            state.followStatus = { ...state.followStatus, isFollowing: true, requestStatus: null };
          }
        });
        
        toast.success('Following!');
        return { requested: false, requestStatus: null };
      } catch (error) {
        console.error('❌ Follow failed:', error);
        
        // Rollback to the captured snapshot.
        set((state) => {
          state.followLoading = false;
          if (state.followStatusTargetId === followingId) {
            state.followStatus = previousFollowStatus;
          }
          if ((state.profile?.uid || state.profile?.id) === followingId || (state.profile && !(state.profile.uid || state.profile.id) && state.followStatusTargetId === followingId)) {
            state.profile.followerCount = previousFollowerCount;
          }
        });
        
        toast.error('Failed to follow user');
      }
    },
    
    /**
     * Unfollow a user with optimistic update
     * @param {string} followerId - Follower user ID
     * @param {string} followingId - Following user ID
     */
    unfollow: async (followerId, followingId) => {
      if (!followerId || !followingId) return;
      if (get().followLoading) return;
      // Idempotent: a double-tap while not following must not decrement the
      // optimistic counter a second time.
      if (get().followStatusTargetId === followingId && get().followStatus?.isFollowing === false) return;
      
      // Store previous state for rollback. Immer copy-on-writes the draft, so
      // the reference is not mutated by the optimistic `set`.
      const isCurrentProfileTarget = (get().profile?.uid || get().profile?.id) === followingId;
      const previousFollowStatus = get().followStatusTargetId === followingId ? get().followStatus : null;
      const previousFollowerCount = isCurrentProfileTarget ? (get().profile?.followerCount ?? null) : null;

      set((state) => {
        state.followLoading = true;
        if (isCurrentProfileTarget) {
          state.followStatusTargetId = followingId;
          state.followStatus = { ...state.followStatus, isFollowing: false, requestStatus: null };
          if (typeof state.profile.followerCount === 'number' && Number.isFinite(state.profile.followerCount)) {
            state.profile.followerCount = Math.max(0, state.profile.followerCount - 1);
          }
        }
      });
      
      try {
        const userService = (await import('../services/userService.js')).getUserService();
        await userService.unfollowUser(followerId, followingId);
        
        set((state) => {
          state.followLoading = false;
          if (state.followStatusTargetId === followingId) {
            state.followStatus = { ...state.followStatus, isFollowing: false, requestStatus: null };
          }
        });
        
        toast.success('Unfollowed');
      } catch (error) {
        console.error('❌ Unfollow failed:', error);
        
        // Rollback
        set((state) => {
          state.followLoading = false;
          if (state.followStatusTargetId === followingId) {
            state.followStatus = previousFollowStatus;
          }
          if ((state.profile?.uid || state.profile?.id) === followingId) {
            state.profile.followerCount = previousFollowerCount;
          }
        });
        
        toast.error('Failed to unfollow user');
      }
    },
    
    /**
     * Update follow status directly
     * @param {string} followerId - Follower user ID
     * @param {string} followingId - Following user ID
     * @param {boolean} isFollowing - Follow status
     */
    updateFollowStatus: (followerId, followingId, isFollowing) => {
      set((state) => {
        // Ignore a late edge event for a profile that is no longer active.
        if ((state.profile?.uid || state.profile?.id) !== followingId) return;
        const wasFollowing = state.followStatusTargetId === followingId && state.followStatus?.isFollowing === true;
        state.followStatusTargetId = followingId;
        state.followStatus = { ...state.followStatus, isFollowing };
        if (
          wasFollowing !== Boolean(isFollowing) &&
          typeof state.profile.followerCount === 'number' &&
          Number.isFinite(state.profile.followerCount)
        ) {
          state.profile.followerCount = isFollowing
            ? state.profile.followerCount + 1
            : Math.max(0, state.profile.followerCount - 1);
        }
      });
    },
    
    /**
     * Withdraw a pending follow request to a private account. Without this the
     * requester's control stayed on "Requested" with no way back.
     */
    cancelFollowRequest: async (fromUserId, toUserId) => {
      if (!fromUserId || !toUserId) return;
      if (get().followLoading) return;
      if ((get().followStatusTargetId && get().followStatusTargetId !== toUserId) || get().followStatus?.requestStatus !== 'pending') return;
      const previousFollowStatus = get().followStatus;
      set((state) => {
        state.followLoading = true;
        if (!state.followStatusTargetId || state.followStatusTargetId === toUserId) {
          state.followStatusTargetId = toUserId;
          state.followStatus = { isFollowing: false, requestStatus: null };
        }
      });
      try {
        const userService = (await import('../services/userService.js')).getUserService();
        await userService.cancelFollowRequest(fromUserId, toUserId);
        set((state) => {
          state.followLoading = false;
        });
        toast.success('Follow request withdrawn');
      } catch (error) {
        set((state) => {
          state.followLoading = false;
          if (!state.followStatusTargetId || state.followStatusTargetId === toUserId) {
            state.followStatus = previousFollowStatus;
          }
        });
        toast.error('Could not withdraw request');
      }
    },

    /**
     * Adjust optimistic like tally for a single post in the loaded profile grid
     * and roll the delta into `postsLikesCount` / `profile.likesReceived`.
     * @param {string} postId
     * @param {number} delta
     */
    adjustPostLikes: (postId, delta) => {
      if (!postId || !Number.isFinite(Number(delta))) return;
      const numericDelta = Number(delta);
      set((state) => {
        const post = state.posts.find((p) => p && p.id === postId);
        if (post) {
          const currentLikes = Number(post.stats?.likes ?? post.likes ?? post.likesCount ?? 0) || 0;
          const nextLikes = Math.max(0, currentLikes + numericDelta);
          post.likes = nextLikes;
          post.likesCount = nextLikes;
          post.stats = { ...(post.stats || {}), likes: nextLikes };
        }
        if (typeof state.postsLikesCount === 'number' && Number.isFinite(state.postsLikesCount)) {
          state.postsLikesCount = Math.max(0, state.postsLikesCount + numericDelta);
        }
        if (state.profile && typeof state.profile.likesReceived === 'number' && Number.isFinite(state.profile.likesReceived)) {
          state.profile.likesReceived = Math.max(0, state.profile.likesReceived + numericDelta);
        }
      });
    },

    /**
     * Set active tab
     * @param {string} tab - Tab name
     */
    setActiveTab: (tab) => {
      set((state) => {
        state.activeTab = tab;
      });
    },
    
    /**
     * Clear all profile state
     */
    clear: () => {
      _inFlightProfileKey = null;
      _inFlightProfilePromise = null;
      _lastCompletedProfileKey = null;
      _lastCompletedProfileAt = 0;
      _activeSwrKey = null;
      _activeSwrAliasKey = null;
      _swrProfileCache.clear();
      set((state) => {
        const nextSeq = (state.requestSeq || 0) + 1;
        const nextLoads = {};
        for (const k of Object.keys(state.loadSeq || {})) nextLoads[k] = (state.loadSeq[k] || 0) + 1;
        Object.assign(state, initialState);
        // Keep the bumped tokens so any in-flight load for the previous account
        // is discarded when it resolves.
        state.requestSeq = nextSeq;
        state.loadSeq = nextLoads;
      });
    },
    
    /**
     * Reset store to initial state
     */
    reset: () => {
      _inFlightProfileKey = null;
      _inFlightProfilePromise = null;
      _lastCompletedProfileKey = null;
      _lastCompletedProfileAt = 0;
      _activeSwrKey = null;
      _activeSwrAliasKey = null;
      _swrProfileCache.clear();
      set(() => ({ ...initialState }));
    },
  }))
);

export const selectProfile = (state) => state.profile;
export const selectIsOwner = (state) => state.isOwner;
export const selectFollowStatus = (state) => state.followStatus;
export const selectPosts = (state) => state.posts;
export const selectHighlights = (state) => state.highlights;
export const selectActiveTab = (state) => state.activeTab;
export const selectLoading = (state) => state.loading;
export const selectError = (state) => state.error;

export default useProfileStore;
