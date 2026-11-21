/**
 * Deep preview mode for the user's profile before or after editing.
 * Supports toggling between Owner Perspective and Visitor Perspective.
 * Displays hero identity, metric strip, highlights, and tabbed feed content.
 * 
 * @component
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useLayoutChrome } from '../../context/LayoutChromeContext.jsx';
import { useProfileStore } from '../../store/profileStore';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';
import { ArrowLeft, Edit3, ShieldCheck } from "lucide-react";
import { ErrorBoundary } from '../../components/ErrorBoundary';
import ProfileHeroSection from '../../components/profile/ProfileHeroSection';
import ProfileProgression from '../../components/profile/ProfileProgression';
import ProfileMetricsGrid from '../../components/profile/ProfileMetricsGrid';
import ProfileHighlightsSection from '../../components/profile/ProfileHighlightsSection';
import ProfileTabsBar from '../../components/profile/ProfileTabsBar';
import ProfileFeedGrid from '../../components/profile/ProfileFeedGrid';
import ProfileSkeleton from '../../components/profile/ProfileSkeleton';
import { getStoredUid, getStoredUser } from '../../utils/security';
import {
  deriveProfileIdentity,
  projectProfileForViewer,
} from '../../services/profileReadModel.js';
import { resolveCapabilities } from '../../services/profileCapabilityEngine';
import { shareProfile } from '../../utils/shareUtils';
import { toast } from 'sonner';

const PERSPECTIVES = [
  { id: 'owner', label: 'Owner', desc: 'Your full private profile experience.' },
  { id: 'public', label: 'Public', desc: 'Simulating how strangers and public search visitors see your profile.' },
  { id: 'follower', label: 'Follower', desc: 'Simulating how approved followers see your profile.' },
  { id: 'connection', label: 'Connection', desc: 'Simulating how mutual friends and close connections see your profile.' },
];

/**
 * ProfilePreviewScreen Component
 */
export default function ProfilePreviewScreen({
  profile: propProfile,
  loading: propLoading = false,
  onBack,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { hasTopAppBar } = useLayoutChrome();
  const isDark = theme === 'dark';

  const { user: authUser } = useAuth();
  const storeUser = useAppStore((state) => state.currentUser);
  const storeProfile = useProfileStore((state) => state.profile);
  const storePosts = useProfileStore((state) => state.posts);
  const storePostsCount = useProfileStore((state) => state.postsCount);
  const storePostsHasMore = useProfileStore((state) => state.postsHasMore);
  const storeHighlights = useProfileStore((state) => state.highlights);
  const storeStories = useProfileStore((state) => state.stories);
  const storeFollowStatus = useProfileStore((state) => state.followStatus);
  const loadProfile = useProfileStore((state) => state.loadProfile);

  const [activeTab, setActiveTab] = useState('posts');
  const [viewPerspective, setViewPerspective] = useState('owner'); // 'owner' | 'public' | 'follower' | 'connection'
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
    } catch {
      /* view-mode preference */
    }
  }, []);

  const currentUserId = authUser?.uid || storeUser?.uid || getStoredUid();

  // Resolve active profile from props, location.state, store, or auth
  const rawProfile = propProfile || location.state?.profile || storeProfile || authUser || storeUser || getStoredUser();

  useEffect(() => {
    if (!rawProfile && currentUserId) {
      loadProfile(currentUserId, currentUserId);
    }
  }, [rawProfile, currentUserId, loadProfile]);

  const effectiveProfile = useMemo(() => {
    if (!rawProfile && !currentUserId) return null;
    const p = rawProfile || {};
    const livePostCount = Array.isArray(storePosts)
      ? storePosts.filter((item) => !item?.isDeleted && item?.status !== 'scheduled').length
      : 0;
    const reconciledPostCount =
      typeof storePostsCount === 'number' && Number.isFinite(storePostsCount)
        ? Math.max(storePostsCount, livePostCount)
        : typeof p.postCount === 'number' && (p.postCount > 0 || !storePosts?.length)
          ? p.postCount
          : storePostsHasMore === false && storePosts
            ? livePostCount
            : p.postCount;

    const identity = deriveProfileIdentity(p, {
      viewer: authUser || storeUser || {},
      handleCandidates: [p.username],
      handleFallbacks: [authUser?.email],
      handleFallback: 'citizen',
      displayCandidates: [p.displayName, p.name],
      displayFallback: null,
      followerCandidates: [p.followerCount, p.followersCount],
      followingCandidates: [p.followingCount],
      postCandidates: [reconciledPostCount, p.postCount, storePosts?.length],
      levelCandidates: [p.level, p.creatorLevel],
      coinCandidates: [p.coins, p.coinBalance],
      userId: currentUserId,
    });
    return {
      ...p,
      ...identity,
      bio: p.bio || '',
      location: p.location || '',
      website: p.website || '',
      isPrivate: Boolean(p.isPrivate),
    };
  }, [rawProfile, currentUserId, authUser, storeUser, storePosts, storePostsCount, storePostsHasMore]);

  const isOwnerMode = viewPerspective === 'owner';

  const capabilities = useMemo(() => {
    const isOwnerView = viewPerspective === 'owner';
    return resolveCapabilities({
      viewer: isOwnerView ? authUser : { uid: `preview_${viewPerspective}_visitor` },
      target: effectiveProfile,
      relationship: isOwnerView
        ? { isOwner: true }
        : {
            isOwner: false,
            isFollowing: viewPerspective === 'follower' || viewPerspective === 'connection',
            isFollower: viewPerspective === 'follower' || viewPerspective === 'connection',
            isMutualFriend: viewPerspective === 'connection',
            requestStatus: storeFollowStatus?.requestStatus ?? null,
          },
      viewAs: isOwnerView ? null : viewPerspective,
    });
  }, [authUser, effectiveProfile, viewPerspective]);

  // Apply the capability decision once; the view layer never re-derives it.
  const projectedProfile = useMemo(
    () => projectProfileForViewer(effectiveProfile, capabilities, { isOwner: isOwnerMode }),
    [effectiveProfile, capabilities, isOwnerMode]
  );

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  const handleEdit = () => {
    navigate('/profile/edit');
  };

  const handleShare = useCallback(async () => {
    try {
      const target = projectedProfile || { id: currentUserId, uid: currentUserId };
      const result = await shareProfile(target);
      if (result?.copied) {
        toast.success('Profile link copied to clipboard');
      }
    } catch {
      toast.error('Could not share profile');
    }
  }, [projectedProfile, currentUserId]);

  if (propLoading || (!effectiveProfile && currentUserId)) {
    return (
      <div className={cn(
        'min-h-screen pb-20',
        isDark ? 'bg-[#03071B]' : 'bg-[#F6F8FC]'
      )}>
        <ProfileSkeleton theme={theme} variant={isOwnerMode ? 'owner' : 'public'} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className={cn(
        'min-h-screen pb-24 transition-colors',
        isDark ? 'bg-[#03071B] text-white' : 'bg-[#F6F8FC] text-slate-900'
      )}>
        {/* Perspective Selector Header (inline panel inside MainLayout, sticky header standalone) */}
        <header className={cn(
          hasTopAppBar
            ? 'max-w-[1160px] mx-auto px-3 sm:px-6 lg:px-8 pt-2 sm:pt-4'
            : cn('sticky top-0 z-30 backdrop-blur-xl border-b transition-colors', isDark ? 'bg-[#03071B]/90 border-white/10' : 'bg-white/90 border-slate-200')
        )}>
          <div className={cn(
            'flex items-center justify-between gap-2.5 flex-wrap',
            hasTopAppBar
              ? cn(
                  'px-3 sm:px-4 py-2.5 rounded-2xl border backdrop-blur-xl',
                  isDark ? 'bg-[#080F2E]/85 border-white/[0.08]' : 'bg-white/90 border-slate-200/90 shadow-xs'
                )
              : 'max-w-[1240px] mx-auto px-3 sm:px-6 lg:px-8 py-2'
          )}>
            {!hasTopAppBar && (
              <button
                type="button"
                onClick={handleBack}
                className={cn(
                  'min-h-[40px] inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple',
                  isDark ? 'text-slate-300 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}

            {/* Perspective Toggle */}
            <div
              role="group"
              aria-label="Preview perspective"
              className={cn(
                'flex items-center gap-1 p-1 rounded-2xl border overflow-x-auto no-scrollbar',
                isDark ? 'bg-white/[0.04] border-white/10' : 'bg-slate-100/90 border-slate-200/80'
              )}
            >
              {PERSPECTIVES.map((p) => {
                const active = viewPerspective === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setViewPerspective(p.id)}
                    className={cn(
                      "min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple",
                      active
                        ? "bg-arvdoul-gradient text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleEdit}
              className="min-h-[40px] px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all shadow-sm bg-arvdoul-gradient text-white hover:opacity-95 cursor-pointer shrink-0 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          </div>
        </header>

        {/* Main Preview Container */}
        <div className="max-w-[1160px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
          {/* Banner notification for Non-Owner Perspectives */}
          {viewPerspective !== 'owner' && (
            <div className={cn(
              "px-4 py-2.5 rounded-2xl border text-xs font-medium flex items-center gap-2",
              isDark ? "bg-amber-500/10 border-amber-500/25 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-800"
            )}>
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{PERSPECTIVES.find((p) => p.id === viewPerspective)?.desc}</span>
            </div>
          )}

          {/* 1. Hero Identity Header */}
          <ProfileHeroSection
            profile={projectedProfile}
            isOwner={isOwnerMode}
            level={projectedProfile?.level ?? null}
            theme={theme}
            onBack={hasTopAppBar ? undefined : handleBack}
            onEditProfile={handleEdit}
            onShare={handleShare}
            capabilities={capabilities}
          />

          {/* 2. Key Metrics Grid */}
          <ProfileMetricsGrid
            isOwner={isOwnerMode}
            theme={theme}
            profile={projectedProfile}
            capabilities={capabilities}
            showCoins={false}
          />

          {/* 3. Citizen Progression */}
          <ProfileProgression
            level={projectedProfile?.level ?? null}
            experience={projectedProfile?.experience}
            streak={projectedProfile?.activeStreak}
            reputation={projectedProfile?.reputation}
            showLevel={projectedProfile?.showLevel !== false}
            showReputation={projectedProfile?.showReputation !== false}
            showStreak={projectedProfile?.showStreak !== false}
            isOwner={isOwnerMode}
            theme={theme}
          />

          {/* 4. Story Highlights / Vibes Carousel */}
          <ProfileHighlightsSection
            highlights={storeHighlights}
            userId={currentUserId}
            isOwner={isOwnerMode}
            theme={theme}
          />

          {/* 5. Tabs Strip */}
          <ProfileTabsBar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            isOwner={isOwnerMode}
            theme={theme}
            counts={(() => {
              const list = storePosts || [];
              const vibePosts = list.filter((p) => p.type === 'story' || p.type === 'vibe' || p.isStory || p.isVibe);
              const mergedVibeIds = new Set([
                ...((storeStories || []).map((s) => s?.id).filter(Boolean)),
                ...vibePosts.map((p) => p?.id).filter(Boolean),
              ]);
              return {
                posts: list.filter(p => p.type !== 'audio' && p.type !== 'track' && p.type !== 'story' && p.type !== 'vibe').length,
                videos: list.filter(p => p.type === 'video' || p.type === 'reel' || p.type === 'spark' || Boolean(p.videoURL || p.videoUrl || p.mediaType === 'video')).length,
                reels: list.filter(p => p.type === 'reel' || p.type === 'spark' || p.isReel || p.isSpark).length,
                photos: list.filter(p => {
                  const isVidOrAudio = p.type === 'video' || p.type === 'reel' || p.type === 'spark' || p.type === 'audio' || p.type === 'track' || Boolean(p.videoURL || p.videoUrl || p.audioURL || p.audioUrl);
                  return !isVidOrAudio && (p.type === 'image' || p.type === 'photo' || p.type === 'gallery' || Boolean(p.mediaURL || p.imageUrl || (Array.isArray(p.media) && p.media.length > 0)));
                }).length,
                stories: Math.max(mergedVibeIds.size, (storeStories || []).length),
                audio: list.filter(p => p.type === 'audio' || p.type === 'track' || p.type === 'music' || Boolean(p.audioURL || p.audioUrl)).length,
                saved: 0,
                tagged: list.filter(p => Array.isArray(p.taggedUsers) && p.taggedUsers.length > 0).length,
              };
            })()}
          />

          {/* 6. Feed & Tab Content */}
          <ProfileFeedGrid
            posts={storePosts || []}
            savedPosts={[]}
            stories={storeStories || []}
            activeTab={activeTab}
            viewMode={viewMode}
            loading={false}
            theme={theme}
            profile={projectedProfile}
            isOwner={isOwnerMode}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}
