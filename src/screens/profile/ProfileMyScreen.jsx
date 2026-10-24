/**
 * Arvdoul — Authenticated Owner Profile
 *
 * Production-oriented, mobile-first profile screen.
 *
 * Visual direction:
 * - Premium Arvdoul glassmorphism
 * - Electric violet/blue progression accents
 * - Gold level insignia
 * - Responsive mobile and desktop layouts
 * - Canonical light/dark theme support
 *
 * Integration requirements:
 * - Profile, progression, analytics, and wallet values must come from
 *   authenticated, authoritative application services.
 * - Authorization must be enforced by the backend and Firestore Rules.
 * - This component never awards XP, modifies coin balances, or determines
 *   rewards independently.
 *
 * Important: This component retains the existing profile component and
 * store contracts supplied in the original implementation. The dependent
 * services and components must still be validated against the repository
 * before this file can be certified as production-ready.
 */

import React, {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  Activity,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  Award,
  Bell,
  Check,
  ChevronRight,
  CircleHelp,
  Coins,
  Crown,
  Eye,
  Gift,
  Globe,
  Grid2X2,
  Image as ImageIcon,
  LayoutGrid,
  Link as LinkIcon,
  LoaderCircle,
  Lock,
  MapPin,
  Medal,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  X,
} from 'lucide-react';

import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';

import { useProfileStore } from '../../store/profileStore';
import { useAnalyticsStore } from '../../store/analyticsStore';
import { useAppStore } from '../../store/appStore';

import { cn } from '../../lib/utils';

import { ErrorBoundary } from '../../components/ErrorBoundary';

import { shareProfile } from '../../utils/shareUtils';

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
import ProfileOptionsMenu from '../../components/profile/ProfileOptionsMenu';

const AvatarUploadModal = lazy(
  () => import('../../components/profile/AvatarUploadModal')
);

const VIEW_MODES = new Set([
  'owner',
  'public',
  'follower',
  'connection',
]);

const PROFILE_TABS = [
  { id: 'posts', label: 'Posts', icon: Grid2X2 },
  { id: 'reels', label: 'Sparks', icon: Sparkles },
  { id: 'audio', label: 'Audio', icon: Activity },
  { id: 'saved', label: 'Saved', icon: Lock },
  { id: 'tagged', label: 'Tagged', icon: Users },
];

const DEFAULT_VIEW_MODE = 'grid';

function readViewMode() {
  if (typeof window === 'undefined') return DEFAULT_VIEW_MODE;

  try {
    const value = window.localStorage.getItem(
      'arvdoul_profile_view_mode'
    );

    return value === 'list' || value === 'grid'
      ? value
      : DEFAULT_VIEW_MODE;
  } catch {
    return DEFAULT_VIEW_MODE;
  }
}

function formatCount(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) return '0';

  return new Intl.NumberFormat(undefined, {
    notation: number >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(number);
}

function formatInteger(value) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) return '0';

  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(number);
}

function getPostCategory(post) {
  if (!post || typeof post !== 'object') return 'posts';

  const type = String(post.type || '').toLowerCase();

  if (
    type === 'reel' ||
    type === 'spark' ||
    post.isReel ||
    post.isSpark
  ) {
    return 'reels';
  }

  if (
    type === 'audio' ||
    type === 'track' ||
    type === 'music' ||
    post.audioURL ||
    post.audioUrl
  ) {
    return 'audio';
  }

  return 'posts';
}

function getPostId(post) {
  return post?.id || post?.postId || post?.documentId || null;
}

function getTaggedCount(posts) {
  return posts.filter(
    (post) =>
      Array.isArray(post?.taggedUsers) &&
      post.taggedUsers.length > 0
  ).length;
}

function safeErrorMessage(error, fallback) {
  const message =
    typeof error?.message === 'string'
      ? error.message.trim()
      : '';

  return message || fallback;
}

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const query = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    );

    const update = () => setReducedMotion(query.matches);

    update();
    query.addEventListener?.('change', update);

    return () => {
      query.removeEventListener?.('change', update);
    };
  }, []);

  return reducedMotion;
}

function GlassCard({
  children,
  className,
  theme,
  ...props
}) {
  return (
    <section
      {...props}
      className={cn(
        'rounded-[24px] border backdrop-blur-2xl',
        'transition-colors duration-200',
        theme === 'dark'
          ? 'border-white/[0.085] bg-white/[0.045] shadow-[0_12px_40px_rgba(0,0,0,0.16)]'
          : 'border-black/[0.07] bg-white/85 shadow-[0_12px_40px_rgba(15,23,42,0.045)]',
        className
      )}
    >
      {children}
    </section>
  );
}

function SectionHeading({
  title,
  subtitle,
  action,
  theme,
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2
          className={cn(
            'text-sm font-bold tracking-tight sm:text-base',
            theme === 'dark' ? 'text-white' : 'text-slate-950'
          )}
        >
          {title}
        </h2>

        {subtitle ? (
          <p
            className={cn(
              'mt-1 text-xs leading-5',
              theme === 'dark'
                ? 'text-white/50'
                : 'text-slate-500'
            )}
          >
            {subtitle}
          </p>
        ) : null}
      </div>

      {action}
    </div>
  );
}

function ProgressBar({
  value,
  theme,
  label,
}) {
  const safeValue = Math.max(
    0,
    Math.min(100, Number(value) || 0)
  );

  return (
    <div
      className="w-full"
      role="progressbar"
      aria-label={label || 'Level progression'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeValue)}
    >
      <div
        className={cn(
          'h-2 overflow-hidden rounded-full',
          theme === 'dark'
            ? 'bg-white/[0.09]'
            : 'bg-slate-200'
        )}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#8B1EF3] via-[#4431F7] to-[#055BFB] shadow-[0_0_16px_rgba(100,70,255,0.5)] motion-safe:transition-[width] motion-safe:duration-500"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

function LevelEmblem({ size = 'large' }) {
  const dimensions =
    size === 'small'
      ? 'h-12 w-12 rounded-2xl'
      : 'h-[76px] w-[76px] rounded-[26px]';

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center',
        'border border-amber-300/30',
        'bg-gradient-to-br from-[#4431F7]/90 via-[#8129D8]/90 to-[#F0A92E]/90',
        'shadow-[0_0_28px_rgba(139,30,243,0.24)]',
        dimensions
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-[5px] rounded-[inherit] border border-white/20" />

      <Crown
        className={cn(
          'relative text-amber-100 drop-shadow-[0_2px_10px_rgba(255,203,91,0.5)]',
          size === 'small' ? 'h-6 w-6' : 'h-9 w-9'
        )}
        strokeWidth={1.7}
      />
    </div>
  );
}

function LevelOverviewCard({
  theme,
  level,
  xp,
  nextLevelXp,
  title,
  rank,
  onOpenProgression,
}) {
  const currentXp = Number(xp);
  const targetXp = Number(nextLevelXp);

  const validXp =
    Number.isFinite(currentXp) && currentXp >= 0
      ? currentXp
      : null;

  const validTarget =
    Number.isFinite(targetXp) && targetXp > 0
      ? targetXp
      : null;

  const progress =
    validXp !== null && validTarget !== null
      ? Math.min(100, (validXp / validTarget) * 100)
      : null;

  const remaining =
    validXp !== null && validTarget !== null
      ? Math.max(0, validTarget - validXp)
      : null;

  return (
    <GlassCard
      theme={theme}
      className="relative overflow-hidden p-4 sm:p-5"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#8B1EF3]/15 blur-3xl"
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-[#055BFB]/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative">
        <div className="flex items-start gap-3">
          <LevelEmblem />

          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.19em] text-violet-400">
                Your progression
              </span>

              {rank ? (
                <span className="rounded-full border border-amber-400/20 bg-amber-400/[0.09] px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                  {String(rank)}
                </span>
              ) : null}
            </div>

            <h2
              className={cn(
                'mt-1 text-[25px] font-black tracking-tight sm:text-3xl',
                theme === 'dark' ? 'text-white' : 'text-slate-950'
              )}
            >
              Level {level ?? '—'}
            </h2>

            <p
              className={cn(
                'mt-0.5 text-sm font-semibold',
                theme === 'dark'
                  ? 'text-white/70'
                  : 'text-slate-600'
              )}
            >
              {title || 'Your journey continues'}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <p
                className={cn(
                  'text-sm font-bold tabular-nums',
                  theme === 'dark'
                    ? 'text-white'
                    : 'text-slate-950'
                )}
              >
                {validXp !== null
                  ? formatInteger(validXp)
                  : '—'}
                <span className="font-medium text-violet-400">
                  {' '}
                  XP
                </span>
              </p>

              <p
                className={cn(
                  'mt-1 text-[11px]',
                  theme === 'dark'
                    ? 'text-white/45'
                    : 'text-slate-500'
                )}
              >
                {validTarget !== null
                  ? `${formatInteger(validTarget)} XP required for the next level`
                  : 'Next-level requirement unavailable'}
              </p>
            </div>

            {progress !== null ? (
              <span className="text-sm font-bold tabular-nums text-violet-400">
                {Math.round(progress)}%
              </span>
            ) : null}
          </div>

          <ProgressBar
            value={progress ?? 0}
            theme={theme}
            label="Experience progress toward the next level"
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p
              className={cn(
                'text-[11px]',
                theme === 'dark'
                  ? 'text-white/45'
                  : 'text-slate-500'
              )}
            >
              {remaining !== null
                ? `${formatInteger(remaining)} XP remaining`
                : 'Progress details will appear when available'}
            </p>

            <button
              type="button"
              onClick={onOpenProgression}
              className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-xs font-bold text-violet-400 transition hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              View progression
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function ProfileMetric({
  icon: Icon,
  label,
  value,
  theme,
  onClick,
}) {
  const content = (
    <>
      <span
        className={cn(
          'mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-xl',
          theme === 'dark'
            ? 'bg-white/[0.055] text-violet-300'
            : 'bg-violet-50 text-violet-600'
        )}
      >
        <Icon size={17} strokeWidth={1.8} />
      </span>

      <span
        className={cn(
          'block text-base font-extrabold tabular-nums sm:text-lg',
          theme === 'dark' ? 'text-white' : 'text-slate-950'
        )}
      >
        {formatCount(value)}
      </span>

      <span
        className={cn(
          'mt-1 block text-[10px] font-medium sm:text-xs',
          theme === 'dark'
            ? 'text-white/45'
            : 'text-slate-500'
        )}
      >
        {label}
      </span>
    </>
  );

  if (!onClick) {
    return (
      <div className="min-w-0 px-1 py-3 text-center">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'min-w-0 rounded-2xl px-1 py-3 text-center',
        'transition hover:bg-violet-500/[0.07]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500'
      )}
      aria-label={`${label}: ${formatCount(value)}`}
    >
      {content}
    </button>
  );
}

function ProfileErrorPanel({
  theme,
  message,
  onRetry,
}) {
  return (
    <GlassCard
      theme={theme}
      className="p-5"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
          <CircleHelp size={20} />
        </div>

        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              'text-sm font-bold',
              theme === 'dark'
                ? 'text-white'
                : 'text-slate-950'
            )}
          >
            We couldn't refresh your profile
          </h2>

          <p
            className={cn(
              'mt-1 text-xs leading-5',
              theme === 'dark'
                ? 'text-white/55'
                : 'text-slate-500'
            )}
          >
            {message ||
              'Check your connection and try again.'}
          </p>

          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-600 px-3 text-xs font-bold text-white transition hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <RefreshCw size={14} />
            Try again
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

function OwnerProfileContent() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user: authContextUser } = useAuth();

  const reducedMotion = useReducedMotionPreference();

  const authStoreUser = useAppStore(
    (state) => state.currentUser
  );

  /*
   * The authenticated context is preferred. A cached store user is
   * useful for display only; it is not independent authentication proof.
   */
  const currentUser = authContextUser || authStoreUser || null;

  /*
   * Do not use localStorage or getStoredUid() to establish ownership.
   * The authenticated user's UID must be present.
   */
  const currentUserId =
    typeof authContextUser?.uid === 'string'
      ? authContextUser.uid
      : typeof authStoreUser?.uid === 'string' &&
          authContextUser
        ? authStoreUser.uid
        : null;

  const profile = useProfileStore(
    (state) => state.profile
  );

  const loading = useProfileStore(
    (state) => state.loading
  );

  const error = useProfileStore(
    (state) => state.error
  );

  const posts = useProfileStore(
    (state) => state.posts
  );

  const postsLoading = useProfileStore(
    (state) => state.postsLoading
  );

  const postsHasMore = useProfileStore(
    (state) => state.postsHasMore
  );

  const savedPosts = useProfileStore(
    (state) => state.savedPosts
  );

  const savedLoading = useProfileStore(
    (state) => state.savedLoading
  );

  const highlights = useProfileStore(
    (state) => state.highlights
  );

  const level = useProfileStore(
    (state) => state.level
  );

  const balance = useProfileStore(
    (state) => state.balance
  );

  const position = useProfileStore(
    (state) => state.position
  );

  const analytics = useAnalyticsStore(
    (state) => state.analytics
  );

  const analyticsLoading = useAnalyticsStore(
    (state) => state.loading
  );

  const timeframe = useAnalyticsStore(
    (state) => state.timeframe
  );

  const ranking = useAnalyticsStore(
    (state) => state.ranking
  );

  const setTimeframe = useAnalyticsStore(
    (state) => state.setTimeframe
  );

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showPerspectiveModal, setShowPerspectiveModal] = useState(false);
  const [showLevelDetails, setShowLevelDetails] = useState(false);

  const [activeTab, setActiveTab] = useState('posts');
  const [viewAs, setViewAs] = useState('owner');
  const [viewMode, setViewMode] = useState(readViewMode);

  const initialLoadStarted = useRef(false);
  const currentIdentityRef = useRef(currentUserId);

  const isDark = theme === 'dark';

  useEffect(() => {
    if (currentIdentityRef.current === currentUserId) {
      return;
    }

    currentIdentityRef.current = currentUserId;
    initialLoadStarted.current = false;

    setActiveTab('posts');
    setViewAs('owner');
    setRefreshError(null);
    setIsRefreshing(false);
    setShowAvatarModal(false);
    setShowQrModal(false);
    setShowScannerModal(false);
    setShowLocationModal(false);
    setShowOptionsMenu(false);
    setShowPerspectiveModal(false);
    setShowLevelDetails(false);
  }, [currentUserId]);

  const handleViewModeChange = useCallback((mode) => {
    if (mode !== 'grid' && mode !== 'list') return;

    setViewMode(mode);

    try {
      window.localStorage.setItem(
        'arvdoul_profile_view_mode',
        mode
      );
    } catch {
      // Storage is optional; the in-memory preference still works.
    }
  }, []);

  const handleViewAsChange = useCallback((mode) => {
    if (!VIEW_MODES.has(mode)) return;

    /*
     * This is a local preview selector, not a security boundary.
     * Do not let preview mode grant additional capabilities.
     */
    setViewAs(mode);
    setShowPerspectiveModal(false);
  }, []);

  const cleanUsername = useMemo(() => {
    const candidate = pickHandle([
      profile?.username,
      currentUser?.username,
    ]);

    if (candidate) return candidate;

    const fromDisplay = deriveHandle(
      currentUser?.displayName || profile?.displayName
    );

    if (
      fromDisplay &&
      !isPlaceholderHandle(fromDisplay)
    ) {
      return fromDisplay;
    }

    const fromEmail = deriveHandle(
      currentUser?.email || profile?.email
    );

    if (
      fromEmail &&
      !isPlaceholderHandle(fromEmail)
    ) {
      return fromEmail;
    }

    return 'citizen';
  }, [
    profile?.username,
    profile?.displayName,
    profile?.email,
    currentUser?.username,
    currentUser?.displayName,
    currentUser?.email,
  ]);

  /*
   * Username creation is intentionally not performed here.
   * Username allocation is a mutation that should be handled by an
   * idempotent, authenticated service or backend transaction.
   */
  const effectiveProfile = useMemo(() => {
    const safeDisplayName = pickDisplayName(
      [
        currentUser?.displayName,
        currentUser?.name,
        profile?.displayName,
        profile?.name,
      ],
      {
        fallback:
          deriveHandle(currentUser?.email) || 'Citizen',
      }
    );

    const safeBio =
      typeof profile?.bio === 'string'
        ? profile.bio.trim()
        : typeof currentUser?.bio === 'string'
          ? currentUser.bio.trim()
          : '';

    const safeLocation =
      typeof profile?.location === 'string'
        ? profile.location
        : typeof currentUser?.location === 'string'
          ? currentUser.location
          : '';

    const safeWebsite =
      typeof profile?.website === 'string'
        ? profile.website
        : typeof currentUser?.website === 'string'
          ? currentUser.website
          : '';

    const safeLevel = resolveLevelValue(
      level,
      profile?.level,
      currentUser?.level
    );

    const source =
      profile && typeof profile === 'object'
        ? profile
        : {};

    return {
      ...source,

      id:
        source.id ||
        source.uid ||
        currentUserId ||
        undefined,

      uid:
        source.uid ||
        source.id ||
        currentUserId ||
        undefined,

      username: cleanUsername,
      displayName: safeDisplayName,
      bio: safeBio,
      location: safeLocation,
      website: safeWebsite,

      level: safeLevel,

      photoURL: resolveAvatarUrl(
        source.photoURL ||
          source.profilePicture ||
          currentUser?.photoURL ||
          currentUser?.profilePicture,
        safeDisplayName,
        currentUserId
      ),

      followerCount: resolveCount(
        source.followerCount,
        source.followersCount,
        currentUser?.followerCount
      ),

      followingCount: resolveCount(
        source.followingCount,
        source.followersFollowingCount,
        currentUser?.followingCount
      ),

      postCount: resolveCount(
        source.postCount,
        posts?.length
      ),

      /*
       * This value is display-only. The canonical wallet store or
       * server response must remain the source of truth.
       */
      coins: resolveCount(
        balance,
        source.coinBalance,
        source.coins
      ),

      isVerified:
        resolveVerifiedFlag(source) ||
        Boolean(currentUser?.isVerified),

      isCreator: resolveCreatorFlag(
        source,
        currentUser,
        safeLevel
      ),
    };
  }, [
    profile,
    cleanUsername,
    currentUser,
    currentUserId,
    posts?.length,
    balance,
    level,
  ]);

  /*
   * A preview must never be considered the authenticated owner
   * for capability resolution.
   */
  const capabilities = useMemo(() => {
    return resolveCapabilities({
      viewer: currentUser,
      target: effectiveProfile,

      relationship: {
        isOwner: viewAs === 'owner',
        isFollowing:
          viewAs === 'follower' ||
          viewAs === 'connection',
        isFollower:
          viewAs === 'follower' ||
          viewAs === 'connection',
        isMutualFriend: viewAs === 'connection',
      },

      viewAs:
        viewAs === 'owner'
          ? null
          : viewAs,
    });
  }, [
    currentUser,
    effectiveProfile,
    viewAs,
  ]);

  /*
   * Load profile resources once per identity. Analytics are refreshed
   * independently when the selected timeframe changes.
   */
  useEffect(() => {
    if (!currentUserId) return undefined;
    if (initialLoadStarted.current) return undefined;

    initialLoadStarted.current = true;

    let cancelled = false;

    const loadInitialData = async () => {
      const store = useProfileStore.getState();

      const tasks = [
        store.loadProfile(currentUserId, currentUserId),
        store.loadHighlights(currentUserId),
        store.loadLevel(currentUserId),
        store.loadBalance(currentUserId),
        store.loadPosition(currentUserId),
        store.loadPosts(currentUserId),
      ];

      const results = await Promise.allSettled(tasks);

      if (cancelled) return;

      const failures = results.filter(
        (result) => result.status === 'rejected'
      );

      if (failures.length > 0) {
        console.error(
          'Arvdoul profile initialization had failed operations:',
          failures.map((result) => result.reason)
        );
      }
    };

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId) return undefined;

    let cancelled = false;

    const loadAnalytics = async () => {
      try {
        await useAnalyticsStore
          .getState()
          .loadAnalytics(currentUserId, timeframe);
      } catch (loadError) {
        if (!cancelled) {
          console.error(
            'Failed to load profile analytics:',
            loadError
          );
        }
      }
    };

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, timeframe]);

  const handleTabChange = useCallback(
    async (tab) => {
      if (!PROFILE_TABS.some((item) => item.id === tab)) {
        return;
      }

      setActiveTab(tab);

      if (
        tab === 'saved' &&
        currentUserId &&
        (!Array.isArray(savedPosts) ||
          savedPosts.length === 0)
      ) {
        try {
          await useProfileStore
            .getState()
            .loadSavedPosts(currentUserId);
        } catch (loadError) {
          toast.error(
            safeErrorMessage(
              loadError,
              'Could not load saved posts.'
            )
          );
        }
      }
    },
    [currentUserId, savedPosts]
  );

  const handleRefresh = useCallback(async () => {
    if (!currentUserId || isRefreshing) return;

    setIsRefreshing(true);
    setRefreshError(null);

    try {
      const results = await Promise.allSettled([
        useProfileStore
          .getState()
          .loadProfile(currentUserId, currentUserId),

        useProfileStore
          .getState()
          .loadHighlights(currentUserId),

        useProfileStore
          .getState()
          .loadLevel(currentUserId),

        useProfileStore
          .getState()
          .loadBalance(currentUserId),

        useProfileStore
          .getState()
          .loadPosition(currentUserId),

        useProfileStore
          .getState()
          .loadPosts(currentUserId),

        useAnalyticsStore
          .getState()
          .loadAnalytics(currentUserId, timeframe),
      ]);

      const failures = results.filter(
        (result) => result.status === 'rejected'
      );

      if (failures.length > 0) {
        setRefreshError(
          'Some profile information could not be refreshed. Retry to load the missing information.'
        );

        toast.error(
          'Some profile information could not be refreshed.'
        );

        console.error(
          'Arvdoul profile refresh failures:',
          failures.map((result) => result.reason)
        );

        return;
      }

      toast.success('Profile refreshed.');
    } catch (refreshError) {
      setRefreshError(
        safeErrorMessage(
          refreshError,
          'Unable to refresh your profile.'
        )
      );

      toast.error('Unable to refresh your profile.');
    } finally {
      setIsRefreshing(false);
    }
  }, [
    currentUserId,
    timeframe,
    isRefreshing,
  ]);

  const handleShare = useCallback(async () => {
    if (!currentUserId) {
      toast.error('Sign in to share your profile.');
      return;
    }

    try {
      const result = await shareProfile({
        ...effectiveProfile,
        id: currentUserId,
        uid: currentUserId,
        username: cleanUsername,
      });

      if (result?.copied) {
        toast.success('Profile link copied.');
      } else if (result?.shared) {
        toast.success('Profile shared.');
      }
    } catch (shareError) {
      toast.error(
        safeErrorMessage(
          shareError,
          'Could not share your profile.'
        )
      );
    }
  }, [
    currentUserId,
    effectiveProfile,
    cleanUsername,
  ]);

  useEffect(() => {
    const handleQrEvent = () => setShowQrModal(true);
    const handlePerspectiveEvent = () =>
      setShowPerspectiveModal(true);
    const handleShareEvent = () => void handleShare();
    const handleOptionsEvent = () =>
      setShowOptionsMenu(true);

    window.addEventListener(
      'arvdoul:open_qr_code',
      handleQrEvent
    );

    window.addEventListener(
      'arvdoul:open_perspective_modal',
      handlePerspectiveEvent
    );

    window.addEventListener(
      'arvdoul:share_profile',
      handleShareEvent
    );

    window.addEventListener(
      'arvdoul:open_profile_options',
      handleOptionsEvent
    );

    return () => {
      window.removeEventListener(
        'arvdoul:open_qr_code',
        handleQrEvent
      );

      window.removeEventListener(
        'arvdoul:open_perspective_modal',
        handlePerspectiveEvent
      );

      window.removeEventListener(
        'arvdoul:share_profile',
        handleShareEvent
      );

      window.removeEventListener(
        'arvdoul:open_profile_options',
        handleOptionsEvent
      );
    };
  }, [handleShare]);

  const safePosts = useMemo(
    () => (Array.isArray(posts) ? posts : []),
    [posts]
  );

  const safeSavedPosts = useMemo(
    () =>
      Array.isArray(savedPosts)
        ? savedPosts
        : [],
    [savedPosts]
  );

  const counts = useMemo(
    () => ({
      posts: safePosts.filter(
        (post) => getPostCategory(post) === 'posts'
      ).length,

      reels: safePosts.filter(
        (post) => getPostCategory(post) === 'reels'
      ).length,

      audio: safePosts.filter(
        (post) => getPostCategory(post) === 'audio'
      ).length,

      saved: safeSavedPosts.length,

      tagged: getTaggedCount(safePosts),
    }),
    [safePosts, safeSavedPosts]
  );

  const currentLevel = level ?? effectiveProfile.level;

  /*
   * Only use XP and threshold values actually exposed by the canonical
   * level/profile data. Missing data remains unavailable instead of
   * displaying fabricated progression.
   */
  const currentXp =
    typeof profile?.experience === 'number'
      ? profile.experience
      : typeof profile?.xp === 'number'
        ? profile.xp
        : typeof level?.experience === 'number'
          ? level.experience
          : typeof level?.xp === 'number'
            ? level.xp
            : null;

  const nextLevelXp =
    typeof level?.nextLevelXp === 'number'
      ? level.nextLevelXp
      : typeof level?.nextLevelThreshold === 'number'
        ? level.nextLevelThreshold
        : typeof profile?.nextLevelXp === 'number'
          ? profile.nextLevelXp
          : null;

  const levelTitle =
    level?.title ||
    level?.name ||
    profile?.levelTitle ||
    profile?.rankTitle ||
    null;

  const currentRank =
    position?.title ||
    position?.name ||
    position?.rank ||
    ranking?.title ||
    null;

  const onMetricPress = useCallback(
    (key) => {
      if (!currentUserId) return;

      switch (key) {
        case 'followers':
          navigate(
            `/profile/${encodeURIComponent(currentUserId)}/followers`
          );
          break;

        case 'following':
          navigate(
            `/profile/${encodeURIComponent(currentUserId)}/following`
          );
          break;

        case 'friends':
          navigate(
            `/profile/${encodeURIComponent(currentUserId)}/friends`
          );
          break;

        case 'coins':
          navigate('/coins');
          break;

        case 'posts':
          setActiveTab('posts');
          break;

        case 'reputation':
          navigate('/passport');
          break;

        default:
          break;
      }
    },
    [currentUserId, navigate]
  );

  const isInitialLoading =
    loading &&
    !profile &&
    !currentUser;

  if (!currentUserId) {
    return (
      <main
        className={cn(
          'flex min-h-[70vh] items-center justify-center px-5',
          isDark
            ? 'bg-[#03071B] text-white'
            : 'bg-[#F6F8FC] text-slate-950'
        )}
      >
        <GlassCard
          theme={theme}
          className="w-full max-w-md p-6 text-center"
        >
          <ShieldCheck
            size={34}
            className="mx-auto text-violet-400"
          />

          <h1 className="mt-4 text-lg font-bold">
            Sign in to view your profile
          </h1>

          <p
            className={cn(
              'mt-2 text-sm leading-6',
              isDark
                ? 'text-white/55'
                : 'text-slate-500'
            )}
          >
            Your profile, progression, and wallet are available
            after authentication.
          </p>

          <button
            type="button"
            onClick={() => navigate('/login')}
            className="mt-5 min-h-11 rounded-xl bg-gradient-to-r from-[#8B1EF3] via-[#4431F7] to-[#055BFB] px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            Sign in
          </button>
        </GlassCard>
      </main>
    );
  }

  if (isInitialLoading) {
    return (
      <main
        className={cn(
          'min-h-screen pb-28',
          isDark
            ? 'bg-[#03071B]'
            : 'bg-[#F6F8FC]'
        )}
      >
        <ProfileSkeleton theme={theme} />
      </main>
    );
  }

  return (
    <main
      className={cn(
        'min-h-screen overflow-x-clip pb-[calc(7.5rem+env(safe-area-inset-bottom))]',
        'transition-colors duration-200',
        isDark
          ? 'bg-[#03071B] text-white selection:bg-violet-500/30'
          : 'bg-[#F6F8FC] text-slate-950 selection:bg-violet-500/20'
      )}
    >
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-80 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[#8B1EF3]/10 blur-[90px]" />
        <div className="absolute -right-24 top-0 h-64 w-64 rounded-full bg-[#055BFB]/10 blur-[90px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-3 pt-3 sm:px-5 sm:pt-5 lg:px-8">
        <header className="mb-4 flex min-h-12 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-400/20 bg-gradient-to-br from-violet-500/20 to-blue-500/10">
              <Crown
                size={19}
                className="text-violet-400"
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-[0.13em]">
                ARVDOUL
              </p>

              <p
                className={cn(
                  'truncate text-[10px]',
                  isDark
                    ? 'text-white/45'
                    : 'text-slate-500'
                )}
              >
                Your identity. Your progression.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              aria-label="Refresh profile"
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl border transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                isDark
                  ? 'border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.09]'
                  : 'border-black/[0.07] bg-white/80 text-slate-600 hover:bg-white',
                isRefreshing && 'cursor-wait opacity-60'
              )}
            >
              {isRefreshing ? (
                <LoaderCircle
                  size={17}
                  className="animate-spin"
                />
              ) : (
                <RefreshCw size={17} />
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/settings')}
              aria-label="Settings"
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl border transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                isDark
                  ? 'border-white/[0.08] bg-white/[0.04] text-white/75 hover:bg-white/[0.09]'
                  : 'border-black/[0.07] bg-white/80 text-slate-600 hover:bg-white'
              )}
            >
              <Settings size={17} />
            </button>
          </div>
        </header>

        {refreshError ? (
          <div className="mb-4">
            <ProfileErrorPanel
              theme={theme}
              message={refreshError}
              onRetry={() => void handleRefresh()}
            />
          </div>
        ) : null}

        {error && !profile ? (
          <div className="mb-4">
            <ProfileErrorPanel
              theme={theme}
              message={
                typeof error === 'string'
                  ? error
                  : error?.message
              }
              onRetry={() => void handleRefresh()}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12 lg:gap-7">
          <div className="min-w-0 space-y-5 lg:col-span-5">
            <GlassCard
              theme={theme}
              className="relative overflow-hidden"
            >
              <div
                className="relative h-28 overflow-hidden sm:h-36"
                aria-hidden="true"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#8B1EF3]/65 via-[#4431F7]/35 to-[#055BFB]/60" />

                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_30%,rgba(255,255,255,0.18),transparent_35%),radial-gradient(ellipse_at_85%_80%,rgba(255,255,255,0.12),transparent_35%)]" />

                <div className="absolute -right-8 -top-20 h-52 w-52 rounded-full border border-white/10" />

                <div className="absolute -right-2 -top-14 h-44 w-44 rounded-full border border-white/10" />

                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />
              </div>

              <div className="px-4 pb-5 sm:px-5">
                <div className="-mt-11 flex items-end justify-between gap-3 sm:-mt-12">
                  <button
                    type="button"
                    onClick={() => setShowAvatarModal(true)}
                    aria-label="Update profile picture"
                    className="group relative h-[92px] w-[92px] shrink-0 rounded-[28px] border-[4px] border-[#03071B] bg-gradient-to-br from-[#8B1EF3] via-[#4431F7] to-[#055BFB] p-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 sm:h-[100px] sm:w-[100px]"
                  >
                    <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-[21px] bg-slate-900">
                      {effectiveProfile.photoURL ? (
                        <img
                          src={effectiveProfile.photoURL}
                          alt={`${effectiveProfile.displayName}'s profile`}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-3xl font-black text-white">
                          {(
                            effectiveProfile.displayName?.[0] ||
                            'A'
                          ).toUpperCase()}
                        </span>
                      )}
                    </span>

                    <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-[#03071B] bg-violet-600 text-white">
                      <Plus size={14} />
                    </span>
                  </button>

                  <div className="mb-1 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/profile/edit')}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-violet-400/25 bg-violet-500/[0.09] px-3 text-xs font-bold text-violet-400 transition hover:bg-violet-500/[0.16] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      Edit profile
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleShare()}
                      aria-label="Share profile"
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl border transition',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                        isDark
                          ? 'border-white/[0.09] bg-white/[0.04] text-white/75 hover:bg-white/[0.09]'
                          : 'border-black/[0.07] bg-white text-slate-600 hover:bg-slate-50'
                      )}
                    >
                      <Share2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1
                      className={cn(
                        'max-w-full break-words text-xl font-black tracking-tight sm:text-2xl',
                        isDark
                          ? 'text-white'
                          : 'text-slate-950'
                      )}
                    >
                      {effectiveProfile.displayName}
                    </h1>

                    {effectiveProfile.isVerified ? (
                      <ShieldCheck
                        size={19}
                        className="shrink-0 text-sky-400"
                        aria-label="Verified account"
                      />
                    ) : null}
                  </div>

                  <p
                    className={cn(
                      'mt-1 text-xs',
                      isDark
                        ? 'text-white/50'
                        : 'text-slate-500'
                    )}
                  >
                    @{cleanUsername}
                  </p>

                  {effectiveProfile.bio ? (
                    <p
                      className={cn(
                        'mt-3 whitespace-pre-wrap break-words text-sm leading-6',
                        isDark
                          ? 'text-white/75'
                          : 'text-slate-600'
                      )}
                    >
                      {effectiveProfile.bio}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigate('/profile/edit')}
                      className="mt-3 text-left text-xs font-medium text-violet-400 hover:underline"
                    >
                      Add a bio to introduce yourself.
                    </button>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    {effectiveProfile.location ? (
                      <span
                        className={cn(
                          'inline-flex min-w-0 items-center gap-1.5 text-xs',
                          isDark
                            ? 'text-white/55'
                            : 'text-slate-500'
                        )}
                      >
                        <MapPin
                          size={13}
                          className="shrink-0"
                        />
                        <span className="break-words">
                          {effectiveProfile.location}
                        </span>
                      </span>
                    ) : null}

                    {effectiveProfile.website ? (
                      <span
                        className={cn(
                          'inline-flex min-w-0 items-center gap-1.5 text-xs',
                          isDark
                            ? 'text-white/55'
                            : 'text-slate-500'
                        )}
                      >
                        <Globe
                          size={13}
                          className="shrink-0"
                        />
                        <span className="break-all">
                          {effectiveProfile.website}
                        </span>
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {effectiveProfile.isCreator ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-2.5 py-1 text-[10px] font-bold text-amber-500">
                        <Crown size={12} />
                        Creator
                      </span>
                    ) : null}

                    {currentRank ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-500/[0.08] px-2.5 py-1 text-[10px] font-bold text-violet-400">
                        <Medal size={12} />
                        {String(currentRank)}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div
                  className={cn(
                    'mt-5 grid grid-cols-3 divide-x rounded-2xl border',
                    isDark
                      ? 'divide-white/[0.07] border-white/[0.07] bg-black/10'
                      : 'divide-black/[0.06] border-black/[0.06] bg-slate-50/70'
                  )}
                >
                  <ProfileMetric
                    icon={ImageIcon}
                    label="Posts"
                    value={effectiveProfile.postCount}
                    theme={theme}
                    onClick={() => onMetricPress('posts')}
                  />

                  <ProfileMetric
                    icon={Users}
                    label="Followers"
                    value={effectiveProfile.followerCount}
                    theme={theme}
                    onClick={() => onMetricPress('followers')}
                  />

                  <ProfileMetric
                    icon={ArrowDownRight}
                    label="Following"
                    value={effectiveProfile.followingCount}
                    theme={theme}
                    onClick={() => onMetricPress('following')}
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onMetricPress('coins')}
                    className={cn(
                      'flex min-h-[66px] items-center gap-3 rounded-2xl border p-3 text-left transition',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400',
                      isDark
                        ? 'border-amber-300/15 bg-amber-400/[0.045] hover:bg-amber-400/[0.09]'
                        : 'border-amber-400/20 bg-amber-50/70 hover:bg-amber-50'
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300/25 to-orange-500/10 text-amber-500">
                      <Coins size={20} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-sm font-black tabular-nums',
                          isDark
                            ? 'text-white'
                            : 'text-slate-950'
                        )}
                      >
                        {formatInteger(
                          effectiveProfile.coins
                        )}
                      </span>

                      <span
                        className={cn(
                          'mt-0.5 block text-[10px]',
                          isDark
                            ? 'text-white/50'
                            : 'text-slate-500'
                        )}
                      >
                        Coin balance
                      </span>
                    </span>

                    <ChevronRight
                      size={15}
                      className="shrink-0 text-amber-500"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/passport')}
                    className={cn(
                      'flex min-h-[66px] items-center gap-3 rounded-2xl border p-3 text-left transition',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
                      isDark
                        ? 'border-violet-400/15 bg-violet-500/[0.045] hover:bg-violet-500/[0.09]'
                        : 'border-violet-400/20 bg-violet-50/70 hover:bg-violet-50'
                    )}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
                      <Trophy size={20} />
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block truncate text-sm font-black',
                          isDark
                            ? 'text-white'
                            : 'text-slate-950'
                        )}
                      >
                        {currentLevel ?? '—'}
                      </span>

                      <span
                        className={cn(
                          'mt-0.5 block text-[10px]',
                          isDark
                            ? 'text-white/50'
                            : 'text-slate-500'
                        )}
                      >
                        Current level
                      </span>
                    </span>

                    <ChevronRight
                      size={15}
                      className="shrink-0 text-violet-400"
                    />
                  </button>
                </div>
              </div>
            </GlassCard>

            <LevelOverviewCard
              theme={theme}
              level={currentLevel}
              xp={currentXp}
              nextLevelXp={nextLevelXp}
              title={levelTitle}
              rank={currentRank}
              onOpenProgression={() =>
                setShowLevelDetails(true)
              }
            />

            {viewAs === 'owner' ? (
              <ProfileCreatorDashboard
                analytics={analytics}
                ranking={ranking}
                userLevel={currentLevel ?? null}
                userXp={currentXp ?? 0}
                isCreator={effectiveProfile.isCreator}
                theme={theme}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
              />
            ) : null}
          </div>

          <div className="min-w-0 space-y-5 lg:col-span-7">
            <GlassCard
              theme={theme}
              className="p-4 sm:p-5"
            >
              <SectionHeading
                theme={theme}
                title="Your Arvdoul journey"
                subtitle="Explore your profile, progression, and milestones."
                action={
                  <button
                    type="button"
                    onClick={() =>
                      setShowLevelDetails(true)
                    }
                    className="inline-flex min-h-9 items-center gap-1 rounded-xl px-2 text-xs font-bold text-violet-400 transition hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  >
                    Details
                    <ArrowRight size={14} />
                  </button>
                }
              />

              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {[
                  {
                    label: 'Progression',
                    description: 'Level and XP',
                    icon: TrendingUp,
                    action: () => setShowLevelDetails(true),
                  },
                  {
                    label: 'Rewards',
                    description: 'Available rewards',
                    icon: Gift,
                    action: () => navigate('/levels/rewards'),
                  },
                  {
                    label: 'Rank',
                    description: 'Your position',
                    icon: Trophy,
                    action: () => navigate('/passport'),
                  },
                  {
                    label: 'Benefits',
                    description: 'Unlocked features',
                    icon: Award,
                    action: () => navigate('/levels/benefits'),
                  },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={item.action}
                      className={cn(
                        'min-w-0 rounded-2xl border p-3 text-left transition',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                        isDark
                          ? 'border-white/[0.07] bg-white/[0.025] hover:border-violet-400/30 hover:bg-violet-500/[0.06]'
                          : 'border-black/[0.06] bg-white/70 hover:border-violet-300 hover:bg-violet-50/70'
                      )}
                    >
                      <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-blue-500/10 text-violet-400">
                        <Icon size={18} />
                      </span>

                      <span
                        className={cn(
                          'block truncate text-xs font-bold',
                          isDark
                            ? 'text-white'
                            : 'text-slate-900'
                        )}
                      >
                        {item.label}
                      </span>

                      <span
                        className={cn(
                          'mt-1 block text-[10px] leading-4',
                          isDark
                            ? 'text-white/45'
                            : 'text-slate-500'
                        )}
                      >
                        {item.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </GlassCard>

            <ProfileHighlightsSection
              highlights={highlights}
              userId={currentUserId}
              isOwner={viewAs === 'owner'}
              theme={theme}
              onAddHighlight={() =>
                navigate('/profile/highlights?create=true')
              }
            />

            <ProfilePinnedPosts
              posts={safePosts}
              theme={theme}
              onPostClick={(post) => {
                const id = getPostId(post);

                if (id) {
                  navigate(`/post/${encodeURIComponent(id)}`);
                }
              }}
            />

            <GlassCard
              theme={theme}
              className="min-w-0 overflow-hidden"
            >
              <div className="px-3 pt-3 sm:px-4 sm:pt-4">
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <div>
                    <h2 className="text-sm font-bold">
                      Your content
                    </h2>

                    <p
                      className={cn(
                        'mt-1 text-[11px]',
                        isDark
                          ? 'text-white/45'
                          : 'text-slate-500'
                      )}
                    >
                      Your posts and creative work.
                    </p>
                  </div>

                  {viewAs === 'owner' ? (
                    <button
                      type="button"
                      onClick={() => navigate('/create')}
                      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#8B1EF3] via-[#4431F7] to-[#055BFB] px-3 text-xs font-bold text-white shadow-[0_4px_20px_rgba(100,50,255,0.2)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                    >
                      <Plus size={15} />
                      Create
                    </button>
                  ) : null}
                </div>

                <div
                  className={cn(
                    'flex items-center gap-1 overflow-x-auto border-b px-1',
                    'scrollbar-none',
                    isDark
                      ? 'border-white/[0.07]'
                      : 'border-black/[0.07]'
                  )}
                  role="tablist"
                  aria-label="Profile content categories"
                >
                  {PROFILE_TABS.filter(
                    (tab) =>
                      tab.id !== 'saved' ||
                      viewAs === 'owner'
                  ).map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() =>
                          void handleTabChange(tab.id)
                        }
                        className={cn(
                          'relative flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-xs font-semibold transition',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500',
                          active
                            ? 'text-violet-400'
                            : isDark
                              ? 'text-white/45 hover:text-white/80'
                              : 'text-slate-500 hover:text-slate-900'
                        )}
                      >
                        <Icon size={14} />

                        {tab.label}

                        <span
                          className={cn(
                            'ml-0.5 text-[10px] tabular-nums',
                            active
                              ? 'text-violet-400'
                              : isDark
                                ? 'text-white/35'
                                : 'text-slate-400'
                          )}
                        >
                          {formatCount(
                            counts[tab.id] ?? 0
                          )}
                        </span>

                        {active ? (
                          <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-[#8B1EF3] to-[#055BFB]" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-3 py-3">
                  <p
                    className={cn(
                      'text-[11px]',
                      isDark
                        ? 'text-white/45'
                        : 'text-slate-500'
                    )}
                  >
                    {activeTab === 'saved'
                      ? 'Your saved content'
                      : activeTab === 'tagged'
                        ? 'Content you are tagged in'
                        : activeTab === 'reels'
                          ? 'Short-form video and Sparks'
                          : activeTab === 'audio'
                            ? 'Your audio and music'
                            : 'Your published content'}
                  </p>

                  <div
                    className={cn(
                      'flex shrink-0 items-center rounded-xl border p-0.5',
                      isDark
                        ? 'border-white/[0.07] bg-black/10'
                        : 'border-black/[0.07] bg-slate-50'
                    )}
                    aria-label="Content layout"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        handleViewModeChange('grid')
                      }
                      aria-label="Grid view"
                      aria-pressed={viewMode === 'grid'}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                        viewMode === 'grid'
                          ? 'bg-violet-500/15 text-violet-400'
                          : isDark
                            ? 'text-white/45'
                            : 'text-slate-500'
                      )}
                    >
                      <LayoutGrid size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleViewModeChange('list')
                      }
                      aria-label="List view"
                      aria-pressed={viewMode === 'list'}
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                        viewMode === 'list'
                          ? 'bg-violet-500/15 text-violet-400'
                          : isDark
                            ? 'text-white/45'
                            : 'text-slate-500'
                      )}
                    >
                      <MoreHorizontal size={17} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-w-0 px-3 pb-4 sm:px-4">
                <ProfileFeedGrid
                  posts={safePosts}
                  savedPosts={safeSavedPosts}
                  activeTab={activeTab}
                  viewMode={viewMode}
                  loading={
                    postsLoading ||
                    (activeTab === 'saved' && savedLoading)
                  }
                  theme={theme}
                  profile={effectiveProfile}
                  isOwner={viewAs === 'owner'}
                  onPostClick={(post) => {
                    const id = getPostId(post);

                    if (id) {
                      navigate(
                        `/post/${encodeURIComponent(id)}`
                      );
                    }
                  }}
                />

                {!postsLoading &&
                activeTab !== 'saved' &&
                postsHasMore ? (
                  <button
                    type="button"
                    onClick={() => {
                      toast.info(
                        'Load-more support must be connected to the profile store pagination API.'
                      );
                    }}
                    className={cn(
                      'mt-3 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border text-xs font-bold transition',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                      isDark
                        ? 'border-white/[0.08] text-white/70 hover:bg-white/[0.04]'
                        : 'border-black/[0.07] text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    View more
                    <ChevronRight size={15} />
                  </button>
                ) : null}
              </div>
            </GlassCard>

            {analyticsLoading ? (
              <p
                className={cn(
                  'flex items-center justify-center gap-2 py-2 text-xs',
                  isDark
                    ? 'text-white/45'
                    : 'text-slate-500'
                )}
              >
                <LoaderCircle
                  size={14}
                  className="animate-spin"
                />
                Updating analytics…
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {viewAs !== 'owner' ? (
        <div className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-2 rounded-2xl border border-violet-400/25 bg-[#090D20]/95 px-3 py-2.5 text-white shadow-[0_12px_45px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <Eye
            size={17}
            className="shrink-0 text-amber-400"
          />

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold">
              Preview mode
            </p>

            <p className="mt-0.5 truncate text-[10px] text-white/55">
              {viewAs === 'public'
                ? 'Public visitor perspective'
                : viewAs === 'follower'
                  ? 'Follower perspective'
                  : 'Connection perspective'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => handleViewAsChange('owner')}
            className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl bg-violet-600 px-3 text-[11px] font-bold text-white transition hover:bg-violet-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            <X size={13} />
            Exit
          </button>
        </div>
      ) : null}

      <ProfilePerspectiveModal
        isOpen={showPerspectiveModal}
        onClose={() => setShowPerspectiveModal(false)}
        currentPerspective={viewAs}
        onSelectPerspective={handleViewAsChange}
        theme={theme}
      />

      <ProfileQRCodeModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        profile={effectiveProfile}
        theme={theme}
      />

      {showScannerModal ? (
        <ProfileQRScannerModal
          isOpen={showScannerModal}
          onClose={() => setShowScannerModal(false)}
          theme={theme}
        />
      ) : null}

      {showLocationModal ? (
        <ProfileLocationModal
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          currentLocation={effectiveProfile.location}
          userId={currentUserId}
          theme={theme}
          onLocationUpdated={() => {
            void useProfileStore
              .getState()
              .loadProfile(currentUserId, currentUserId);
          }}
        />
      ) : null}

      {showOptionsMenu ? (
        <ProfileOptionsMenu
          profile={effectiveProfile}
          isOwner={viewAs === 'owner'}
          theme={theme}
          onClose={() => setShowOptionsMenu(false)}
        />
      ) : null}

      {showAvatarModal ? (
        <Suspense
          fallback={
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
              role="status"
              aria-live="polite"
            >
              <LoaderCircle
                size={28}
                className="animate-spin text-violet-400"
              />
              <span className="sr-only">
                Loading avatar editor
              </span>
            </div>
          }
        >
          <AvatarUploadModal
            isOpen={showAvatarModal}
            onClose={() => setShowAvatarModal(false)}
            currentAvatarUrl={effectiveProfile.photoURL}
            theme={theme}
            onUpload={async (croppedFile) => {
              if (!currentUserId) {
                toast.error('Your session has expired.');
                return;
              }

              if (!(croppedFile instanceof Blob)) {
                toast.error('Select a valid image file.');
                return;
              }

              const toastId = toast.loading(
                'Uploading profile picture…'
              );

              try {
                const { getUserService } = await import(
                  '../../services/userService.js'
                );

                await getUserService().uploadAvatar(
                  currentUserId,
                  croppedFile
                );

                await useProfileStore
                  .getState()
                  .loadProfile(
                    currentUserId,
                    currentUserId
                  );

                toast.success(
                  'Profile picture updated.',
                  { id: toastId }
                );

                setShowAvatarModal(false);
              } catch (uploadError) {
                toast.error(
                  safeErrorMessage(
                    uploadError,
                    'Failed to upload profile picture.'
                  ),
                  { id: toastId }
                );

                throw uploadError;
              }
            }}
            onRemoveAvatar={async () => {
              if (!currentUserId) {
                toast.error('Your session has expired.');
                return;
              }

              const toastId = toast.loading(
                'Removing profile picture…'
              );

              try {
                const { getUserService } = await import(
                  '../../services/userService.js'
                );

                await getUserService().updateUserProfile(
                  currentUserId,
                  { photoURL: '' }
                );

                await useProfileStore
                  .getState()
                  .loadProfile(
                    currentUserId,
                    currentUserId
                  );

                toast.success(
                  'Profile picture removed.',
                  { id: toastId }
                );

                setShowAvatarModal(false);
              } catch (removeError) {
                toast.error(
                  safeErrorMessage(
                    removeError,
                    'Failed to remove profile picture.'
                  ),
                  { id: toastId }
                );

                throw removeError;
              }
            }}
          />
        </Suspense>
      ) : null}

      {showLevelDetails ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowLevelDetails(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="arvdoul-level-dialog-title"
            className={cn(
              'relative max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border p-5 shadow-2xl sm:rounded-[28px] sm:p-6',
              isDark
                ? 'border-white/10 bg-[#080D20] text-white'
                : 'border-black/[0.07] bg-white text-slate-950'
            )}
          >
            <button
              type="button"
              onClick={() => setShowLevelDetails(false)}
              aria-label="Close level details"
              className={cn(
                'absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-xl',
                isDark
                  ? 'bg-white/[0.06] text-white/70 hover:bg-white/10'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 pr-10">
              <LevelEmblem />

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-400">
                  Arvdoul progression
                </p>

                <h2
                  id="arvdoul-level-dialog-title"
                  className="mt-1 text-xl font-black"
                >
                  Level {currentLevel ?? '—'}
                </h2>

                <p
                  className={cn(
                    'mt-1 text-xs',
                    isDark
                      ? 'text-white/50'
                      : 'text-slate-500'
                  )}
                >
                  {levelTitle ||
                    'Your progression details'}
                </p>
              </div>
            </div>

            <div
              className={cn(
                'mt-5 rounded-2xl border p-4',
                isDark
                  ? 'border-white/[0.08] bg-white/[0.035]'
                  : 'border-black/[0.06] bg-slate-50'
              )}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold">
                    Experience points
                  </p>

                  <p
                    className={cn(
                      'mt-1 text-[11px]',
                      isDark
                        ? 'text-white/45'
                        : 'text-slate-500'
                    )}
                  >
                    Based on your current progression data
                  </p>
                </div>

                <Sparkles
                  size={19}
                  className="text-violet-400"
                />
              </div>

              <p className="mb-3 text-lg font-black tabular-nums">
                {currentXp !== null
                  ? `${formatInteger(currentXp)} XP`
                  : 'XP unavailable'}
              </p>

              <ProgressBar
                value={
                  currentXp !== null &&
                  nextLevelXp !== null &&
                  nextLevelXp > 0
                    ? (currentXp / nextLevelXp) * 100
                    : 0
                }
                theme={theme}
                label="Progress toward the next level"
              />

              <p
                className={cn(
                  'mt-3 text-[11px] leading-5',
                  isDark
                    ? 'text-white/45'
                    : 'text-slate-500'
                )}
              >
                {nextLevelXp !== null &&
                currentXp !== null &&
                nextLevelXp > 0
                  ? `${formatInteger(
                      Math.max(0, nextLevelXp - currentXp)
                    )} XP remaining to the next threshold.`
                  : 'The next-level threshold has not been provided by the progression service.'}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={() => {
                  setShowLevelDetails(false);
                  navigate('/levels/rewards');
                }}
                className={cn(
                  'flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 text-left transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                  isDark
                    ? 'border-white/[0.08] hover:bg-white/[0.04]'
                    : 'border-black/[0.07] hover:bg-slate-50'
                )}
              >
                <Gift
                  size={18}
                  className="text-violet-400"
                />

                <span className="flex-1 text-sm font-semibold">
                  Level rewards
                </span>

                <ChevronRight size={16} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLevelDetails(false);
                  navigate('/levels/benefits');
                }}
                className={cn(
                  'flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 text-left transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                  isDark
                    ? 'border-white/[0.08] hover:bg-white/[0.04]'
                    : 'border-black/[0.07] hover:bg-slate-50'
                )}
              >
                <Award
                  size={18}
                  className="text-amber-400"
                />

                <span className="flex-1 text-sm font-semibold">
                  Level benefits
                </span>

                <ChevronRight size={16} />
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLevelDetails(false);
                  navigate('/passport');
                }}
                className={cn(
                  'flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 text-left transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                  isDark
                    ? 'border-white/[0.08] hover:bg-white/[0.04]'
                    : 'border-black/[0.07] hover:bg-slate-50'
                )}
              >
                <Trophy
                  size={18}
                  className="text-sky-400"
                />

                <span className="flex-1 text-sm font-semibold">
                  Rank and reputation
                </span>

                <ChevronRight size={16} />
              </button>
            </div>

            <p
              className={cn(
                'mt-5 text-[10px] leading-5',
                isDark
                  ? 'text-white/35'
                  : 'text-slate-400'
              )}
            >
              XP thresholds, rewards, and unlocks must be supplied
              and validated by Arvdoul's canonical progression
              service. This screen does not award progression.
            </p>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default function ProfileMyScreen() {
  return (
    <ErrorBoundary>
      <OwnerProfileContent />
    </ErrorBoundary>
  );
}