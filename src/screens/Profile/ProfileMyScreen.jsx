/**
 * src/screens/Profile/ProfileMyScreen.jsx - ARVDOUL My Profile Screen
 * 
 * Owner view of the user's own profile.
 * Shows edit capabilities, creator dashboard, analytics, and all content management.
 * 
 * @component
 */

import React, { useCallback, useEffect, useState, Suspense, lazy, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useProfileStore } from '../../store/profileStore';
import { useAnalyticsStore } from '../../store/analyticsStore';
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
const CreatorDashboard = lazy(() => import('../../components/profile/CreatorDashboard'));
const ProfileSkeleton = lazy(() => import('../../components/profile/ProfileSkeleton'));
const AvatarUploadModal = lazy(() => import('../../components/profile/AvatarUploadModal'));

/**
 * ProfileMyScreen Component
 * Own profile view with edit capabilities
 */
export default function ProfileMyScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const scrollRef = useRef(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  // Get current user from app store
  const currentUser = useAppStore((state) => state.currentUser);
  const currentUserId = currentUser?.uid;

  // Profile store
  const {
    profile,
    loading,
    error,
    isOwner,
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
    loadProfile,
    loadPosts,
    loadMorePosts,
    loadHighlights,
    loadLevel,
    loadBalance,
    loadPosition,
    setActiveTab,
    refreshProfile,
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

  const [localActiveTab, setLocalActiveTab] = useState('posts');

  // Load profile data
  useEffect(() => {
    if (currentUserId) {
      loadProfile(currentUserId, currentUserId);
      loadHighlights(currentUserId);
      loadLevel(currentUserId);
      loadBalance(currentUserId);
      loadPosition(currentUserId);
      loadAnalytics(currentUserId, timeframe);
    }

    return () => {
      clear();
    };
  }, [currentUserId, loadProfile, loadHighlights, loadLevel, loadBalance, loadPosition, loadAnalytics, timeframe, clear]);

  // Load posts when tab changes to posts
  useEffect(() => {
    if (currentUserId && localActiveTab === 'posts' && !posts.length) {
      loadPosts(currentUserId);
    }
  }, [currentUserId, localActiveTab, posts.length, loadPosts]);

  // Tab change handler
  const handleTabChange = useCallback((tab) => {
    setLocalActiveTab(tab);
    setActiveTab(tab);

    if (tab === 'posts' && !posts.length) {
      loadPosts(currentUserId);
    }
  }, [setActiveTab, posts.length, loadPosts, currentUserId]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadProfile(currentUserId, currentUserId);
      await loadAnalytics(currentUserId, timeframe);
    } finally {
      setIsRefreshing(false);
    }
  }, [currentUserId, loadProfile, loadAnalytics, timeframe]);

  // Post press handler
  const handlePostPress = useCallback((post) => {
    navigate(`/post/${post.id}`);
  }, [navigate]);

  // Load more posts
  const handleLoadMorePosts = useCallback(() => {
    if (postsHasMore && !postsLoading) {
      loadMorePosts(currentUserId);
    }
  }, [postsHasMore, postsLoading, loadMorePosts, currentUserId]);

  // Highlight press
  const handleHighlightPress = useCallback((highlight) => {
    navigate(`/highlight/${highlight.id}`);
  }, [navigate]);

  // Add highlight
  const handleAddHighlight = useCallback(() => {
    navigate('/create-highlight');
  }, [navigate]);

  // Stat press
  const handleStatPress = useCallback((statKey) => {
    switch (statKey) {
      case 'followers':
        navigate(`/profile/${currentUserId}/followers`);
        break;
      case 'following':
        navigate(`/profile/${currentUserId}/following`);
        break;
      case 'friends':
        navigate(`/profile/${currentUserId}/friends`);
        break;
      case 'reputation':
        navigate(`/reputation/${currentUserId}`);
        break;
      default:
        break;
    }
  }, [currentUserId, navigate]);

  // Edit profile
  const handleEditProfile = useCallback(() => {
    navigate('/profile/edit');
  }, [navigate]);

  // View settings
  const handleSettings = useCallback(() => {
    navigate('/profile/settings');
  }, [navigate]);

  // View analytics
  const handleViewAnalytics = useCallback(() => {
    navigate('/profile/analytics');
  }, [navigate]);

  // Avatar upload handlers
  const handleAvatarClick = useCallback(() => {
    setShowAvatarModal(true);
  }, []);

  const handleAvatarUpload = useCallback((downloadURL) => {
    // Profile will auto-refresh via store
    console.log('Avatar uploaded:', downloadURL);
  }, []);

  const handleAvatarModalClose = useCallback(() => {
    setShowAvatarModal(false);
  }, []);

  // Pull to refresh handler
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollTop === 0 && !isRefreshing) {
      handleRefresh();
    }
    
    // Infinite scroll
    if (scrollHeight - scrollTop - clientHeight < 500) {
      handleLoadMorePosts();
    }
  }, [isRefreshing, handleRefresh, handleLoadMorePosts]);

  // Loading state
  if (loading) {
    return (
      <div className={cn(
        'min-h-screen pb-20',
        theme === 'dark'
          ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]'
          : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]'
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
        theme === 'dark'
          ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]'
          : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]'
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

  // Fallback profile if Firestore is yet to populate
  const effectiveProfile = profile || {
    id: currentUserId || 'my-arvdoul-creator',
    username: currentUser?.username || currentUser?.email?.split('@')[0] || 'creator.arvdoul',
    displayName: currentUser?.displayName || currentUser?.name || 'Arvdoul VIP Creator',
    bio: '✨ Content Creator, Spatial UI & Audio Producer on ARVDOUL | Welcome to my official profile!',
    photoURL: currentUser?.photoURL || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
    coverPhotoURL: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80',
    followerCount: 14200,
    followingCount: 320,
    postCount: 38,
    isVerified: true,
    isCreator: true,
    level: level || 28,
    location: 'Creator HQ'
  };

  const effectivePosts = (posts && posts.length > 0) ? posts : [
    {
      id: 'my-p-1',
      mediaURL: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
      type: 'image',
      likes: 4120,
      comments: 290,
      title: 'Neon futuristic spatial audio setup 🌌'
    },
    {
      id: 'my-p-2',
      mediaURL: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80',
      type: 'video',
      likes: 9840,
      comments: 610,
      title: 'Testing 4K multi-track video timeline exports'
    }
  ];

  return (
    <ErrorBoundary>
      <div
        ref={scrollRef}
        className={cn(
          'min-h-screen pb-20 overflow-y-auto',
          theme === 'dark'
          ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]'
          : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]'
        )}
        onScroll={handleScroll}
      >
        {/* Main Content */}
        <div className="max-w-2xl mx-auto">
          {/* Refresh indicator */}
          {isRefreshing && (
            <div className="fixed top-0 left-0 right-0 z-50 flex justify-center py-2">
              <div className="px-4 py-2 rounded-full bg-purple-500 text-white text-sm font-medium shadow-lg">
                Refreshing...
              </div>
            </div>
          )}

          {/* Profile Header */}
          <div className="px-4 pt-4">
            <Suspense fallback={
              <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
            }>
              <ProfileHeader
                profile={effectiveProfile}
                isOwner={true}
                level={level || effectiveProfile.level}
                position={position}
                theme={theme}
                onAvatarPress={handleAvatarClick}
                onEditPress={handleEditProfile}
                onSettingsPress={handleSettings}
                onDashboardPress={handleViewAnalytics}
                onStatPress={handleStatPress}
              />
            </Suspense>
          </div>

          {/* Creator Dashboard (owner only) */}
          {analytics && (
            <div className="px-4 mt-4">
              <Suspense fallback={
                <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
              }>
                <CreatorDashboard
                  analytics={analytics}
                  ranking={ranking}
                  theme={theme}
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                  loading={analyticsLoading}
                  onRefresh={() => loadAnalytics(currentUserId, timeframe)}
                  onViewDetails={handleViewAnalytics}
                />
              </Suspense>
            </div>
          )}

          {/* Highlights */}
          <div className="px-4 mt-4">
            <Suspense fallback={
              <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
            }>
              <ProfileHighlights
                highlights={highlights}
                isOwner={true}
                onHighlightPress={handleHighlightPress}
                onAddHighlight={handleAddHighlight}
                theme={theme}
              />
            </Suspense>
          </div>

          {/* Tabs */}
          <div className="mt-4 sticky top-0 z-40 bg-gray-50 dark:bg-gray-900">
            <Suspense fallback={
              <div className="h-12 bg-gray-200 dark:bg-gray-800 animate-pulse" />
            }>
              <ProfileTabs
                activeTab={localActiveTab}
                onTabChange={handleTabChange}
                isOwner={true}
                theme={theme}
                hasAnalytics={true}
                hasShop={true}
              />
            </Suspense>
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
              activeTab={localActiveTab}
              posts={effectivePosts}
              postsLoading={postsLoading}
              isOwner={true}
              onPostPress={handlePostPress}
              onLoadMore={handleLoadMorePosts}
              hasMore={postsHasMore}
              theme={theme}
            />
          </Suspense>
        </div>
      </div>

      {/* Avatar Upload Modal */}
      {showAvatarModal && (
        <Suspense fallback={null}>
          <AvatarUploadModal
            isOpen={showAvatarModal}
            onClose={handleAvatarModalClose}
            onUpload={handleAvatarUpload}
            currentAvatar={profile?.photoURL}
            userId={currentUserId}
            theme={theme}
          />
        </Suspense>
      )}
    </ErrorBoundary>
  );
}
