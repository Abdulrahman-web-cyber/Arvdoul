/**
 * src/screens/Profile/ProfilePublicScreen.jsx - ARVDOUL Public Profile Screen
 * 
 * Public view of a user's profile for visitors (non-owners).
 * Shows profile info, stats, follow button, and content tabs.
 * 
 * @component
 */

import React, { useCallback, useEffect, useState, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useProfileStore } from '../../store/profileStore';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import LoadingSpinner from '../../components/Shared/LoadingSpinner';

// Lazy load components
const ProfileHeader = lazy(() => import('../../components/profile/ProfileHeader'));
const ProfileHighlights = lazy(() => import('../../components/profile/ProfileHighlights'));
const ProfileFeatured = lazy(() => import('../../components/profile/ProfileFeatured'));
const ProfileTabs = lazy(() => import('../../components/profile/ProfileTabs'));
const ProfileTabContent = lazy(() => import('../../components/profile/ProfileTabContent'));
const ProfileMutualFriends = lazy(() => import('../../components/profile/ProfileMutualFriends'));
const ProfileActions = lazy(() => import('../../components/profile/ProfileActions'));
const ProfileSkeleton = lazy(() => import('../../components/profile/ProfileSkeleton'));

/**
 * ProfilePublicScreen Component
 * Public view of a user's profile
 */
export default function ProfilePublicScreen() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  // Get current user from app store
  const currentUser = useAppStore((state) => state.currentUser);
  const currentUserId = currentUser?.uid;

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

  const [activeTab, setActiveTabState] = useState('posts');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load profile data
  useEffect(() => {
    if (userId && currentUserId) {
      loadProfile(userId, currentUserId);
      loadHighlights(userId);
    }

    return () => {
      clear();
    };
  }, [userId, currentUserId, loadProfile, loadHighlights, clear]);

  // Load posts when tab changes to posts
  useEffect(() => {
    if (userId && activeTab === 'posts' && !posts.length) {
      loadPosts(userId);
    }
  }, [userId, activeTab, posts.length, loadPosts]);

  // Load mutual friends
  useEffect(() => {
    if (userId && currentUserId && !isOwner) {
      loadMutualFriends(currentUserId, userId);
    }
  }, [userId, currentUserId, isOwner, loadMutualFriends]);

  // Tab change handler
  const handleTabChange = useCallback((tab) => {
    setActiveTabState(tab);
    setActiveTab(tab);

    if (tab === 'posts' && !posts.length) {
      loadPosts(userId);
    }
  }, [setActiveTab, posts.length, loadPosts, userId]);

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

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadProfile(userId, currentUserId);
    } finally {
      setIsRefreshing(false);
    }
  }, [userId, currentUserId, loadProfile]);

  // Post press handler
  const handlePostPress = useCallback((post) => {
    navigate(`/post/${post.id}`);
  }, [navigate]);

  // Load more posts
  const handleLoadMorePosts = useCallback(() => {
    if (postsHasMore && !postsLoading) {
      loadMorePosts(userId);
    }
  }, [postsHasMore, postsLoading, loadMorePosts, userId]);

  // Highlight press
  const handleHighlightPress = useCallback((highlight) => {
    navigate(`/highlight/${highlight.id}`);
  }, [navigate]);

  // Add highlight
  const handleAddHighlight = useCallback(() => {
    navigate('/create-highlight');
  }, [navigate]);

  // Mutual friend press
  const handleMutualFriendPress = useCallback((friend) => {
    navigate(`/profile/${friend.id}`);
  }, [navigate]);

  // Stat press
  const handleStatPress = useCallback((statKey) => {
    switch (statKey) {
      case 'followers':
        navigate(`/profile/${userId}/followers`);
        break;
      case 'following':
        navigate(`/profile/${userId}/following`);
        break;
      case 'friends':
        navigate(`/profile/${userId}/friends`);
        break;
      default:
        break;
    }
  }, [userId, navigate]);

  // Message handler
  const handleMessage = useCallback(() => {
    navigate(`/messages/new?to=${userId}`);
  }, [userId, navigate]);

  // Share handler
  const handleShare = useCallback(() => {
    const shareUrl = `${window.location.origin}/profile/${userId}`;
    if (navigator.share) {
      navigator.share({
        title: `${profile?.displayName}'s Profile`,
        url: shareUrl,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
  }, [userId, profile?.displayName]);

  // Loading state
  if (loading) {
    return (
      <div className={cn(
        'min-h-screen pb-20',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <Suspense fallback={
          <div className="flex items-center justify-center min-h-screen">
            <LoadingSpinner />
          </div>
        }>
          <ProfileSkeleton theme={theme} />
        </Suspense>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn(
        'min-h-screen pb-20 flex items-center justify-center',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="text-center p-6 max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Unable to Load Profile
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={handleRefresh}
            className={cn(
              'px-6 py-3 rounded-xl font-semibold',
              'bg-gradient-to-r from-purple-500 to-blue-500',
              'text-white hover:opacity-90 transition-opacity'
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
        'min-h-screen pb-20 flex items-center justify-center',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        <div className="text-center p-6 max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            Profile Not Found
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            This profile doesn't exist or has been removed.
          </p>
          <button
            onClick={() => navigate('/home')}
            className={cn(
              'px-6 py-3 rounded-xl font-semibold',
              'bg-gradient-to-r from-purple-500 to-blue-500',
              'text-white hover:opacity-90 transition-opacity'
            )}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={cn(
        'min-h-screen pb-20',
        theme === 'dark' ? 'bg-gray-900' : 'bg-gray-50'
      )}>
        {/* Main Content */}
        <div className="max-w-2xl mx-auto">
          {/* Profile Header */}
          <div className="px-4 pt-4">
            <Suspense fallback={
              <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
            }>
              <ProfileHeader
                profile={profile}
                isOwner={false}
                theme={theme}
                onStatPress={handleStatPress}
              />
            </Suspense>
          </div>

          {/* Action Buttons */}
          <div className="px-4 mt-4">
            <ProfileActions
              isOwner={false}
              followStatus={followStatus}
              followLoading={followLoading}
              onFollow={handleFollow}
              onUnfollow={handleUnfollow}
              onMessage={handleMessage}
              onShare={handleShare}
              theme={theme}
            />
          </div>

          {/* Mutual Friends */}
          {mutualFriends.length > 0 && (
            <div className="px-4 mt-4">
              <ProfileMutualFriends
                mutualFriends={mutualFriends}
                onFriendPress={handleMutualFriendPress}
                theme={theme}
              />
            </div>
          )}

          {/* Highlights */}
          {highlights.length > 0 && (
            <div className="px-4 mt-4">
              <ProfileHighlights
                highlights={highlights}
                isOwner={false}
                onHighlightPress={handleHighlightPress}
                theme={theme}
              />
            </div>
          )}

          {/* Tabs */}
          <div className="mt-4">
            <ProfileTabs
              activeTab={activeTab}
              onTabChange={handleTabChange}
              isOwner={false}
              theme={theme}
            />
          </div>

          {/* Tab Content */}
          <Suspense fallback={
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2">
                {[...Array(6)].map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            </div>
          }>
            <ProfileTabContent
              activeTab={activeTab}
              posts={posts}
              postsLoading={postsLoading}
              isOwner={false}
              onPostPress={handlePostPress}
              onLoadMore={handleLoadMorePosts}
              hasMore={postsHasMore}
              theme={theme}
            />
          </Suspense>
        </div>
      </div>
    </ErrorBoundary>
  );
}
