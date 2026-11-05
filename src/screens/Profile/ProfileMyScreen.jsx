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
import ProfileViewAsBanner from '../../components/profile/ProfileViewAsBanner';
import { TopAppLoadingBanner } from '../../components/Navigation/RouteProgressBar';
import { shareProfile } from '../../utils/shareUtils';
import { getStoredUid } from '../../utils/security';
import {
  deriveHandle,
  isPlaceholderHandle,
  deriveProfileIdentity,
  projectProfileForViewer,
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
import ProfileVerificationModal from '../../components/profile/ProfileVerificationModal';
import ProfileQuickEditModal from '../../components/profile/ProfileQuickEditModal';

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
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showQuickEditModal, setShowQuickEditModal] = useState(false);
  const [quickEditField, setQuickEditField] = useState('all');
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
  const postsCursor = useProfileStore((state) => state.postsCursor);
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

  // Server-authoritative composite profile. The identity/count derivation is
  // the shared `deriveProfileIdentity` (profileReadModel) so the owner screen
  // cannot drift from the public/preview screens; the owner-only extras
  // (viewer fallbacks for bio/location/website, coins) are applied here.
  const effectiveProfile = useMemo(() => {
    const base = profile && typeof profile === 'object' ? profile : {};
    const identity = deriveProfileIdentity(base, {
      viewer: currentUser || {},
      handleCandidates: [base.username, currentUser?.username],
      handleFallbacks: [currentUser?.displayName, base.displayName, currentUser?.email, base.email],
      handleFallback: 'citizen',
      displayCandidates: [currentUser?.displayName, currentUser?.name, base.displayName, base.name],
      displayFallback: deriveHandle(currentUser?.email) || 'Citizen',
      followerCandidates: [base.followerCount, base.followersCount, currentUser?.followerCount],
      followingCandidates: [base.followingCount, currentUser?.followingCount],
      postCandidates: [base.postCount, posts?.length],
      levelCandidates: [level, base.level, currentUser?.level],
      coinCandidates: [base.coins, base.coinBalance, balance, currentUser?.coins],
      userId: currentUserId,
    });
    const safeBio = (typeof base.bio === 'string' ? base.bio : (typeof currentUser?.bio === 'string' ? currentUser.bio : '')).trim();
    const safeLocation = typeof base.location === 'string' ? base.location : (typeof currentUser?.location === 'string' ? currentUser.location : '');
    const safeWebsite = typeof base.website === 'string' ? base.website : (typeof currentUser?.website === 'string' ? currentUser.website : '');
    return {
      ...base,
      ...identity,
      bio: safeBio,
      location: safeLocation,
      website: safeWebsite,
    };
  }, [profile, currentUser, currentUserId, posts?.length, balance, level]);

  // Centrally resolved Action Capabilities adhering strictly to active viewAs perspective
  const capabilities = useMemo(() => {
    const isSimulatedOwner = viewAs === 'owner';
    return resolveCapabilities({
      viewer: isSimulatedOwner ? currentUser : { uid: `preview_${viewAs}_visitor` },
      target: effectiveProfile,
      relationship: {
        isOwner: isSimulatedOwner,
        isFollowing: viewAs === 'follower' || viewAs === 'connection',
        isFollower: viewAs === 'follower' || viewAs === 'connection',
        isMutualFriend: viewAs === 'connection',
        isBlocked: false,
      },
      viewAs: isSimulatedOwner ? null : viewAs
    });
  }, [currentUser, effectiveProfile, viewAs]);

  // Projected profile adhering strictly to active viewer perspective and privacy boundaries
  const displayedProfile = useMemo(() => {
    if (viewAs === 'owner') return effectiveProfile;
    return projectProfileForViewer(effectiveProfile, capabilities);
  }, [effectiveProfile, capabilities, viewAs]);

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

  // Paginate the profile feed. Without this the grid stopped at the first page.
  const handleLoadMorePosts = useCallback(() => {
    if (!currentUserId) return;
    useProfileStore.getState().loadMorePosts(currentUserId);
  }, [currentUserId]);

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
      const target = effectiveProfile || { id: currentUserId, uid: currentUserId };
      const result = await shareProfile(target);
      if (result.copied) {
        toast.success('Profile link copied to clipboard!');
      }
    } catch (err) {
      toast.error('Could not share profile');
    }
  }, [effectiveProfile, currentUserId]);

  // Cross-component event listeners for TopAppBar & Header actions
  useEffect(() => {
    const handleQrEvent = () => setShowQrModal(true);
    const handlePerspectiveEvent = () => setShowPerspectiveModal(true);
    const handleShareEvent = () => handleShare();
    const handleOptionsEvent = () => setShowOptionsMenu(true);
    const handleLocationEvent = () => setShowLocationModal(true);

    window.addEventListener('arvdoul:open_qr_code', handleQrEvent);
    window.addEventListener('arvdoul:open_perspective_modal', handlePerspectiveEvent);
    window.addEventListener('arvdoul:share_profile', handleShareEvent);
    window.addEventListener('arvdoul:open_profile_options', handleOptionsEvent);
    window.addEventListener('arvdoul:open_location_setup', handleLocationEvent);

    return () => {
      window.removeEventListener('arvdoul:open_qr_code', handleQrEvent);
      window.removeEventListener('arvdoul:open_perspective_modal', handlePerspectiveEvent);
      window.removeEventListener('arvdoul:share_profile', handleShareEvent);
      window.removeEventListener('arvdoul:open_profile_options', handleOptionsEvent);
      window.removeEventListener('arvdoul:open_location_setup', handleLocationEvent);
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

        {/* Master Container matching Image 1 Hierarchy */}
        <div className="w-full max-w-[1240px] mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-6 space-y-4 sm:space-y-5">
          {/* 1. Master Identity Card with Level Badge, Passport & 6 Action Buttons */}
          <ProfileHeroSection
            variant="identity"
            profile={displayedProfile}
            isOwner={viewAs === 'owner'}
            viewAs={viewAs}
            level={displayedProfile?.level}
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
            onOpenQuickEdit={(field = 'all') => {
              setQuickEditField(field);
              setShowQuickEditModal(true);
            }}
            onOpenVerificationModal={() => setShowVerificationModal(true)}
            onInsightsPress={() => navigate('/profile/analytics')}
            capabilities={capabilities}
            analytics={analytics}
          />

          {/* 2. 6-Card Metrics Grid */}
          <ProfileMetricsGrid
            isOwner={viewAs === 'owner'}
            theme={theme}
            profile={displayedProfile}
            analytics={analytics}
            capabilities={capabilities}
            onMetricPress={(key) => {
              if (key === 'followers') navigate(`/profile/${currentUserId}/followers`);
              else if (key === 'following') navigate(`/profile/${currentUserId}/following`);
              else if (key === 'friends') navigate(`/profile/${currentUserId}/friends`);
              else if (key === 'coins') navigate('/coins');
              else if (key === 'posts') setActiveTab('posts');
              else if (key === 'views') navigate('/profile/analytics');
            }}
          />

          {viewAs !== 'owner' && !capabilities.canViewContent ? (
            <div className={cn(
              "p-8 sm:p-12 rounded-3xl border text-center space-y-3 shadow-sm",
              isDark ? "bg-[#0d1424] border-white/10" : "bg-white border-slate-200"
            )}>
              <div className="w-14 h-14 mx-auto rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">This Account is Private</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Visitors in {viewAs === 'public' ? 'Public' : viewAs} perspective cannot view private highlights, pinned posts, or media gallery.
              </p>
            </div>
          ) : (
            <>
              {/* 3. Citizen Progression & Civic Standing (level / XP / streak /
                  reputation — each gated by the owner's show* privacy toggles) */}
              <ProfileProgression
                level={displayedProfile?.level}
                experience={displayedProfile?.experience}
                streak={displayedProfile?.activeStreak}
                reputation={displayedProfile?.reputation}
                showLevel={displayedProfile?.showLevel !== false}
                showReputation={displayedProfile?.showReputation !== false}
                showStreak={displayedProfile?.showStreak !== false}
                isOwner={viewAs === 'owner'}
                theme={theme}
              />

              {/* 4. Story Highlights Carousel */}
              <ProfileHighlightsSection
                highlights={highlights}
                userId={currentUserId}
                isOwner={viewAs === 'owner'}
                theme={theme}
                onAddHighlight={() => navigate('/profile/highlights?create=true')}
              />

              {/* 4. Creator Analytics Dashboard (when owner) */}
              {viewAs === 'owner' && (
                <ProfileCreatorDashboard
                  analytics={analytics}
                  ranking={ranking}
                  userLevel={effectiveProfile?.level ?? null}
                  userXp={effectiveProfile?.experience}
                  isCreator={effectiveProfile?.isCreator}
                  theme={theme}
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                />
              )}

              {/* 5. Pill Tabs Bar with View Mode Switcher */}
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

              {/* 6. Pinned Posts 4-Card Section (shown on 'posts' tab) */}
              {activeTab === 'posts' && (
                <ProfilePinnedPosts
                  posts={posts}
                  isOwner={viewAs === 'owner'}
                  theme={theme}
                  onPostClick={(post) => navigate(`/post/${post.id}`)}
                />
              )}

              {/* 7. Multi-View Media & Posts Grid */}
              <ProfileFeedGrid
                posts={posts}
                savedPosts={savedPosts}
                activeTab={activeTab}
                viewMode={viewMode}
                loading={postsLoading || savedLoading}
                theme={theme}
                profile={displayedProfile}
                isOwner={viewAs === 'owner'}
                onPostClick={(post) => navigate(`/post/${post.id}`)}
                hasMore={Boolean(postsCursor && postsHasMore)}
                loadingMore={postsLoading}
                onLoadMore={handleLoadMorePosts}
              />
            </>
          )}
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
            currentPrivacy={effectiveProfile?.locationPrivacy}
            userId={currentUserId}
            theme={theme}
            onLocationUpdated={(newLoc) => {
              useProfileStore.getState().loadProfile(currentUserId, currentUserId);
            }}
          />
        )}

        {/* Verification Status & Application Modal */}
        <ProfileVerificationModal
          isOpen={showVerificationModal}
          onClose={() => setShowVerificationModal(false)}
          isVerified={effectiveProfile.isVerified}
          profile={effectiveProfile}
          isOwner={true}
          theme={theme}
          onVerificationSubmitted={() => {
            useProfileStore.getState().loadProfile(currentUserId, currentUserId);
          }}
        />

        {/* Quick Profile Edit Modal */}
        <ProfileQuickEditModal
          isOpen={showQuickEditModal}
          onClose={() => setShowQuickEditModal(false)}
          initialField={quickEditField}
          profile={effectiveProfile}
          userId={currentUserId}
          theme={theme}
          onProfileUpdated={() => {
            useProfileStore.getState().loadProfile(currentUserId, currentUserId);
          }}
        />

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

        {/* Persistent Floating Banner for Simulated View As Perspective */}
        <ProfileViewAsBanner
          viewAs={viewAs}
          onViewAsChange={handleViewAsChange}
          onExit={() => handleViewAsChange('owner')}
          theme={theme}
        />
      </div>
    </ErrorBoundary>
  );
}
