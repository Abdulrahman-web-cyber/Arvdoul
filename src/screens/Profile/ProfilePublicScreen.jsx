/**
 * Production-grade public profile viewing screen for other creators & users.
 * Rebuilt to perfectly match the uploaded design specifications across Light and Dark themes.
 * Fully integrated with real system data, server-authoritative level & progression,
 * optimistic follow/unfollow, direct messaging, coin tipping modal, mutual friends,
 * social connections, featured creations, and responsive layout.
 * 
 * @component
 */

import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, UserPlus, UserX, ShieldAlert, RefreshCw, Coins, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useProfileStore } from '../../store/profileStore';
import { cn } from '../../lib/utils';
import {
  pickDisplayName,
  deriveProfileIdentity,
  projectProfileForViewer,
  resolveCreatorFlag,
  OFFLINE_PRESENCE,
} from '../../services/profileReadModel.js';
import { shareProfile } from '../../utils/shareUtils';
import { resolveCapabilities } from '../../services/profileCapabilityEngine';
import { getUserService } from '../../services/userService.js';
import { PROFILE_TABS } from '../../config/profileContracts.js';
import { LEVEL_GATES } from '../../shared/levelConfig.cjs';
import { unknownNumber } from '../../lib/unknownNumber';
import { ErrorBoundary } from '../../components/ErrorBoundary';

// Modular Profile Components
import ProfileHeroSection from '../../components/profile/ProfileHeroSection';
import ProfileProgression from '../../components/profile/ProfileProgression';
import ProfileMutualFriends from '../../components/profile/ProfileMutualFriends';
import ProfileMetricsGrid from '../../components/profile/ProfileMetricsGrid';
import ProfileHighlightsSection from '../../components/profile/ProfileHighlightsSection';
import ProfileFeaturedSection from '../../components/profile/ProfileFeaturedSection';
import ProfileTabsBar from '../../components/profile/ProfileTabsBar';
import ProfilePinnedPosts from '../../components/profile/ProfilePinnedPosts';
import ProfileFeedGrid from '../../components/profile/ProfileFeedGrid';
import ProfileSkeleton from '../../components/profile/ProfileSkeleton';

const lazyDefault = (loader) => lazy(async () => {
  const mod = await loader();
  const comp = mod?.default?.default || mod?.default || Object.values(mod || {}).find(
    (v) => typeof v === 'function' || (v && typeof v === 'object' && v.$$typeof)
  );
  return { default: comp };
});

// Modals (lazy-loaded on demand to reduce memory footprint)
const ProfileTipModal = lazyDefault(() => import('../../components/profile/ProfileTipModal'));
const ProfileQRCodeModal = lazyDefault(() => import('../../components/profile/ProfileQRCodeModal'));
const ProfileQRScannerModal = lazyDefault(() => import('../../components/profile/ProfileQRScannerModal'));
const ProfileOptionsMenu = lazyDefault(() => import('../../components/profile/ProfileOptionsMenu'));
const ProfileVerificationModal = lazyDefault(() => import('../../components/profile/ProfileVerificationModal'));

export default function ProfilePublicScreen() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, authInitialized } = useAuth();
  const currentUserId = currentUser?.uid || null;
  const routeUserId = userId ? String(userId).replace(/^@/, '').trim() : '';
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Read state authoritatively from Profile Store
  const storeProfile = useProfileStore((state) => state.profile);
  const storePosts = useProfileStore((state) => state.posts);
  const storePostsCount = useProfileStore((state) => state.postsCount);
  const storePostsLikesCount = useProfileStore((state) => state.postsLikesCount);
  const storeFriendCount = useProfileStore((state) => state.friendCount);
  const storePostsLoading = useProfileStore((state) => state.postsLoading);
  const storePostsError = useProfileStore((state) => state.postsError);
  const storePostsHasMore = useProfileStore((state) => state.postsHasMore);
  const storePostsCursor = useProfileStore((state) => state.postsCursor);
  const storeLoading = useProfileStore((state) => state.loading);
  const storeError = useProfileStore((state) => state.error);
  const storeFollowStatus = useProfileStore((state) => state.followStatus);
  const storeFollowLoading = useProfileStore((state) => state.followLoading);
  const storeMutualFriends = useProfileStore((state) => state.mutualFriends);
  const storeMutualFriendsResolved = useProfileStore((state) => state.mutualFriendsResolved);
  const storeHighlights = useProfileStore((state) => state.highlights);
  const storeHighlightsLoading = useProfileStore((state) => state.highlightsLoading);
  const storeStories = useProfileStore((state) => state.stories);
  const storeStoriesLoading = useProfileStore((state) => state.storiesLoading);

  const [localLoading, setLocalLoading] = useState(() => {
    if (!routeUserId) return false;
    const normalized = routeUserId.toLowerCase();
    const state = useProfileStore.getState();
    const p = state.profile;
    const matched = Boolean(
      p &&
      !state.error &&
      (
        String(p.id || '').toLowerCase() === normalized ||
        String(p.uid || '').toLowerCase() === normalized ||
        (p.username && String(p.username).replace(/^@/, '').toLowerCase() === normalized)
      )
    );
    return !matched;
  });
  const [friendshipStatus, setFriendshipStatus] = useState('none'); // 'none' | 'pending' | 'received' | 'friends'
  const [pendingRequestId, setPendingRequestId] = useState(null);
  const [friendRequestLoading, setFriendRequestLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [relationship, setRelationship] = useState(null);
  const [relationshipResolved, setRelationshipResolved] = useState(false);
  const [relationshipError, setRelationshipError] = useState(false);
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('arvdoul_profile_view_mode') || 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('arvdoul_profile_view_mode', mode);
    } catch {
      /* view-mode persistence is a preference, not state */
    }
  }, []);
  
  // Modals
  const [showTipModal, setShowTipModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  const loadPublicProfile = useCallback(async (isMountedRef = { current: true }) => {
    if (!authInitialized) {
      setLocalLoading(true);
      return;
    }
    const cleanUserId = userId ? String(userId).replace(/^@/, '').trim() : '';
    if (!cleanUserId) {
      if (isMountedRef.current) setLocalLoading(false);
      return;
    }

    const normalizedTarget = cleanUserId.toLowerCase();
    const currentStore = useProfileStore.getState();
    const cachedProfile = currentStore.profile;
    const hasMatchedStore = Boolean(
      cachedProfile &&
      !currentStore.error &&
      (
        String(cachedProfile.id || '').toLowerCase() === normalizedTarget ||
        String(cachedProfile.uid || '').toLowerCase() === normalizedTarget ||
        (cachedProfile.username && String(cachedProfile.username).replace(/^@/, '').toLowerCase() === normalizedTarget)
      )
    );

    if (!hasMatchedStore) {
      setLocalLoading(true);
    }
    setRelationship(null);
    setRelationshipResolved(false);
    setRelationshipError(false);
    setFriendshipStatus('none');
    setPendingRequestId(null);
    setFriendRequestLoading(false);
    setShowTipModal(false);
    setShowQrModal(false);
    setShowScannerModal(false);
    setShowOptionsMenu(false);
    setShowVerificationModal(false);

    const safetyTimer = setTimeout(() => {
      if (isMountedRef.current) setLocalLoading(false);
    }, 6000);

    try {
      const userService = getUserService();
      const matchedKnownUid = hasMatchedStore ? (cachedProfile.id || cachedProfile.uid || null) : null;
      const speculativeUid = matchedKnownUid || (/^[A-Za-z0-9]{20,40}$/.test(cleanUserId) ? cleanUserId : null);
      const speculativeRelPromise = (currentUserId && speculativeUid && speculativeUid !== currentUserId)
        ? userService.getRelationshipState(currentUserId, speculativeUid).catch(() => null)
        : null;

      // 1. Fetch user profile via store (returns immediately on SWR hit)
      await useProfileStore.getState().loadProfile(cleanUserId, currentUserId);
      const { profile: currentProfile, error: profileError } = useProfileStore.getState();
      if (profileError && !currentProfile?.username) {
        return;
      }

      const resolvedUid = currentProfile?.id || currentProfile?.uid || cleanUserId;
      const store = useProfileStore.getState();

      // 2. Verify relationship before rendering content/actions, then paint immediately
      // while posts, highlights, and stories stream into their section skeletons.
      if (currentUserId && resolvedUid !== currentUserId) {
        const precomputedRel = speculativeRelPromise && resolvedUid === speculativeUid
          ? await speculativeRelPromise
          : null;
        const relSettled = precomputedRel
          ? [{ status: 'fulfilled', value: precomputedRel }]
          : await Promise.allSettled([
              userService.getRelationshipState(currentUserId, resolvedUid),
            ]);

        // A failed safety-graph read is not equivalent to "no block". Do not
        // issue content/list queries or render relationship actions until the
        // graph has been resolved successfully.
        if (relSettled[0].status !== 'fulfilled' || !relSettled[0].value) {
          if (isMountedRef.current) setRelationshipError(true);
          return;
        }
        const rel = relSettled[0].value;
        if (isMountedRef.current) {
          setRelationship(rel);
          setRelationshipResolved(true);
          setLocalLoading(false);
        }

        if (rel.isBlockedBy || rel.isBlocking) {
          return;
        }

        const areFriends = Boolean(rel.isMutualFriend);
        if (areFriends) {
          if (isMountedRef.current) setFriendshipStatus('friends');
          void Promise.allSettled([
            store.loadPosts(resolvedUid, { limit: 12 }),
            store.loadHighlights(resolvedUid),
            store.loadStories(resolvedUid),
          ]);
        } else {
          const secondaryTasks = Promise.allSettled([
            store.loadPosts(resolvedUid, { limit: 12 }),
            store.loadHighlights(resolvedUid),
            store.loadStories(resolvedUid),
            userService.getFriendRequestStatus(currentUserId, resolvedUid),
          ]);
          const [, , , reqResult] = await secondaryTasks;
          if (reqResult?.status === 'fulfilled' && reqResult.value) {
            const requestState = reqResult.value;
            if (isMountedRef.current) {
              if (requestState.sent) {
                setFriendshipStatus('pending');
                setPendingRequestId(requestState.sent.id);
              } else if (requestState.received) {
                setFriendshipStatus('received');
                setPendingRequestId(requestState.received.id);
              } else {
                setFriendshipStatus('none');
              }
            }
          } else {
            console.warn('Friend request status could not be verified:', reqResult?.reason);
            if (isMountedRef.current) setFriendshipStatus('none');
          }
        }
      } else {
        if (isMountedRef.current) {
          setRelationshipResolved(true);
          setLocalLoading(false);
        }
        void Promise.allSettled([
          store.loadPosts(resolvedUid, { limit: 12 }),
          store.loadHighlights(resolvedUid),
          store.loadStories(resolvedUid),
        ]);
      }
    } catch (err) {
      console.warn('Public profile fetch error:', err);
    } finally {
      clearTimeout(safetyTimer);
      if (isMountedRef.current) setLocalLoading(false);
    }
  }, [userId, currentUserId, authInitialized]);

  // Load profile and related data using useProfileStore
  useEffect(() => {
    const isMountedRef = { current: true };
    loadPublicProfile(isMountedRef);
    return () => { isMountedRef.current = false; };
  }, [loadPublicProfile]);

  // Ensure visiting another profile NEVER flashes a previously cached owner/other profile
  const isMatchingTarget = useMemo(() => {
    if (!storeProfile || !routeUserId) return false;
    const normalizedRoute = routeUserId.toLowerCase();
    const idMatch =
      String(storeProfile.id || '').toLowerCase() === normalizedRoute ||
      String(storeProfile.uid || '').toLowerCase() === normalizedRoute;
    const usernameMatch =
      Boolean(storeProfile.username) &&
      String(storeProfile.username).replace(/^@/, '').toLowerCase() === normalizedRoute;
    return idMatch || usernameMatch;
  }, [storeProfile, routeUserId]);

  const profileData = isMatchingTarget ? storeProfile : null;
  const posts = isMatchingTarget ? storePosts : [];
  const postsCountForTarget = isMatchingTarget ? storePostsCount : null;
  const likesCountForTarget = isMatchingTarget ? storePostsLikesCount : null;
  const friendCountForTarget = isMatchingTarget ? storeFriendCount : null;
  const mutualFriends = isMatchingTarget ? storeMutualFriends : [];
  const mutualFriendsResolved = isMatchingTarget ? storeMutualFriendsResolved : false;
  const highlightsForTarget = isMatchingTarget ? storeHighlights : [];
  const storiesForTarget = isMatchingTarget ? storeStories : [];
  const loading = localLoading || storeLoading;
  const isSyncingPublic = Boolean(profileData && (loading || storePostsLoading));

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('arvdoul:sync_progress', {
      detail: { source: 'profile-public', active: isSyncingPublic },
    }));
    return () => {
      window.dispatchEvent(new CustomEvent('arvdoul:sync_progress', {
        detail: { source: 'profile-public', active: false },
      }));
    };
  }, [isSyncingPublic]);

  const targetUid = profileData?.id || profileData?.uid || routeUserId;
  const handleLoadMorePosts = useCallback(() => {
    if (!targetUid) return;
    useProfileStore.getState().loadMorePosts(targetUid);
  }, [targetUid]);
  // Only the resolved relationship graph is authoritative. A profile's
  // denormalized isFollowing field can be stale and must not enable actions.
  const isFollowing = Boolean(
    isMatchingTarget && currentUserId && (relationship?.isFollowing ?? storeFollowStatus?.isFollowing ?? false)
  );
  // A private target records a pending follow request rather than an edge; the
  // control must show "Requested" (and offer withdrawal), not "Follow".
  const requestStatus = isMatchingTarget && currentUserId
    ? (relationship?.requestStatus ?? storeFollowStatus?.requestStatus ?? null)
    : null;
  const followLoading = storeFollowLoading;

  // Optimistic Follow / Unfollow / Withdraw-request via Profile Store
  const handleFollowToggle = useCallback(async () => {
    if (!currentUserId) {
      toast.error('Please sign in to follow this creator');
      navigate('/login');
      return;
    }

    const targetUid = profileData?.id || profileData?.uid || routeUserId;
    if (!targetUid || targetUid === currentUserId) return;

    if (requestStatus === 'pending') {
      await useProfileStore.getState().cancelFollowRequest(currentUserId, targetUid);
      setRelationship(prev => prev ? { ...prev, isFollowing: false, requestStatus: null } : null);
      return;
    }

    if (isFollowing) {
      await useProfileStore.getState().unfollow(currentUserId, targetUid);
      setRelationship(prev => prev ? { ...prev, isFollowing: false } : null);
    } else {
      await useProfileStore.getState().follow(currentUserId, targetUid);
      // The service may have created a pending request instead of an edge; read
      // the store's truthful post-call state rather than assuming "following".
      const store = useProfileStore.getState();
      const next = store.followStatus;
      setRelationship(prev => prev ? { ...prev, isFollowing: Boolean(next?.isFollowing), requestStatus: next?.requestStatus ?? null } : null);
      if (next?.isFollowing) {
        store.loadPosts(targetUid, { limit: 30 });
        store.loadHighlights(targetUid);
        store.loadStories(targetUid);
      }
    }
  }, [currentUserId, isFollowing, requestStatus, profileData?.id, profileData?.uid, routeUserId, navigate]);

  // Handle Friend Request Toggle (For Newcomer level 1-2 profiles)
  const handleFriendRequestToggle = useCallback(async () => {
    if (!currentUser?.uid) {
      toast.error('Please sign in to send a friend request');
      navigate('/login');
      return;
    }

    // The route param may be a `@handle`; friend requests are keyed on the
    // resolved uid, so using the raw param filed them under the wrong document
    // id (and the accept/cancel paths then never matched).
    const friendTargetUid = profileData?.id || profileData?.uid || routeUserId;
    if (!friendTargetUid || friendTargetUid === currentUser.uid) return;

    if (friendshipStatus === 'friends') {
      toast.info(`You and @${profileData?.username || 'user'} are already friends!`);
      return;
    }

    if (friendshipStatus === 'pending') {
      toast.info('Friend request already sent. Waiting for acceptance.');
      return;
    }
    setFriendRequestLoading(true);
    try {
      const userServiceModule = await import('../../services/userService.js');
      const userService = userServiceModule.getUserService();

      if (friendshipStatus === 'received' && pendingRequestId) {
        await userService.acceptFriendRequest(pendingRequestId, currentUser.uid);
        setFriendshipStatus('friends');
        setPendingRequestId(null);
        window.dispatchEvent(new CustomEvent('arvdoul:friend-request-changed', {
          detail: { targetUid: friendTargetUid, action: 'accepted', requestId: pendingRequestId },
        }));
        const store = useProfileStore.getState();
        store.loadProfile(friendTargetUid, currentUser.uid, { force: true });
        store.loadPosts(friendTargetUid, { limit: 30 });
        store.loadHighlights(friendTargetUid);
        store.loadStories(friendTargetUid);
        toast.success(`You and @${profileData?.username || 'user'} are now friends!`);
      } else if (friendshipStatus === 'none') {
        const res = await userService.sendFriendRequest(currentUser.uid, friendTargetUid);
        if (res?.alreadyFriends) {
          setFriendshipStatus('friends');
          toast.info(`You and @${profileData?.username || 'user'} are already friends!`);
        } else {
          setFriendshipStatus('pending');
          if (res?.requestId) setPendingRequestId(res.requestId);
          window.dispatchEvent(new CustomEvent('arvdoul:friend-request-changed', {
            detail: { targetUid: friendTargetUid, action: 'sent', requestId: res?.requestId || null },
          }));
          toast.success(`Friend request sent to @${profileData?.username || 'user'}`);
        }
      }
    } catch (e) {
      console.error('Friend request error:', e);
      toast.error(e?.message || 'Could not process friend request');
    } finally {
      setFriendRequestLoading(false);
    }
  }, [currentUser?.uid, friendshipStatus, pendingRequestId, profileData?.username, profileData?.id, profileData?.uid, routeUserId, navigate]);

  // Withdraw an outgoing friend request. `cancelFriendRequest` had no caller,
  // so a sent request was a permanent dead-end.
  const handleCancelFriendRequest = useCallback(async () => {
    if (!currentUser?.uid) return;
    const friendTargetUid = profileData?.id || profileData?.uid || routeUserId;
    if (!friendTargetUid) return;
    setFriendRequestLoading(true);
    try {
      const { getUserService } = await import('../../services/userService.js');
      await getUserService().cancelFriendRequest(currentUser.uid, friendTargetUid);
      setFriendshipStatus('none');
      setPendingRequestId(null);
      window.dispatchEvent(new CustomEvent('arvdoul:friend-request-changed', {
        detail: { targetUid: friendTargetUid, action: 'cancelled' },
      }));
      toast.success('Friend request withdrawn.');
    } catch (e) {
      toast.error(e?.message || 'Could not withdraw the friend request.');
    } finally {
      setFriendRequestLoading(false);
    }
  }, [currentUser?.uid, profileData?.id, profileData?.uid, routeUserId]);

  const handleDeclineFriendRequest = useCallback(async () => {
    if (!currentUser?.uid || !pendingRequestId) return;
    const friendTargetUid = profileData?.id || profileData?.uid || routeUserId;
    setFriendRequestLoading(true);
    try {
      const { getUserService } = await import('../../services/userService.js');
      await getUserService().declineFriendRequest(pendingRequestId, currentUser.uid);
      setFriendshipStatus('none');
      setPendingRequestId(null);
      window.dispatchEvent(new CustomEvent('arvdoul:friend-request-changed', {
        detail: { targetUid: friendTargetUid, action: 'declined', requestId: pendingRequestId },
      }));
      toast.info('Friend request declined.');
    } catch (e) {
      toast.error(e?.message || 'Could not decline the friend request.');
    } finally {
      setFriendRequestLoading(false);
    }
  }, [currentUser?.uid, pendingRequestId, profileData?.id, profileData?.uid, routeUserId]);

  // Base profile: real data only, no mock fallbacks and no privacy decisions.
  // Privacy is applied once, from the capability engine, in `effectiveProfile`
  // below: components must not re-derive fail-open privacy flags. Identity and
  // counts come from the shared `deriveProfileIdentity` so this screen cannot
  // drift from the owner/preview screens.
  const baseProfile = useMemo(() => {
    if (!profileData) return null;
    const livePostCount = Array.isArray(posts)
      ? posts.filter((p) => !p?.isDeleted && p?.status !== 'scheduled').length
      : 0;
    const reconciledPostCount =
      typeof postsCountForTarget === 'number' && Number.isFinite(postsCountForTarget)
        ? Math.max(postsCountForTarget, livePostCount)
        : typeof profileData.postCount === 'number' && (profileData.postCount > 0 || !posts?.length)
          ? profileData.postCount
          : storePostsHasMore === false && posts
            ? livePostCount
            : profileData.postCount;

    const identity = deriveProfileIdentity(profileData, {
      handleCandidates: [profileData.username, profileData.handle],
      handleFallbacks: [profileData.displayName, profileData.email],
      handleFallback: null,
      displayCandidates: [profileData.displayName, profileData.name],
      displayFallback: null,
      followerCandidates: [profileData.followerCount, profileData.followersCount],
      followingCandidates: [profileData.followingCount],
      postCandidates: [reconciledPostCount, profileData.postCount, posts?.length],
      levelCandidates: [profileData.level],
      coinCandidates: [profileData.coins, profileData.coinBalance],
      userId,
    });
    const resolvedLikes =
      typeof likesCountForTarget === 'number' && Number.isFinite(likesCountForTarget)
        ? likesCountForTarget
        : unknownNumber(profileData.likesReceived ?? profileData.likesCount);
    return {
      ...profileData,
      ...identity,
      ...(typeof friendCountForTarget === 'number' ? { friendCount: friendCountForTarget } : {}),
      likesReceived: resolvedLikes,
      isPrivate: Boolean(profileData.isPrivate),
      isRestricted: Boolean(profileData.isRestricted),
      links: Array.isArray(profileData.links) ? profileData.links : [],
      pronouns: typeof profileData.pronouns === 'string' ? profileData.pronouns : '',
      profession: typeof profileData.profession === 'string' ? profileData.profession : '',
      education: typeof profileData.education === 'string' ? profileData.education : '',
      presence: profileData.presence || OFFLINE_PRESENCE,
      location: typeof profileData.location === 'string' ? profileData.location : (typeof profileData.city === 'string' ? profileData.city : ''),
      website: typeof profileData.website === 'string' ? profileData.website : (typeof profileData.link === 'string' ? profileData.link : ''),
    };
  }, [profileData, userId, posts, postsCountForTarget, likesCountForTarget, friendCountForTarget, storePostsHasMore]);

  const capabilities = useMemo(() => {
    return resolveCapabilities({
      viewer: currentUser,
      target: baseProfile,
      relationship: relationship || {
        isFollowing,
        friendshipStatus
      }
    });
  }, [currentUser, baseProfile, relationship, isFollowing, friendshipStatus]);

  // The single projection handed to the view layer. Economic status and every
  // gated section are masked here based on the capability engine's decision —
  // never recomputed by a component.
  const isOwner = Boolean(currentUser?.uid && (baseProfile?.uid === currentUser.uid || baseProfile?.id === currentUser.uid));
  const effectiveProfile = useMemo(
    () => projectProfileForViewer(baseProfile, capabilities, { isOwner }),
    [baseProfile, capabilities, isOwner]
  );

  // Reset default-tab tracking cleanly when switching routes
  const appliedDefaultTabFor = React.useRef(null);
  useEffect(() => {
    appliedDefaultTabFor.current = null;
    setActiveTab('posts');
  }, [routeUserId]);

  useEffect(() => {
    const targetKey = effectiveProfile?.id || effectiveProfile?.uid;
    if (!targetKey || appliedDefaultTabFor.current === targetKey) return;
    const preferred = effectiveProfile?.defaultTab;
    if (preferred && PROFILE_TABS.includes(preferred)) {
      setActiveTab(preferred);
    } else {
      setActiveTab('posts');
    }
    appliedDefaultTabFor.current = targetKey;
  }, [effectiveProfile?.id, effectiveProfile?.uid, effectiveProfile?.defaultTab]);

  const handleUnblock = useCallback(async () => {
    const targetUid = effectiveProfile?.id || effectiveProfile?.uid || userId;
    if (!currentUser?.uid || !targetUid) return;
    try {
      const userServiceModule = await import('../../services/userService.js');
      const svc = userServiceModule.getUserService();
      await svc.unblockUser(currentUser.uid, targetUid);
      toast.success('User unblocked');
      const updatedRel = await svc.getRelationshipState(currentUser.uid, targetUid);
      setRelationship(updatedRel);
    } catch {
      toast.error('Could not unblock user');
    }
  }, [currentUser?.uid, effectiveProfile?.id, effectiveProfile?.uid, userId]);

  // Handle profile sharing
  const handleShare = useCallback(async () => {
    try {
      const target = effectiveProfile || { id: userId, uid: userId, username: profileData?.username };
      const result = await shareProfile(target);
      if (result.copied) {
        toast.success('Profile link copied to clipboard!');
      }
    } catch {
      toast.error('Could not share profile');
    }
  }, [effectiveProfile, userId, profileData?.username]);

  // Clearer separation: TopAppBar displays plain "Profile" on visitor routes without avatar or visitor name.

  // Cross-component event listeners for TopAppBar & Header actions
  useEffect(() => {
    const handleQrEvent = () => setShowQrModal(true);
    const handleShareEvent = () => handleShare();
    const handleOptionsEvent = () => setShowOptionsMenu(true);
    window.addEventListener('arvdoul:open_qr_code', handleQrEvent);
    window.addEventListener('arvdoul:share_profile', handleShareEvent);
    window.addEventListener('arvdoul:open_profile_options', handleOptionsEvent);
    return () => {
      window.removeEventListener('arvdoul:open_qr_code', handleQrEvent);
      window.removeEventListener('arvdoul:share_profile', handleShareEvent);
      window.removeEventListener('arvdoul:open_profile_options', handleOptionsEvent);
    };
  }, [handleShare]);

  if (loading && !profileData) {
    return (
      <div className="w-full pb-20">
        <ProfileSkeleton theme={theme} variant="public" />
      </div>
    );
  }

  // The six-second content fallback must never release a signed-in visitor
  // profile while its block/privacy relationship read is still pending.
  if (!loading && baseProfile && !isOwner && currentUserId && !relationshipResolved && !relationshipError) {
    return (
      <div className="w-full pb-20" role="status" aria-label="Verifying profile access">
        <ProfileSkeleton theme={theme} variant="public" />
      </div>
    );
  }

  if (!loading && relationshipError) {
    return (
      <div className={cn(
        "min-h-[70vh] flex items-center justify-center p-4",
        isDark ? "text-white" : "text-slate-900"
      )}>
        <div className={cn(
          "max-w-md w-full p-8 rounded-2xl border text-center space-y-4 shadow-xl",
          isDark ? "bg-white/[0.025] backdrop-blur-2xl border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white border-slate-200"
        )}>
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="font-display text-xl font-bold">Profile Access Could Not Be Verified</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Arvdoul could not verify the relationship and safety settings for this profile. Its contents and actions are withheld until that check succeeds.
          </p>
          <button
            type="button"
            onClick={() => loadPublicProfile()}
            className="min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-arvdoul-gradient hover:opacity-90 shadow-md transition-opacity inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry verification</span>
          </button>
        </div>
      </div>
    );
  }

  if (capabilities?.isBlocking) {
    return (
      <div className={cn(
        "min-h-[70vh] flex items-center justify-center p-4",
        isDark ? "text-white" : "text-slate-900"
      )}>
        <div className={cn(
          "max-w-md w-full p-8 rounded-2xl border text-center space-y-4 shadow-xl",
          isDark ? "bg-white/[0.025] backdrop-blur-2xl border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white border-slate-200"
        )}>
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
            <UserX className="w-8 h-8" />
          </div>
          <h2 className="font-display text-xl font-bold">You have blocked this profile</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You cannot view content or interact with @{effectiveProfile?.username || 'this user'} while they are blocked.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-sm bg-slate-200 dark:bg-white/10 hover:opacity-90 transition-opacity cursor-pointer"
            >
              Go Back
            </button>
            <button
              type="button"
              onClick={handleUnblock}
              className="min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-red-600 hover:bg-red-700 shadow-md transition-opacity cursor-pointer"
            >
              Unblock Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (capabilities?.isBlockedBy) {
    return (
      <div className={cn(
        "min-h-[70vh] flex items-center justify-center p-4",
        isDark ? "text-white" : "text-slate-900"
      )}>
        <div className={cn(
          "max-w-md w-full p-8 rounded-2xl border text-center space-y-4 shadow-xl",
          isDark ? "bg-white/[0.025] backdrop-blur-2xl border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white border-slate-200"
        )}>
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-500/10 text-slate-500 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="font-display text-xl font-bold">Profile Unavailable</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This account is currently unavailable or restricted.
          </p>
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-sm bg-slate-200 dark:bg-white/10 hover:opacity-90 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && (!effectiveProfile || (storeError && !profileData?.username))) {
    return (
      <div className={cn(
        "min-h-[70vh] flex items-center justify-center p-4",
        isDark ? "text-white" : "text-slate-900"
      )}>
        <div className={cn(
          "max-w-md w-full p-8 rounded-2xl border text-center space-y-4 shadow-xl",
          isDark ? "bg-white/[0.025] backdrop-blur-2xl border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white border-slate-200"
        )}>
          <div className="w-16 h-16 mx-auto rounded-full bg-arvdoul-purple/10 text-arvdoul-purple flex items-center justify-center">
            {storeError ? <ShieldAlert className="w-8 h-8" /> : <UserX className="w-8 h-8" />}
          </div>
          <h2 className="font-display text-xl font-bold">
            {storeError ? 'Could Not Load Profile' : 'Creator Profile Not Found'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {storeError || 'This account may have been renamed, removed, or is not yet available on Arvdoul.'}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-sm bg-slate-200 dark:bg-white/10 hover:opacity-90 transition-opacity cursor-pointer"
            >
              Go Back
            </button>
            {storeError ? (
              <button
                type="button"
                onClick={() => loadPublicProfile()}
                className="min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-arvdoul-gradient hover:opacity-90 shadow-md transition-opacity inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/')}
                className="min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-arvdoul-gradient hover:opacity-90 shadow-md transition-opacity cursor-pointer"
              >
                Discover Creators
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!loading && capabilities?.canViewProfile === false) {
    return (
      <div className={cn(
        "min-h-[70vh] flex items-center justify-center p-4",
        isDark ? "text-white" : "text-slate-900"
      )}>
        <div className={cn(
          "max-w-md w-full p-8 rounded-2xl border text-center space-y-4 shadow-xl",
          isDark ? "bg-white/[0.025] backdrop-blur-2xl border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white border-slate-200"
        )}>
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-500/10 text-slate-500 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="font-display text-xl font-bold">Profile Unavailable</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This account is currently unavailable or restricted.
          </p>
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl font-semibold text-sm bg-slate-200 dark:bg-white/10 hover:opacity-90 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={cn(
        "w-full pb-20 transition-colors duration-200",
        isDark
          ? "text-white selection:bg-purple-500/30"
          : "text-slate-900 selection:bg-purple-500/20"
      )}>
        {/* Inline load failure banner */}
        {storeError && (
          <div className="w-full max-w-[1160px] mx-auto px-1 sm:px-2 pt-2">
            <div className={cn(
              "flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border text-xs font-semibold",
              isDark
                ? "bg-red-500/10 border-red-500/25 text-red-300"
                : "bg-red-50 border-red-200 text-red-700"
            )}>
              <span className="truncate">{storeError}</span>
              <button
                type="button"
                onClick={() => loadPublicProfile()}
                className={cn(
                  "min-h-[40px] px-3.5 py-1.5 rounded-xl font-bold transition-colors shrink-0 inline-flex items-center gap-1.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                  isDark ? "bg-white/10 hover:bg-white/15 text-white" : "bg-white hover:bg-slate-100 text-red-700 border border-red-200"
                )}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {/* Master Container — Visitor Social Proof & Content-First Discovery */}
        <div className="w-full max-w-[1040px] mx-auto px-3 sm:px-5 lg:px-7 pt-2 pb-4 sm:pt-3 sm:pb-6 space-y-5 sm:space-y-6">
          {/* 1. Master Identity Header */}
          <ProfileHeroSection
            profile={effectiveProfile}
            isOwner={false}
            level={effectiveProfile.level}
            theme={theme}
            onBack={() => navigate(-1)}
            onRefresh={() => loadPublicProfile()}
            isRefreshing={localLoading}
            onOpenMessages={() => {
              if (capabilities && capabilities.canMessage === false) {
                toast.error('This citizen does not accept direct messages based on their privacy settings.');
                return;
              }
              navigate(`/messages/new?to=${effectiveProfile.id || effectiveProfile.uid}`);
            }}
            onOpenVerificationModal={() => setShowVerificationModal(true)}
            onOpenQrCode={() => setShowQrModal(true)}
            onOpenOptions={() => setShowOptionsMenu(true)}
            onAvatarClick={() => setShowQrModal(true)}
            onShare={handleShare}
            onFollowToggle={handleFollowToggle}
            isFollowing={isFollowing}
            requestStatus={requestStatus}
            followLoading={followLoading}
            friendshipStatus={friendshipStatus}
            friendRequestLoading={friendRequestLoading}
            onFriendRequestToggle={handleFriendRequestToggle}
            onCancelFriendRequest={handleCancelFriendRequest}
            onDeclineFriendRequest={handleDeclineFriendRequest}
            onOpenTipModal={() => setShowTipModal(true)}
            capabilities={capabilities}
          />

          {/* 2. Social Context Bar (Mutual Friends, Shared Communities, Follows You) */}
          <ProfileMutualFriends
            mutualFriends={mutualFriends}
            mutualFriendsResolved={mutualFriendsResolved}
            relationship={relationship}
            isFollowing={isFollowing}
            targetName={pickDisplayName([effectiveProfile?.displayName, effectiveProfile?.name], { fallback: null }) || ((effectiveProfile?.id || effectiveProfile?.uid || userId) ? `user ${String(effectiveProfile?.id || effectiveProfile?.uid || userId).slice(0, 6)}` : 'this user')}
            theme={theme}
            capabilities={capabilities}
            // The mutual-friends card is a summary, and `ProfileSocialContext`
            // invokes the handler with no argument — route to the full friends list.
            onFriendPress={() => navigate(`/profile/${effectiveProfile?.id || effectiveProfile?.uid || userId}/friends`)}
          />

          {/* 3. Public Civic Ledger Summary */}
          <ProfileMetricsGrid
            isOwner={false}
            theme={theme}
            profile={effectiveProfile}
            analytics={null}
            capabilities={capabilities}
            showCoins={false}
            onMetricPress={(key) => {
              const targetId = effectiveProfile?.id || effectiveProfile?.uid || userId;
              if (key === 'followers') navigate(`/profile/${targetId}/followers`);
              else if (key === 'following') navigate(`/profile/${targetId}/following`);
              else if (key === 'friends') navigate(`/profile/${targetId}/friends`);
              else if (key === 'coins') setShowTipModal(true);
              else if (key === 'posts') setActiveTab('posts');
            }}
          />

          {!capabilities.canViewContent ? (
            /* Restricted / Private Account Access Gate */
            (() => {
              const gateRawLevel =
                effectiveProfile?.level != null && Number.isFinite(Number(effectiveProfile.level))
                  ? Number(effectiveProfile.level)
                  : null;
              const canFollowPrivateTarget = Boolean(
                resolveCreatorFlag(effectiveProfile || {}, {}, gateRawLevel) ||
                (gateRawLevel !== null && gateRawLevel >= LEVEL_GATES.publicFollowers)
              );

              return (
                <div className={cn(
                  "rounded-[24px] p-8 sm:p-12 text-center border backdrop-blur-xl space-y-4 my-2",
                  isDark ? "bg-white/[0.025] border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "bg-white border-slate-200/90 shadow-sm"
                )}>
                  <div className="w-14 h-14 mx-auto rounded-full bg-arvdoul-purple/10 text-arvdoul-purple flex items-center justify-center">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">This Account is Private</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                      {canFollowPrivateTarget
                        ? `Follow @${effectiveProfile.username} to view their media gallery, highlights, and activity feed.`
                        : `Send a friend request to @${effectiveProfile.username} to view their media gallery, highlights, and activity feed.`}
                    </p>
                  </div>
                  <div className="pt-2 flex justify-center">
                    {canFollowPrivateTarget ? (
                      <button
                        type="button"
                        disabled={followLoading}
                        onClick={handleFollowToggle}
                        className="min-h-[44px] px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-arvdoul-gradient hover:brightness-110 shadow-md transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                      >
                        <UserPlus className="w-4 h-4" />
                        <span>{requestStatus === 'pending' ? 'Requested' : 'Follow to View'}</span>
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center justify-center gap-2.5">
                        <button
                          type="button"
                          disabled={friendRequestLoading || friendshipStatus === 'friends'}
                          onClick={friendshipStatus === 'pending' ? handleCancelFriendRequest : handleFriendRequestToggle}
                          className="min-h-[44px] px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-arvdoul-gradient hover:brightness-110 shadow-md transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>
                            {friendshipStatus === 'received'
                              ? 'Accept Friend Request'
                              : friendshipStatus === 'pending'
                                ? 'Cancel Request'
                                : friendshipStatus === 'friends'
                                  ? 'Friends'
                                  : 'Add friend'}
                          </span>
                        </button>
                        {friendshipStatus === 'received' && (
                          <button
                            type="button"
                            disabled={friendRequestLoading}
                            onClick={handleDeclineFriendRequest}
                            className={cn(
                              "min-h-[44px] px-5 py-2.5 rounded-xl border font-bold text-sm transition-colors cursor-pointer disabled:opacity-60",
                              isDark ? "bg-white/[0.04] hover:bg-white/[0.09] border-white/15 text-slate-200" : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
                            )}
                          >
                            Decline
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          ) : (
            <>
              {/* 4. Content-First Showcase: Vibes Highlights & Featured Creations */}
              {storeHighlightsLoading && highlightsForTarget.length === 0 ? (
                <div className={cn(
                  "rounded-[22px] border px-4 py-3 flex items-center gap-3 overflow-hidden animate-pulse",
                  isDark ? "bg-white/[0.025] border-white/[0.08]" : "bg-white/75 border-white/90"
                )}>
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="flex flex-col items-center gap-1.5 shrink-0">
                      <div className={cn("w-14 h-14 rounded-full", isDark ? "bg-white/[0.06]" : "bg-slate-200/75")} />
                      <div className={cn("h-2.5 w-11 rounded", isDark ? "bg-white/[0.06]" : "bg-slate-200/75")} />
                    </div>
                  ))}
                </div>
              ) : (
                <ProfileHighlightsSection
                  highlights={highlightsForTarget}
                  userId={targetUid}
                  isOwner={false}
                  managedByParent={true}
                  theme={theme}
                />
              )}

              <ProfileFeaturedSection
                profile={effectiveProfile}
                posts={posts}
                theme={theme}
                isOwner={false}
                onPostClick={(post) => navigate(`/post/${post.id}`)}
                onViewAll={() => setActiveTab('posts')}
              />

              {/* 5. Sticky Underline Tabs Bar + Pinned & Media Feed Grid */}
              <div className="sticky top-0 z-30">
                <ProfileTabsBar
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  viewMode={viewMode}
                  onViewModeChange={handleViewModeChange}
                  isOwner={false}
                  theme={theme}
                  counts={(() => {
                    const list = (posts || []).filter(
                      (p) => p && typeof p === 'object' && p.isDeleted !== true && p.status !== 'deleted' && p.status !== 'scheduled'
                    );
                    const typeOf = (p) => String(p.type || '').toLowerCase();
                    const vibePosts = list.filter((p) => {
                      const t = typeOf(p);
                      return t === 'story' || t === 'vibe' || p.isStory === true || p.isVibe === true;
                    });
                    const mergedVibeIds = new Set([
                      ...((storiesForTarget || []).map((s) => s?.id).filter(Boolean)),
                      ...vibePosts.map((p) => p?.id).filter(Boolean),
                    ]);
                    return {
                      posts: list.filter((p) => {
                        const t = typeOf(p);
                        return t !== 'audio' && t !== 'track' && t !== 'story' && t !== 'vibe' && p.isStory !== true && p.isVibe !== true;
                      }).length,
                      videos: list.filter((p) => {
                        const t = typeOf(p);
                        return t === 'video' || t === 'reel' || t === 'spark' || Boolean(p.videoURL || p.videoUrl || p.mediaType === 'video');
                      }).length,
                      reels: list.filter((p) => {
                        const t = typeOf(p);
                        return t === 'reel' || t === 'spark' || p.isReel === true || p.isSpark === true;
                      }).length,
                      photos: list.filter((p) => {
                        const t = typeOf(p);
                        const isVidOrAudio = t === 'video' || t === 'reel' || t === 'spark' || t === 'audio' || t === 'track' || Boolean(p.videoURL || p.videoUrl || p.audioURL || p.audioUrl);
                        return !isVidOrAudio && (t === 'image' || t === 'photo' || t === 'gallery' || Boolean(p.mediaURL || p.imageUrl || (Array.isArray(p.media) && p.media.length > 0)));
                      }).length,
                      stories: Math.max(mergedVibeIds.size, (storiesForTarget || []).length),
                      audio: list.filter((p) => {
                        const t = typeOf(p);
                        return t === 'audio' || t === 'track' || t === 'music' || Boolean(p.audioURL || p.audioUrl);
                      }).length,
                      saved: 0,
                      tagged: list.filter((p) => Array.isArray(p.taggedUsers) && p.taggedUsers.length > 0).length,
                    };
                  })()}
                />
              </div>

              {activeTab === 'posts' && (
                <ProfilePinnedPosts
                  posts={posts}
                  profileId={targetUid}
                  isOwner={false}
                  theme={theme}
                  onPostClick={(post) => navigate(`/post/${post.id}`)}
                  onViewAll={() => setActiveTab('posts')}
                />
              )}

              {storePostsError && posts.length === 0 ? (
                <div className={cn(
                  "rounded-[24px] p-6 border text-center space-y-3",
                  isDark ? "bg-white/[0.025] border-white/[0.08]" : "bg-white border-slate-200"
                )}>
                  <p className="text-sm font-semibold">We couldn&apos;t load posts for this profile.</p>
                  <button
                    type="button"
                    onClick={() => useProfileStore.getState().loadPosts(targetUid, { limit: 12, force: true })}
                    className="min-h-[44px] px-5 py-2 rounded-xl font-semibold text-sm text-white bg-arvdoul-gradient inline-flex items-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Retry posts</span>
                  </button>
                </div>
              ) : (
                <ProfileFeedGrid
                  posts={posts}
                  stories={storiesForTarget}
                  activeTab={activeTab}
                  viewMode={viewMode}
                  loading={storePostsLoading || (activeTab === 'stories' && storeStoriesLoading)}
                  theme={theme}
                  profile={effectiveProfile}
                  onPostClick={(post) => navigate(`/post/${post.id}`)}
                  onOpenTipModal={() => setShowTipModal(true)}
                  hasMore={Boolean(storePostsCursor && storePostsHasMore)}
                  loadingMore={storePostsLoading}
                  onLoadMore={handleLoadMorePosts}
                />
              )}

              {/* 6. Civic Standing & Patronage Ledger */}
              <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12 items-stretch pt-2">
                <div className={cn(
                  "min-w-0",
                  (Boolean(capabilities?.canViewEconomicStatus) || Boolean(currentUserId))
                    ? "lg:col-span-7"
                    : "lg:col-span-12"
                )}>
                  <ProfileProgression
                    level={effectiveProfile?.level}
                    experience={effectiveProfile?.experience}
                    streak={effectiveProfile?.activeStreak}
                    reputation={effectiveProfile?.reputation}
                    showLevel={effectiveProfile?.showLevel !== false}
                    showReputation={effectiveProfile?.showReputation !== false}
                    showStreak={effectiveProfile?.showStreak !== false}
                    isOwner={false}
                    theme={theme}
                    className="h-full"
                  />
                </div>

                {(Boolean(capabilities?.canViewEconomicStatus) || Boolean(currentUserId)) && (
                  <div className="min-w-0 lg:col-span-5">
                    <div
                      className={cn(
                        "h-full rounded-[24px] border backdrop-blur-xl px-4 py-4 sm:px-5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 transition-colors",
                        isDark
                          ? "bg-white/[0.025] border-amber-400/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                          : "bg-white border-amber-200/80 text-slate-900 shadow-xs"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-500 flex items-center justify-center shrink-0">
                          <Coins className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400 truncate">
                            Arvdoul Patronage
                          </p>
                          {capabilities?.canViewEconomicStatus && effectiveProfile?.coins != null ? (
                            <p className="text-sm font-bold tabular-nums truncate">
                              {Number(effectiveProfile.coins).toLocaleString()} <span className="font-normal text-xs opacity-75">Coins</span>
                            </p>
                          ) : (
                            <p className={cn("text-xs leading-snug", isDark ? "text-slate-400" : "text-slate-600")}>
                              Send Arvdoul Coins to support this creator
                            </p>
                          )}
                        </div>
                      </div>

                      {currentUserId && !isOwner && (
                        <button
                          type="button"
                          onClick={() => setShowTipModal(true)}
                          className={cn(
                            "min-h-[44px] px-4 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                            isDark
                              ? "bg-amber-500/15 border-amber-400/30 text-amber-200 hover:bg-amber-500/25"
                              : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100"
                          )}
                        >
                          <Gift className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Send Coins</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Tip / Gift Modal */}
        {showTipModal && (
          <Suspense fallback={null}>
            <ProfileTipModal
              isOpen={showTipModal}
              onClose={() => setShowTipModal(false)}
              recipient={effectiveProfile}
              currentUser={currentUser}
              onTipSuccess={() => {
                setShowTipModal(false);
              }}
            />
          </Suspense>
        )}

        {/* QR Code Modal */}
        {showQrModal && (
          <Suspense fallback={null}>
            <ProfileQRCodeModal
              isOpen={showQrModal}
              onClose={() => setShowQrModal(false)}
              profile={effectiveProfile}
              theme={theme}
            />
          </Suspense>
        )}

        {/* QR Scanner Modal */}
        {showScannerModal && (
          <Suspense fallback={null}>
            <ProfileQRScannerModal
              isOpen={showScannerModal}
              onClose={() => setShowScannerModal(false)}
              theme={theme}
            />
          </Suspense>
        )}

        {/* Options Menu */}
        {showOptionsMenu && (
          <Suspense fallback={null}>
            <ProfileOptionsMenu
              profile={effectiveProfile}
              isOwner={false}
              theme={theme}
              capabilities={capabilities}
              friendshipStatus={friendshipStatus}
              friendRequestLoading={friendRequestLoading}
              onFriendRequestToggle={handleFriendRequestToggle}
              onCancelFriendRequest={handleCancelFriendRequest}
              onDeclineFriendRequest={handleDeclineFriendRequest}
              onOpenTipModal={() => setShowTipModal(true)}
              onRelationshipChange={({ type, value }) => {
                setRelationship((prev) => ({
                  ...(prev || {}),
                  ...(type === 'block'
                    ? { isBlocking: value }
                    : type === 'mute'
                      ? { isMuted: value }
                      : { isRestricted: value }),
                }));
                if (type === 'block' && value === false) {
                  loadPublicProfile();
                }
              }}
              onClose={() => setShowOptionsMenu(false)}
            />
          </Suspense>
        )}

        {/* Verification Details Modal */}
        {showVerificationModal && (
          <Suspense fallback={null}>
            <ProfileVerificationModal
              isOpen={showVerificationModal}
              onClose={() => setShowVerificationModal(false)}
              isVerified={effectiveProfile.isVerified}
              profile={effectiveProfile}
              isOwner={false}
              theme={theme}
            />
          </Suspense>
        )}
      </div>
    </ErrorBoundary>
  );
}
