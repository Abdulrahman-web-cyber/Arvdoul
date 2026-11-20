/**
 * Identity hero for Arvdoul profiles (owner and visitor).
 *
 * Centered, single-column architectural identity composition sitting directly
 * on the canvas (no cover banner, no duplicate standing/progression box):
 *   portrait (with optional royal crest aura) -> display name + verification
 *   -> @username + bespoke level emblem -> royal provenance / designations
 *   -> bio & tagline -> location / profession / website / joined
 *   -> principal actions (Edit Profile / Follow or Friend + Digital Passport + Share + Options)
 *
 * Low-RAM aware: lazy-loads modal sheets and disables backdrop blur in Lite Mode.
 *
 * @component
 */

import { memo, useMemo, useState, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  MapPin,
  Crown,
  MoreHorizontal,
  QrCode,
  Share2,
  Edit3,
  MessageSquare,
  Phone,
  Gift,
  Coins,
  Settings,
  UserCheck,
  UserPlus,
  Copy,
  Check,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Star,
  Lock,
  Clock,
  X,
  RefreshCw,
} from "lucide-react";
import { cn } from '../../lib/utils';
import * as LevelModule from '../../services/levelSystemService';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import {
  pickHandle,
  pickDisplayName,
  resolveRoyalFlag,
  resolveActiveTitleId,
  resolveCreatorFlag,
} from '../../services/profileReadModel.js';
import { sanitizeProfileUrl } from '../../config/profileContracts.js';
import { toast } from 'sonner';
import { useFeatureFlag } from '../../hooks/useFeatureFlag.js';
import { LazyImage } from '../../components/Shared/LazyImage';
import { BRAND_GRADIENT, brandRgba, brandHexRgba, tokens } from '../../design-system/tokens.js';
import { useLayoutChrome } from '../../context/LayoutChromeContext.jsx';
import { getAdaptiveTuning } from '../../utils/deviceCapabilities.js';
import LevelNumeralBadge from './LevelNumeralBadge.jsx';

const ProfileSystemRoadmapModal = lazy(async () => {
  const mod = await import('./ProfileSystemRoadmapModal');
  return { default: mod?.default?.default || mod?.default || mod?.ProfileSystemRoadmapModal };
});

const getLevelInfo = LevelModule.getLevelInfo || (() => null);
const getRoyalEligibility = LevelModule.getRoyalEligibility || (() => ({ eligible: false }));
const getIdentityBadge = LevelModule.getIdentityBadge || (() => null);

const COPIED_RESET_MS = 2000;
const BIO_CLAMP_THRESHOLD = 140;
const MENU_ID = 'profile-hero-more';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple focus-visible:ring-offset-1 focus-visible:ring-offset-transparent';

const PRESS =
  'active:scale-[0.98] motion-reduce:active:scale-100 transition-[transform,background-color,border-color,color,opacity,filter] duration-150 motion-reduce:transition-none';

const buildMaterial = (isDark, isLiteMode) => {
  const indigo = tokens.color.brand.indigo;
  const blue = tokens.color.brand.blue;
  if (isDark) {
    return {
      panel: {
        background:
          `linear-gradient(145deg, ${brandRgba(0.10)} 0%, ${brandHexRgba(indigo, 0.05)} 50%, ${brandHexRgba(blue, 0.09)} 100%), rgba(10,16,44,0.88)`,
        ...(isLiteMode ? {} : { backdropFilter: 'blur(20px) saturate(150%)', WebkitBackdropFilter: 'blur(20px) saturate(150%)' }),
        border: '1px solid rgba(255,255,255,0.11)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
      },
      passport: {
        background:
          `linear-gradient(135deg, ${brandRgba(0.24)} 0%, ${brandHexRgba(indigo, 0.16)} 55%, ${brandHexRgba(blue, 0.22)} 100%)`,
        border: '1px solid rgba(255,255,255,0.14)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
      },
      overlay: {
        background:
          `linear-gradient(145deg, ${brandRgba(0.10)} 0%, ${brandHexRgba(blue, 0.08)} 100%), rgba(12,18,44,0.96)`,
        ...(isLiteMode ? {} : { backdropFilter: 'blur(22px) saturate(150%)', WebkitBackdropFilter: 'blur(22px) saturate(150%)' }),
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 12px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      reflection: 'via-white/30',
      outline: '0 0 0 1px rgba(255,255,255,0.16)',
      control: cn(
        'bg-white/[0.06] hover:bg-white/[0.10] active:bg-white/[0.14] border-white/[0.10] text-slate-100',
        !isLiteMode && 'backdrop-blur-md'
      ),
    };
  }
  return {
    panel: {
      background:
        `linear-gradient(145deg, ${brandRgba(0.07)} 0%, ${brandHexRgba(indigo, 0.04)} 50%, ${brandHexRgba(blue, 0.07)} 100%), rgba(255,255,255,0.84)`,
      ...(isLiteMode ? {} : { backdropFilter: 'blur(20px) saturate(145%)', WebkitBackdropFilter: 'blur(20px) saturate(145%)' }),
      border: '1px solid rgba(120,140,170,0.22)',
      boxShadow:
        '0 1px 2px rgba(15,23,42,0.05), 0 8px 24px -12px rgba(30,41,90,0.18), inset 0 1px 0 rgba(255,255,255,0.95)',
    },
    passport: {
      background:
        `linear-gradient(135deg, ${brandRgba(0.10)} 0%, ${brandHexRgba(indigo, 0.06)} 55%, ${brandHexRgba(blue, 0.10)} 100%), rgba(255,255,255,0.85)`,
      border: `1px solid ${brandHexRgba(indigo, 0.20)}`,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)',
    },
    overlay: {
      background:
        `linear-gradient(145deg, ${brandRgba(0.06)} 0%, ${brandHexRgba(blue, 0.06)} 100%), rgba(255,255,255,0.96)`,
      ...(isLiteMode ? {} : { backdropFilter: 'blur(22px) saturate(150%)', WebkitBackdropFilter: 'blur(22px) saturate(150%)' }),
      border: '1px solid rgba(120,140,170,0.22)',
      boxShadow: '0 12px 32px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.95)',
    },
    reflection: 'via-white',
    outline: '0 0 0 1px rgba(15,23,42,0.12)',
    control: cn(
      'bg-white/80 hover:bg-white active:bg-white border-slate-300/60 text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.05)]',
      !isLiteMode && 'backdrop-blur-md'
    ),
  };
};

/** Returns a finite number or null. */
const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

// Joined date. Returns null when absent/unparseable so nothing is fabricated.
const formatJoinedDate = (createdAt) => {
  if (!createdAt) return null;
  try {
    const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    if (isNaN(d.getTime())) return null;
    const month = d.toLocaleString('default', { month: 'short' });
    return `Joined ${month} ${d.getFullYear()}`;
  } catch {
    return null;
  }
};

/** Legacy banner export for compatibility (Arvdoul profiles have no cover photo). */
export const ProfileBanner = memo(() => null);
ProfileBanner.displayName = 'ProfileBanner';

/**
 * Legacy export kept intact for compatibility and standalone card unit contracts.
 * Hero itself no longer renders this duplicate panel because ProfileProgression
 * sits cleanly below the Hero actions.
 */
export const ProfileLevelProgressCard = memo(({
  level = null,
  experience = null,
  isOwner = false,
  isDark = false,
  userId = null,
  showLevel = true,
  navigate,
  onOpenRoadmap,
}) => {
  const material = buildMaterial(isDark, true);
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const text = isDark ? 'text-white' : 'text-slate-900';

  const levelInfo = useMemo(() => {
    const xp = toFiniteNumber(experience);
    if (xp === null || xp < 0) return null;
    return getLevelInfo(xp) || null;
  }, [experience]);

  const levelNumber = useMemo(() => {
    const fromService = toFiniteNumber(levelInfo?.level);
    if (fromService !== null && fromService > 0) return Math.floor(fromService);
    const fromProp = toFiniteNumber(level);
    return fromProp !== null && fromProp > 0 ? Math.floor(fromProp) : null;
  }, [levelInfo, level]);

  const rankTitle = useMemo(() => {
    if (!levelNumber) return null;
    try {
      return LevelModule.getRankTitle?.(levelNumber) || null;
    } catch {
      return null;
    }
  }, [levelNumber]);

  const isMaxLevel = Boolean(levelInfo?.isMaxLevel) || levelInfo?.nextLevelXp === null;
  const nextXp = toFiniteNumber(levelInfo?.nextLevelXp);
  const currentXp = toFiniteNumber(levelInfo?.currentLevelXp);
  const xpInto = toFiniteNumber(levelInfo?.xpIntoLevel);
  const span = !isMaxLevel && nextXp !== null && currentXp !== null
    ? (levelInfo.nextLevelXp - levelInfo.currentLevelXp)
    : null;
  const hasProgress = Boolean(levelInfo) && span !== null && span > 0 && xpInto !== null && xpInto >= 0;
  const percent = hasProgress
    ? Math.min(100, Math.max(0, Math.round(toFiniteNumber(levelInfo.progress) ?? (xpInto / span) * 100)))
    : null;

  const passportUrl = isOwner ? '/passport' : (userId ? `/passport/${userId}` : null);
  const openPassport = () => { if (passportUrl) navigate?.(passportUrl); };

  const shell = cn("relative w-full max-w-[420px] mx-auto rounded-[20px] p-3 text-left", text);
  const rowButton = cn("flex items-center gap-3 w-full min-h-[48px] rounded-xl text-left cursor-pointer", PRESS, FOCUS_RING);
  const overline = cn("block text-[11px] font-medium uppercase tracking-[0.08em]", muted);

  const reflection = (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent to-transparent", material.reflection)}
    />
  );

  const passportButton = (
    <button
      type="button"
      onClick={openPassport}
      disabled={!passportUrl}
      className={cn(
        "w-full min-h-[44px] px-3.5 rounded-xl text-[13px] font-semibold inline-flex items-center justify-between gap-2 cursor-pointer",
        "hover:brightness-[1.07] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100",
        PRESS, FOCUS_RING, text
      )}
      style={material.passport}
    >
      <span className="inline-flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>Digital Passport</span>
      </span>
      <ChevronRight className={cn("w-4 h-4 shrink-0", muted)} aria-hidden="true" />
    </button>
  );

  const plainInsignia = (
    <span
      aria-hidden="true"
      className={cn("w-[42px] h-[42px] rounded-[14px] flex items-center justify-center shrink-0", isDark ? "bg-white/10 text-slate-300" : "bg-slate-900/[0.06] text-slate-500")}
    >
      <ShieldCheck className="w-5 h-5" />
    </span>
  );

  if (!showLevel && !isOwner) {
    return (
      <div className={shell} style={material.panel}>
        {reflection}
        <div className="flex items-center gap-3 min-h-[48px]">
          <span
            aria-hidden="true"
            className={cn("w-[42px] h-[42px] rounded-[14px] flex items-center justify-center shrink-0", isDark ? "bg-white/10" : "bg-slate-900/[0.06]", muted)}
          >
            <Lock className="w-5 h-5" />
          </span>
          <span className="min-w-0">
            <span className={overline}>Civic standing</span>
            <span className="block text-[15px] font-semibold leading-tight truncate">Hidden by owner</span>
          </span>
        </div>
        <div className="mt-2.5">{passportButton}</div>
      </div>
    );
  }

  if (!levelNumber) {
    const openCitizenship = () => (onOpenRoadmap ? onOpenRoadmap('citizenship') : openPassport());
    const content = (
      <>
        {plainInsignia}
        <span className="min-w-0 flex-1">
          <span className={overline}>Civic standing</span>
          <span className="block text-[15px] font-semibold leading-tight truncate">
            {isOwner ? 'Open citizenship roadmap' : 'Not available'}
          </span>
        </span>
        {isOwner && <ChevronRight className={cn("w-4 h-4 shrink-0", muted)} aria-hidden="true" />}
      </>
    );
    return (
      <div className={shell} style={material.panel}>
        {reflection}
        {isOwner ? (
          <button type="button" onClick={openCitizenship} className={rowButton}>{content}</button>
        ) : (
          <div className="flex items-center gap-3 min-h-[48px]">{content}</div>
        )}
        <div className="mt-2.5">{passportButton}</div>
      </div>
    );
  }

  const openLevels = () => (onOpenRoadmap ? onOpenRoadmap('levels') : openPassport());
  const subtitle = hasProgress
    ? `Level ${levelNumber} · ${Math.round(xpInto).toLocaleString()} / ${Math.round(span).toLocaleString()} XP`
    : isMaxLevel
      ? `Level ${levelNumber} · Apex`
      : rankTitle ? `Level ${levelNumber}` : null;

  return (
    <div className={shell} style={material.panel}>
      {reflection}
      <button
        type="button"
        onClick={openLevels}
        aria-label={`Level ${levelNumber}${rankTitle ? `, ${rankTitle}` : ''}. Open level roadmap`}
        className={rowButton}
      >
        <LevelNumeralBadge level={levelNumber} theme={isDark ? 'dark' : 'light'} size="md" />
        <span className="min-w-0 flex-1">
          <span className={overline}>Civic standing</span>
          <span className="block text-[15px] font-semibold leading-tight truncate">
            {rankTitle || `Level ${levelNumber}`}
          </span>
          {subtitle && (
            <span className={cn("block text-[12px] leading-snug tabular-nums truncate", muted)}>{subtitle}</span>
          )}
        </span>
        <ChevronRight className={cn("w-4 h-4 shrink-0", muted)} aria-hidden="true" />
      </button>

      {hasProgress && (
        <div className="mt-2 flex items-center gap-2.5 px-0.5">
          <span
            role="progressbar"
            aria-label="Progress to next level"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className={cn("block flex-1 h-1 rounded-full overflow-hidden", isDark ? "bg-white/10" : "bg-slate-900/10")}
          >
            <span
              className="block h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${percent}%`, background: BRAND_GRADIENT }}
            />
          </span>
          <span className={cn("text-[11px] font-medium tabular-nums", muted)}>{percent}%</span>
        </div>
      )}

      <div className="mt-2.5">{passportButton}</div>
    </div>
  );
});
ProfileLevelProgressCard.displayName = 'ProfileLevelProgressCard';

/** Legacy compatibility exports */
export const ProfileActionDock = memo(() => null);
ProfileActionDock.displayName = 'ProfileActionDock';
export const ProfileLargeCoinCard = memo(() => null);
ProfileLargeCoinCard.displayName = 'ProfileLargeCoinCard';
export const ProfileMetricsBar = memo(() => null);
ProfileMetricsBar.displayName = 'ProfileMetricsBar';

/** One row of the "More" menu. */
const MenuItem = ({ icon: Icon, label, onClick, disabled = false, busy = false, isDark, className }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-busy={busy || undefined}
    className={cn(
      "w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-[13px] font-medium text-left cursor-pointer",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      PRESS, FOCUS_RING,
      isDark ? "text-slate-100 hover:bg-white/[0.08] active:bg-white/[0.12]" : "text-slate-800 hover:bg-slate-900/[0.05] active:bg-slate-900/[0.08]",
      className
    )}
  >
    <Icon className={cn("w-4 h-4 shrink-0", isDark ? "text-slate-300" : "text-slate-500", busy && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
    <span className="flex-1 min-w-0 truncate">{label}</span>
  </button>
);

/** Main ProfileHeroSection */
export const ProfileHeroSection = memo(({
  profile,
  isOwner = false,
  level = null,
  theme = 'light',
  onBack,
  onOpenQrCode,
  onOpenLocationSetup,
  onOpenOptions,
  onAvatarClick,
  onShare,
  onEditProfile,
  onOpenQuickEdit,
  onOpenVerificationModal,
  onInsightsPress,
  onFollowToggle,
  isFollowing = false,
  requestStatus = null,
  followLoading = false,
  friendshipStatus = 'none',
  friendRequestLoading = false,
  onFriendRequestToggle,
  onCancelFriendRequest,
  onOpenTipModal,
  onOpenMessages,
  capabilities,
  onRefresh,
  isRefreshing = false,
}) => {
  const navigate = useNavigate();
  const { hasTopAppBar } = useLayoutChrome();
  const isDark = theme === 'dark';
  const isLiteMode = getAdaptiveTuning().isLiteMode;
  const material = useMemo(() => buildMaterial(isDark, isLiteMode), [isDark, isLiteMode]);
  const callsEnabled = useFeatureFlag('messaging.calls');

  const text = isDark ? 'text-white' : 'text-slate-900';
  const body = isDark ? 'text-slate-200' : 'text-slate-700';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const accent = isDark ? 'text-purple-300' : 'text-arvdoul-purple';

  const [copiedHandle, setCopiedHandle] = useState(false);
  const [showRoadmapModal, setShowRoadmapModal] = useState(false);
  const [roadmapInitialTab, setRoadmapInitialTab] = useState('levels');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [callPending, setCallPending] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);

  const copiedTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const callInFlightRef = useRef(false);
  const menuWrapRef = useRef(null);
  const menuTriggerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (e) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        menuTriggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const handleOpenRoadmap = useCallback((tab = 'levels') => {
    setRoadmapInitialTab(tab);
    setShowRoadmapModal(true);
  }, []);

  const profileUid = profile?.id || profile?.uid || null;

  const handleStartCall = useCallback(async () => {
    if (!profileUid || callInFlightRef.current) return;
    callInFlightRef.current = true;
    setCallPending(true);
    try {
      const { getMessagingService } = await import('../../services/messagesService.js');
      const { conversation } = await getMessagingService().createConversation([profileUid]);
      navigate(`/call/${conversation.id}?type=audio`);
    } catch {
      toast.error('Could not start call');
    } finally {
      callInFlightRef.current = false;
      if (mountedRef.current) setCallPending(false);
    }
  }, [profileUid, navigate]);

  const displayName = pickDisplayName([profile?.displayName, profile?.name], {
    fallback: profileUid ? `user ${String(profileUid).slice(0, 6)}` : '—',
  });
  const username = pickHandle([profile?.username, profile?.handle]) || null;
  const avatarUrl = getSafeAvatarUrl(profile?.photoURL, displayName, profileUid);
  const avatarFailed = failedAvatarUrl === avatarUrl;
  const initials = useMemo(
    () => displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => Array.from(w)[0]).join('').toUpperCase() || '?',
    [displayName]
  );

  const userLevel = toFiniteNumber(profile?.level) ?? toFiniteNumber(level);
  const isVerified = profile?.isVerified === true;
  const isCreator = resolveCreatorFlag(profile || {}, {}, userLevel);
  const isPremium = profile?.isPremium === true;
  const showLevel = isOwner || (profile?.showLevel !== false && capabilities?.canViewLevel !== false);

  const creatorBadgeLabel = useMemo(
    () => getIdentityBadge(profile?.level ?? userLevel, { isCreator })?.label || null,
    [profile?.level, userLevel, isCreator],
  );

  const verificationLevelGate = LevelModule.LEVEL_GATES?.verifiedPriority ?? null;
  const followersLevelGate = LevelModule.LEVEL_GATES?.publicFollowers ?? 3;
  const isLevelEligibleForVerification = userLevel !== null && verificationLevelGate !== null && userLevel >= verificationLevelGate;
  const sovereignGate = LevelModule.LEVEL_GATES?.sovereign ?? null;

  // Royal & Civic Titles resolution (supports object { id, name } and flags gracefully)
  const activeTitleObj = profile?.activeTitle;
  const activeTitleId = resolveActiveTitleId(profile);
  const activeTitleName = useMemo(() => {
    if (activeTitleObj && typeof activeTitleObj === 'object') {
      return activeTitleObj.name || activeTitleObj.label || null;
    }
    if (profile?.primaryTitle && typeof profile.primaryTitle === 'object') {
      return profile.primaryTitle.name || profile.primaryTitle.label || null;
    }
    if (typeof profile?.primaryTitle === 'string' && profile.primaryTitle.trim()) {
      return profile.primaryTitle.trim();
    }
    if (activeTitleId) {
      return String(activeTitleId).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return null;
  }, [activeTitleObj, profile?.primaryTitle, activeTitleId]);

  const isRoyal = useMemo(() => {
    if (resolveRoyalFlag(profile)) return true;
    const stats = {
      level: profile?.level ?? level ?? null,
      activeDays: profile?.activeDaysCount ?? profile?.activeDays ?? null,
      reputationScore: profile?.reputationScore ?? profile?.reputation ?? null,
      contributionScore: profile?.contributionScore ?? profile?.contribution ?? null,
      influenceScore: profile?.influenceScore ?? profile?.influence ?? null,
      achievements: profile?.achievements ?? null,
      policyStanding: profile?.policyStanding || profile?.accountStatus || null,
    };
    if (getRoyalEligibility('duke', stats).eligible) return true;
    return getRoyalEligibility('king', stats).eligible;
  }, [profile, level]);

  const canShowTitles = isOwner || capabilities?.canViewTitles !== false;
  const showRoyalBadge = canShowTitles && (isRoyal || Boolean(activeTitleName));
  const royalLabel = activeTitleName || (isRoyal ? 'Royal House' : null);
  const heraldicMotto = canShowTitles && typeof profile?.heraldicMotto === 'string' && profile.heraldicMotto.trim()
    ? profile.heraldicMotto.trim()
    : null;

  // Crest aura = existing identity/progression styling. Never emits a story ring.
  const crestAuraRing = useMemo(() => {
    const aura = profile?.crestAura;
    if (aura === 'purple') return 'linear-gradient(135deg,#a855f7,#4f46e5,#d946ef)';
    if (aura === 'royal' || isRoyal || (sovereignGate !== null && userLevel !== null && userLevel >= sovereignGate)) {
      return 'linear-gradient(135deg,#3b82f6,#4338ca,#22d3ee)';
    }
    if (aura === 'cyan') return 'linear-gradient(135deg,#22d3ee,#14b8a6,#7dd3fc)';
    if (aura === 'emerald') return 'linear-gradient(135deg,#34d399,#16a34a,#5eead4)';
    if (aura === 'gold') return 'linear-gradient(135deg,#fbbf24,#eab308,#fcd34d)';
    return null;
  }, [profile?.crestAura, isRoyal, userLevel, sovereignGate]);

  const handleCopyHandle = useCallback(async () => {
    if (!username) return;
    try {
      if (!navigator?.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(`@${username}`);
      if (!mountedRef.current) return;
      setCopiedHandle(true);
      toast.success(`Copied @${username}`);
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setCopiedHandle(false);
      }, COPIED_RESET_MS);
    } catch {
      toast.error('Could not copy handle');
    }
  }, [username]);

  const bio = (typeof profile?.bio === 'string' && profile.bio.trim())
    ? profile.bio.trim()
    : (typeof profile?.about === 'string' ? profile.about.trim() : '');
  const tagline = (typeof profile?.tagline === 'string' && profile.tagline.trim()) ? profile.tagline.trim() : '';
  const profession = (typeof profile?.profession === 'string' && profile.profession.trim()) ? profile.profession.trim() : '';
  const location = (typeof profile?.location === 'string' && profile.location.trim()) ? profile.location.trim() : '';
  const website = (typeof profile?.website === 'string' && profile.website.trim()) ? profile.website.trim() : '';
  const websiteHref = website ? sanitizeProfileUrl(website) : null;
  const websiteLabel = website.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const joinedDate = profile?.createdAt ? formatJoinedDate(profile.createdAt) : null;
  const isLongBio = bio.length > BIO_CLAMP_THRESHOLD;

  const designations = [
    showRoyalBadge && royalLabel && {
      key: 'royal',
      label: royalLabel,
      icon: Crown,
      royal: true,
      onClick: () => handleOpenRoadmap('royals'),
    },
    isCreator && creatorBadgeLabel && { key: 'creator', label: creatorBadgeLabel, icon: Star },
    isPremium && { key: 'premium', label: 'Premium', icon: Crown },
  ].filter(Boolean);

  const showInlineBack = Boolean(onBack && !hasTopAppBar);
  const showHeroRefresh = Boolean(onRefresh && !showInlineBack);
  const canOpenAvatar = Boolean(isOwner && onAvatarClick);
  const isOnline = profile?.presence?.status === 'online';

  const iconBtn = cn(
    "relative inline-flex items-center justify-center w-11 h-11 rounded-[14px] border shrink-0 cursor-pointer",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    PRESS, FOCUS_RING, material.control
  );
  const primaryBtn = cn(
    "inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-[14px] text-[13px] font-semibold whitespace-nowrap cursor-pointer",
    "disabled:opacity-60 disabled:cursor-not-allowed",
    PRESS, FOCUS_RING
  );

  const closeThen = (fn) => () => {
    setMenuOpen(false);
    menuTriggerRef.current?.focus();
    fn?.();
  };

  const friendLabel = friendshipStatus === 'friends' ? 'Friends'
    : friendshipStatus === 'received' ? 'Accept friend'
    : friendshipStatus === 'pending' ? (onCancelFriendRequest ? 'Cancel Request' : 'Requested')
    : 'Add friend';
  const FriendIcon = friendshipStatus === 'friends' ? UserCheck
    : friendshipStatus === 'pending' ? (onCancelFriendRequest ? X : Clock)
    : UserPlus;
  const friendAction = friendshipStatus === 'pending' && onCancelFriendRequest ? onCancelFriendRequest : onFriendRequestToggle;
  const friendRequestWaiting = !isOwner && Boolean(onFriendRequestToggle) && friendshipStatus === 'received';

  // Below followersLevelGate (Level 3) for non-creator targets: Friends-first CTA when friend handlers exist.
  const followersUnlocked = Boolean(isCreator || (userLevel !== null && userLevel >= followersLevelGate));
  const useFriendPrimaryCta = !isOwner && !followersUnlocked && Boolean(onFriendRequestToggle);

  const menuItems = isOwner
    ? [
        onOpenLocationSetup && { key: 'loc', icon: MapPin, label: 'Location', onClick: closeThen(onOpenLocationSetup) },
        { key: 'insights', icon: BarChart2, label: 'Insights', onClick: closeThen(onInsightsPress || (() => navigate('/profile/analytics'))) },
        { key: 'coins', icon: Coins, label: 'Coins', onClick: closeThen(() => navigate('/coins')) },
        { key: 'settings', icon: Settings, label: 'Settings', onClick: closeThen(() => navigate('/settings')) },
        showHeroRefresh && { key: 'refresh', icon: RefreshCw, label: 'Refresh', disabled: isRefreshing, busy: isRefreshing, onClick: closeThen(onRefresh) },
      ]
    : [
        !useFriendPrimaryCta && onFriendRequestToggle && {
          key: 'friend', icon: FriendIcon, label: friendLabel,
          disabled: friendRequestLoading || friendshipStatus === 'friends' || !friendAction,
          busy: friendRequestLoading, onClick: closeThen(friendAction),
        },
        callsEnabled && {
          key: 'call', icon: Phone, label: 'Audio call',
          disabled: !onOpenMessages || callPending, busy: callPending, onClick: closeThen(handleStartCall),
        },
        onOpenTipModal && { key: 'gift', icon: Gift, label: 'Send gift', onClick: closeThen(onOpenTipModal) },
        onShare && { key: 'share', icon: Share2, label: 'Share profile', className: 'min-[360px]:hidden', onClick: closeThen(onShare) },
        showHeroRefresh && { key: 'refresh', icon: RefreshCw, label: 'Refresh', disabled: isRefreshing, busy: isRefreshing, onClick: closeThen(onRefresh) },
      ];
  const visibleMenuItems = menuItems.filter(Boolean);

  const passportUrl = isOwner ? '/passport' : (profileUid ? `/passport/${profileUid}` : null);

  // If caller passes onOpenOptions (or in visitor mode where preview passes none),
  // render the canonical options trigger and disable it when no handler exists.
  const moreMenu = (onOpenOptions || !isOwner) ? (
    <button
      ref={menuTriggerRef}
      type="button"
      onClick={onOpenOptions}
      disabled={!onOpenOptions}
      title={!onOpenOptions ? 'Preview only' : undefined}
      aria-label={friendRequestWaiting ? 'More options, friend request waiting' : 'More options'}
      className={iconBtn}
    >
      <MoreHorizontal className="w-[18px] h-[18px]" aria-hidden="true" />
      {friendRequestWaiting && (
        <span aria-hidden="true" className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
      )}
    </button>
  ) : visibleMenuItems.length > 0 ? (
    <div ref={menuWrapRef} className="relative shrink-0">
      <button
        ref={menuTriggerRef}
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-controls={MENU_ID}
        aria-label={friendRequestWaiting ? 'More options, friend request waiting' : 'More options'}
        className={iconBtn}
      >
        <MoreHorizontal className="w-[18px] h-[18px]" aria-hidden="true" />
        {friendRequestWaiting && (
          <span aria-hidden="true" className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
        )}
      </button>

      {menuOpen && (
        <div
          id={MENU_ID}
          role="group"
          aria-label="More profile actions"
          className="absolute right-0 top-full mt-1.5 z-30 w-[232px] max-w-[calc(100vw-24px)] max-h-[min(60vh,360px)] overflow-y-auto overscroll-contain p-1 rounded-2xl text-left origin-top-right"
          style={material.overlay}
        >
          {visibleMenuItems.map(({ key, ...item }) => (
            <MenuItem key={key} isDark={isDark} {...item} />
          ))}
        </div>
      )}
    </div>
  ) : null;

  const shareButton = onShare && (
    <button
      type="button"
      onClick={onShare}
      className={cn(iconBtn, !isOwner && onOpenOptions == null && "hidden min-[360px]:inline-flex")}
      aria-label="Share profile"
    >
      <Share2 className="w-[18px] h-[18px]" aria-hidden="true" />
    </button>
  );

  const portraitFace = avatarFailed ? (
    <span
      aria-hidden="true"
      className={cn("w-full h-full flex items-center justify-center text-[34px] font-semibold", isDark ? "bg-[#0B1438] text-slate-200" : "bg-slate-200 text-slate-600")}
    >
      {initials}
    </span>
  ) : (
    <LazyImage
      src={avatarUrl}
      alt={canOpenAvatar ? '' : `${displayName} profile photo`}
      className="w-full h-full object-cover"
      loading="lazy"
      onError={() => setFailedAvatarUrl(avatarUrl)}
    />
  );

  const portraitClip = cn(
    "block w-full h-full rounded-full overflow-hidden relative",
    isDark ? "bg-[#080F2E]" : "bg-slate-100"
  );

  const metaItems = [
    profession && {
      key: 'profession',
      node: <span className="max-w-full min-w-0 truncate">{profession}</span>,
    },
    location && {
      key: 'location',
      node: isOwner && onOpenLocationSetup ? (
        <button
          type="button"
          onClick={onOpenLocationSetup}
          className={cn("inline-flex items-center gap-1 max-w-full min-w-0 truncate rounded-md hover:underline underline-offset-2 cursor-pointer", FOCUS_RING)}
        >
          <MapPin className="w-3 h-3 shrink-0 opacity-75" aria-hidden="true" />
          <span className="truncate">{location}</span>
        </button>
      ) : (
        <span className="inline-flex items-center gap-1 max-w-full min-w-0 truncate">
          <MapPin className="w-3 h-3 shrink-0 opacity-75" aria-hidden="true" />
          <span className="truncate">{location}</span>
        </span>
      ),
    },
    websiteLabel && {
      key: 'website',
      node: websiteHref ? (
        <a
          href={websiteHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("max-w-full min-w-0 truncate rounded-md font-medium hover:underline underline-offset-2", accent, FOCUS_RING)}
        >
          {websiteLabel}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <span className="max-w-full min-w-0 truncate">{websiteLabel}</span>
      ),
    },
    joinedDate && { key: 'joined', node: <span>{joinedDate}</span> },
  ].filter(Boolean);

  const verifiedIcon = (
    <BadgeCheck
      className="w-5 h-5 min-[412px]:w-[22px] min-[412px]:h-[22px] text-white"
      style={{ fill: tokens.color.brand.indigo }}
      aria-hidden="true"
    />
  );

  const emptyBioAction = onOpenQuickEdit
    ? () => onOpenQuickEdit('bio')
    : (onEditProfile || (() => navigate('/profile/edit')));

  return (
    <div
      role="group"
      aria-label="Profile header"
      className={cn("relative z-20 w-full font-sans py-1", text)}
    >
      {showInlineBack && (
        <div className="flex items-center justify-between gap-2 mb-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className={cn(
              "inline-flex items-center gap-1 min-h-[44px] pl-1.5 pr-3 -ml-1.5 rounded-xl text-[13px] font-medium cursor-pointer",
              PRESS, FOCUS_RING,
              isDark ? "text-slate-300 hover:bg-white/[0.07]" : "text-slate-600 hover:bg-slate-900/[0.05]"
            )}
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            <span>Back</span>
          </button>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-busy={isRefreshing}
              aria-label="Refresh profile"
              className={iconBtn}
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div className="mx-auto w-full max-w-[560px] flex flex-col items-center text-center">
        {/* 1. Portrait */}
        <div
          className={cn("relative shrink-0 rounded-full", crestAuraRing && "p-[2px]")}
          style={{
            width: 'clamp(100px, calc(76px + 7.5vw), 124px)',
            aspectRatio: '1 / 1',
            ...(crestAuraRing ? { background: crestAuraRing } : { boxShadow: material.outline }),
          }}
        >
          {canOpenAvatar ? (
            <button
              type="button"
              onClick={onAvatarClick}
              aria-label="Update profile avatar"
              className={cn(portraitClip, "cursor-pointer hover:opacity-95 active:opacity-90", PRESS, FOCUS_RING)}
            >
              {portraitFace}
            </button>
          ) : (
            <div className={portraitClip}>{portraitFace}</div>
          )}
          {isOnline && (
            <span
              role="status"
              aria-label="Online now"
              title="Online now"
              className={cn(
                "absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2",
                isDark ? "ring-[#03071B]" : "ring-[#F6F8FC]"
              )}
            />
          )}
        </div>

        {/* 2. Display name + verification */}
        <h1
          className={cn("mt-3 max-w-full font-sans font-semibold [overflow-wrap:anywhere]", text)}
          style={{
            fontSize: 'clamp(22px, calc(10px + 3.6vw), 28px)',
            lineHeight: 1.18,
            letterSpacing: '-0.016em',
            textWrap: 'balance',
          }}
        >
          <span>{displayName}</span>
          {isVerified && (
            onOpenVerificationModal ? (
              <button
                type="button"
                onClick={onOpenVerificationModal}
                aria-label="Verified account credentials"
                className={cn(
                  "relative inline-flex align-[-3px] ml-1.5 rounded-full cursor-pointer",
                  "after:absolute after:-inset-2 after:content-['']",
                  PRESS, FOCUS_RING
                )}
              >
                {verifiedIcon}
              </button>
            ) : (
              <span role="img" aria-label="Verified account" className="inline-flex align-[-3px] ml-1.5">
                {verifiedIcon}
              </span>
            )
          )}
        </h1>

        {/* 3. Username + Bespoke Per-Level Numeral Emblem + Owner verification status */}
        {(username || (showLevel && userLevel !== null) || (!isVerified && isOwner && verificationLevelGate !== null)) && (
          <div className="mt-1.5 max-w-full flex items-center justify-center gap-x-2.5 gap-y-1 flex-wrap text-[13px] leading-5">
            {username && (
              <button
                type="button"
                onClick={handleCopyHandle}
                aria-label={`Copy handle @${username}`}
                className={cn(
                  "inline-flex items-center gap-1 max-w-full min-w-0 min-h-[28px] rounded-md font-medium cursor-pointer transition-colors motion-reduce:transition-none",
                  muted, isDark ? "hover:text-slate-200" : "hover:text-slate-800",
                  FOCUS_RING
                )}
              >
                <span className="truncate">@{username}</span>
                {copiedHandle ? (
                  <Check className="w-3 h-3 text-emerald-500 shrink-0" aria-hidden="true" />
                ) : (
                  <Copy className="w-3 h-3 opacity-60 shrink-0" aria-hidden="true" />
                )}
              </button>
            )}

            {showLevel && userLevel !== null && (
              <LevelNumeralBadge
                level={userLevel}
                theme={theme}
                size="sm"
                onClick={isOwner ? () => handleOpenRoadmap('levels') : undefined}
              />
            )}

            {!isVerified && isOwner && verificationLevelGate !== null && (
              <button
                type="button"
                onClick={onOpenVerificationModal}
                disabled={!onOpenVerificationModal}
                className={cn(
                  "inline-flex items-center gap-1 min-h-[28px] rounded-md text-[12px] font-medium cursor-pointer disabled:cursor-default transition-colors motion-reduce:transition-none",
                  isLevelEligibleForVerification ? accent : muted,
                  FOCUS_RING
                )}
              >
                {isLevelEligibleForVerification ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Get verified</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3" aria-hidden="true" />
                    <span>Level {verificationLevelGate} to verify</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* 4. Royal Provenance & Designations (renders gracefully only when earned) */}
        {designations.length > 0 && (
          <div className="mt-2 flex items-center justify-center gap-1.5 flex-wrap">
            {designations.map(({ key, label, icon: Icon, royal, onClick }) => {
              const chip = cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] leading-none font-medium",
                royal
                  ? (isDark
                      ? "border-amber-400/35 bg-amber-500/12 text-amber-200"
                      : "border-amber-300 bg-amber-50 text-amber-900")
                  : (isDark
                      ? "border-white/[0.12] bg-white/[0.03] text-slate-300"
                      : "border-slate-300/70 bg-white/70 text-slate-700")
              );
              const content = (
                <>
                  <Icon className={cn("w-3 h-3 shrink-0", royal && "text-amber-500")} aria-hidden="true" />
                  <span>{label}</span>
                </>
              );
              return onClick ? (
                <button
                  key={key}
                  type="button"
                  onClick={onClick}
                  className={cn(chip, "cursor-pointer", PRESS, FOCUS_RING, isDark ? "hover:brightness-110" : "hover:bg-white")}
                >
                  {content}
                </button>
              ) : (
                <span key={key} className={chip}>{content}</span>
              );
            })}
          </div>
        )}
        {heraldicMotto && (
          <p className={cn("mt-1.5 text-[11.5px] italic tracking-wide", muted)}>
            “{heraldicMotto}”
          </p>
        )}

        {/* 5. Bio and tagline */}
        {(bio || tagline) && (
          <div className={cn("mt-2.5 w-full max-w-[52ch] text-[14px] leading-[1.55] [overflow-wrap:anywhere]", body)}>
            {bio && (
              <p className={cn("whitespace-pre-line", isLongBio && !bioExpanded && "line-clamp-3")}>{bio}</p>
            )}
            {bio && isLongBio && (
              <button
                type="button"
                onClick={() => setBioExpanded((v) => !v)}
                aria-expanded={bioExpanded}
                className={cn("mt-0.5 min-h-[28px] px-1 rounded-md text-[12px] font-semibold hover:underline underline-offset-2 cursor-pointer", accent, FOCUS_RING)}
              >
                {bioExpanded ? 'Less' : 'More'}
              </button>
            )}
            {tagline && (
              <p className={cn("text-[12.5px] leading-snug", muted, bio && "mt-1")}>{tagline}</p>
            )}
          </div>
        )}
        {!bio && !tagline && isOwner && (
          <button
            type="button"
            onClick={emptyBioAction}
            className={cn("mt-2 min-h-[32px] px-1 rounded-md text-[13px] font-medium hover:underline underline-offset-2 cursor-pointer", accent, FOCUS_RING)}
          >
            Add a bio
          </button>
        )}

        {/* 6. Profession, location, website, joined */}
        {metaItems.length > 0 && (
          <div className={cn("mt-2 max-w-full flex items-center justify-center gap-x-2 gap-y-0.5 flex-wrap text-[12px] leading-5", muted)}>
            {metaItems.map(({ key, node }, index) => (
              <span key={key} className="inline-flex items-center gap-2 min-w-0 max-w-full">
                {index > 0 && <span aria-hidden="true">·</span>}
                {node}
              </span>
            ))}
          </div>
        )}

        {/* 7. Principal actions: Edit Profile / Follow-or-Friend + Digital Passport beside it */}
        <div className="mt-4 w-full max-w-[460px] flex items-center gap-2">
          {isOwner ? (
            <>
              <button
                type="button"
                onClick={onEditProfile || (() => navigate('/profile/edit'))}
                className={cn(primaryBtn, "flex-1 min-w-0 text-white hover:brightness-110")}
                style={{ background: BRAND_GRADIENT }}
              >
                <Edit3 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Edit Profile</span>
              </button>

              {passportUrl && (
                <button
                  type="button"
                  onClick={() => navigate(passportUrl)}
                  aria-label="Digital Passport"
                  className={cn(primaryBtn, "border shrink-0 px-3", text)}
                  style={material.passport}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="hidden min-[360px]:inline">Digital Passport</span>
                </button>
              )}

              {shareButton}
              {onOpenQrCode && (
                <button type="button" onClick={onOpenQrCode} className={iconBtn} aria-label="Identity QR code">
                  <QrCode className="w-[18px] h-[18px]" aria-hidden="true" />
                </button>
              )}
              {moreMenu}
            </>
          ) : (
            <>
              {useFriendPrimaryCta ? (
                <button
                  type="button"
                  onClick={friendAction}
                  disabled={friendRequestLoading || friendshipStatus === 'friends' || !friendAction}
                  aria-busy={friendRequestLoading || undefined}
                  className={cn(
                    primaryBtn,
                    "flex-1 min-w-0",
                    friendshipStatus === 'friends' || friendshipStatus === 'pending'
                      ? cn("border", material.control)
                      : "text-white hover:brightness-110"
                  )}
                  style={!(friendshipStatus === 'friends' || friendshipStatus === 'pending') ? { background: BRAND_GRADIENT } : undefined}
                >
                  <FriendIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{friendLabel}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onFollowToggle}
                  disabled={followLoading || !onFollowToggle}
                  aria-busy={followLoading || undefined}
                  title={!onFollowToggle ? 'Preview only: this is how your profile looks to others' : undefined}
                  className={cn(
                    primaryBtn,
                    "flex-1 min-w-0",
                    isFollowing || requestStatus === 'pending'
                      ? cn("border", material.control)
                      : "text-white hover:brightness-110"
                  )}
                  style={!(isFollowing || requestStatus === 'pending') ? { background: BRAND_GRADIENT } : undefined}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">Following</span>
                    </>
                  ) : requestStatus === 'pending' ? (
                    <>
                      <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">Requested</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">Follow</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={onOpenMessages}
                disabled={!onOpenMessages}
                aria-label="Message"
                title={!onOpenMessages ? 'Preview only' : (capabilities?.canMessage === false ? 'Messaging is not available' : undefined)}
                className={cn(
                  primaryBtn, "border shrink-0 px-0 w-11 min-[420px]:px-3.5 min-[420px]:w-auto", material.control
                )}
              >
                <MessageSquare className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
                <span className="hidden min-[420px]:inline">Message</span>
              </button>

              <button
                type="button"
                onClick={onOpenTipModal}
                disabled={!onOpenTipModal}
                aria-label="Send Coins"
                title={!onOpenTipModal ? 'Preview only' : 'Send Coins'}
                className={iconBtn}
              >
                <Gift className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
              </button>

              {passportUrl && (
                <button
                  type="button"
                  onClick={() => navigate(passportUrl)}
                  aria-label="Digital Passport"
                  title="Digital Passport"
                  className={cn(
                    primaryBtn, "border shrink-0 px-0 w-11 sm:px-3 sm:w-auto", text
                  )}
                  style={material.passport}
                >
                  <ShieldCheck className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">Passport</span>
                </button>
              )}

              {shareButton}
              {moreMenu}
            </>
          )}
        </div>
      </div>

      {showRoadmapModal && (
        <Suspense fallback={null}>
          <ProfileSystemRoadmapModal
            isOpen={showRoadmapModal}
            onClose={() => setShowRoadmapModal(false)}
            profile={profile}
            theme={theme}
            initialTab={roadmapInitialTab}
            userId={profileUid}
          />
        </Suspense>
      )}
    </div>
  );
});

ProfileHeroSection.displayName = 'ProfileHeroSection';

export default ProfileHeroSection;
