/**
 * src/hooks/useProfile.js - ARVDOUL Profile Hook
 *
 * The single authoritative data hook for a Profile target. It drives the
 * canonical `profileStore` orchestration layer and exposes viewer-target state
 * plus the digital-nation summaries a Profile surface needs.
 *
 * This hook replaces per-screen data pipelines (no direct userService /
 * firestoreService / analyticsService fetching inside Profile screens).
 *
 * @module hooks/useProfile
 */

import { useCallback, useEffect, useMemo } from 'react';
import { useProfileStore } from '../store/profileStore';
import { useAppStore } from '../store/appStore';
import { resolveCapabilities } from '../services/profileCapabilityEngine';

/**
 * @param {string} userId - Target user id (may be a username; caller resolves).
 * @param {Object} [options]
 * @param {boolean} [options.autoLoad=true] - load on mount / target change.
 * @param {string}  [options.viewAs] - owner simulation mode.
 */
export function useProfile(userId, options = {}) {
  const { autoLoad = true, viewAs = null } = options;
  const currentUser = useAppStore((state) => state.currentUser);
  const currentUserId = currentUser?.uid;

  const store = useProfileStore();

  const targetId = userId || null;
  // Prefer the resolved uid once the profile document is loaded (username targets).
  const resolvedTargetId = store.resolvedTargetId || targetId;

  // Load identity + relationship + capability context.
  useEffect(() => {
    if (!autoLoad || !targetId) return;
    useProfileStore.getState().loadProfile(targetId, currentUserId, viewAs ? { viewAs } : {});
  }, [autoLoad, targetId, currentUserId, viewAs]);

  // Load posts whenever the target changes (after uid resolution when possible).
  useEffect(() => {
    if (!autoLoad) return;
    const id = useProfileStore.getState().resolvedTargetId || targetId;
    if (!id) return;
    useProfileStore.getState().loadPosts(id);
  }, [autoLoad, targetId, store.resolvedTargetId]);

  // Load stories + highlights through the store (single coordinated read).
  useEffect(() => {
    if (!autoLoad || !resolvedTargetId) return;
    useProfileStore.getState().loadHighlights(resolvedTargetId);
  }, [autoLoad, resolvedTargetId]);

  // Load digital-nation summary surfaces once the profile + capabilities resolve.
  // Runs for both the owner and visitor views; per-domain capability gating is
  // enforced inside the store action (fail-closed).
  useEffect(() => {
    if (!autoLoad || !resolvedTargetId) return;
    if (!store.profile) return;
    const isOwner = store.isOwner || resolvedTargetId === currentUserId;
    useProfileStore.getState().loadInstitutionalSummaries(resolvedTargetId, currentUserId, {
      isOwner,
      capabilities: store.capabilities,
      profile: store.profile,
    });
    // Re-runs when the target identity or resolved capability set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad, resolvedTargetId, store.profile?.uid, store.profile?.id, currentUserId]);

  // Friend-request domain state for visitor surfaces. Owner/self targets are a
  // no-op inside the store action; the read is capability-gated (fail-closed).
  useEffect(() => {
    if (!autoLoad || !resolvedTargetId || !currentUserId) return;
    if (resolvedTargetId === currentUserId) return;
    if (!store.relationship && !store.profile) return;
    useProfileStore.getState().loadFriendRequestStatus(currentUserId, resolvedTargetId, {
      relationship: store.relationship,
      capabilities: store.capabilities,
    });
  }, [autoLoad, resolvedTargetId, currentUserId, store.relationship, store.capabilities]);

  // Capabilities: prefer store-resolved, otherwise resolve locally from the
  // canonical engine (never a booleans-default fallback).
  const capabilities = useMemo(() => {
    if (store.capabilities) return store.capabilities;
    return resolveCapabilities({
      viewer: { uid: currentUserId },
      target: store.profile,
      relationship: store.relationship || {},
      viewAs,
    });
  }, [store.capabilities, store.profile, store.relationship, currentUserId, viewAs]);

  const handleFollow = useCallback(() => {
    if (!capabilities.canFollow) return;
    if (currentUserId && resolvedTargetId) useProfileStore.getState().follow(currentUserId, resolvedTargetId);
  }, [capabilities.canFollow, currentUserId, resolvedTargetId]);

  const handleUnfollow = useCallback(() => {
    if (!capabilities.canUnfollow) return;
    if (currentUserId && resolvedTargetId) useProfileStore.getState().unfollow(currentUserId, resolvedTargetId);
  }, [capabilities.canUnfollow, currentUserId, resolvedTargetId]);

  const handleSendFriendRequest = useCallback(async () => {
    if (!currentUserId || !resolvedTargetId) return null;
    return useProfileStore.getState().sendFriendRequest(currentUserId, resolvedTargetId);
  }, [currentUserId, resolvedTargetId]);

  const handleAcceptFriendRequest = useCallback(async () => {
    if (!currentUserId) return null;
    const requestId = useProfileStore.getState().pendingFriendRequestId;
    if (!requestId) return null;
    return useProfileStore.getState().acceptFriendRequest(requestId, currentUserId);
  }, [currentUserId]);

  const handleUnblock = useCallback(async () => {
    if (!currentUserId || !resolvedTargetId) return null;
    return useProfileStore.getState().unblockUser(currentUserId, resolvedTargetId);
  }, [currentUserId, resolvedTargetId]);

  const handleLoadMorePosts = useCallback(() => {
    if (resolvedTargetId && store.postsHasMore && !store.postsLoading) {
      useProfileStore.getState().loadMorePosts(resolvedTargetId);
    }
  }, [resolvedTargetId, store.postsHasMore, store.postsLoading]);

  const handleRefresh = useCallback(() => {
    useProfileStore.getState().refreshProfile(targetId, currentUserId, viewAs ? { viewAs } : {});
  }, [targetId, currentUserId, viewAs]);

  const loadHighlights = useCallback((id) => {
    useProfileStore.getState().loadHighlights(id || targetId);
  }, [targetId]);

  const loadVideos = useCallback((id) => {
    useProfileStore.getState().loadVideos(id || targetId);
  }, [targetId]);

  return {
    // Identity + relationship
    profile: store.profile,
    relationship: store.relationship,
    capabilities,
    isOwner: store.isOwner,
    loading: store.loading,
    error: store.error,
    resolvedTargetId,

    // Social
    followStatus: store.followStatus,
    followLoading: store.followLoading,
    mutualFriends: store.mutualFriends,
    mutualFriendsLoading: store.mutualFriendsLoading,
    friendRequestStatus: store.friendRequestStatus,
    pendingFriendRequestId: store.pendingFriendRequestId,
    friendRequestLoading: store.friendRequestLoading,

    // Content
    posts: store.posts,
    postsLoading: store.postsLoading,
    postsHasMore: store.postsHasMore,
    postsError: store.postsError,
    highlights: store.highlights,
    stories: store.stories,
    highlightsLoading: store.highlightsLoading,
    highlightsError: store.highlightsError,
    videos: store.videos,
    videosLoading: store.videosLoading,
    videosError: store.videosError,

    // Digital-nation summaries
    level: store.level,
    balance: store.balance,
    position: store.position,
    reputation: store.reputation,
    rank: store.rank,
    achievements: store.achievements,
    titles: store.titles,
    badges: store.badges,
    creatorProfile: store.creatorProfile,
    passport: store.passport,
    wallet: store.wallet,

    // UI
    activeTab: store.activeTab,
    setActiveTab: store.setActiveTab,

    // Actions
    follow: handleFollow,
    unfollow: handleUnfollow,
    sendFriendRequest: handleSendFriendRequest,
    acceptFriendRequest: handleAcceptFriendRequest,
    unblockUser: handleUnblock,
    loadMorePosts: handleLoadMorePosts,
    loadHighlights,
    loadVideos,
    refresh: handleRefresh,
  };
}

export default useProfile;
