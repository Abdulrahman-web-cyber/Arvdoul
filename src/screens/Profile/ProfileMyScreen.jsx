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
import { Eye, ShieldCheck, X, Lock } from 'lucide-react';
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
import { resolveCapabilities } from '../../services/profileCapabilityEngine';
import { toast } from 'sonner';

// Modular Profile Components
import ProfileHeroSection from '../../components/profile/ProfileHeroSection';
import ProfileMetricsGrid from '../../components/profile/ProfileMetricsGrid';
import ProfileHighlightsSection from '../../components/profile/ProfileHighlightsSection';
import ProfileCreatorDashboard from '../../components/profile/ProfileCreatorDashboard';
import ProfileTabsBar from '../../components/profile/ProfileTabsBar';
import ProfilePinnedPosts from '../../components/profile/ProfilePinnedPosts';
import ProfileFeedGrid from '../../components/profile/ProfileFeedGrid';
import ProfileQRCodeModal from '../../components/profile/ProfileQRCodeModal';
import ProfileQRScannerModal from '../../components/profile/ProfileQRScannerModal';
import ProfileLocationModal from '../../components/profile/ProfileLocationModal';
import ProfileSkeleton from '../../components/profile/ProfileSkeleton';

// Modals & Extras
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
  const [viewAs, setViewAs] = useState('owner'); // 'owner' | 'public' | 'follower' | 'connection'

  // Authenticated user
  const { user: authContextUser } = useAuth();
  const authStoreUser = useAppStore((state) => state.currentUser);
  const currentUser = authStoreUser || authContextUser;
  const currentUserId = currentUser?.uid || authContextUser?.uid || getStoredUid();

  const handleViewAsChange = useCallback((mode) => {
    setViewAs(mode);
    if (!currentUserId) return;
    useProfileStore.getState().loadProfile(currentUserId, currentUserId, {
      viewAs: mode === 'owner' ? null : mode
    });
  }, [currentUserId]);

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

  // Fallback username if Firestore is yet to populate
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

  // Server-authoritative composite profile
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

  // Centrally resolved Action Capabilities
  const capabilities = useMemo(() => {
    return resolveCapabilities({
      viewer: currentUser,
      target: effectiveProfile,
      relationship: {
        isOwner: true,
        isFollowing: viewAs === 'follower' || viewAs === 'connection',
        isFollower: true,
        isMutualFriend: viewAs === 'connection'
      },
      viewAs: viewAs === 'owner' ? null : viewAs
    });
  }, [currentUser, effectiveProfile, viewAs]);

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
      const target = effectiveProfile || { id: currentUserId, uid: currentUserId, username: cleanUsername };
      const result = await shareProfile(target);
      if (result.copied) {
        toast.success('Profile link copied to clipboard!');
      }
    } catch (err) {
      toast.error('Could not share profile');
    }
  }, [effectiveProfile, currentUserId, cleanUsername]);

  const isDark = theme === 'dark';

  if (loading && !profile && !currentUser) {
    return (
      <div className={cn(
        'min-h-screen pb-20',
        isDark ? 'bg-[#060816]' : 'bg-[#f0f4fa]'
      )}>
        <TopAppLoadingBanner isAnimating={true} label="Loading Profile..." />
        <ProfileSkeleton theme={theme} />
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
          
          {/* View As Mode Control */}
          <div className={cn(
            "rounded-2xl p-3 border flex flex-col sm:flex-row items-center justify-between gap-3 transition-all shadow-sm",
            isDark ? "bg-[#0d1424] border-purple-500/20" : "bg-white border-purple-100"
          )}>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>View As Perspective</span>
                  {viewAs !== 'owner' && (
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30">
                      Simulating {viewAs}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Preview how visitors, followers, and connections experience your identity & privacy.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-white/5 p-1 rounded-xl w-full sm:w-auto justify-center">
              {[
                { id: 'owner', label: 'Owner' },
                { id: 'public', label: 'Public' },
                { id: 'follower', label: 'Follower' },
                { id: 'connection', label: 'Connection' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => handleViewAsChange(item.id)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                    viewAs === item.id
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

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
            onShare={handleShare}
            onEditProfile={() => navigate('/profile/edit')}
            onInsightsPress={() => navigate('/profile/analytics')}
          />

          {/* 2. Key Metric Grid */}
          <ProfileMetricsGrid
            isOwner={capabilities.isOwner}
            theme={theme}
            profile={effectiveProfile}
            analytics={analytics}
            capabilities={capabilities}
            onMetricPress={(key) => {
              if (key === 'followers') navigate(`/profile/${currentUserId}/followers`);
              else if (key === 'following') navigate(`/profile/${currentUserId}/following`);
              else if (key === 'friends') navigate(`/profile/${currentUserId}/friends`);
              else if (key === 'coins') navigate('/coins');
              else if (key === 'views') navigate('/profile/analytics');
            }}
          />

          {/* 4. Story Highlights / Vibes Carousel */}
          {viewAs !== 'owner' && !capabilities.canViewContent ? (
            <div className={cn(
              "p-8 sm:p-12 rounded-3xl border text-center space-y-3 shadow-sm",
              isDark ? "bg-[#0d1424] border-white/10" : "bg-white border-slate-200"
            )}>
              <div className="w-14 h-14 mx-auto rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">This Account is Private to {viewAs === 'public' ? 'Public Visitors' : viewAs}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Because your profile visibility is set to Private, visitors in {viewAs} perspective cannot view your highlights, pinned posts, or media gallery.
              </p>
            </div>
          ) : (
            <>
              <ProfileHighlightsSection
                highlights={highlights}
                userId={currentUserId}
                isOwner={viewAs === 'owner'}
                theme={theme}
                onAddHighlight={() => navigate('/create-story')}
              />

              {/* 5. Creator Dashboard Analytics (with Level Gating) */}
              {viewAs === 'owner' && (
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
              )}

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
                  isOwner={viewAs === 'owner'}
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
            </>
          )}

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
