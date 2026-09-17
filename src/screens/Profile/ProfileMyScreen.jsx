/**
 * src/screens/Profile/ProfileMyScreen.jsx - ARVDOUL My Profile Screen
 * 
 * Production-grade owner view of the authenticated user's profile.
 * Rebuilt to perfectly match the uploaded design specifications across Light and Dark themes.
 * Fully integrated with real system data, server-authoritative level & progression,
 * real coin ledger balance, real analytics, highlights, and content management.
 * 
 * @component
 */

import React, { useCallback, useEffect, useState, Suspense, lazy, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useProfileStore } from '../../store/profileStore';
import { useAnalyticsStore } from '../../store/analyticsStore';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { TopAppLoadingBanner } from '../../components/Navigation/RouteProgressBar';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { toast } from 'sonner';

// Modular Profile Components
import ProfileHeroSection from '../../components/profile/ProfileHeroSection';
import ProfileActionBar from '../../components/profile/ProfileActionBar';
import ProfileMetricsGrid from '../../components/profile/ProfileMetricsGrid';
import ProfileHighlightsSection from '../../components/profile/ProfileHighlightsSection';
import ProfileCreatorDashboard from '../../components/profile/ProfileCreatorDashboard';
import ProfileTabsBar from '../../components/profile/ProfileTabsBar';
import ProfilePinnedPosts from '../../components/profile/ProfilePinnedPosts';
import ProfileFeedGrid from '../../components/profile/ProfileFeedGrid';
import ProfileQRCodeModal from '../../components/profile/ProfileQRCodeModal';

// Modals & Extras
const ProfileSkeleton = lazy(() => import('../../components/profile/ProfileSkeleton'));
const AvatarUploadModal = lazy(() => import('../../components/profile/AvatarUploadModal'));
const ProfileOptionsMenu = lazy(() => import('../../components/profile/ProfileOptionsMenu'));

export default function ProfileMyScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const scrollRef = useRef(null);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');

  // Authenticated user
  const { user: authContextUser } = useAuth();
  const authStoreUser = useAppStore((state) => state.currentUser);
  const currentUser = authStoreUser || authContextUser;
  const currentUserId = currentUser?.uid || authContextUser?.uid || (typeof window !== 'undefined' ? (localStorage.getItem('arvdoul_uid') || localStorage.getItem('uid') || JSON.parse(localStorage.getItem('user') || '{}')?.uid) : null);

  // Profile store
  const {
    profile,
    loading,
    error,
    posts,
    postsLoading,
    postsHasMore,
    savedPosts,
    savedLoading,
    highlights,
    level,
    balance,
    position,
    loadProfile,
    loadPosts,
    loadMorePosts,
    loadSavedPosts,
    loadHighlights,
    loadLevel,
    loadBalance,
    loadPosition,
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

  // Load user data on mount
  useEffect(() => {
    if (currentUserId) {
      loadProfile(currentUserId, currentUserId);
      loadHighlights(currentUserId);
      loadLevel(currentUserId);
      loadBalance(currentUserId);
      loadPosition(currentUserId);
      loadAnalytics(currentUserId, timeframe);
      loadPosts(currentUserId);
    }

    return () => {
      clear();
    };
  }, [currentUserId, loadProfile, loadHighlights, loadLevel, loadBalance, loadPosition, loadAnalytics, loadPosts, timeframe, clear]);

  // Tab change handler
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === 'saved' && (!savedPosts || savedPosts.length === 0)) {
      loadSavedPosts(currentUserId);
    }
  }, [currentUserId, savedPosts, loadSavedPosts]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadProfile(currentUserId, currentUserId),
        loadAnalytics(currentUserId, timeframe),
        loadPosts(currentUserId),
      ]);
      toast.success('Profile refreshed');
    } catch (e) {
      console.warn('Refresh note:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [currentUserId, loadProfile, loadAnalytics, loadPosts, timeframe]);

  // Handle Share
  const handleShare = useCallback(async () => {
    const profileUrl = typeof window !== 'undefined'
      ? `${window.location.origin}/profile/${currentUserId}`
      : `https://arvdoul.app/profile/${currentUserId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.displayName || 'My Profile'} on Arvdoul`,
          url: profileUrl,
        });
      } catch (err) {}
    } else {
      await navigator.clipboard.writeText(profileUrl);
      toast.success('Profile link copied to clipboard!');
    }
  }, [currentUserId, profile]);

  // Fallback profile if Firestore is yet to populate
  const effectiveProfile = profile || {
    id: currentUserId || 'my-arvdoul-creator',
    username: currentUser?.username || currentUser?.email?.split('@')[0] || 'creator',
    displayName: currentUser?.displayName || currentUser?.name || 'Your Profile',
    bio: currentUser?.bio || '',
    photoURL: getSafeAvatarUrl(currentUser?.photoURL, currentUser?.displayName || 'Your Profile', currentUserId),
    coverPhotoURL: currentUser?.coverPhotoURL || null,
    followerCount: Number(currentUser?.followerCount || currentUser?.followersCount) || 0,
    followingCount: Number(currentUser?.followingCount) || 0,
    postCount: posts?.length || 0,
    coins: Number(currentUser?.coins) || balance || 0,
    isVerified: Boolean(currentUser?.isVerified),
    isCreator: Boolean(currentUser?.isCreator),
    level: level || currentUser?.level || 1,
    location: currentUser?.location || '',
  };

  const isDark = theme === 'dark';

  if (loading && !profile) {
    return (
      <div className={cn(
        'min-h-screen pb-20',
        isDark ? 'bg-[#060816]' : 'bg-[#f0f4fa]'
      )}>
        <TopAppLoadingBanner isAnimating={true} label="Loading Profile..." />
        <Suspense fallback={null}>
          <ProfileSkeleton theme={theme} />
        </Suspense>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div
        ref={scrollRef}
        className={cn(
          "min-h-screen pb-24 transition-colors duration-200",
          isDark
            ? "bg-[#060816] text-white selection:bg-purple-500/30"
            : "bg-[#f0f4fa] text-slate-900 selection:bg-purple-500/20"
        )}
      >
        {/* Top Refreshing Pill */}
        {isRefreshing && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-600 text-white text-xs font-bold shadow-lg animate-pulse">
            Refreshing Profile...
          </div>
        )}

        {/* Outer responsive frame matching design images */}
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-5 space-y-4 sm:space-y-5">
          
          {/* 1. Hero Identity & Level Section */}
          <ProfileHeroSection
            profile={effectiveProfile}
            isOwner={true}
            level={level || effectiveProfile.level}
            position={position}
            theme={theme}
            onOpenQrCode={() => setShowQrModal(true)}
            onOpenNotifications={() => navigate('/notifications')}
            onOpenOptions={() => setShowOptionsMenu(true)}
            onAvatarClick={() => setShowAvatarModal(true)}
          />

          {/* 2. Action Buttons Bar */}
          <ProfileActionBar
            isOwner={true}
            theme={theme}
            profile={effectiveProfile}
            coinsBalance={balance}
            onOpenQrCode={() => setShowQrModal(true)}
            onSharePress={handleShare}
            onInsightsPress={() => navigate('/profile/analytics')}
          />

          {/* 3. 6-Cards Key Metric Grid */}
          <ProfileMetricsGrid
            isOwner={true}
            theme={theme}
            profile={effectiveProfile}
            analytics={analytics}
            onMetricPress={(key) => {
              if (key === 'followers') navigate(`/profile/${currentUserId}/followers`);
              else if (key === 'following') navigate(`/profile/${currentUserId}/following`);
              else if (key === 'friends') navigate(`/profile/${currentUserId}/friends`);
              else if (key === 'coins') navigate('/coins');
              else if (key === 'views') navigate('/profile/analytics');
            }}
          />

          {/* 4. Story Highlights / Vibes Carousel */}
          <ProfileHighlightsSection
            highlights={highlights}
            userId={currentUserId}
            isOwner={true}
            theme={theme}
            onAddHighlight={() => navigate('/create-story')}
          />

          {/* 5. Creator Dashboard Analytics (with Level Gating) */}
          <ProfileCreatorDashboard
            analytics={analytics}
            ranking={ranking}
            userLevel={level || effectiveProfile?.level || 1}
            userXp={effectiveProfile?.experience || 0}
            isCreator={effectiveProfile?.isCreator}
            theme={theme}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
          />

          {/* 6. Pinned Posts Section */}
          <ProfilePinnedPosts
            posts={posts}
            theme={theme}
            onPostClick={(post) => navigate(`/post/${post.id}`)}
          />

          {/* 7. Multi-Tab Navigation Bar */}
          <div className="sticky top-2 z-30 pt-1">
            <ProfileTabsBar
              activeTab={activeTab}
              onTabChange={handleTabChange}
              isOwner={true}
              theme={theme}
              counts={{
                posts: posts?.length,
                saved: savedPosts?.length,
              }}
            />
          </div>

          {/* 8. Media Posts & Creations Grid */}
          <ProfileFeedGrid
            posts={posts}
            savedPosts={savedPosts}
            activeTab={activeTab}
            loading={postsLoading || savedLoading}
            theme={theme}
            profile={effectiveProfile}
            onPostClick={(post) => navigate(`/post/${post.id}`)}
          />

        </div>

        {/* QR Code Modal */}
        <ProfileQRCodeModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          profile={effectiveProfile}
          theme={theme}
        />

        {/* Options Menu Dialog */}
        {showOptionsMenu && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
              <Suspense fallback={null}>
                <ProfileOptionsMenu
                  profile={effectiveProfile}
                  isOwner={true}
                  theme={theme}
                  onClose={() => setShowOptionsMenu(false)}
                />
              </Suspense>
            </div>
          </div>
        )}

        {/* Avatar Upload Modal */}
        {showAvatarModal && (
          <Suspense fallback={null}>
            <AvatarUploadModal
              isOpen={showAvatarModal}
              onClose={() => setShowAvatarModal(false)}
              onUpload={(newUrl) => {
                setShowAvatarModal(false);
                toast.success('Avatar updated successfully!');
                loadProfile(currentUserId, currentUserId);
              }}
              currentAvatar={effectiveProfile?.photoURL}
              userId={currentUserId}
              theme={theme}
            />
          </Suspense>
        )}
      </div>
    </ErrorBoundary>
  );
}
