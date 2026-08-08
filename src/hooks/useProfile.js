/**
 * src/hooks/useProfile.js - ARVDOUL Profile Hook
 * 
 * Custom hook for profile management.
 * Provides profile loading, follow/unfollow, and post management.
 * 
 * @module hooks/useProfile
 */

import { useCallback, useEffect, useState } from 'react';
import { useProfileStore } from '../store/profileStore';
import { useAppStore } from '../store/appStore';

/**
 * useProfile Hook
 * @param {string} userId - User ID to load
 * @returns {Object} Profile state and actions
 */
export function useProfile(userId) {
  const currentUser = useAppStore(state => state.currentUser);
  const currentUserId = currentUser?.uid;
  
  const {
    profile,
    loading,
    error,
    isOwner,
    followStatus,
    followLoading,
    posts,
    postsLoading,
    postsHasMore,
    activeTab,
    refreshKey,
    loadProfile,
    loadPosts,
    loadMorePosts,
    follow,
    unfollow,
    setActiveTab,
    refreshProfile,
    reset,
  } = useProfileStore();
  
  // Refresh data when userId changes
  useEffect(() => {
    if (userId && currentUserId) {
      loadProfile(userId, currentUserId);
    }
  }, [userId, currentUserId]);
  
  // Load posts when tab is posts
  useEffect(() => {
    if (userId && activeTab === 'posts') {
      loadPosts(userId);
    }
  }, [userId, activeTab, loadPosts]);
  
  // Follow handler
  const handleFollow = useCallback(() => {
    if (currentUserId && userId) {
      follow(currentUserId, userId);
    }
  }, [currentUserId, userId, follow]);
  
  // Unfollow handler
  const handleUnfollow = useCallback(() => {
    if (currentUserId && userId) {
      unfollow(currentUserId, userId);
    }
  }, [currentUserId, userId, unfollow]);
  
  // Load more posts
  const handleLoadMorePosts = useCallback(() => {
    if (userId && postsHasMore && !postsLoading) {
      loadMorePosts(userId);
    }
  }, [userId, postsHasMore, postsLoading, loadMorePosts]);
  
  // Refresh profile
  const handleRefresh = useCallback(() => {
    refreshProfile(userId, currentUserId);
  }, [userId, currentUserId, refreshProfile]);
  
  // Tab change
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
  }, [setActiveTab]);
  
  return {
    // State
    profile,
    loading,
    error,
    isOwner,
    followStatus,
    followLoading,
    posts,
    postsLoading,
    postsHasMore,
    activeTab,
    
    // Actions
    follow: handleFollow,
    unfollow: handleUnfollow,
    loadMorePosts: handleLoadMorePosts,
    setActiveTab: handleTabChange,
    refresh: handleRefresh,
    reset,
  };
}

export default useProfile;
