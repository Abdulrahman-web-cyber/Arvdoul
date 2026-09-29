/**
 * src/screens/Profile/ProfileMyScreen.jsx - ARVDOUL My Profile Screen
 *
 * Owner-facing digital-nation identity surface.
 *
 * Data truth flows exclusively through the canonical `useProfile` hook
 * (profileStore -> userService / profileCapabilityEngine / domain services).
 * No domain value is computed or defaulted in this screen: unavailable metrics
 * render as honest placeholders rather than invented numbers.
 *
 * @component
 */

import React, { useCallback, useEffect, useState, useMemo, Suspense, lazy, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Lock } from 'lucide-react';
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
import { useProfile } from '../../hooks/useProfile';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { toast } from 'sonner';

// Modular Profile Components
import ProfileHeroSection from '../../components/profile/ProfileHeroSection';
import ProfileMetricsGrid from '../../components/profile/ProfileMetricsGrid';
import ProfileNationStanding from '../../components/profile/ProfileNationStanding';
import ProfileProgression from '../../components/profile/ProfileProgression';
import ProfileHighlightsSection from '../../components/profile/ProfileHighlightsSection';
import ProfileCreatorDashboard from '../../components/profile/ProfileCreatorDashboard';
import ProfileTabsBar from '../../components/profile/ProfileTabsBar';
import ProfilePinnedPosts from '../../components/profile/ProfilePinnedPosts';
import ProfileFeedGrid from '../../components/profile/ProfileFeedGrid';
import ProfileDeepNavigation from '../../components/profile/ProfileDeepNavigation';
import ProfileAchievements from '../../components/profile/ProfileAchievements';
import ProfilePassportCard from '../../components/profile/ProfilePassportCard';
import ProfileEconomyCard from '../../components/profile/ProfileEconomyCard';
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

  // Authenticated user - canonical identity chain (appStore mirror, AuthContext fallback).
  const { user: authContextUser } = useAuth();
  const authStoreUser = useAppStore((state) => state.currentUser);
  const currentUser = authStoreUser || authContextUser;
  const currentUserId = currentUser?.uid || authContextUser?.uid;

  // Canonical profile data pipeline (identity, relationship, capabilities, content,
  // and all digital-nation summaries). viewAs drives the owner preview simulation.
  const {
    profile,
    capabilities,
    loading,
    posts,
    postsLoading,
    postsError,
    postsHasMore,
    loadMorePosts,
    highlights,
    stories,
    highlightsLoading,
    highlightsError,
    loadHighlights,
    videos,
    videosLoading,
    videosError,
    loadVideos,
    level,
    balance,
    position,
    reputation,
    rank,
    achievements,
    titles,
    badges,
    creatorProfile,
    passport,
    wallet,
    refresh,
  } = useProfile(currentUserId, { viewAs: viewAs === 'owner' ? null : viewAs });

  // Owner-only saved content stays on the store surface (loaded on demand).
  const savedPosts = useProfileStore((state) => state.savedPosts);
  const savedLoading = useProfileStore((state) => state.savedLoading);

  const activeTitle = useMemo(
    () => titles?.find?.((t) => t?.isActive || t?.status === 'active') || null,
    [titles]
  );

  // Analytics store - reactive state selectors.
  const analytics = useAnalyticsStore((state) => state.analytics);
  const analyticsLoading = useAnalyticsStore((state) => state.loading);
  const analyticsError = useAnalyticsStore((state) => state.error);
  const timeframe = useAnalyticsStore((state) => state.timeframe);
  const ranking = useAnalyticsStore((state) => state.ranking);
  const setTimeframe = useAnalyticsStore((state) => state.setTimeframe);

  // Honest display projection: only shapes real fields for rendering. Counts and
  // domain status are never defaulted here - they surface as unavailable instead.
  const effectiveProfile = useMemo(() => {
    if (!profile) return null;
    return {
      ...profile,
      id: profile.id || profile.uid || currentUserId,
      uid: profile.uid || profile.id || currentUserId,
      photoURL: getSafeAvatarUrl(profile.photoURL, profile.displayName || profile.username, currentUserId),
      bio: typeof profile.bio === 'string' ? profile.bio : '',
      location: typeof profile.location === 'string' ? profile.location : '',
      website: typeof profile.website === 'string' ? profile.website : '',
      activeTitle: activeTitle || profile.activeTitle || null,
    };
  }, [profile, currentUserId, activeTitle]);

  // Analytics reload only when the identity or selected timeframe changes.
  useEffect(() => {
    if (!currentUserId) return;
    useAnalyticsStore.getState().loadAnalytics(currentUserId, timeframe);
  }, [currentUserId, timeframe]);

  // Tab change handler.
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === 'saved' && (!savedPosts || savedPosts.length === 0) && currentUserId) {
      useProfileStore.getState().loadSavedPosts(currentUserId);
    }
    if (tab === 'sparks' && videos.length === 0) {
      loadVideos();
    }
  }, [currentUserId, savedPosts, videos.length, loadVideos]);

  // Pull to refresh.
  const handleRefresh = useCallback(async () => {
    if (!currentUserId) return;
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        refresh(),
        useAnalyticsStore.getState().loadAnalytics(currentUserId, timeframe),
      ]);
      toast.success('Profile refreshed');
    } finally {
      setIsRefreshing(false);
    }
  }, [currentUserId, timeframe, refresh]);

  // Handle Share.
  const handleShare = useCallback(async () => {
    try {
      const target = effectiveProfile || { id: currentUserId, uid: currentUserId };
      const result = await shareProfile(target);
      if (result.copied) {
        toast.success('Profile link copied to clipboard!');
      }
    } catch {
      toast.error('Could not share profile');
    }
  }, [effectiveProfile, currentUserId]);

  const isDark = theme === 'dark';
  const { isOnline } = useOfflineSync();

  if (loading && !profile && !currentUser) {
    return (
      <div className={cn('min-h-screen pb-20', isDark ? 'bg-arvdoul-bg' : 'bg-arvdoul-bg-light')}>
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
            ? "bg-arvdoul-bg text-white selection:bg-arvdoul-purple/30"
            : "bg-arvdoul-bg-light text-slate-900 selection:bg-arvdoul-purple/20"
        )}
      >
        {loading && !profile && (
          <TopAppLoadingBanner isAnimating={true} label="Syncing profile..." />
        )}
        {isRefreshing && (
          <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-1.5 rounded-full bg-arvdoul-purple text-white text-xs font-bold shadow-lg animate-pulse">
            Refreshing Profile...
          </div>
        )}

        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-5 space-y-4 sm:space-y-5">

          {/* View As Mode Control */}
          <div className={cn(
            "rounded-2xl p-3 border flex flex-col sm:flex-row items-center justify-between gap-3 transition-all shadow-sm",
            isDark ? "bg-arvdoul-surface border-arvdoul-border" : "bg-white border-slate-200"
          )}>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-arvdoul-purple/10 text-arvdoul-purple">
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
                  Preview how visitors, followers, and connections experience your identity &amp; privacy.
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
                  onClick={() => setViewAs(item.id)}
                  aria-pressed={viewAs === item.id}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all",
                    viewAs === item.id
                      ? "bg-arvdoul-gradient text-white shadow-sm"
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
            profile={effectiveProfile || { id: currentUserId, uid: currentUserId }}
            isOwner={true}
            level={level ?? effectiveProfile?.level ?? null}
            position={position}
            theme={theme}
            reputation={reputation}
            creatorProfile={creatorProfile}
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

          {/* 1b. Digital-Nation standing rail (reputation, rank, badges, title) */}
          <ProfileNationStanding
            level={level ?? effectiveProfile?.level ?? null}
            reputation={reputation}
            rank={rank}
            badges={badges}
            activeTitle={activeTitle}
            theme={theme}
          />

          {/* 2. Key Metric Grid */}
          <ProfileMetricsGrid
            isOwner={capabilities?.isOwner === true}
            theme={theme}
            profile={effectiveProfile}
            reputation={reputation}
            balance={balance}
            capabilities={capabilities}
            onMetricPress={(key) => {
              if (key === 'followers') navigate(`/profile/${currentUserId}/followers`);
              else if (key === 'following') navigate(`/profile/${currentUserId}/following`);
              else if (key === 'friends') navigate(`/profile/${currentUserId}/friends`);
              else if (key === 'coins') navigate('/coins');
            }}
          />

          {/* 3. Progression, streak ledger & digital-citizenship standing */}
          <ProfileProgression
            profile={effectiveProfile}
            isOwner={capabilities?.isOwner === true}
            canViewProgression={capabilities?.canViewProgression === true}
            theme={theme}
          />

          {/* 3b. Institutional Passport artifact (owner's authorized projection) */}
          <ProfilePassportCard
            passport={passport}
            isOwner={capabilities?.isOwner === true}
            canView={capabilities?.canViewIdentity === true}
            theme={theme}
          />

          {/* 3c. Owner-only economy summary (ledger-backed, fail-closed) */}
          <ProfileEconomyCard
            wallet={wallet}
            balance={balance}
            position={position}
            isOwner={capabilities?.isOwner === true}
            canView={capabilities?.canViewEconomicStatus === true}
            theme={theme}
          />

          {/* 3d. Achievements summary (canonical achievementService) */}
          {achievements.length > 0 && (
            <ProfileAchievements achievements={achievements} theme={theme} />
          )}

          {/* 4. Story Highlights / Vibes Carousel */}
          {viewAs !== 'owner' && !capabilities?.canViewContent ? (
            <div className={cn(
              "p-8 sm:p-12 rounded-3xl border text-center space-y-3 shadow-sm",
              isDark ? "bg-arvdoul-surface border-arvdoul-border" : "bg-white border-slate-200"
            )}>
              <div className="w-14 h-14 mx-auto rounded-full bg-arvdoul-purple/10 text-arvdoul-purple flex items-center justify-center">
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
                stories={stories}
                userId={currentUserId}
                isOwner={viewAs === 'owner'}
                theme={theme}
                loading={highlightsLoading}
                error={highlightsError}
                onRetry={() => loadHighlights(currentUserId)}
                onAddHighlight={() => navigate('/create-story')}
              />

              {/* 5. Creator Dashboard Analytics (owner-only, creator-eligible) */}
              {viewAs === 'owner' && Boolean(creatorProfile) && (
                <ProfileCreatorDashboard
                  analytics={analytics}
                  analyticsLoading={analyticsLoading}
                  analyticsError={analyticsError}
                  ranking={ranking}
                  userLevel={level ?? null}
                  userXp={profile?.experience ?? profile?.xp ?? null}
                  isCreator={true}
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
                loading={postsLoading || savedLoading || (activeTab === 'sparks' && videosLoading)}
                error={activeTab === 'sparks' ? videosError : postsError}
                isOnline={isOnline}
                onRetry={() => (activeTab === 'sparks' ? loadVideos() : refresh())}
                hasMore={activeTab === 'posts' && postsHasMore}
                onLoadMore={loadMorePosts}
                videos={videos}
                theme={theme}
                profile={effectiveProfile}
                onPostClick={(post) => navigate(`/post/${post.id}`)}
                onVideoClick={(video) => navigate(`/video/${video.id}`)}
              />

              {/* 9. Deep-navigation layer into the canonical identity systems */}
              <ProfileDeepNavigation
                profile={effectiveProfile}
                isOwner={capabilities?.isOwner === true}
                capabilities={capabilities}
                theme={theme}
              />
            </>
          )}

        </div>

        <ProfileQRCodeModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          profile={effectiveProfile}
          theme={theme}
        />

        {showScannerModal && (
          <ProfileQRScannerModal
            isOpen={showScannerModal}
            onClose={() => setShowScannerModal(false)}
            theme={theme}
          />
        )}

        {showLocationModal && (
          <ProfileLocationModal
            isOpen={showLocationModal}
            onClose={() => setShowLocationModal(false)}
            currentLocation={effectiveProfile?.location}
            userId={currentUserId}
            theme={theme}
            onLocationUpdated={() => {
              refresh();
            }}
          />
        )}

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

        {showAvatarModal && (
          <Suspense fallback={null}>
            <AvatarUploadModal
              isOpen={showAvatarModal}
              onClose={() => setShowAvatarModal(false)}
              onUpload={() => {
                setShowAvatarModal(false);
                toast.success('Avatar updated successfully!');
                refresh();
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
