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

import React, { useCallback, useEffect, useState, useMemo, Suspense, lazy, useRef } from 'react';
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
import { shareProfile } from '../../utils/shareUtils';
import { getStoredUid } from '../../utils/security';
import { LEVEL_GATES } from '../../services/levelSystemService';
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
import ProfileQRScannerModal from '../../components/profile/ProfileQRScannerModal';
import ProfileLocationModal from '../../components/profile/ProfileLocationModal';

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
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');

  // Authenticated user
  const { user: authContextUser } = useAuth();
  const authStoreUser = useAppStore((state) => state.currentUser);
  const currentUser = authStoreUser || authContextUser;
  const currentUserId = currentUser?.uid || authContextUser?.uid || getStoredUid();

  // Profile store - reactive state selectors
  const profile = useProfileStore((state) => state.profile);
  const loading = useProfileStore((state) => state.loading);
  const error = useProfileStore((state) => state.error);
  const posts = useProfileStore((state) => state.posts);
  const postsLoading = useProfileStore((state) => state.postsLoading);
  const postsHasMore = useProfileStore((state) => state.postsHasMore);
  const savedPosts = useProfileStore((state) => state.savedPosts);
  const savedLoading = useProfileStore((state) => state.savedLoading);
  const highlights = useProfileStore((state) => state.highlights);
  const level = useProfileStore((state) => state.level);
  const balance = useProfileStore((state) => state.balance);
  const position = useProfileStore((state) => state.position);

  // Analytics store - reactive state selectors
  const analytics = useAnalyticsStore((state) => state.analytics);
  const analyticsLoading = useAnalyticsStore((state) => state.loading);
  const timeframe = useAnalyticsStore((state) => state.timeframe);
  const ranking = useAnalyticsStore((state) => state.ranking);
  const setTimeframe = useAnalyticsStore((state) => state.setTimeframe);

  // Load user data on mount without thrashing or clearing cache
  useEffect(() => {
    if (!currentUserId) return;

    const profileStore = useProfileStore.getState();
    const analyticsStore = useAnalyticsStore.getState();

    profileStore.loadProfile(currentUserId, currentUserId);
    profileStore.loadHighlights(currentUserId);
    profileStore.loadLevel(currentUserId);
    profileStore.loadBalance(currentUserId);
    profileStore.loadPosition(currentUserId);
    profileStore.loadPosts(currentUserId);

    analyticsStore.loadAnalytics(currentUserId, timeframe);
  }, [currentUserId, timeframe]);

  // Tab change handler
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === 'saved' && (!savedPosts || savedPosts.length === 0) && currentUserId) {
      useProfileStore.getState().loadSavedPosts(currentUserId);
    }
  }, [currentUserId, savedPosts]);

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    if (!currentUserId) return;
    setIsRefreshing(true);
    try {
      const profileStore = useProfileStore.getState();
      const analyticsStore = useAnalyticsStore.getState();
      await Promise.allSettled([
        profileStore.loadProfile(currentUserId, currentUserId),
        analyticsStore.loadAnalytics(currentUserId, timeframe),
        profileStore.loadPosts(currentUserId),
      ]);
      toast.success('Profile refreshed');
    } catch (e) {
      console.warn('Refresh note:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [currentUserId, timeframe]);

  // Handle Share
  const handleShare = useCallback(async () => {
    try {
      const result = await shareProfile(effectiveProfile || { id: currentUserId, ...profile });
      if (result.copied) {
        toast.success('Profile link copied to clipboard!');
      }
    } catch (err) {
      toast.error('Could not share profile');
    }
  }, [currentUserId, profile, effectiveProfile]);

  // Fallback profile if Firestore is yet to populate
  const cleanUsername = useMemo(() => {
    try {
      const raw = profile?.username || currentUser?.username;
      if (raw && typeof raw === 'string' && !raw.startsWith('user_') && raw !== 'user' && raw !== 'creator') {
        return raw;
      }
      const rawEmail = typeof currentUser?.email === 'string' ? currentUser.email : (typeof profile?.email === 'string' ? profile.email : '');
      const fromEmail = rawEmail.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (fromEmail && fromEmail !== 'user') return fromEmail;

      const rawName = typeof currentUser?.displayName === 'string' ? currentUser.displayName : (typeof profile?.displayName === 'string' ? profile.displayName : '');
      const fromName = rawName.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (fromName && fromName !== 'user') return fromName;

      return 'creator';
    } catch {
      return 'creator';
    }
  }, [profile?.username, currentUser?.username, currentUser?.email, profile?.email, currentUser?.displayName, profile?.displayName]);

  const effectiveProfile = useMemo(() => {
    const rawDisplayName = currentUser?.displayName || currentUser?.name || profile?.displayName || profile?.name;
    const safeDisplayName = (typeof rawDisplayName === 'string' && rawDisplayName.trim())
      ? rawDisplayName.trim()
      : (typeof currentUser?.email === 'string' && currentUser.email ? currentUser.email.split('@')[0] : 'Creator');

    const safeBio = (typeof profile?.bio === 'string' ? profile.bio : (typeof currentUser?.bio === 'string' ? currentUser.bio : '')).trim();
    const safeLocation = typeof profile?.location === 'string' ? profile.location : (typeof currentUser?.location === 'string' ? currentUser.location : '');
    const safeWebsite = typeof profile?.website === 'string' ? profile.website : (typeof currentUser?.website === 'string' ? currentUser.website : '');
    const safeLevel = Number(level || profile?.level || currentUser?.level) || 1;

    if (profile && typeof profile === 'object') {
      return {
        ...profile,
        id: profile.id || profile.uid || currentUserId || 'creator',
        uid: profile.uid || profile.id || currentUserId || 'creator',
        username: cleanUsername,
        displayName: safeDisplayName,
        bio: safeBio,
        location: safeLocation,
        website: safeWebsite,
        level: safeLevel,
        photoURL: getSafeAvatarUrl(profile.photoURL || currentUser?.photoURL, safeDisplayName, currentUserId),
        followerCount: Number(profile.followerCount ?? profile.followersCount ?? currentUser?.followerCount ?? 0) || 0,
        followingCount: Number(profile.followingCount ?? currentUser?.followingCount ?? 0) || 0,
        postCount: Number(profile.postCount ?? posts?.length ?? 0) || 0,
        coins: Number(profile.coins ?? profile.coinBalance ?? balance ?? currentUser?.coins ?? 0) || 0,
        isVerified: Boolean(profile.isVerified || profile.verified || currentUser?.isVerified),
        isCreator: Boolean(profile.isCreator || currentUser?.isCreator || safeLevel >= LEVEL_GATES.creatorProfile),
      };
    }

    return {
      id: currentUserId || 'creator',
      uid: currentUserId || 'creator',
      username: cleanUsername,
      displayName: safeDisplayName,
      bio: safeBio,
      photoURL: getSafeAvatarUrl(currentUser?.photoURL, safeDisplayName, currentUserId),
      followerCount: Number(currentUser?.followerCount || currentUser?.followersCount) || 0,
      followingCount: Number(currentUser?.followingCount) || 0,
      postCount: posts?.length || 0,
      coins: Number(currentUser?.coins) || balance || 0,
      isVerified: Boolean(currentUser?.isVerified),
      isCreator: Boolean(currentUser?.isCreator || safeLevel >= LEVEL_GATES.creatorProfile),
      level: safeLevel,
      location: safeLocation,
      website: safeWebsite,
    };
  }, [profile, cleanUsername, currentUser, currentUserId, posts?.length, balance, level]);

  const isDark = theme === 'dark';

  if (loading && !profile && !currentUser) {
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
        {loading && !profile && (
          <TopAppLoadingBanner isAnimating={true} label="Syncing profile..." />
        )}
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
            onOpenQrScanner={() => setShowScannerModal(true)}
            onOpenLocationSetup={() => setShowLocationModal(true)}
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

        {/* QR Scanner Modal */}
        {showScannerModal && (
          <ProfileQRScannerModal
            isOpen={showScannerModal}
            onClose={() => setShowScannerModal(false)}
            theme={theme}
          />
        )}

        {/* Location Setup Modal */}
        {showLocationModal && (
          <ProfileLocationModal
            isOpen={showLocationModal}
            onClose={() => setShowLocationModal(false)}
            currentLocation={effectiveProfile?.location}
            userId={currentUserId}
            theme={theme}
            onLocationUpdated={(newLoc) => {
              useProfileStore.getState().loadProfile(currentUserId, currentUserId);
            }}
          />
        )}

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
                useProfileStore.getState().loadProfile(currentUserId, currentUserId);
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
