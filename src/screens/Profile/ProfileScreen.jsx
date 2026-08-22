/**
 * src/screens/Profile/ProfileScreen.jsx - ARVDOUL Main Profile Screen
 * 
 * Primary profile screen showing user profile with posts, stats, and actions.
 * Handles both owner and visitor views.
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
import {
  ProfileHeader,
  ProfileHighlights,
  ProfileFeatured,
  ProfileTabs,
  ProfileTabContent,
  CreatorDashboard,
  ProfileMutualFriends,
  ProfileSkeleton,
} from '../../components/profile';

/**
 * ProfileScreen Component
 */
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
    followStatus,
    followLoading,
    mutualFriends,
    posts,
    postsLoading,
    postsHasMore,
    postsCursor,
    highlights,
    highlightsLoading,
    level,
    balance,
    position,
    activeTab,
    refreshKey,
    loadProfile,
    loadPosts,
    loadMorePosts,
    loadHighlights,
    loadMutualFriends,
    follow,
    unfollow,
    setActiveTab,
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
      case 'reputation':
        navigate(`/reputation/${viewingUserId}`);
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
        theme === 'dark'
          ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]'
          : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]'
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
        theme === 'dark'
          ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]'
          : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]'
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
  
  // Fallback profile if Firestore has not synced yet
  // Honest fallback - real user fields only, zeroed counters, no fabricated
  // identity, stats or posts.
  const effectiveProfile = profile || {
    id: viewingUserId || 'creator-arvdoul',
    username: authUser?.username || '',
    displayName: authUser?.displayName || 'Creator',
    bio: authUser?.bio || '',
    photoURL: authUser?.photoURL || '/assets/default-profile.png',
    coverPhotoURL: null,
    followerCount: 0,
    followingCount: 0,
    postCount: 0,
    isVerified: false,
    isCreator: false,
    level: 1,
    location: ''
  };

  const effectivePosts = (posts && posts.length > 0) ? posts : [];

  return (
    <div className={cn(
      'min-h-screen pb-20',
      theme === 'dark'
        ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]'
        : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]'
    )}>
      {/* Main Content */}
      <div className="max-w-2xl mx-auto">
        {/* Profile Header */}
        <div className="px-4 pt-4">
          <ProfileHeader
            profile={effectiveProfile}
            isOwner={isOwner}
            level={level || effectiveProfile.level}
            position={position}
            theme={theme}
            onAvatarPress={handleAvatarPress}
            onCoverPress={handleCoverPress}
            onStatPress={handleStatPress}
            onMutualFriendPress={handleMutualFriendPress}
          />
        </div>
        
        {/* Mutual Friends (for non-owner) */}
        {mutualFriends.length > 0 && (
          <div className="px-4">
            <ProfileMutualFriends
              mutualFriends={mutualFriends}
              onFriendPress={handleMutualFriendPress}
              theme={theme}
            />
          </div>
        )}
        
        {/* Creator Dashboard (for owner) */}
        {isOwner && analytics && (
          <div className="px-4 mt-4">
            <CreatorDashboard
              analytics={analytics}
              ranking={ranking}
              theme={theme}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              loading={analyticsLoading}
              onRefresh={() => loadAnalytics(viewingUserId, timeframe)}
              onViewDetails={() => navigate('/profile/analytics')}
            />
          </div>
        )}
        
        {/* Highlights */}
        {(highlights.length > 0 || isOwner) && (
          <div className="px-4 mt-4">
            <ProfileHighlights
              highlights={highlights}
              isOwner={isOwner}
              onHighlightPress={handleHighlightPress}
              onAddHighlight={handleAddHighlight}
              theme={theme}
            />
          </div>
        )}
        
        {/* Tabs */}
        <div className="mt-4">
          <ProfileTabs
            activeTab={activeProfileTab}
            onTabChange={handleTabChange}
            isOwner={isOwner}
            theme={theme}
            hasAnalytics={isOwner}
            hasShop={isOwner}
          />
        </div>
        
        {/* Tab Content */}
        <ProfileTabContent
          activeTab={activeProfileTab}
          posts={effectivePosts}
          postsLoading={postsLoading}
          isOwner={isOwner}
          onPostPress={handlePostPress}
          onLoadMore={handleLoadMorePosts}
          hasMore={postsHasMore}
          theme={theme}
        />
      </div>
    </div>
  );
}
