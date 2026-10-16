/**
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
import { shareProfile } from '../../utils/shareUtils';
import { getStoredUid } from '../../utils/security';
import {
  pickHandle,
  deriveHandle,
  pickDisplayName,
  resolveAvatarUrl,
  resolveCount,
  resolveLevelValue,
  resolveCreatorFlag,
  resolveVerifiedFlag,
  isPlaceholderHandle,
} from '../../services/profileReadModel.js';
import { resolveCapabilities } from '../../services/profileCapabilityEngine';
import { toast } from 'sonner';

// Modular Profile Components
import ProfileHeroSection from '../../components/profile/ProfileHeroSection';
import ProfileProgression from '../../components/profile/ProfileProgression';
import ProfileMetricsGrid from '../../components/profile/ProfileMetricsGrid';
import ProfileHighlightsSection from '../../components/profile/ProfileHighlightsSection';
import ProfileCreatorDashboard from '../../components/profile/ProfileCreatorDashboard';
import ProfileTabsBar from '../../components/profile/ProfileTabsBar';
import ProfilePinnedPosts from '../../components/profile/ProfilePinnedPosts';
import ProfileFeedGrid from '../../components/profile/ProfileFeedGrid';
import ProfileQRCodeModal from '../../components/profile/ProfileQRCodeModal';
import ProfileQRScannerModal from '../../components/profile/ProfileQRScannerModal';
import ProfileLocationModal from '../../components/profile/ProfileLocationModal';
import ProfilePerspectiveModal from '../../components/profile/ProfilePerspectiveModal';
import ProfileSkeleton from '../../components/profile/ProfileSkeleton';

// Modals & Extras
import ProfileOptionsMenu from '../../components/profile/ProfileOptionsMenu';
const AvatarUploadModal = lazy(() => import('../../components/profile/AvatarUploadModal'));

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
  const [showPerspectiveModal, setShowPerspectiveModal] = useState(false);
  const [activeTab, setActiveTab] = useState('posts');
  const [viewAs, setViewAs] = useState('owner'); // 'owner' | 'public' | 'follower' | 'connection'

  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('arvdoul_profile_view_mode') || 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('arvdoul_profile_view_mode', mode);
    } catch {}
  }, []);

  // Authenticated user identity
  const { user: authContextUser } = useAuth();
  const authStoreUser = useAppStore((state) => state.currentUser);
  const currentUser = authContextUser || authStoreUser;
  const currentUserId = authContextUser?.uid || authStoreUser?.uid || getStoredUid();

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

  // Auto-generate and ensure a unique username via userService if user document has none
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    const ensureUniqueUser = async () => {
      try {
        const storedHandle = profile?.username;
        if (storedHandle && !isPlaceholderHandle(storedHandle)) return;
        const userServiceModule = await import('../../services/userService.js');
        const userService = userServiceModule.getUserService();
        const base = currentUser?.displayName || profile?.displayName || 'citizen';
        const cleanBase = base.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'citizen';
        const generated = await userService.generateUniqueUsername(cleanBase, currentUserId);
        if (!cancelled && generated) {
          await userService.updateUserProfile(currentUserId, { username: generated });
          useProfileStore.getState().loadProfile(currentUserId, currentUserId);
        }
      } catch (err) {
        console.warn('Auto username generation note:', err);
      }
    };
    ensureUniqueUser();
    return () => { cancelled = true; };
  }, [currentUserId, profile?.username, currentUser?.displayName, profile?.displayName]);

  // Clean unique username by userService (never displaying signing method name)
  const cleanUsername = useMemo(() => {
    const candidate = pickHandle([profile?.username, currentUser?.username]);
    if (candidate) return candidate;
    const fromDisplay = deriveHandle(currentUser?.displayName || profile?.displayName);
    if (fromDisplay && !isPlaceholderHandle(fromDisplay)) return fromDisplay;
    const fromEmail = deriveHandle(currentUser?.email || profile?.email);
    if (fromEmail && !isPlaceholderHandle(fromEmail)) return fromEmail;
    return 'citizen';
  }, [profile?.username, currentUser?.username, currentUser?.email, profile?.email, currentUser?.displayName, profile?.displayName]);

  // Server-authoritative composite profile
  const effectiveProfile = useMemo(() => {
    const safeDisplayName = pickDisplayName(
      [currentUser?.displayName, currentUser?.name, profile?.displayName, profile?.name],
      { fallback: deriveHandle(currentUser?.email) || 'Citizen' }
    );
    const safeBio = (typeof profile?.bio === 'string' ? profile.bio : (typeof currentUser?.bio === 'string' ? currentUser.bio : '')).trim();
    const safeLocation = typeof profile?.location === 'string' ? profile.location : (typeof currentUser?.location === 'string' ? currentUser.location : '');
    const safeWebsite = typeof profile?.website === 'string' ? profile.website : (typeof currentUser?.website === 'string' ? currentUser.website : '');
    const safeLevel = resolveLevelValue(level, profile?.level, currentUser?.level);

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
        photoURL: resolveAvatarUrl(profile.photoURL || currentUser?.photoURL, safeDisplayName, currentUserId),
        followerCount: resolveCount(profile.followerCount, profile.followersCount, currentUser?.followerCount),
        followingCount: resolveCount(profile.followingCount, currentUser?.followingCount),
        postCount: resolveCount(profile.postCount, posts?.length),
        coins: resolveCount(profile.coins, profile.coinBalance, balance, currentUser?.coins),
        isVerified: resolveVerifiedFlag(profile) || Boolean(currentUser?.isVerified),
        isCreator: resolveCreatorFlag(profile, currentUser, safeLevel),
      };
    }

    return {
      id: currentUserId || 'creator',
      uid: currentUserId || 'creator',
      username: cleanUsername,
      displayName: safeDisplayName,
      bio: safeBio,
      photoURL: resolveAvatarUrl(currentUser?.photoURL, safeDisplayName, currentUserId),
      followerCount: resolveCount(currentUser?.followerCount, currentUser?.followersCount),
      followingCount: resolveCount(currentUser?.followingCount),
      postCount: resolveCount(posts?.length),
      coins: resolveCount(currentUser?.coins, balance),
      isVerified: resolveVerifiedFlag(currentUser),
      isCreator: resolveCreatorFlag({}, currentUser, safeLevel),
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

  // Load user data on mount
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

  // Cross-component event listeners for TopAppBar & Header actions
  useEffect(() => {
    const handleQrEvent = () => setShowQrModal(true);
    const handlePerspectiveEvent = () => setShowPerspectiveModal(true);
    const handleShareEvent = () => handleShare();
    const handleOptionsEvent = () => setShowOptionsMenu(true);

    window.addEventListener('arvdoul:open_qr_code', handleQrEvent);
    window.addEventListener('arvdoul:open_perspective_modal', handlePerspectiveEvent);
    window.addEventListener('arvdoul:share_profile', handleShareEvent);
    window.addEventListener('arvdoul:open_profile_options', handleOptionsEvent);

    return () => {
      window.removeEventListener('arvdoul:open_qr_code', handleQrEvent);
      window.removeEventListener('arvdoul:open_perspective_modal', handlePerspectiveEvent);
      window.removeEventListener('arvdoul:share_profile', handleShareEvent);
      window.removeEventListener('arvdoul:open_profile_options', handleOptionsEvent);
    };
  }, [handleShare]);

  const isDark = theme === 'dark';

  if (loading && !profile && !currentUser) {
    return (
      <div className={cn(
        'min-h-screen pb-20',
        isDark ? 'bg-[#060816]' : 'bg-[#f0f4fa]'
      )}>
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

        {/* Top Refreshing Pill */}
        {isRefreshing && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-600 text-white text-xs font-bold shadow-lg animate-pulse">
            Refreshing Profile...
          </div>
        )}

        {/* Outer responsive frame - Top Card is the Profile Pic Card */}
        <div className="max-w-7xl mx-auto px-2 sm:px-4 md:px-6 py-2 sm:py-4 space-y-4">
          
          {/* Dual-column architecture: Sticky command rail on left, media/content feed on right */}
          <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">
            
            {/* Left Column: Command Rail (lg:col-span-4, sticky) */}
            <div className="lg:col-span-4 lg:sticky lg:top-4 space-y-4 relative z-10">
              
              {/* TOP CARD: Elevated Master Identity Card with Profile Picture */}
              <ProfileHeroSection
                variant="identity"
                profile={effectiveProfile}
                isOwner={viewAs === 'owner'}
                level={level || effectiveProfile.level}
                position={position}
                theme={theme}
                onOpenQrCode={() => setShowQrModal(true)}
                onOpenQrScanner={() => setShowScannerModal(true)}
                onOpenLocationSetup={() => setShowLocationModal(true)}
                onOpenPerspective={() => setShowPerspectiveModal(true)}
                onOpenOptions={() => setShowOptionsMenu(true)}
                onAvatarClick={() => setShowAvatarModal(true)}
                onShare={handleShare}
                onEditProfile={() => navigate('/profile/edit')}
                onInsightsPress={() => navigate('/profile/analytics')}
                capabilities={capabilities}
                analytics={analytics}
                onMetricPress={(key) => {
                  if (key === 'followers') navigate(`/profile/${currentUserId}/followers`);
                  else if (key === 'following') navigate(`/profile/${currentUserId}/following`);
                  else if (key === 'friends') navigate(`/profile/${currentUserId}/friends`);
                  else if (key === 'coins') navigate('/coins');
                  else if (key === 'posts') setActiveTab('posts');
                  else if (key === 'reputation') navigate('/passport');
                }}
              />

              {/* 2. Creator Analytics Dashboard (if owner) */}
              {viewAs === 'owner' && (
                <ProfileCreatorDashboard
                  analytics={analytics}
                  ranking={ranking}
                  userLevel={level ?? effectiveProfile?.level ?? null}
                  userXp={effectiveProfile?.experience || 0}
                  isCreator={effectiveProfile?.isCreator}
                  theme={theme}
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                />
              )}
            </div>

            {/* Right Column: Active Feed & Content Hub (lg:col-span-8) */}
            <div className="lg:col-span-8 space-y-5 min-w-0 pt-4 lg:pt-0">
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
                  {/* Story Highlights */}
                  <ProfileHighlightsSection
                    highlights={highlights}
                    userId={currentUserId}
                    isOwner={viewAs === 'owner'}
                    theme={theme}
                    onAddHighlight={() => navigate('/profile/highlights?create=true')}
                  />

                  {/* Pinned Posts Section */}
                  <ProfilePinnedPosts
                    posts={posts}
                    theme={theme}
                    onPostClick={(post) => navigate(`/post/${post.id}`)}
                  />

                  {/* Multi-Tab Navigation Bar with Multi-View Switcher */}
                  <div className="sticky top-2 z-30 pt-1">
                    <ProfileTabsBar
                      activeTab={activeTab}
                      onTabChange={handleTabChange}
                      viewMode={viewMode}
                      onViewModeChange={handleViewModeChange}
                      isOwner={viewAs === 'owner'}
                      theme={theme}
                      counts={{
                        posts: (posts || []).filter(p => p.type !== 'audio' && p.type !== 'track').length,
                        reels: (posts || []).filter(p => p.type === 'reel' || p.type === 'spark' || p.isReel || p.isSpark).length,
                        audio: (posts || []).filter(p => p.type === 'audio' || p.type === 'track' || p.type === 'music' || Boolean(p.audioURL || p.audioUrl)).length,
                        saved: savedPosts?.length || 0,
                        tagged: (posts || []).filter(p => Array.isArray(p.taggedUsers) && p.taggedUsers.length > 0).length,
                      }}
                    />
                  </div>

                  {/* Multi-View Media & Posts Grid */}
                  <ProfileFeedGrid
                    posts={posts}
                    savedPosts={savedPosts}
                    activeTab={activeTab}
                    viewMode={viewMode}
                    loading={postsLoading || savedLoading}
                    theme={theme}
                    profile={effectiveProfile}
                    isOwner={viewAs === 'owner'}
                    onPostClick={(post) => navigate(`/post/${post.id}`)}
                  />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Floating Perspective Preview Bar when simulating visitor view */}
        {viewAs !== 'owner' && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/90 dark:bg-white/10 text-white backdrop-blur-xl border border-purple-500/30 shadow-2xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-4">
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>Simulating <strong>{viewAs.toUpperCase()}</strong> view</span>
            <button
              onClick={() => handleViewAsChange('owner')}
              className="ml-1.5 px-2.5 py-0.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] transition cursor-pointer shadow-sm"
            >
              Exit Preview
            </button>
          </div>
        )}

        {/* Perspective Switcher Modal */}
        <ProfilePerspectiveModal
          isOpen={showPerspectiveModal}
          onClose={() => setShowPerspectiveModal(false)}
          currentPerspective={viewAs}
          onSelectPerspective={handleViewAsChange}
          theme={theme}
        />

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
          <ProfileOptionsMenu
            profile={effectiveProfile}
            isOwner={true}
            theme={theme}
            onClose={() => setShowOptionsMenu(false)}
          />
        )}

        {/* Avatar Upload Modal */}
        {showAvatarModal && (
          <Suspense fallback={null}>
            <AvatarUploadModal
              isOpen={showAvatarModal}
              onClose={() => setShowAvatarModal(false)}
              onUpload={async (croppedFile) => {
                const toastId = toast.loading('Uploading avatar...');
                try {
                  const { getUserService } = await import('../../services/userService.js');
                  await getUserService().uploadAvatar(currentUserId, croppedFile);
                  toast.success('Avatar updated successfully!', { id: toastId });
                  setShowAvatarModal(false);
                  useProfileStore.getState().loadProfile(currentUserId, currentUserId);
                } catch (err) {
                  console.error('Avatar upload failed:', err);
                  toast.error(err?.message || 'Failed to upload avatar', { id: toastId });
                }
              }}
              onRemoveAvatar={async () => {
                const toastId = toast.loading('Removing avatar...');
                try {
                  const { getUserService } = await import('../../services/userService.js');
                  await getUserService().updateUserProfile(currentUserId, { photoURL: '' });
                  toast.success('Avatar removed', { id: toastId });
                  setShowAvatarModal(false);
                  useProfileStore.getState().loadProfile(currentUserId, currentUserId);
                } catch (err) {
                  console.error('Avatar removal failed:', err);
                  toast.error(err?.message || 'Failed to remove avatar', { id: toastId });
                }
              }}
              currentAvatarUrl={effectiveProfile?.photoURL}
              theme={theme}
            />
          </Suspense>
        )}
      </div>
    </ErrorBoundary>
  );
}
