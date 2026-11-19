/**
 * Production-grade public profile viewing screen for other creators & users.
 * Rebuilt to perfectly match the uploaded design specifications across Light and Dark themes.
 * Fully integrated with real system data, server-authoritative level & progression,
 * optimistic follow/unfollow, direct messaging, coin tipping modal, mutual friends,
 * social connections, featured creations, and responsive layout.
 * 
 * @component
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, UserPlus, UserX, ShieldAlert, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useProfileStore } from '../../store/profileStore';
import { cn } from '../../lib/utils';
import {
  pickDisplayName,
  deriveProfileIdentity,
  projectProfileForViewer,
  OFFLINE_PRESENCE,
} from '../../services/profileReadModel.js';
import { shareProfile } from '../../utils/shareUtils';
import { getStoredUid } from '../../utils/security';
import { resolveCapabilities } from '../../services/profileCapabilityEngine';
import { getUserService } from '../../services/userService.js';
import { getAnalyticsService } from '../../services/analyticsService.js';
import { PROFILE_TABS } from '../../config/profileContracts.js';
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
import ProfileTipModal from '../../components/profile/ProfileTipModal';
import ProfileQRCodeModal from '../../components/profile/ProfileQRCodeModal';
import ProfileQRScannerModal from '../../components/profile/ProfileQRScannerModal';
import ProfileSkeleton from '../../components/profile/ProfileSkeleton';

// Modals
import ProfileOptionsMenu from '../../components/profile/ProfileOptionsMenu';
import ProfileVerificationModal from '../../components/profile/ProfileVerificationModal';

export default function ProfilePublicScreen() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.uid || getStoredUid();
  const routeUserId = userId ? String(userId).replace(/^@/, '').trim() : '';
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Read state authoritatively from Profile Store
  const storeProfile = useProfileStore((state) => state.profile);
  const storePosts = useProfileStore((state) => state.posts);
  const storePostsLoading = useProfileStore((state) => state.postsLoading);
  const storePostsHasMore = useProfileStore((state) => state.postsHasMore);
  const storePostsCursor = useProfileStore((state) => state.postsCursor);
  const storeLoading = useProfileStore((state) => state.loading);
  const storeError = useProfileStore((state) => state.error);
  const storeFollowStatus = useProfileStore((state) => state.followStatus);
  const storeFollowLoading = useProfileStore((state) => state.followLoading);
  const storeMutualFriends = useProfileStore((state) => state.mutualFriends);
  const storeMutualFriendsResolved = useProfileStore((state) => state.mutualFriendsResolved);
  const storeHighlights = useProfileStore((state) => state.highlights);

  const [localLoading, setLocalLoading] = useState(true);
  const [friendshipStatus, setFriendshipStatus] = useState('none'); // 'none' | 'pending' | 'received' | 'friends'
  const [pendingRequestId, setPendingRequestId] = useState(null);
  const [friendRequestLoading, setFriendRequestLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [relationship, setRelationship] = useState(null);
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
    const cleanUserId = userId ? String(userId).replace(/^@/, '').trim() : '';
    if (!cleanUserId) {
      if (isMountedRef.current) setLocalLoading(false);
      return;
    }

    setLocalLoading(true);
    setRelationship(null);
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
      // 1. Fetch user profile via store
      await useProfileStore.getState().loadProfile(cleanUserId, currentUserId);
      const { profile: currentProfile, error: profileError } = useProfileStore.getState();
      if (profileError && !currentProfile?.username) {
        return;
      }

      const resolvedUid = currentProfile?.id || currentProfile?.uid || cleanUserId;
      const store = useProfileStore.getState();

      // 2. Load posts, highlights, and relationship context in parallel
      if (currentUserId && resolvedUid !== currentUserId) {
        const userService = getUserService();
        const [relSettled, friendsSettled] = await Promise.allSettled([
          userService.getRelationshipState(currentUserId, resolvedUid),
          userService.areFriends(currentUserId, resolvedUid),
          store.loadPosts(resolvedUid, { limit: 30 }),
          store.loadHighlights(resolvedUid),
          store.loadMutualFriends(currentUserId, resolvedUid),
        ]);

        const rel = relSettled.status === 'fulfilled' ? relSettled.value : null;
        if (rel && isMountedRef.current) {
          setRelationship(rel);
        }

        if (rel?.isBlockedBy || rel?.isBlocking) {
          return;
        }

        const areFriends = friendsSettled.status === 'fulfilled' ? Boolean(friendsSettled.value) : false;
        if (areFriends) {
          if (isMountedRef.current) setFriendshipStatus('friends');
        } else {
          try {
            const [sent, received] = await Promise.all([
              userService.getFriendRequests(currentUserId, 'sent').catch(() => ({ requests: [] })),
              userService.getFriendRequests(currentUserId, 'received').catch(() => ({ requests: [] })),
            ]);
            const sentReq = sent.requests?.find((r) => r.toUserId === resolvedUid);
            const recReq = received.requests?.find((r) => r.fromUserId === resolvedUid);
            if (isMountedRef.current) {
              if (sentReq) {
                setFriendshipStatus('pending');
                setPendingRequestId(sentReq.id);
              } else if (recReq) {
                setFriendshipStatus('received');
                setPendingRequestId(recReq.id);
              } else {
                setFriendshipStatus('none');
              }
            }
          } catch (reqErr) {
            console.warn('Friend request status note:', reqErr);
          }
        }

        try {
          getAnalyticsService().trackProfileView(currentUserId, resolvedUid).catch((e) => {
            console.warn('[Profile] view not tracked', e?.message);
          });
        } catch (e) {
          console.warn('[Profile] analytics service unavailable for view tracking', e?.message);
        }
      } else {
        await Promise.allSettled([
          store.loadPosts(resolvedUid, { limit: 30 }),
          store.loadHighlights(resolvedUid),
        ]);
      }
    } catch (err) {
      console.warn('Public profile fetch error:', err);
    } finally {
      clearTimeout(safetyTimer);
      if (isMountedRef.current) setLocalLoading(false);
    }
  }, [userId, currentUserId]);

  // Load profile and related data using useProfileStore
  useEffect(() => {
    const isMountedRef = { current: true };
    loadPublicProfile(isMountedRef);
    return () => { isMountedRef.current = false; };
  }, [loadPublicProfile]);

  const profileData = storeProfile;
  const posts = storePosts;
  const mutualFriends = storeMutualFriends;
  const mutualFriendsResolved = storeMutualFriendsResolved;
  const loading = localLoading || storeLoading;
  const targetUid = storeProfile?.id || storeProfile?.uid || routeUserId;
  const handleLoadMorePosts = useCallback(() => {
    if (!targetUid) return;
    useProfileStore.getState().loadMorePosts(targetUid);
  }, [targetUid]);
  const isFollowing = Boolean(storeFollowStatus?.isFollowing ?? relationship?.isFollowing ?? profileData?.isFollowing);
  // A private target records a pending follow request rather than an edge; the
  // control must show "Requested" (and offer withdrawal), not "Follow".
  const requestStatus = storeFollowStatus?.requestStatus ?? relationship?.requestStatus ?? null;
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
        toast.success(`You and @${profileData?.username || 'user'} are now friends!`);
      } else if (friendshipStatus === 'none') {
        const res = await userService.sendFriendRequest(currentUser.uid, friendTargetUid);
        setFriendshipStatus('pending');
        if (res?.requestId) setPendingRequestId(res.requestId);
        toast.success(`Friend request sent to @${profileData?.username || 'user'}`);
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
      toast.success('Friend request withdrawn.');
    } catch (e) {
      toast.error(e?.message || 'Could not withdraw the friend request.');
    } finally {
      setFriendRequestLoading(false);
    }
  }, [currentUser?.uid, profileData?.id, profileData?.uid, routeUserId]);

  // Base profile: real data only, no mock fallbacks and no privacy decisions.
  // Privacy is applied once, from the capability engine, in `effectiveProfile`
  // below: components must not re-derive fail-open privacy flags. Identity and
  // counts come from the shared `deriveProfileIdentity` so this screen cannot
  // drift from the owner/preview screens.
  const baseProfile = useMemo(() => {
    if (!profileData) return null;
    const identity = deriveProfileIdentity(profileData, {
      handleCandidates: [profileData.username, profileData.handle],
      handleFallbacks: [profileData.displayName, profileData.email],
      handleFallback: 'creator',
      displayCandidates: [profileData.displayName, profileData.name],
      displayFallback: null,
      followerCandidates: [profileData.followerCount, profileData.followersCount],
      followingCandidates: [profileData.followingCount],
      postCandidates: [posts?.length, profileData.postCount],
      levelCandidates: [profileData.level],
      coinCandidates: [profileData.coins, profileData.coinBalance],
      userId,
    });
    return {
      ...profileData,
      ...identity,
      bio: typeof profileData.bio === 'string' ? profileData.bio : '',
      // `likesReceived`/`likesCount` have no writer anywhere (the metric is not
      // computed), so a `resolveCount` here coerced an absent value to a
      // measured "0 likes" on every public profile. The grid renders unknown as
      // '—'; keep an absent value unknown rather than fabricating a count.
      likesReceived: unknownNumber(profileData.likesReceived ?? profileData.likesCount),
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
  }, [profileData, userId, posts?.length]);

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

  // Sync visitor profile identity into TopAppBar
  useEffect(() => {
    const canExposeIdentity =
      Boolean(effectiveProfile) &&
      !capabilities?.isBlockedBy &&
      capabilities?.canViewProfile !== false;

    if (!canExposeIdentity) {
      window.dispatchEvent(new CustomEvent('arvdoul:profile_header_state', { detail: null }));
      return undefined;
    }

    window.dispatchEvent(new CustomEvent('arvdoul:profile_header_state', {
      detail: {
        userId: effectiveProfile.id || effectiveProfile.uid || routeUserId || null,
        displayName: effectiveProfile.displayName || effectiveProfile.name || null,
        username: effectiveProfile.username || null,
        photoURL: effectiveProfile.photoURL || null,
        isVerified: Boolean(effectiveProfile.isVerified),
      },
    }));
    return undefined;
  }, [
    effectiveProfile,
    capabilities?.isBlockedBy,
    capabilities?.canViewProfile,
    routeUserId,
  ]);

  useEffect(() => {
    return () => {
      window.dispatchEvent(new CustomEvent('arvdoul:profile_header_state', { detail: null }));
    };
  }, []);

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
        <ProfileSkeleton theme={theme} />
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
          isDark ? "bg-[#080F2E]/95 border-white/[0.08]" : "bg-white border-slate-200"
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
          isDark ? "bg-[#080F2E]/95 border-white/[0.08]" : "bg-white border-slate-200"
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
          isDark ? "bg-[#080F2E]/95 border-white/[0.08]" : "bg-white border-slate-200"
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
          isDark ? "bg-[#080F2E]/95 border-white/[0.08]" : "bg-white border-slate-200"
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

        {/* Master Container */}
        <div className="w-full max-w-[1160px] mx-auto px-1 sm:px-2 py-2 sm:py-4 space-y-5 sm:space-y-6">
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
            // invokes the handler with no argument — the old
            // `(friend) => navigate(...friend.id)` dereferenced `undefined` and
            // threw on every click. Route to the full friends list instead.
            onFriendPress={() => navigate(`/profile/${effectiveProfile?.id || effectiveProfile?.uid || userId}/friends`)}
          />

          {/* 3. 6-Card Civic Metrics Grid */}
          <ProfileMetricsGrid
            isOwner={false}
            theme={theme}
            profile={effectiveProfile}
            analytics={null}
            capabilities={capabilities}
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
            <div className={cn(
              "rounded-2xl p-8 sm:p-12 text-center border space-y-4 my-2",
              isDark ? "bg-[#080F2E]/85 border-white/[0.08]" : "bg-white border-slate-200/90 shadow-sm"
            )}>
              <div className="w-14 h-14 mx-auto rounded-full bg-arvdoul-purple/10 text-arvdoul-purple flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">This Account is Private</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Follow @{effectiveProfile.username} to view their media gallery, highlights, and activity feed.
                </p>
              </div>
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  disabled={followLoading}
                  onClick={handleFollowToggle}
                  className="min-h-[44px] px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-arvdoul-gradient hover:brightness-110 shadow-md transition-all inline-flex items-center gap-2 cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{requestStatus === 'pending' ? 'Requested' : 'Follow to View'}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 4. Citizen Progression & Civic Standing (level / XP / streak /
                  reputation — each gated by the owner's show* privacy toggles) */}
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
              />

              {/* 5. Story Highlights Carousel */}
              <ProfileHighlightsSection
                highlights={storeHighlights}
                userId={targetUid}
                isOwner={false}
                theme={theme}
              />

              {/* 5. Featured by Creator 4-Card Section */}
              <ProfileFeaturedSection
                profile={effectiveProfile}
                posts={posts}
                theme={theme}
                isOwner={false}
                onPostClick={(post) => navigate(`/post/${post.id}`)}
                onViewAll={() => setActiveTab('posts')}
              />

              {/* 6. Sticky Underline Tabs Bar with Multi-View Switcher */}
              <div className="sticky top-0 z-30">
                <ProfileTabsBar
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  viewMode={viewMode}
                  onViewModeChange={handleViewModeChange}
                  isOwner={false}
                  theme={theme}
                  counts={{
                    posts: (posts || []).filter(p => p.type !== 'audio' && p.type !== 'track').length,
                    reels: (posts || []).filter(p => p.type === 'reel' || p.type === 'spark' || p.isReel || p.isSpark).length,
                    audio: (posts || []).filter(p => p.type === 'audio' || p.type === 'track' || p.type === 'music' || Boolean(p.audioURL || p.audioUrl)).length,
                    saved: 0,
                    tagged: (posts || []).filter(p => Array.isArray(p.taggedUsers) && p.taggedUsers.length > 0).length,
                  }}
                />
              </div>

              {/* 7. Pinned Posts 4-Card Section (shown on 'posts' tab) */}
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

              {/* 8. Media Feed Grid with Multi-View Mode */}
              <ProfileFeedGrid
                posts={posts}
                activeTab={activeTab}
                viewMode={viewMode}
                loading={storePostsLoading}
                theme={theme}
                profile={effectiveProfile}
                onPostClick={(post) => navigate(`/post/${post.id}`)}
                onOpenTipModal={() => setShowTipModal(true)}
                hasMore={Boolean(storePostsCursor && storePostsHasMore)}
                loadingMore={storePostsLoading}
                onLoadMore={handleLoadMorePosts}
              />
            </>
          )}
        </div>

        {/* Tip / Gift Modal */}
        {showTipModal && (
          <ProfileTipModal
            isOpen={showTipModal}
            onClose={() => setShowTipModal(false)}
            recipient={effectiveProfile}
            currentUser={currentUser}
            onTipSuccess={() => {
              setShowTipModal(false);
            }}
          />
        )}

        {/* QR Code Modal */}
        <ProfileQRCodeModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          profile={effectiveProfile}
          theme={theme}
        />

        {/* QR Scanner Modal */}
        {showScannerModal && (
          <ProfileQRScannerModal
            isOpen={showScannerModal}
            onClose={() => setShowScannerModal(false)}
            theme={theme}
          />
        )}

        {/* Options Menu */}
        {showOptionsMenu && (
          <ProfileOptionsMenu
            profile={effectiveProfile}
            isOwner={false}
            theme={theme}
            capabilities={capabilities}
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
        )}

        {/* Verification Details Modal */}
        <ProfileVerificationModal
          isOpen={showVerificationModal}
          onClose={() => setShowVerificationModal(false)}
          isVerified={effectiveProfile.isVerified}
          profile={effectiveProfile}
          isOwner={false}
          theme={theme}
        />
      </div>
    </ErrorBoundary>
  );
}
