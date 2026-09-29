/**
 * src/screens/Profile/ProfilePublicScreen.jsx - ARVDOUL Public Profile Screen
 *
 * Visitor-facing digital-nation identity surface.
 *
 * Data truth comes exclusively from the canonical `useProfile` hook (which drives
 * `profileStore` -> userService / profileCapabilityEngine / domain services).
 * No direct userService / firestoreService / analyticsService fetching happens in
 * this screen for identity, content, or analytics. Only the friend-request domain
 * (a distinct canonical service) is called directly for its mutations.
 *
 * @component
 */

import React, { useState, useCallback, useMemo, Suspense, lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Lock, UserPlus, UserX, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { cn } from '../../lib/utils';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { shareProfile } from '../../utils/shareUtils';
import { useProfile } from '../../hooks/useProfile';
import { useOfflineSync } from '../../hooks/useOfflineSync';
import { TopAppLoadingBanner } from '../../components/Navigation/RouteProgressBar';
import { ErrorBoundary } from '../../components/ErrorBoundary';

// Modular Profile Components
import ProfileHeroSection from '../../components/profile/ProfileHeroSection';
import ProfileMutualFriends from '../../components/profile/ProfileMutualFriends';
import ProfileMetricsGrid from '../../components/profile/ProfileMetricsGrid';
import ProfileNationStanding from '../../components/profile/ProfileNationStanding';
import ProfileHighlightsSection from '../../components/profile/ProfileHighlightsSection';
import ProfileFeaturedSection from '../../components/profile/ProfileFeaturedSection';
import ProfileTabsBar from '../../components/profile/ProfileTabsBar';
import ProfilePinnedPosts from '../../components/profile/ProfilePinnedPosts';
import ProfileFeedGrid from '../../components/profile/ProfileFeedGrid';
import ProfileTipModal from '../../components/profile/ProfileTipModal';
import ProfileQRCodeModal from '../../components/profile/ProfileQRCodeModal';
import ProfileQRScannerModal from '../../components/profile/ProfileQRScannerModal';
import ProfileSkeleton from '../../components/profile/ProfileSkeleton';
import ProfileProgression from '../../components/profile/ProfileProgression';
import ProfileDeepNavigation from '../../components/profile/ProfileDeepNavigation';
import ProfileAchievements from '../../components/profile/ProfileAchievements';
import ProfilePassportCard from '../../components/profile/ProfilePassportCard';

// Modals
const ProfileOptionsMenu = lazy(() => import('../../components/profile/ProfileOptionsMenu'));

export default function ProfilePublicScreen() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.uid;
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { isOnline } = useOfflineSync();

  const {
    profile: profileData,
    relationship,
    capabilities,
    loading,
    error,
    resolvedTargetId,
    followStatus,
    followLoading,
    friendRequestStatus,
    friendRequestLoading,
    mutualFriends,
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
    reputation,
    rank,
    achievements,
    titles,
    badges,
    creatorProfile,
    passport,
    follow,
    unfollow,
    sendFriendRequest,
    acceptFriendRequest,
    unblockUser,
    refresh,
  } = useProfile(userId);

  const [activeTab, setActiveTab] = useState('posts');

  // Active title follows the canonical Titles domain ownership flag; the
  // profile document is only a fallback mirror.
  const activeTitle = useMemo(
    () => titles?.find?.((t) => t?.isActive || t?.status === 'active') || null,
    [titles]
  );

  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    if (tab === 'sparks' && videos.length === 0) loadVideos();
  }, [videos.length, loadVideos]);

  // Modals
  const [showTipModal, setShowTipModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);

  const targetUid = resolvedTargetId || userId;
  // Relationship truth only; null (unresolved) is never coerced to `false`.
  const isFollowing = followStatus?.isFollowing ?? relationship?.isFollowing ?? null;
  // `null` means the friend-request domain has not resolved (or is not
  // applicable yet). Treating it as 'none' would offer "Add Friend" on a
  // relationship we have not actually verified, so the toggle stays hidden
  // until a real status is known.
  const friendshipStatus = friendRequestStatus ?? null;

  const handleFollowToggle = useCallback(() => {
    if (!currentUserId) {
      toast.error('Please sign in to follow this creator');
      navigate('/login');
      return;
    }
    if (isFollowing) unfollow();
    else follow();
  }, [currentUserId, isFollowing, follow, unfollow, navigate]);

  const handleFriendRequestToggle = useCallback(async () => {
    if (!currentUserId) {
      toast.error('Please sign in to send a friend request');
      navigate('/login');
      return;
    }
    if (!friendshipStatus) {
      toast.info('Friend status is still loading. Please try again in a moment.');
      return;
    }
    if (friendshipStatus === 'friends') {
      toast.info(`You and @${profileData?.username || 'user'} are already friends!`);
      return;
    }
    if (friendshipStatus === 'pending') {
      toast.info('Friend request already sent. Waiting for acceptance.');
      return;
    }
    try {
      if (friendshipStatus === 'received') {
        await acceptFriendRequest();
        toast.success(`You and @${profileData?.username || 'user'} are now friends!`);
      } else if (friendshipStatus === 'none') {
        const res = await sendFriendRequest();
        // `alreadyFriends` is authoritative server truth.
        toast.success(
          res?.alreadyFriends
            ? `You and @${profileData?.username || 'user'} are already friends!`
            : `Friend request sent to @${profileData?.username || 'user'}`
        );
      }
    } catch (e) {
      toast.error(e?.message || 'Could not process friend request');
    }
  }, [currentUserId, friendshipStatus, profileData?.username, navigate, sendFriendRequest, acceptFriendRequest]);

  const handleUnblock = useCallback(async () => {
    if (!currentUserId || !targetUid) return;
    try {
      await unblockUser();
      toast.success('User unblocked');
    } catch {
      toast.error('Could not unblock user');
    }
  }, [currentUserId, targetUid, unblockUser]);

  const handleShare = useCallback(async () => {
    try {
      const target = profileData || { id: targetUid, uid: targetUid, username: profileData?.username };
      const result = await shareProfile(target);
      if (result.copied) toast.success('Profile link copied to clipboard!');
    } catch {
      toast.error('Could not share profile');
    }
  }, [profileData, targetUid]);

  // Honest identity projection: normalize display fields without inventing values.
  const effectiveProfile = profileData
    ? {
        ...profileData,
        id: profileData.id || profileData.uid || targetUid,
        uid: profileData.uid || profileData.id || targetUid,
        photoURL: getSafeAvatarUrl(profileData.photoURL, profileData.displayName || 'Creator', targetUid),
        bio: typeof profileData.bio === 'string' ? profileData.bio : '',
        links: Array.isArray(profileData.links) ? profileData.links : [],
        presence: profileData.presence || null,
        location: typeof profileData.location === 'string' ? profileData.location : '',
        website: typeof profileData.website === 'string' ? profileData.website : '',
      }
    : null;

  if (loading && !profileData) {
    return (
      <div className={cn('min-h-screen pb-20', isDark ? 'bg-arvdoul-bg' : 'bg-arvdoul-bg-light')}>
        <TopAppLoadingBanner isAnimating={true} label="Loading Profile..." />
        <ProfileSkeleton theme={theme} />
      </div>
    );
  }

  if (capabilities?.isBlocking) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center p-4",
        isDark ? "bg-arvdoul-bg text-white" : "bg-arvdoul-bg-light text-slate-900"
      )}>
        <div className={cn(
          "max-w-md w-full p-8 rounded-3xl border text-center space-y-4 shadow-xl",
          isDark ? "bg-arvdoul-bg-elevated border-white/10" : "bg-white border-slate-200"
        )}>
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
            <UserX className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black">You have blocked this profile</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            You cannot view content or interact with @{effectiveProfile?.username || 'this user'} while they are blocked.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 rounded-full font-semibold text-sm bg-slate-200 dark:bg-white/10 hover:opacity-90 transition-opacity"
            >
              Go Back
            </button>
            <button
              onClick={handleUnblock}
              className="px-5 py-2.5 rounded-full font-semibold text-sm text-white bg-red-600 hover:bg-red-700 shadow-md transition-opacity"
            >
              Unblock Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (capabilities?.isBlockedBy || (!loading && capabilities?.canViewProfile === false)) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center p-4",
        isDark ? "bg-arvdoul-bg text-white" : "bg-arvdoul-bg-light text-slate-900"
      )}>
        <div className={cn(
          "max-w-md w-full p-8 rounded-3xl border text-center space-y-4 shadow-xl",
          isDark ? "bg-arvdoul-bg-elevated border-white/10" : "bg-white border-slate-200"
        )}>
          <div className="w-16 h-16 mx-auto rounded-full bg-slate-500/10 text-slate-500 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black">Profile Unavailable</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This account is currently unavailable or restricted.
          </p>
          <div className="pt-2 flex justify-center">
            <button
              onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-full font-semibold text-sm bg-slate-200 dark:bg-white/10 hover:opacity-90 transition-opacity"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!loading && !effectiveProfile) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center p-4",
        isDark ? "bg-arvdoul-bg text-white" : "bg-arvdoul-bg-light text-slate-900"
      )}>
        <div className={cn(
          "max-w-md w-full p-8 rounded-3xl border text-center space-y-4 shadow-xl",
          isDark ? "bg-arvdoul-bg-elevated border-white/10" : "bg-white border-slate-200"
        )}>
          <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center text-2xl font-bold">
            ?
          </div>
          <h2 className="text-xl font-black">
            {error ? 'Could Not Load Profile' : 'Creator Profile Not Found'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {error
              ? 'Something went wrong while loading this profile. Please retry.'
              : 'This account may have been renamed, removed, or is not yet available on Arvdoul.'}
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 rounded-full font-semibold text-sm bg-slate-200 dark:bg-white/10 hover:opacity-90 transition-opacity"
            >
              Go Back
            </button>
            <button
              onClick={() => refresh()}
              className="px-5 py-2.5 rounded-full font-semibold text-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 shadow-md transition-opacity"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={cn(
        "min-h-screen pb-24 transition-colors duration-200",
        isDark
          ? "bg-arvdoul-bg text-white selection:bg-purple-500/30"
          : "bg-arvdoul-bg-light text-slate-900 selection:bg-purple-500/20"
      )}>
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-5 space-y-4 sm:space-y-5">

          {/* 1. Hero Section */}
          <ProfileHeroSection
            profile={effectiveProfile}
            isOwner={false}
            level={level || effectiveProfile.level}
            theme={theme}
            reputation={reputation}
            creatorProfile={creatorProfile}
            relationship={relationship}
            onBack={() => navigate(-1)}
            onOpenQrCode={() => setShowQrModal(true)}
            onOpenQrScanner={() => setShowScannerModal(true)}
            onOpenNotifications={() => navigate('/notifications')}
            onOpenMessages={() => navigate(`/messages/new?to=${targetUid}`)}
            onOpenOptions={() => setShowOptionsMenu(true)}
            onAvatarClick={() => setShowQrModal(true)}
            onShare={handleShare}
            onFollowToggle={handleFollowToggle}
            isFollowing={isFollowing}
            followLoading={followLoading}
            friendshipStatus={friendshipStatus}
            friendRequestLoading={friendRequestLoading}
            onFriendRequestToggle={handleFriendRequestToggle}
            onOpenTipModal={() => setShowTipModal(true)}
          />

          {/* 1b. Digital-Nation standing rail (reputation, rank, badges, title) */}
          <ProfileNationStanding
            level={level ?? effectiveProfile?.level ?? null}
            reputation={reputation}
            rank={rank}
            badges={badges}
            activeTitle={activeTitle || profileData?.activeTitle || profileData?.primaryTitle || null}
            theme={theme}
          />

          {/* 2. Key Metrics Strip */}
          <ProfileMetricsGrid
            isOwner={false}
            theme={theme}
            profile={effectiveProfile}
            reputation={reputation}
            capabilities={capabilities}
            onMetricPress={(key) => {
              if (key === 'followers') navigate(`/profile/${targetUid}/followers`);
              else if (key === 'following') navigate(`/profile/${targetUid}/following`);
              else if (key === 'friends') navigate(`/profile/${targetUid}/friends`);
            }}
          />

          {/* 2b. Mutual Friends Line */}
          {mutualFriends && mutualFriends.length > 0 && (
            <ProfileMutualFriends
              mutualFriends={mutualFriends}
              theme={theme}
              onFriendPress={(friend) => navigate(`/profile/${friend.id || friend.uid || friend.username}`)}
            />
          )}

          {!capabilities?.canViewContent ? (
            <div className={cn(
              "rounded-3xl p-8 sm:p-12 text-center border shadow-sm space-y-4 my-6",
              isDark ? "bg-arvdoul-bg-elevated/80 border-white/10" : "bg-white border-slate-200"
            )}>
              <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">This Account is Private</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Follow @{effectiveProfile?.username} to view their media gallery, highlights, and activity feed.
                </p>
              </div>
              <div className="pt-2 flex justify-center">
                <button
                  onClick={handleFollowToggle}
                  className="px-6 py-2.5 rounded-full font-semibold text-sm text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 shadow-md transition-opacity flex items-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isFollowing ? 'Requested' : 'Follow to View'}</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 3. Highlights / Vibes Carousel */}
              <ProfileHighlightsSection
                highlights={highlights}
                stories={stories}
                userId={targetUid}
                isOwner={false}
                loading={highlightsLoading}
                error={highlightsError}
                onRetry={() => loadHighlights(targetUid)}
                theme={theme}
              />

              {/* 4. Featured by Creator */}
              <ProfileFeaturedSection
                profile={effectiveProfile}
                posts={posts}
                theme={theme}
                onPostClick={(post) => navigate(`/post/${post.id}`)}
              />

              {/* 5. Digital-nation standing: progression + achievements summaries */}
              <ProfileProgression
                profile={effectiveProfile}
                isOwner={false}
                canViewProgression={capabilities?.canViewProgression === true}
                theme={theme}
              />

              {/* 5b. Institutional Passport artifact (authorized projection) */}
              <ProfilePassportCard
                passport={passport}
                isOwner={false}
                canView={capabilities?.canViewIdentity === true}
                theme={theme}
              />

              {capabilities?.canViewAchievements === true && achievements.length > 0 && (
                <ProfileAchievements achievements={achievements} isOwner={false} showLink={false} theme={theme} />
              )}

              {/* 6. Tabs */}
              <div className="sticky top-2 z-30 pt-1">
                <ProfileTabsBar
                  activeTab={activeTab}
                  onTabChange={handleTabChange}
                  isOwner={false}
                  theme={theme}
                  counts={{ posts: posts?.length || 0 }}
                />
              </div>

              {/* 7. Pinned Posts */}
              <ProfilePinnedPosts
                posts={posts}
                theme={theme}
                onPostClick={(post) => navigate(`/post/${post.id}`)}
              />

              {/* 8. Media Feed Grid */}
              <ProfileFeedGrid
                posts={posts}
                activeTab={activeTab}
                loading={loading || postsLoading || (activeTab === 'sparks' && videosLoading)}
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
                isOwner={false}
                capabilities={capabilities}
                theme={theme}
              />
            </>
          )}

        </div>

        {/* Tip / Gift Modal */}
        {showTipModal && (
          <ProfileTipModal
            isOpen={showTipModal}
            onClose={() => setShowTipModal(false)}
            recipient={effectiveProfile}
            currentUser={currentUser}
            onTipSuccess={(amount) => {
              toast.success(`Successfully gifted ${amount} coins to ${effectiveProfile?.displayName}!`);
              setShowTipModal(false);
            }}
          />
        )}

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

        {/* Options Menu */}
        {showOptionsMenu && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
              <Suspense fallback={null}>
                <ProfileOptionsMenu
                  profile={effectiveProfile}
                  isOwner={false}
                  theme={theme}
                  capabilities={capabilities}
                  onClose={() => setShowOptionsMenu(false)}
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
