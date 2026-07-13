/**
 * src/screens/Profile/ProfileScreen.jsx - ARVDOUL Main Profile Screen
 * 
 * Dynamic delegator component to render either `ProfileMyScreen` (owner)
 * or `ProfilePublicScreen` (public view) based on current viewer ID.
 * 
 * @component
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useProfileStore } from '../../store/profileStore';
import { useAnalyticsStore } from '../../store/analyticsStore';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';
import { ProfileSkeleton } from '../../components/profile';
import ProfileMyScreen from './ProfileMyScreen';
import ProfilePublicScreen from './ProfilePublicScreen';

export default function ProfileScreen() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  // Get current user from app store
  const authUser = useAppStore(state => state.currentUser);
  const currentUserId = authUser?.uid;
  
  // Profile store
  const {
    profile,
    loading,
    error,
    isOwner,
    mutualFriends,
    posts,
    postsLoading,
    postsHasMore,
    highlights,
    level,
    position,
    refreshKey,
    loadProfile,
    loadPosts,
    loadMorePosts,
    loadHighlights,
    loadMutualFriends,
    follow,
    unfollow,
    clear,
  } = useProfileStore();
  
  // Analytics store
  const {
    analytics,
    loading: analyticsLoading,
    timeframe,
    ranking,
    loadAnalytics,
    setTimeframe,
  } = useAnalyticsStore();
  
  const [activeProfileTab, setActiveProfileTab] = useState('posts');
  
  // Determine current user ID and viewing user
  const targetUserId = userId || currentUserId;
  const viewingUserId = targetUserId;
  
  // Load profile data
  useEffect(() => {
    if (viewingUserId && currentUserId) {
      loadProfile(viewingUserId, currentUserId);
      loadHighlights(viewingUserId);
      
      if (viewingUserId === currentUserId) {
        loadAnalytics(viewingUserId, timeframe);
      }
    }
    
    return () => {
      clear();
    };
  }, [viewingUserId, currentUserId, refreshKey]);
  
  // Load posts when tab changes
  useEffect(() => {
    if (viewingUserId && activeProfileTab === 'posts') {
      loadPosts(viewingUserId);
    }
  }, [viewingUserId, activeProfileTab]);
  
  // Load mutual friends for non-owner view
  useEffect(() => {
    if (viewingUserId && currentUserId && !isOwner) {
      loadMutualFriends(currentUserId, viewingUserId);
    }
  }, [viewingUserId, currentUserId, isOwner]);
  
  // Handlers
  const handleTabChange = useCallback((tab) => {
    setActiveProfileTab(tab);
  }, []);
  
  const handleFollow = useCallback(() => {
    if (currentUserId && viewingUserId) {
      follow(currentUserId, viewingUserId);
    }
  }, [currentUserId, viewingUserId, follow]);
  
  const handleUnfollow = useCallback(() => {
    if (currentUserId && viewingUserId) {
      unfollow(currentUserId, viewingUserId);
    }
  }, [currentUserId, viewingUserId, unfollow]);
  
  const handleAvatarPress = useCallback(() => {
    if (profile?.photoURL) {
      // Open full size avatar
    }
  }, [profile]);
  
  const handleCoverPress = useCallback(() => {
    if (profile?.coverPhotoURL) {
      // Open full size cover
    }
  }, [profile]);
  
  const handleStatPress = useCallback((statKey) => {
    switch (statKey) {
      case 'followers':
        navigate(`/profile/${viewingUserId}/followers`);
        break;
      case 'following':
        navigate(`/profile/${viewingUserId}/following`);
        break;
      case 'friends':
        navigate(`/profile/${viewingUserId}/friends`);
        break;
      case 'posts':
        setActiveProfileTab('posts');
        break;
      default:
        break;
    }
  }, [viewingUserId, navigate]);
  
  const handlePostPress = useCallback((post) => {
    navigate(`/post/${post.id}`);
  }, [navigate]);
  
  const handleLoadMorePosts = useCallback(() => {
    loadMorePosts(viewingUserId);
  }, [viewingUserId, loadMorePosts]);
  
  const handleHighlightPress = useCallback((highlight) => {
    navigate(`/highlight/${highlight.id}`);
  }, [navigate]);
  
  const handleAddHighlight = useCallback(() => {
    navigate('/create-highlight');
  }, [navigate]);
  
  const handleMutualFriendPress = useCallback((friend) => {
    navigate(`/profile/${friend.id}`);
  }, [navigate]);
  
  const handleRefresh = useCallback(() => {
    if (viewingUserId && currentUserId) {
      loadProfile(viewingUserId, currentUserId);
    }
  }, [viewingUserId, currentUserId, loadProfile]);
  
  // Loading state
  if (loading) {
    return (
      <div className={cn(
        'min-h-screen pb-20',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <ProfileSkeleton theme={theme} />
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center pb-20',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="text-center p-6">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className={cn(
              'px-4 py-2 rounded-xl font-medium',
              'bg-purple-500 text-white',
              'hover:bg-purple-600 transition-colors'
            )}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  // Profile not found
  if (!profile) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center pb-20',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="text-center p-6">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Profile not found
          </p>
          <button
            onClick={() => navigate('/home')}
            className={cn(
              'px-4 py-2 rounded-xl font-medium',
              'bg-purple-500 text-white',
              'hover:bg-purple-600 transition-colors'
            )}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }
  
  // Delegate rendering based on isOwner
  if (isOwner) {
    return (
      <ProfileMyScreen
        profile={profile}
        level={level}
        position={position}
        theme={theme}
        posts={posts}
        postsLoading={postsLoading}
        postsHasMore={postsHasMore}
        highlights={highlights}
        analytics={analytics}
        ranking={ranking}
        timeframe={timeframe}
        analyticsLoading={analyticsLoading}
        activeProfileTab={activeProfileTab}
        handleTabChange={handleTabChange}
        handleAvatarPress={handleAvatarPress}
        handleCoverPress={handleCoverPress}
        handleStatPress={handleStatPress}
        handlePostPress={handlePostPress}
        handleLoadMorePosts={handleLoadMorePosts}
        handleHighlightPress={handleHighlightPress}
        handleAddHighlight={handleAddHighlight}
        handleMutualFriendPress={handleMutualFriendPress}
        loadAnalytics={loadAnalytics}
        setTimeframe={setTimeframe}
        viewingUserId={viewingUserId}
      />
    );
  }

  return (
    <ProfilePublicScreen
      profile={profile}
      level={level}
      position={position}
      theme={theme}
      posts={posts}
      postsLoading={postsLoading}
      postsHasMore={postsHasMore}
      highlights={highlights}
      mutualFriends={mutualFriends}
      activeProfileTab={activeProfileTab}
      handleTabChange={handleTabChange}
      handleAvatarPress={handleAvatarPress}
      handleCoverPress={handleCoverPress}
      handleStatPress={handleStatPress}
      handlePostPress={handlePostPress}
      handleLoadMorePosts={handleLoadMorePosts}
      handleHighlightPress={handleHighlightPress}
      handleMutualFriendPress={handleMutualFriendPress}
    />
  );
}
