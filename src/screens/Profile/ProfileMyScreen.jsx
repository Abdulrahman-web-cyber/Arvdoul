/**
 * Owner view of the authenticated user's profile.
 *
 * Composition (top to bottom), each section delegated to an existing component:
 *  1. Identity            - ProfileHeroSection
 *  2. Social presence     - ProfileMetricsGrid
 *  3. Digital standing    - ProfileProgression + ProfileHighlightsSection
 *  4. Creator intelligence- ProfileCreatorDashboard (owner perspective only)
 *  5. Content hub         - ProfileTabsBar, ProfilePinnedPosts, ProfileFeedGrid
 *  6. Secondary interfaces- modals, options menu, view-as banner
 *
 * The AuthContext UID is the only ownership authority. App-store user data is
 * used for supplementary display fields only when it carries the same UID.
 * Owner-only actions are unavailable while previewing another perspective.
 *
 * @component
 */
import { useCallback, useEffect, useState, useMemo, Suspense, lazy, useRef } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, RefreshCw, Coins, ArrowUpRight, Wallet } from "lucide-react";
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useProfileStore } from '../../store/profileStore';
import { useAnalyticsStore } from '../../store/analyticsStore';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import ProfileViewAsBanner from '../../components/profile/ProfileViewAsBanner';
import { shareProfile } from '../../utils/shareUtils';
import {
  isPlaceholderHandle,
  deriveProfileIdentity,
  projectProfileForViewer,
} from '../../services/profileReadModel.js';
import { resolveCapabilities } from '../../services/profileCapabilityEngine';
import { PROFILE_TABS } from '../../config/profileContracts.js';
import { BRAND_GRADIENT, brandRgba, brandHexRgba, tokens } from '../../design-system/tokens.js';
import { getAdaptiveTuning } from '../../utils/deviceCapabilities.js';
import { toast } from 'sonner';

// Core Above-the-Fold Profile Components (eager for instant frame-1 paint)
import ProfileHeroSection from '../../components/profile/ProfileHeroSection';
import ProfileProgression from '../../components/profile/ProfileProgression';
import ProfileMetricsGrid from '../../components/profile/ProfileMetricsGrid';
import ProfileHighlightsSection from '../../components/profile/ProfileHighlightsSection';
import ProfileTabsBar from '../../components/profile/ProfileTabsBar';
import ProfilePinnedPosts from '../../components/profile/ProfilePinnedPosts';
import ProfileFeedGrid from '../../components/profile/ProfileFeedGrid';
import ProfileSkeleton from '../../components/profile/ProfileSkeleton';

const lazyDefault = (loader) => lazy(async () => {
  const mod = await loader();
  const comp = mod?.default?.default || mod?.default || Object.values(mod || {}).find(
    (v) => typeof v === 'function' || (v && typeof v === 'object' && v.$$typeof)
  );
  return { default: comp };
});

// Heavy below-the-fold panel & modal surfaces (lazy-loaded for fast low-RAM paint)
const ProfileCreatorDashboard = lazyDefault(() => import('../../components/profile/ProfileCreatorDashboard'));
const ProfileQRCodeModal = lazyDefault(() => import('../../components/profile/ProfileQRCodeModal'));
const ProfileLocationModal = lazyDefault(() => import('../../components/profile/ProfileLocationModal'));
const ProfilePerspectiveModal = lazyDefault(() => import('../../components/profile/ProfilePerspectiveModal'));
const ProfileVerificationModal = lazyDefault(() => import('../../components/profile/ProfileVerificationModal'));
const ProfileOptionsMenu = lazyDefault(() => import('../../components/profile/ProfileOptionsMenu'));
const AvatarUploadModal = lazyDefault(() => import('../../components/profile/AvatarUploadModal'));
const ProfileQuickEditModal = lazyDefault(() => import('../../components/profile/ProfileQuickEditModal'));

const VIEW_MODE_STORAGE_KEY = 'arvdoul_profile_view_mode';

const PERSPECTIVE_LABELS = {
  public: 'Public',
  follower: 'Follower',
  connection: 'Connection',
};

/**
 * Glass surfaces. Blur is applied only on capable devices (disabled automatically in Lite Mode).
 */
const buildGlassSurface = (isDark, isLiteMode) => cn(
  isLiteMode ? '' : 'backdrop-blur-xl',
  isDark
    ? 'bg-[#0B1233]/85 border-white/[0.09] shadow-[0_8px_32px_rgba(3,7,27,0.45)]'
    : 'bg-white/90 border-slate-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.07)]'
);

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple focus-visible:ring-offset-2 focus-visible:ring-offset-transparent';

/**
 * @param {unknown} value
 * @returns {string | null} The value if it is a non-empty string.
 */
const asNonEmptyString = (value) =>
  typeof value === 'string' && value.length > 0 ? value : null;

export default function ProfileMyScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showPerspectiveModal, setShowPerspectiveModal] = useState(false);
  const [quickEditField, setQuickEditField] = useState(null);
  const [activeTab, setActiveTab] = useState('posts');
  const [viewAs, setViewAs] = useState('owner'); // 'owner' | 'public' | 'follower' | 'connection'

  const isLiteMode = getAdaptiveTuning().isLiteMode;

  const isOwnerView = viewAs === 'owner';

  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem(VIEW_MODE_STORAGE_KEY) || 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {
      /* view-mode persistence is a preference, not state */
    }
  }, []);

  // --- Authenticated identity -------------------------------------------
  // AuthContext is the sole ownership authority. A locally stored UID is never
  // used, and app-store data is only supplementary and only when its UID
  // equals the authenticated UID.
  const { user: authContextUser } = useAuth();
  const appStoreUser = useAppStore((state) => state.currentUser);
  const currentUserId = asNonEmptyString(authContextUser?.uid);

  const authDisplayName = authContextUser?.displayName ?? null;
  const authEmail = authContextUser?.email ?? null;
  const authPhotoURL = authContextUser?.photoURL ?? null;

  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    const supplement =
      appStoreUser && appStoreUser.uid === currentUserId ? appStoreUser : {};
    return {
      ...supplement,
      uid: currentUserId,
      displayName: authDisplayName ?? supplement.displayName,
      email: authEmail ?? supplement.email,
      photoURL: authPhotoURL ?? supplement.photoURL,
    };
  }, [currentUserId, appStoreUser, authDisplayName, authEmail, authPhotoURL]);

  // --- Store selectors --------------------------------------------------
  const profile = useProfileStore((state) => state.profile);
  const loading = useProfileStore((state) => state.loading);
  const error = useProfileStore((state) => state.error);
  const posts = useProfileStore((state) => state.posts);
  const postsCount = useProfileStore((state) => state.postsCount);
  const postsLikesCount = useProfileStore((state) => state.postsLikesCount);
  const friendCount = useProfileStore((state) => state.friendCount);
  const postsLoading = useProfileStore((state) => state.postsLoading);
  const postsHasMore = useProfileStore((state) => state.postsHasMore);
  const postsCursor = useProfileStore((state) => state.postsCursor);
  const savedPosts = useProfileStore((state) => state.savedPosts);
  const savedLoading = useProfileStore((state) => state.savedLoading);
  const highlights = useProfileStore((state) => state.highlights);
  const stories = useProfileStore((state) => state.stories);
  const storiesLoading = useProfileStore((state) => state.storiesLoading);
  const level = useProfileStore((state) => state.level);
  const experience = useProfileStore((state) => state.experience);
  const balance = useProfileStore((state) => state.balance);

  const analytics = useAnalyticsStore((state) => state.analyticsUserId === currentUserId ? state.analytics : null);
  const timeframe = useAnalyticsStore((state) => state.timeframe);
  const ranking = useAnalyticsStore((state) => state.analyticsUserId === currentUserId ? state.ranking : null);
  const setTimeframe = useAnalyticsStore((state) => state.setTimeframe);

  // A profile left in the store by a previous account must never be shown.
  const profileOwnerId = profile?.uid ?? profile?.id ?? null;
  const isProfileStale = Boolean(profile && profileOwnerId && profileOwnerId !== currentUserId);
  const ownedProfile = profile && !isProfileStale ? profile : null;
  const profileUsername = ownedProfile?.username;
  const profileDisplayName = ownedProfile?.displayName;
  const hasOwnedProfile = Boolean(ownedProfile);

  // --- Modal helpers (owner-only surfaces) ------------------------------
  const closeOwnerModals = useCallback(() => {
    setShowAvatarModal(false);
    setShowLocationModal(false);
    setShowVerificationModal(false);
    setShowOptionsMenu(false);
  }, []);

  const handleViewAsChange = useCallback((mode) => {
    setViewAs(mode);
    if (mode !== 'owner') closeOwnerModals();
    if (!currentUserId) return;
    useProfileStore.getState().loadProfile(currentUserId, currentUserId, {
      viewAs: mode === 'owner' ? null : mode,
    });
  }, [currentUserId, closeOwnerModals]);

  // Account switch: drop any preview perspective and owner modals.
  const previousUidRef = useRef(currentUserId);
  useEffect(() => {
    if (previousUidRef.current === currentUserId) return;
    previousUidRef.current = currentUserId;
    setViewAs('owner');
    closeOwnerModals();
  }, [currentUserId, closeOwnerModals]);

  const reloadOwnerProfile = useCallback(() => {
    if (!currentUserId) return;
    useProfileStore.getState().loadProfile(currentUserId, currentUserId);
  }, [currentUserId]);

  // Log load failures; the UI shows a sanitized message only.
  useEffect(() => {
    if (error) console.error('Profile load error:', error);
  }, [error]);

  // --- Username auto-generation (existing userService contract) ---------
  // Attempted at most once per account to avoid duplicate side effects.
  const usernameAttemptRef = useRef(null);
  const latestUidRef = useRef(currentUserId);
  useEffect(() => {
    latestUidRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    if (!isOwnerView || !currentUserId || loading || !hasOwnedProfile) return;
    if (profileUsername && !isPlaceholderHandle(profileUsername)) return;
    if (usernameAttemptRef.current === currentUserId) return;
    usernameAttemptRef.current = currentUserId;
    const uid = currentUserId;

    const ensureUniqueUser = async () => {
      try {
        const userServiceModule = await import('../../services/userService.js');
        const userService = userServiceModule.getUserService();
        const base = authDisplayName || profileDisplayName || 'citizen';
        const cleanBase = base.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'citizen';
        const generated = await userService.generateUniqueUsername(cleanBase, uid);
        if (!generated) return;
        await userService.updateUserProfile(uid, { username: generated });
        if (latestUidRef.current === uid) {
          useProfileStore.getState().loadProfile(uid, uid);
        }
      } catch (err) {
        console.warn('Auto username generation note:', err);
      }
    };
    ensureUniqueUser();
  }, [isOwnerView, currentUserId, loading, hasOwnedProfile, profileUsername, profileDisplayName, authDisplayName]);

  // --- Derived profile --------------------------------------------------
  // Identity/count derivation is the shared read model. Email addresses are
  // never used as a handle or display name. The coin balance comes first from
  // the economy-backed store value; profile metadata is only a fallback, and
  // the loaded (possibly partial) posts page is never used as a lifetime count.
  const effectiveProfile = useMemo(() => {
    const base = ownedProfile && typeof ownedProfile === 'object' ? ownedProfile : {};
    const viewer = currentUser || {};
    const livePostCount = Array.isArray(posts)
      ? posts.filter((p) => !p?.isDeleted && p?.status !== 'scheduled').length
      : 0;
    const reconciledPostCount =
      typeof postsCount === 'number' && Number.isFinite(postsCount)
        ? Math.max(postsCount, livePostCount)
        : typeof base.postCount === 'number' && (base.postCount > 0 || !posts?.length)
          ? base.postCount
          : postsHasMore === false && posts
            ? livePostCount
            : base.postCount;

    const identity = deriveProfileIdentity(base, {
      viewer,
      handleCandidates: [base.username, viewer.username],
      handleFallbacks: [viewer.displayName, base.displayName],
      handleFallback: 'citizen',
      displayCandidates: [viewer.displayName, viewer.name, base.displayName, base.name],
      displayFallback: currentUserId ? `user ${String(currentUserId).slice(0, 6)}` : '—',
      followerCandidates: [base.followerCount, base.followersCount, viewer.followerCount],
      followingCandidates: [base.followingCount, viewer.followingCount],
      postCandidates: [reconciledPostCount, base.postCount],
      levelCandidates: [level, base.level, viewer.level],
      withCoins: false,
      userId: currentUserId,
    });
    const pickString = (a, b) => (typeof a === 'string' ? a : (typeof b === 'string' ? b : ''));
    const experienceCandidates = [experience, base.experience, base.xp];
    const knownExperience = experienceCandidates.find((value) =>
      value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    );
    const resolvedExperience = knownExperience === undefined ? undefined : Number(knownExperience);
    const coinCandidates = [balance, base.coins, base.coinBalance, viewer.coins];
    const knownCoins = coinCandidates.find((value) =>
      value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
    );
    const resolvedCoins = knownCoins === undefined ? null : Number(knownCoins);
    const resolvedLikes =
      typeof postsLikesCount === 'number' && Number.isFinite(postsLikesCount)
        ? postsLikesCount
        : (base.likesReceived ?? base.likesCount ?? null);
    const resolvedFriends =
      typeof friendCount === 'number' && Number.isFinite(friendCount)
        ? friendCount
        : (base.friendCount ?? null);
    return {
      ...base,
      ...identity,
      coins: resolvedCoins,
      ...(resolvedExperience !== undefined ? { experience: resolvedExperience } : {}),
      ...(resolvedLikes !== null ? { likesReceived: resolvedLikes } : {}),
      ...(resolvedFriends !== null ? { friendCount: resolvedFriends } : {}),
      bio: pickString(base.bio, viewer.bio).trim(),
      location: pickString(base.location, viewer.location),
      website: pickString(base.website, viewer.website),
    };
  }, [ownedProfile, currentUser, currentUserId, balance, level, experience, posts, postsCount, postsHasMore, postsLikesCount, friendCount]);

  // Capabilities resolved by the existing engine for the active perspective.
  const capabilities = useMemo(() => resolveCapabilities({
    viewer: isOwnerView ? currentUser : { uid: `preview_${viewAs}_visitor` },
    target: effectiveProfile,
    relationship: {
      isOwner: isOwnerView,
      isFollowing: viewAs === 'follower' || viewAs === 'connection',
      isFollower: viewAs === 'follower' || viewAs === 'connection',
      isMutualFriend: viewAs === 'connection',
      isBlocked: false,
    },
    viewAs: isOwnerView ? null : viewAs,
  }), [currentUser, effectiveProfile, isOwnerView, viewAs]);

  const displayedProfile = useMemo(() => {
    if (isOwnerView) return effectiveProfile;
    return projectProfileForViewer(effectiveProfile, capabilities);
  }, [effectiveProfile, capabilities, isOwnerView]);

  // --- Deep-linked / default tab (applied once per mount) ---------------
  const [searchParams] = useSearchParams();
  const appliedDefaultTabRef = useRef(false);
  const preferredTab = displayedProfile?.defaultTab;
  useEffect(() => {
    if (appliedDefaultTabRef.current) return;
    const requestedTab = searchParams.get('tab');
    if (requestedTab && PROFILE_TABS.includes(requestedTab)) {
      setActiveTab(requestedTab);
      appliedDefaultTabRef.current = true;
      return;
    }
    if (preferredTab && PROFILE_TABS.includes(preferredTab)) {
      setActiveTab(preferredTab);
      appliedDefaultTabRef.current = true;
    }
  }, [searchParams, preferredTab]);

  // --- Data loading -----------------------------------------------------
  useEffect(() => {
    if (!currentUserId) return;
    const profileStore = useProfileStore.getState();
    profileStore.loadProfile(currentUserId, currentUserId);
    profileStore.loadHighlights(currentUserId);
    profileStore.loadStories(currentUserId);
    profileStore.loadLevel(currentUserId);
    profileStore.loadBalance(currentUserId);
    profileStore.loadPosition(currentUserId);
    profileStore.loadPosts(currentUserId);
  }, [currentUserId]);

  // Analytics load separately so a timeframe change never re-fetches profile/posts.
  useEffect(() => {
    if (!currentUserId) return;
    useAnalyticsStore.getState().loadAnalytics(currentUserId, timeframe);
  }, [currentUserId, timeframe]);

  const handleLoadMorePosts = useCallback(() => {
    if (!currentUserId) return;
    const store = useProfileStore.getState();
    if (store.postsLoading) return;
    store.loadMorePosts(currentUserId);
  }, [currentUserId]);

  const handleTabChange = useCallback((tab) => {
    appliedDefaultTabRef.current = true;
    setActiveTab(tab);
    if (!currentUserId) return;
    const store = useProfileStore.getState();
    if (tab === 'saved' && !store.savedLoading && !(store.savedPosts && store.savedPosts.length > 0)) {
      store.loadSavedPosts(currentUserId);
    } else if (tab === 'stories' && !store.storiesLoading && !(store.stories && store.stories.length > 0)) {
      store.loadStories(currentUserId);
    }
  }, [currentUserId]);

  // Refresh reports the real outcome of each operation.
  const handleRefresh = useCallback(async () => {
    if (!currentUserId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const profileStore = useProfileStore.getState();
      const analyticsStore = useAnalyticsStore.getState();
      const results = await Promise.allSettled([
        profileStore.refreshProfile(currentUserId, currentUserId),
        profileStore.loadHighlights(currentUserId),
        profileStore.loadStories(currentUserId),
        analyticsStore.loadAnalytics(currentUserId, timeframe),
        profileStore.loadPosts(currentUserId),
      ]);
      const failed = results.filter((r) => r.status === 'rejected');
      failed.forEach((r) => console.warn('Refresh operation failed:', r.reason));
      if (failed.length === 0) {
        toast.success('Profile refreshed');
      } else if (failed.length < results.length) {
        toast.warning('Some sections could not be refreshed');
      } else {
        toast.error('Could not refresh your profile');
      }
    } catch (e) {
      console.warn('Refresh failed:', e);
      toast.error('Could not refresh your profile');
    } finally {
      setIsRefreshing(false);
    }
  }, [currentUserId, isRefreshing, timeframe]);

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

  // --- Owner-only actions (inert while previewing another perspective) --
  const openLocationSetup = useCallback(() => {
    if (isOwnerView) setShowLocationModal(true);
  }, [isOwnerView]);

  const openOptions = useCallback(() => {
    if (isOwnerView) setShowOptionsMenu(true);
  }, [isOwnerView]);

  const openAvatarModal = useCallback(() => {
    if (isOwnerView) setShowAvatarModal(true);
  }, [isOwnerView]);

  const openVerification = useCallback(() => {
    if (isOwnerView) setShowVerificationModal(true);
  }, [isOwnerView]);

  const handleEditProfile = useCallback(() => {
    if (isOwnerView) navigate('/profile/edit');
  }, [isOwnerView, navigate]);

  const handleInsights = useCallback(() => {
    if (isOwnerView) navigate('/profile/analytics');
  }, [isOwnerView, navigate]);

  const handlePostClick = useCallback((post) => navigate(`/post/${post.id}`), [navigate]);

  const handleMetricPress = useCallback((key) => {
    if (!currentUserId) return;
    switch (key) {
      case 'followers':
      case 'following':
      case 'friends':
        navigate(`/profile/${currentUserId}/${key}`);
        break;
      case 'posts':
        handleTabChange('posts');
        break;
      case 'coins':
        if (isOwnerView) navigate('/coins');
        break;
      case 'views':
        if (isOwnerView) navigate('/profile/analytics');
        break;
      default:
        break;
    }
  }, [currentUserId, isOwnerView, navigate, handleTabChange]);

  // Cross-component events from the app shell.
  useEffect(() => {
    const handleQrEvent = () => setShowQrModal(true);
    const handlePerspectiveEvent = () => setShowPerspectiveModal(true);
    const handleShareEvent = () => handleShare();
    const handleOptionsEvent = () => openOptions();
    const handleLocationEvent = () => openLocationSetup();

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
  }, [handleShare, openOptions, openLocationSetup]);

  // --- Avatar handlers --------------------------------------------------
  const syncAppStoreAvatar = useCallback((photoURL) => {
    const appUser = useAppStore.getState().currentUser;
    if (appUser && (appUser.uid === currentUserId || appUser.id === currentUserId)) {
      useAppStore.getState().setCurrentUser({ ...appUser, photoURL });
    }
  }, [currentUserId]);

  const handleAvatarUpload = useCallback(async (croppedFile) => {
    if (!isOwnerView || !currentUserId) return;
    const toastId = toast.loading('Uploading avatar...');
    try {
      const { getUserService } = await import('../../services/userService.js');
      const uploadRes = await getUserService().uploadAvatar(currentUserId, croppedFile);
      const nextUrl = typeof uploadRes === 'string' ? uploadRes : (uploadRes?.photoURL || uploadRes?.url || null);
      if (nextUrl) syncAppStoreAvatar(nextUrl);
      toast.success('Avatar updated successfully!', { id: toastId });
      setShowAvatarModal(false);
      reloadOwnerProfile();
    } catch (err) {
      console.error('Avatar upload failed:', err);
      toast.error(err?.message || 'Failed to upload avatar', { id: toastId });
    }
  }, [isOwnerView, currentUserId, syncAppStoreAvatar, reloadOwnerProfile]);

  const handleAvatarRemove = useCallback(async () => {
    if (!isOwnerView || !currentUserId) return;
    const toastId = toast.loading('Removing avatar...');
    try {
      const { getUserService } = await import('../../services/userService.js');
      await getUserService().updateUserProfile(currentUserId, { photoURL: '' });
      syncAppStoreAvatar('');
      toast.success('Avatar removed', { id: toastId });
      setShowAvatarModal(false);
      reloadOwnerProfile();
    } catch (err) {
      console.error('Avatar removal failed:', err);
      toast.error(err?.message || 'Failed to remove avatar', { id: toastId });
    }
  }, [isOwnerView, currentUserId, syncAppStoreAvatar, reloadOwnerProfile]);

  // Tab counts reflect the pages & Vibes loaded so far.
  const tabCounts = useMemo(() => {
    const list = posts || [];
    const vibePosts = list.filter((p) => p.type === 'story' || p.type === 'vibe' || p.isStory || p.isVibe);
    const mergedVibeIds = new Set([
      ...((stories || []).map((s) => s?.id).filter(Boolean)),
      ...vibePosts.map((p) => p?.id).filter(Boolean),
    ]);
    return {
      posts: list.filter((p) => p.type !== 'audio' && p.type !== 'track' && p.type !== 'story' && p.type !== 'vibe').length,
      videos: list.filter((p) => p.type === 'video' || p.type === 'reel' || p.type === 'spark' || Boolean(p.videoURL || p.videoUrl || p.mediaType === 'video')).length,
      reels: list.filter((p) => p.type === 'reel' || p.type === 'spark' || p.isReel || p.isSpark).length,
      photos: list.filter((p) => {
        const isVidOrAudio = p.type === 'video' || p.type === 'reel' || p.type === 'spark' || p.type === 'audio' || p.type === 'track' || Boolean(p.videoURL || p.videoUrl || p.audioURL || p.audioUrl);
        return !isVidOrAudio && (p.type === 'image' || p.type === 'photo' || p.type === 'gallery' || Boolean(p.mediaURL || p.imageUrl || (Array.isArray(p.media) && p.media.length > 0)));
      }).length,
      stories: Math.max(mergedVibeIds.size, (stories || []).length),
      audio: list.filter((p) => p.type === 'audio' || p.type === 'track' || p.type === 'music' || Boolean(p.audioURL || p.audioUrl)).length,
      saved: savedPosts?.length || 0,
      tagged: list.filter((p) => Array.isArray(p.taggedUsers) && p.taggedUsers.length > 0).length,
    };
  }, [posts, savedPosts, stories]);

  const glass = buildGlassSurface(isDark, isLiteMode);
  const canShowTreasury = isOwnerView || Boolean(capabilities?.canViewEconomicStatus);
  const treasuryBalance = displayedProfile?.coins != null
    ? Number(displayedProfile.coins)
    : (balance !== null && Number.isFinite(Number(balance)) ? Number(balance) : null);

  // --- Gate: signed out -------------------------------------------------
  if (!currentUserId) {
    return (
      <div className={cn(
        "min-h-[70vh] flex items-center justify-center p-4",
        isDark ? "text-white" : "text-slate-900"
      )}>
        <div className={cn("max-w-md w-full p-8 rounded-3xl border text-center space-y-4", glass)}>
          <div
            className="w-16 h-16 mx-auto rounded-full text-arvdoul-purple flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${brandRgba(0.2)}, ${brandHexRgba(tokens.color.brand.blue, 0.2)})` }}
          >
            <Lock className="w-8 h-8" aria-hidden="true" />
          </div>
          <h2 className="font-display text-xl font-bold">Sign in to view your profile</h2>
          <p className={cn("text-sm", isDark ? "text-slate-400" : "text-slate-600")}>
            Access your Arvdoul identity, progression, creations, and settings by signing in.
          </p>
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className={cn(
                "min-h-[48px] px-8 py-2.5 rounded-2xl font-bold text-sm text-white bg-arvdoul-gradient",
                "hover:brightness-110 active:scale-[0.98] shadow-md transition-all motion-reduce:transition-none cursor-pointer",
                FOCUS_RING
              )}
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  const showPrivateState = !isOwnerView && !capabilities.canViewContent;

  if (loading && !ownedProfile && !error) {
    return (
      <ErrorBoundary>
        <div className="w-full pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
          <ProfileSkeleton theme={theme} variant="owner" />
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div
        className={cn(
          "relative isolate w-full overflow-x-clip pb-[calc(5rem+env(safe-area-inset-bottom,0px))] transition-colors duration-200 motion-reduce:transition-none",
          isDark ? "text-white selection:bg-purple-500/30" : "text-slate-900 selection:bg-purple-500/20"
        )}
      >
        {/* Ambient brand lighting: one static layer, no blur filter */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px]"
          style={{
            background: isDark
              ? `radial-gradient(60% 45% at 12% 0%, ${brandHexRgba(tokens.color.brand.pink, 0.16)}, transparent 70%), radial-gradient(55% 45% at 92% 6%, ${brandHexRgba(tokens.color.brand.cyan, 0.14)}, transparent 70%)`
              : `radial-gradient(60% 45% at 12% 0%, ${brandHexRgba(tokens.color.brand.pink, 0.09)}, transparent 70%), radial-gradient(55% 45% at 92% 6%, ${brandHexRgba(tokens.color.brand.cyan, 0.08)}, transparent 70%)`,
          }}
        />

        {/* Load failure banner (sanitized; details are logged) */}
        {error && (
          <div className="w-full max-w-[1160px] mx-auto px-3 sm:px-4 lg:px-6 pt-3">
            <div
              role="alert"
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-sm",
                isDark
                  ? "bg-red-500/10 border-red-400/25 text-red-200 backdrop-blur-xl"
                  : "bg-red-50/90 border-red-200 text-red-700 backdrop-blur-xl"
              )}
            >
              <span className="min-w-0 font-semibold">
                We couldn&apos;t load everything on your profile. Please try again.
              </span>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                aria-busy={isRefreshing}
                className={cn(
                  "min-h-[44px] px-4 rounded-xl font-bold shrink-0 inline-flex items-center gap-2 cursor-pointer transition-colors motion-reduce:transition-none",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                  isDark ? "bg-white/10 hover:bg-white/15 text-white" : "bg-white hover:bg-slate-100 text-red-700 border border-red-200",
                  FOCUS_RING
                )}
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
                <span>{isRefreshing ? 'Retrying' : 'Retry'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Master container — Owner Studio & Identity Command Hub */}
        <div className="w-full max-w-[1040px] mx-auto px-3 sm:px-5 lg:px-7 py-4 sm:py-6 space-y-4 sm:space-y-5 lg:space-y-6">
          {/* Sync indicator during background refreshes */}
          {loading && !ownedProfile && (
            <div
              role="status"
              aria-label="Syncing profile details"
              className="w-full h-0.5 rounded-full overflow-hidden bg-slate-200/40 dark:bg-white/10"
            >
              <div className="h-full w-1/3 rounded-full animate-pulse" style={{ background: BRAND_GRADIENT }} />
            </div>
          )}

          {/* 01. Identity */}
          <section aria-label="Profile identity" className="min-w-0">
            <ProfileHeroSection
              profile={displayedProfile}
              isOwner={isOwnerView}
              level={displayedProfile?.level}
              theme={theme}
              onOpenQrCode={() => setShowQrModal(true)}
              onOpenLocationSetup={openLocationSetup}
              onOpenOptions={openOptions}
              onAvatarClick={openAvatarModal}
              onShare={handleShare}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              onEditProfile={handleEditProfile}
              onOpenQuickEdit={isOwnerView ? (field) => setQuickEditField(field || 'bio') : undefined}
              onOpenVerificationModal={openVerification}
              onInsightsPress={handleInsights}
              capabilities={capabilities}
            />
          </section>

          {/* 02. Studio Telemetry & Treasury Command Grid */}
          <div className={cn(
            "grid grid-cols-1 gap-4 sm:gap-5 items-stretch",
            canShowTreasury && "lg:grid-cols-12"
          )}>
            <section
              aria-label="Social presence"
              className={cn("min-w-0", canShowTreasury ? "lg:col-span-7" : "w-full")}
            >
              <ProfileMetricsGrid
                isOwner={isOwnerView}
                theme={theme}
                profile={displayedProfile}
                analytics={analytics}
                capabilities={capabilities}
                showCoins={false}
                onMetricPress={handleMetricPress}
              />
            </section>

            {canShowTreasury && (
              <section aria-label="Arvdoul Coins Treasury" className="min-w-0 lg:col-span-5">
                <div
                  className={cn(
                    "h-full rounded-[24px] border px-4 py-4 sm:px-5 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 transition-all duration-200 shadow-[0_10px_28px_rgba(0,0,0,0.10)]",
                    isDark
                      ? "bg-[#080F2E]/78 border-amber-300/25 text-white"
                      : "bg-white/75 border-amber-200/80 text-slate-900 shadow-[0_10px_28px_rgba(38,56,120,0.07)]"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-500 flex items-center justify-center shrink-0">
                      <Coins className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-500 dark:text-amber-400 truncate">
                        Coins Treasury
                      </p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg sm:text-xl font-bold tabular-nums">
                          {treasuryBalance !== null && !Number.isNaN(treasuryBalance) ? treasuryBalance.toLocaleString() : '—'}
                        </span>
                        <span className={cn("text-xs truncate", isDark ? "text-slate-400" : "text-slate-500")}>
                          Available
                        </span>
                      </div>
                    </div>
                  </div>

                  {isOwnerView && (
                    <button
                      type="button"
                      onClick={() => navigate('/coins')}
                      className={cn(
                        "min-h-[44px] px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer shrink-0",
                        isDark
                          ? "bg-amber-500/15 border-amber-400/30 text-amber-200 hover:bg-amber-500/25"
                          : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100",
                        FOCUS_RING
                      )}
                    >
                      <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Treasury</span>
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </section>
            )}
          </div>

          {showPrivateState ? (
            <section
              role="status"
              aria-label="Private content"
              className={cn("p-8 sm:p-12 rounded-3xl border text-center space-y-3", glass)}
            >
              <div
                className="w-14 h-14 mx-auto rounded-full text-arvdoul-purple flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${brandRgba(0.2)}, ${brandHexRgba(tokens.color.brand.blue, 0.2)})` }}
              >
                <Lock className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="text-base font-bold">This Account is Private</h3>
              <p className={cn("text-sm max-w-md mx-auto", isDark ? "text-slate-400" : "text-slate-600")}>
                Visitors in the {PERSPECTIVE_LABELS[viewAs] || viewAs} perspective cannot view private highlights, pinned posts, or the media gallery.
              </p>
              <button
                type="button"
                onClick={() => handleViewAsChange('owner')}
                className={cn(
                  "min-h-[44px] px-5 rounded-2xl font-bold text-sm text-white bg-arvdoul-gradient",
                  "hover:brightness-110 active:scale-[0.98] transition-all motion-reduce:transition-none cursor-pointer",
                  FOCUS_RING
                )}
              >
                Return to owner view
              </button>
            </section>
          ) : (
            <>
              {/* 03. Civic standing & Highlights command split */}
              <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12 lg:items-start">
                <section aria-label="Progression" className="min-w-0 lg:col-span-7">
                  <ProfileProgression
                    level={displayedProfile?.level}
                    experience={displayedProfile?.experience}
                    streak={displayedProfile?.activeStreak}
                    reputation={displayedProfile?.reputation}
                    showLevel={displayedProfile?.showLevel !== false}
                    showReputation={displayedProfile?.showReputation !== false}
                    showStreak={displayedProfile?.showStreak !== false}
                    isOwner={isOwnerView}
                    theme={theme}
                  />
                </section>

                <section aria-label="Story highlights" className="min-w-0 lg:col-span-5">
                  <ProfileHighlightsSection
                    highlights={highlights}
                    userId={currentUserId}
                    isOwner={isOwnerView}
                    managedByParent={true}
                    theme={theme}
                    onAddHighlight={() => {
                      if (isOwnerView) navigate('/profile/highlights?create=true');
                    }}
                  />
                </section>
              </div>

              {/* 04. Creator intelligence (owner perspective only, lazy-loaded for low-RAM startup) */}
              {isOwnerView && (
                <section aria-label="Creator dashboard" className="min-w-0">
                  <Suspense
                    fallback={
                      <div
                        className={cn(
                          "w-full h-36 rounded-[24px] border animate-pulse",
                          isDark ? "bg-white/[0.04] border-white/[0.08]" : "bg-white/60 border-slate-200/70"
                        )}
                      />
                    }
                  >
                    <ProfileCreatorDashboard
                      analytics={analytics}
                      ranking={ranking}
                      userLevel={effectiveProfile?.level ?? null}
                      isCreator={effectiveProfile?.isCreator}
                      theme={theme}
                      timeframe={timeframe}
                      onTimeframeChange={setTimeframe}
                    />
                  </Suspense>
                </section>
              )}

              {/* 05. Content hub */}
              <section aria-label="Profile content" className="min-w-0 space-y-4 sm:space-y-5">
                <div
                  className={cn(
                    "sticky top-0 z-30 rounded-[24px] border overflow-hidden shadow-[0_12px_30px_rgba(0,0,0,0.12)]",
                    glass
                  )}
                >
                  <ProfileTabsBar
                    activeTab={activeTab}
                    onTabChange={handleTabChange}
                    viewMode={viewMode}
                    onViewModeChange={handleViewModeChange}
                    isOwner={isOwnerView}
                    theme={theme}
                    counts={tabCounts}
                  />
                </div>

                {activeTab === 'posts' && (
                  <ProfilePinnedPosts
                    posts={posts}
                    profileId={currentUserId}
                    isOwner={isOwnerView}
                    theme={theme}
                    onPostClick={handlePostClick}
                    onViewAll={() => setActiveTab('posts')}
                  />
                )}

                <ProfileFeedGrid
                  posts={posts}
                  savedPosts={savedPosts}
                  stories={stories}
                  activeTab={activeTab}
                  viewMode={viewMode}
                  loading={postsLoading || savedLoading || (activeTab === 'stories' && storiesLoading)}
                  theme={theme}
                  profile={displayedProfile}
                  isOwner={isOwnerView}
                  onPostClick={handlePostClick}
                  hasMore={Boolean(postsCursor && postsHasMore)}
                  loadingMore={postsLoading}
                  onLoadMore={handleLoadMorePosts}
                />
              </section>
            </>
          )}
        </div>

        {/* 06. Secondary interfaces (mounted & fetched strictly on demand) */}
        {showPerspectiveModal && (
          <Suspense fallback={null}>
            <ProfilePerspectiveModal
              isOpen={showPerspectiveModal}
              onClose={() => setShowPerspectiveModal(false)}
              currentPerspective={viewAs}
              onSelectPerspective={handleViewAsChange}
              theme={theme}
            />
          </Suspense>
        )}

        {showQrModal && (
          <Suspense fallback={null}>
            <ProfileQRCodeModal
              isOpen={showQrModal}
              onClose={() => setShowQrModal(false)}
              profile={effectiveProfile}
              theme={theme}
            />
          </Suspense>
        )}

        {isOwnerView && showLocationModal && (
          <Suspense fallback={null}>
            <ProfileLocationModal
              isOpen={showLocationModal}
              onClose={() => setShowLocationModal(false)}
              currentLocation={effectiveProfile?.location}
              currentPrivacy={effectiveProfile?.locationPrivacy}
              userId={currentUserId}
              theme={theme}
              onLocationUpdated={reloadOwnerProfile}
            />
          </Suspense>
        )}

        {isOwnerView && showVerificationModal && (
          <Suspense fallback={null}>
            <ProfileVerificationModal
              isOpen={showVerificationModal}
              onClose={() => setShowVerificationModal(false)}
              isVerified={effectiveProfile.isVerified}
              profile={effectiveProfile}
              isOwner={isOwnerView}
              theme={theme}
              onVerificationSubmitted={reloadOwnerProfile}
            />
          </Suspense>
        )}

        {isOwnerView && showOptionsMenu && (
          <Suspense fallback={null}>
            <ProfileOptionsMenu
              profile={effectiveProfile}
              isOwner={isOwnerView}
              theme={theme}
              onOpenLocationSetup={openLocationSetup}
              onClose={() => setShowOptionsMenu(false)}
            />
          </Suspense>
        )}

        {isOwnerView && showAvatarModal && (
          <Suspense fallback={null}>
            <AvatarUploadModal
              isOpen={showAvatarModal}
              onClose={() => setShowAvatarModal(false)}
              onUpload={handleAvatarUpload}
              onRemoveAvatar={handleAvatarRemove}
              currentAvatarUrl={effectiveProfile?.photoURL}
              theme={theme}
            />
          </Suspense>
        )}

        {isOwnerView && quickEditField !== null && (
          <Suspense fallback={null}>
            <ProfileQuickEditModal
              isOpen={true}
              initialField={quickEditField}
              onClose={() => setQuickEditField(null)}
              profile={effectiveProfile}
              userId={currentUserId}
              theme={theme}
              onProfileUpdated={reloadOwnerProfile}
            />
          </Suspense>
        )}

        {/* Persistent banner for simulated view-as perspectives */}
        <ProfileViewAsBanner
          viewAs={viewAs}
          onViewAsChange={handleViewAsChange}
          onExit={() => handleViewAsChange('owner')}
        />
      </div>
    </ErrorBoundary>
  );
}
