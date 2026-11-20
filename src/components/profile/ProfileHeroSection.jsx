/**
 * Identity hero for Arvdoul profiles (owner and visitor).
 *
 * A centered, single-column identity composition that sits directly on the
 * page (no hero card, no ambient lighting, no colored glow in either theme):
 *
 *   portrait -> name + verification -> @handle -> designations -> bio/tagline
 *   -> location / website / joined -> civic standing + Digital Passport -> actions
 *
 * Glass is used for three things only: the civic-standing panel (with its
 * Passport button), the secondary controls, and the "More" menu.
 * Metrics, analytics, highlights and content belong to their own components.
 *
 * Props, named exports and callbacks are unchanged.
 *
 * @component
 */

import { memo, useMemo, useState, useCallback, useRef, useEffect } from "react";
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
import { pickHandle, pickDisplayName, resolveRoyalFlag, resolveCreatorFlag } from '../../services/profileReadModel.js';
import { sanitizeProfileUrl } from '../../config/profileContracts.js';
import { toast } from 'sonner';
import ProfileSystemRoadmapModal from './ProfileSystemRoadmapModal';
import { useFeatureFlag } from '../../hooks/useFeatureFlag.js';
import { LazyImage } from '../../components/Shared/LazyImage';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { useLayoutChrome } from '../../context/LayoutChromeContext.jsx';

const getLevelInfo = LevelModule.getLevelInfo || (() => null);
const getRoyalEligibility = LevelModule.getRoyalEligibility || (() => ({ eligible: false }));
const getIdentityBadge = LevelModule.getIdentityBadge || (() => null);

const COPIED_RESET_MS = 2000;
const BIO_CLAMP_THRESHOLD = 140;
const MENU_ID = 'profile-hero-more';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4431F7] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent';

const PRESS =
  'active:scale-[0.98] motion-reduce:active:scale-100 transition-[transform,background-color,border-color,color,opacity,filter] duration-150 motion-reduce:transition-none';

/**
 * Materials. Gradients appear only as faint tints inside the civic panel,
 * the Passport button and the menu; there is no glow, ambient layer or colored
 * shadow. Elevation, where present, is neutral.
 */
const MATERIAL = {
  dark: {
    // Smoked glass
    panel: {
      background:
        'linear-gradient(145deg, rgba(139,30,243,0.10) 0%, rgba(68,49,247,0.05) 50%, rgba(5,91,251,0.09) 100%), rgba(255,255,255,0.04)',
      backdropFilter: 'blur(20px) saturate(150%)',
      WebkitBackdropFilter: 'blur(20px) saturate(150%)',
      border: '1px solid rgba(255,255,255,0.11)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
    },
    passport: {
      background:
        'linear-gradient(135deg, rgba(139,30,243,0.24) 0%, rgba(68,49,247,0.16) 55%, rgba(5,91,251,0.22) 100%)',
      border: '1px solid rgba(255,255,255,0.14)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
    },
    overlay: {
      background:
        'linear-gradient(145deg, rgba(139,30,243,0.10) 0%, rgba(5,91,251,0.08) 100%), rgba(12,18,44,0.9)',
      backdropFilter: 'blur(22px) saturate(150%)',
      WebkitBackdropFilter: 'blur(22px) saturate(150%)',
      border: '1px solid rgba(255,255,255,0.12)',
      boxShadow: '0 12px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
    },
    reflection: 'via-white/30',
    outline: '0 0 0 1px rgba(255,255,255,0.16)',
    control:
      'bg-white/[0.06] hover:bg-white/[0.10] active:bg-white/[0.14] border-white/[0.10] text-slate-100 backdrop-blur-md',
  },
  light: {
    // Crystal
    panel: {
      background:
        'linear-gradient(145deg, rgba(139,30,243,0.07) 0%, rgba(68,49,247,0.04) 50%, rgba(5,91,251,0.07) 100%), rgba(255,255,255,0.66)',
      backdropFilter: 'blur(20px) saturate(145%)',
      WebkitBackdropFilter: 'blur(20px) saturate(145%)',
      border: '1px solid rgba(120,140,170,0.22)',
      boxShadow:
        '0 1px 2px rgba(15,23,42,0.05), 0 8px 24px -12px rgba(30,41,90,0.18), inset 0 1px 0 rgba(255,255,255,0.95)',
    },
    passport: {
      background:
        'linear-gradient(135deg, rgba(139,30,243,0.10) 0%, rgba(68,49,247,0.06) 55%, rgba(5,91,251,0.10) 100%), rgba(255,255,255,0.7)',
      border: '1px solid rgba(68,49,247,0.20)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)',
    },
    overlay: {
      background:
        'linear-gradient(145deg, rgba(139,30,243,0.06) 0%, rgba(5,91,251,0.06) 100%), rgba(255,255,255,0.92)',
      backdropFilter: 'blur(22px) saturate(150%)',
      WebkitBackdropFilter: 'blur(22px) saturate(150%)',
      border: '1px solid rgba(120,140,170,0.22)',
      boxShadow: '0 12px 32px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.95)',
    },
    reflection: 'via-white',
    outline: '0 0 0 1px rgba(15,23,42,0.12)',
    control:
      'bg-white/70 hover:bg-white active:bg-white border-slate-300/60 text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.05)] backdrop-blur-md',
  },
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
 * Civic-standing glass panel: level insignia, rank, real progress (only when
 * the level service supplies valid data), roadmap access (the insignia block)
 * and the Digital Passport button. No XP or percentage is ever estimated.
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
  const material = isDark ? MATERIAL.dark : MATERIAL.light;
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const text = isDark ? 'text-white' : 'text-slate-900';

  // Progress is only derived from a real, finite XP value.
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
  const span = !isMaxLevel && nextXp !== null && currentXp !== null ? nextXp - currentXp : null;
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
        <span
          aria-hidden="true"
          className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center shrink-0 text-white text-[17px] font-semibold tabular-nums"
          style={{
            background: BRAND_GRADIENT,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.28), inset 0 1px 0 rgba(255,255,255,0.35)',
          }}
        >
          {levelNumber}
        </span>
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
  const material = isDark ? MATERIAL.dark : MATERIAL.light;
  const callsEnabled = useFeatureFlag('messaging.calls');

  const text = isDark ? 'text-white' : 'text-slate-900';
  const body = isDark ? 'text-slate-200' : 'text-slate-700';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const accent = isDark ? 'text-purple-300' : 'text-[#8B1EF3]';

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

  // Menu: close on outside press and on Escape (focus returns to the trigger).
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
  // Canonical handle only; never derived from the display name.
  const username = pickHandle([profile?.username, profile?.handle]) || null;
  const avatarUrl = getSafeAvatarUrl(profile?.photoURL, displayName, profileUid);
  const avatarFailed = failedAvatarUrl === avatarUrl;
  const initials = useMemo(
    () => displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => Array.from(w)[0]).join('').toUpperCase() || '?',
    [displayName]
  );

  const userLevel = typeof profile?.level === 'number' ? profile.level : (typeof level === 'number' ? level : null);
  const isVerified = profile?.isVerified === true;
  const isCreator = resolveCreatorFlag(profile || {}, {}, userLevel);
  // Only an explicit flag counts; an arbitrary `subscription` object is not proof of an active plan.
  const isPremium = profile?.isPremium === true;

  const creatorBadgeLabel = useMemo(
    () => getIdentityBadge(profile?.level, { isCreator })?.label || null,
    [profile?.level, isCreator],
  );

  const verificationLevelGate = LevelModule.LEVEL_GATES?.verifiedPriority ?? null;
  const isLevelEligibleForVerification = userLevel !== null && verificationLevelGate !== null && userLevel >= verificationLevelGate;
  const sovereignGate = LevelModule.LEVEL_GATES?.sovereign ?? null;

  // Crest aura = existing identity/progression styling. It is NOT a story indicator,
  // and this component receives no story-availability prop, so no story ring is drawn.
  const crestAuraRing = useMemo(() => {
    const aura = profile?.crestAura;
    if (aura === 'purple') return 'linear-gradient(135deg,#a855f7,#4f46e5,#d946ef)';
    if (aura === 'royal' || (sovereignGate !== null && userLevel !== null && userLevel >= sovereignGate)) {
      return 'linear-gradient(135deg,#3b82f6,#4338ca,#22d3ee)';
    }
    if (aura === 'cyan') return 'linear-gradient(135deg,#22d3ee,#14b8a6,#7dd3fc)';
    if (aura === 'emerald') return 'linear-gradient(135deg,#34d399,#16a34a,#5eead4)';
    if (aura === 'gold') return 'linear-gradient(135deg,#fbbf24,#eab308,#fcd34d)';
    return null;
  }, [profile?.crestAura, userLevel, sovereignGate]);

  // Presentation only: derived from existing resolvers, never an authorization signal.
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
  const location = (typeof profile?.location === 'string' && profile.location.trim()) ? profile.location.trim() : '';
  const website = (typeof profile?.website === 'string' && profile.website.trim()) ? profile.website.trim() : '';
  const websiteHref = website ? sanitizeProfileUrl(website) : null;
  const websiteLabel = website.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const joinedDate = profile?.createdAt ? formatJoinedDate(profile.createdAt) : null;
  const isLongBio = bio.length > BIO_CLAMP_THRESHOLD;

  // All supported designations, rendered as consistent, quiet credentials.
  const designations = [
    isRoyal && { key: 'royal', label: 'Royal Family', icon: Crown, onClick: () => handleOpenRoadmap('royals') },
    isCreator && creatorBadgeLabel && { key: 'creator', label: creatorBadgeLabel, icon: Star },
    isPremium && { key: 'premium', label: 'Premium', icon: Crown },
  ].filter(Boolean);

  const showInlineBack = Boolean(onBack && !hasTopAppBar);
  const showHeroRefresh = Boolean(onRefresh && !showInlineBack);
  const canOpenAvatar = Boolean(isOwner && onAvatarClick);
  const canMessage = Boolean(onOpenMessages) && capabilities?.canMessage !== false;

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

  // Menu selection: close, restore focus to the trigger, then run the action
  // (an action that opens a modal moves focus there afterwards).
  const closeThen = (fn) => () => {
    setMenuOpen(false);
    menuTriggerRef.current?.focus();
    fn?.();
  };

  const friendLabel = friendshipStatus === 'friends' ? 'Friends'
    : friendshipStatus === 'received' ? 'Accept friend request'
    : friendshipStatus === 'pending' ? (onCancelFriendRequest ? 'Cancel friend request' : 'Friend request sent')
    : 'Add friend';
  const FriendIcon = friendshipStatus === 'friends' ? UserCheck
    : friendshipStatus === 'pending' ? X
    : UserPlus;
  const friendAction = friendshipStatus === 'pending' && onCancelFriendRequest ? onCancelFriendRequest : onFriendRequestToggle;
  const friendRequestWaiting = !isOwner && Boolean(onFriendRequestToggle) && friendshipStatus === 'received';

  const menuItems = isOwner
    ? [
        onOpenQuickEdit && { key: 'quick', icon: Edit3, label: 'Quick edit', onClick: closeThen(() => onOpenQuickEdit('all')) },
        onOpenLocationSetup && { key: 'loc', icon: MapPin, label: 'Location', onClick: closeThen(onOpenLocationSetup) },
        { key: 'insights', icon: BarChart2, label: 'Insights', onClick: closeThen(onInsightsPress || (() => navigate('/profile/analytics'))) },
        { key: 'coins', icon: Coins, label: 'Coins', onClick: closeThen(() => navigate('/coins')) },
        { key: 'settings', icon: Settings, label: 'Settings', onClick: closeThen(() => navigate('/settings')) },
        showHeroRefresh && { key: 'refresh', icon: RefreshCw, label: 'Refresh', disabled: isRefreshing, busy: isRefreshing, onClick: closeThen(onRefresh) },
        onOpenOptions && { key: 'options', icon: MoreHorizontal, label: 'Profile options & View As', onClick: closeThen(onOpenOptions) },
      ]
    : [
        onFriendRequestToggle && {
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
        onOpenOptions && { key: 'options', icon: MoreHorizontal, label: 'More options', onClick: closeThen(onOpenOptions) },
      ];
  const visibleMenuItems = menuItems.filter(Boolean);

  // The panel stays mounted so it can fade; `invisible` removes it from the tab order when closed.
  // It is anchored to the trigger, which always sits inside the centered action row,
  // so the 232px panel (capped to the viewport) stays on screen.
  const moreMenu = visibleMenuItems.length > 0 && (
    <div ref={menuWrapRef} className="relative shrink-0">
      <button
        ref={menuTriggerRef}
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-expanded={menuOpen}
        aria-controls={MENU_ID}
        aria-label={friendRequestWaiting ? 'More actions, friend request waiting' : 'More actions'}
        className={iconBtn}
      >
        <MoreHorizontal className="w-[18px] h-[18px]" aria-hidden="true" />
        {friendRequestWaiting && (
          <span aria-hidden="true" className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
        )}
      </button>

      <div
        id={MENU_ID}
        role="group"
        aria-label="More profile actions"
        className={cn(
          "absolute right-0 top-full mt-1.5 z-30 w-[232px] max-w-[calc(100vw-24px)] max-h-[min(60vh,360px)] overflow-y-auto overscroll-contain p-1 rounded-2xl text-left origin-top-right",
          "transition-[opacity,transform,visibility] duration-150 motion-reduce:transition-none",
          menuOpen ? "opacity-100 scale-100 visible" : "opacity-0 scale-95 invisible pointer-events-none"
        )}
        style={material.overlay}
      >
        {visibleMenuItems.map(({ key, ...item }) => (
          <MenuItem key={key} isDark={isDark} {...item} />
        ))}
      </div>
    </div>
  );

  const shareButton = onShare && (
    <button
      type="button"
      onClick={onShare}
      className={cn(iconBtn, !isOwner && "hidden min-[360px]:inline-flex")}
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
    location && {
      key: 'location',
      node: isOwner && onOpenLocationSetup ? (
        <button
          type="button"
          onClick={onOpenLocationSetup}
          className={cn("max-w-full min-w-0 truncate rounded-md hover:underline underline-offset-2 cursor-pointer", FOCUS_RING)}
        >
          {location}
        </button>
      ) : (
        <span className="max-w-full min-w-0 truncate">{location}</span>
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
    <BadgeCheck className="w-5 h-5 min-[412px]:w-[22px] min-[412px]:h-[22px] fill-[#4431F7] text-white" aria-hidden="true" />
  );

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
        {/* 1. Portrait: fixed box (no layout shift), thin structural edge only */}
        <div
          className={cn("relative shrink-0 rounded-full", crestAuraRing && "p-[2px]")}
          style={{
            width: 'clamp(104px, calc(80px + 8vw), 128px)',
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

        {/* 3. Username + copy (and owner verification prompt) */}
        {(username || (!isVerified && isOwner && verificationLevelGate !== null)) && (
          <div className="mt-1 max-w-full flex items-center justify-center gap-x-3 flex-wrap text-[13px] leading-5">
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

        {/* 4. Designations */}
        {designations.length > 0 && (
          <div className="mt-2 flex items-center justify-center gap-1.5 flex-wrap">
            {designations.map(({ key, label, icon: Icon, onClick }) => {
              const chip = cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] leading-none font-medium",
                isDark ? "border-white/[0.12] bg-white/[0.03] text-slate-300" : "border-slate-300/70 bg-white/50 text-slate-600"
              );
              const content = (
                <>
                  <Icon className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </>
              );
              return onClick ? (
                <button
                  key={key}
                  type="button"
                  onClick={onClick}
                  className={cn(chip, "cursor-pointer", PRESS, FOCUS_RING, isDark ? "hover:bg-white/[0.07]" : "hover:bg-white")}
                >
                  {content}
                </button>
              ) : (
                <span key={key} className={chip}>{content}</span>
              );
            })}
          </div>
        )}

        {/* 5. Bio and tagline */}
        {(bio || tagline) && (
          <div className={cn("mt-3 w-full max-w-[52ch] text-[14px] leading-[1.55] [overflow-wrap:anywhere]", body)}>
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
              <p className={cn("text-[12.5px] leading-snug", muted, bio && "mt-1.5")}>{tagline}</p>
            )}
          </div>
        )}
        {!bio && !tagline && isOwner && onOpenQuickEdit && (
          <button
            type="button"
            onClick={() => onOpenQuickEdit('bio')}
            className={cn("mt-2 min-h-[32px] px-1 rounded-md text-[13px] font-medium hover:underline underline-offset-2 cursor-pointer", accent, FOCUS_RING)}
          >
            Add a bio
          </button>
        )}

        {/* 6. Location, website, joined */}
        {metaItems.length > 0 && (
          <div className={cn("mt-2.5 max-w-full flex items-center justify-center gap-x-2 gap-y-0.5 flex-wrap text-[12px] leading-5", muted)}>
            {metaItems.map(({ key, node }, index) => (
              <span key={key} className="inline-flex items-center gap-2 min-w-0 max-w-full">
                {index > 0 && <span aria-hidden="true">·</span>}
                {node}
              </span>
            ))}
          </div>
        )}

        {/* 7. Civic standing + Digital Passport */}
        <div className="mt-4 w-full">
          <ProfileLevelProgressCard
            level={profile?.level ?? level ?? null}
            experience={profile?.experience ?? null}
            isOwner={isOwner}
            isDark={isDark}
            userId={profileUid}
            showLevel={profile?.showLevel !== false}
            navigate={navigate}
            onOpenRoadmap={handleOpenRoadmap}
          />
        </div>

        {/* 8. Principal actions (9. More menu is the last control) */}
        <div className="mt-3 w-full max-w-[420px] flex items-center gap-2">
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

              <button
                type="button"
                onClick={onOpenMessages}
                disabled={!canMessage}
                aria-label="Message"
                title={!onOpenMessages ? 'Preview only' : (capabilities?.canMessage === false ? 'Messaging is not available' : undefined)}
                className={cn(
                  primaryBtn, "border shrink-0 px-0 w-11 min-[380px]:px-3.5 min-[380px]:w-auto", material.control
                )}
              >
                <MessageSquare className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
                <span className="hidden min-[380px]:inline">Message</span>
              </button>

              {shareButton}
              {moreMenu}
            </>
          )}
        </div>
      </div>

      {/* Level, citizenship and Royal Family roadmap modal */}
      <ProfileSystemRoadmapModal
        isOpen={showRoadmapModal}
        onClose={() => setShowRoadmapModal(false)}
        profile={profile}
        theme={theme}
        initialTab={roadmapInitialTab}
        userId={profileUid}
      />
    </div>
  );
});

ProfileHeroSection.displayName = 'ProfileHeroSection';

export default ProfileHeroSection;
