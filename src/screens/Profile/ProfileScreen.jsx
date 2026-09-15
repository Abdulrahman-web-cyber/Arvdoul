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
import { useAuth } from '../../context/AuthContext';
import { useProfileStore } from '../../store/profileStore';
import { useAnalyticsStore } from '../../store/analyticsStore';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { Eye, ShieldAlert, UserX, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getUserService } from '../../services/userService';
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
  
  // Get current user from auth context and app store
  const { user: authContextUser } = useAuth();
  const authStoreUser = useAppStore(state => state.currentUser);
  const authUser = authStoreUser || authContextUser;
  const currentUserId = authUser?.uid || authContextUser?.uid || localStorage.getItem('arvdoul_uid') || localStorage.getItem('uid') || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}')?.uid : null);
  
  // Profile store
  const {
    profile,
    loading,
    error,
    isOwner: storeIsOwner,
    followStatus,
    followLoading,
    mutualFriends,
    posts,
    postsLoading,
    postsHasMore,
    postsCursor,
    savedPosts,
    savedLoading,
    shopItems,
    shopLoading,
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
    loadSavedPosts,
    loadShopItems,
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
  const [viewAsMode, setViewAsMode] = useState('owner'); // 'owner' | 'public' | 'follower'
  const [unblocking, setUnblocking] = useState(false);
  
  // Determine current user ID and viewing user
  const targetUserId = userId || currentUserId;
  const viewingUserId = targetUserId;
  const isActuallyOwner = !userId || userId === currentUserId;
  const isOwner = isActuallyOwner && viewAsMode === 'owner';
  
  // Load profile data
  useEffect(() => {
    if (viewingUserId) {
      const options = viewAsMode !== 'owner' ? { viewAs: viewAsMode } : undefined;
      loadProfile(viewingUserId, currentUserId, options);
      loadHighlights(viewingUserId);
      
      if (isActuallyOwner && viewAsMode === 'owner') {
        loadAnalytics(viewingUserId, timeframe);
      }
    }
    
    return () => {
      clear();
    };
  }, [viewingUserId, currentUserId, refreshKey, viewAsMode, isActuallyOwner]);
  
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
    if (tab === 'posts' && !posts.length) {
      loadPosts(viewingUserId);
    } else if (tab === 'saved' && !savedPosts.length && isOwner) {
      loadSavedPosts(currentUserId);
    } else if (tab === 'shop' && !shopItems.length) {
      loadShopItems(viewingUserId);
    }
  }, [posts.length, viewingUserId, loadPosts, savedPosts.length, isOwner, loadSavedPosts, currentUserId, shopItems.length, loadShopItems]);
  
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
      case 'coins':
        navigate('/coins');
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
  
  const handleUnblock = useCallback(async () => {
    if (!currentUserId || !viewingUserId) return;
    setUnblocking(true);
    try {
      await getUserService().unblockUser(currentUserId, viewingUserId);
      toast.success('User unblocked successfully');
      loadProfile(viewingUserId, currentUserId);
    } catch (err) {
      toast.error('Failed to unblock user');
    } finally {
      setUnblocking(false);
    }
  }, [currentUserId, viewingUserId, loadProfile]);

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
  
  // Blocked user state
  if (profile?.isBlocked) {
    return (
      <div className={cn(
        'min-h-screen flex items-center justify-center pb-20 px-4',
        theme === 'dark'
          ? 'bg-gradient-to-br from-[#060816] via-[#0b1220] to-[#02040a]'
          : 'bg-gradient-to-br from-[#f0f4fa] via-white to-[#eef2f8]'
      )}>
        <div className={cn(
          'max-w-md w-full text-center p-8 rounded-3xl border backdrop-blur-xl shadow-2xl',
          theme === 'dark' ? 'bg-white/[0.03] border-white/10' : 'bg-white border-gray-200'
        )}>
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <UserX className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {profile?.isBlockedByViewer ? 'You Blocked This User' : 'Profile Unavailable'}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
            {profile?.isBlockedByViewer
              ? `You have blocked @${profile.username || 'this user'}. You cannot see their posts, media, or activity until you unblock them.`
              : 'This profile is not available due to privacy and relationship settings.'}
          </p>
          {profile?.isBlockedByViewer && (
            <button
              onClick={handleUnblock}
              disabled={unblocking}
              className={cn(
                'px-6 py-2.5 rounded-xl font-semibold text-sm transition-all',
                'bg-red-500 hover:bg-red-600 text-white shadow-lg flex items-center justify-center gap-2 mx-auto'
              )}
            >
              {unblocking && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{unblocking ? 'Unblocking...' : 'Unblock User'}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Fallback profile if Firestore has not synced yet
  // Resilient fallback - real user fields when available, zeroed counters, no broken screens.
  const effectiveProfile = profile || {
    id: viewingUserId || userId || 'creator-arvdoul',
    username: isOwner
      ? (authUser?.username || authUser?.email?.split('@')[0] || 'user')
      : (userId?.startsWith('user_') ? userId : `user_${(userId || 'creator').slice(0, 7)}`),
    displayName: isOwner
      ? (authUser?.displayName || authUser?.name || 'User')
      : 'Creator',
    bio: isOwner ? (authUser?.bio || '') : '',
    photoURL: getSafeAvatarUrl(isOwner ? authUser?.photoURL : null, isOwner ? (authUser?.displayName || 'User') : 'Creator', viewingUserId),
    coverPhotoURL: null,
    followerCount: 0,
    followingCount: 0,
    postCount: 0,
    coins: isOwner ? (Number(authUser?.coins) || 100) : 0,
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
        {/* Owner View-As Simulator Switcher */}
        {isActuallyOwner && (
          <div className="px-4 pt-3">
            <div className={cn(
              'flex items-center justify-between px-3.5 py-2 rounded-2xl border text-xs shadow-sm',
              theme === 'dark'
                ? 'bg-purple-950/30 border-purple-800/40 text-purple-300'
                : 'bg-purple-50 border-purple-200 text-purple-800'
            )}>
              <div className="flex items-center gap-1.5 font-medium">
                <Eye className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-semibold">Privacy Simulation:</span>
              </div>
              <div className="flex items-center gap-1 bg-white/60 dark:bg-black/40 p-0.5 rounded-xl border border-purple-500/20">
                {[
                  { id: 'owner', label: 'My View' },
                  { id: 'follower', label: 'Follower' },
                  { id: 'public', label: 'Public' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setViewAsMode(item.id)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
                      viewAsMode === item.id
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-purple-600'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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
        {mutualFriends.length > 0 && !effectiveProfile.isRestricted && (
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
        {((highlights.length > 0 && !effectiveProfile.isRestricted) || isOwner) && (
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
        {!effectiveProfile.isRestricted && (
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
        )}
        
        {/* Tab Content */}
        <ProfileTabContent
          profile={effectiveProfile}
          activeTab={activeProfileTab}
          posts={effectivePosts}
          postsLoading={postsLoading}
          savedPosts={savedPosts || []}
          savedLoading={savedLoading}
          shopItems={shopItems || []}
          shopLoading={shopLoading}
          analytics={analytics}
          analyticsLoading={analyticsLoading}
          isOwner={isOwner}
          isRestricted={Boolean(effectiveProfile.isRestricted)}
          isPrivate={Boolean(effectiveProfile.isPrivate)}
          onPostPress={handlePostPress}
          onLoadMore={handleLoadMorePosts}
          onEdit={() => navigate('/profile/edit')}
          hasMore={postsHasMore}
          theme={theme}
        />
      </div>
    </div>
  );
}
