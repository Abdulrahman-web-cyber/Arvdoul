/**
 * Identity hero for Arvdoul profiles (owner and visitor).
 *
 * Centered composition on a locally scoped ambient glass environment:
 *
 *   portrait (orbital ring, presence) -> name + verification -> @handle
 *   -> level pill -> designations -> motto -> bio / tagline -> metadata
 *   -> primary action -> four-tile secondary dock (incl. the More menu)
 *
 * Privacy: every identity detail the viewer may not see (level, titles,
 * creator status, presence) fails closed for visitors unless the matching
 * capability is explicitly granted. This component is not a permission engine;
 * it renders the already-projected profile it is given.
 *
 * Metrics, treasury, progression, highlights, creator analytics, tabs and
 * content belong to their own components.
 *
 * Props, named exports and callbacks are unchanged.
 *
 * @component
 */

import {
  memo, forwardRef, lazy, Suspense, useMemo, useState, useCallback, useRef, useEffect, useId,
} from "react";
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  MapPin,
  Link2,
  Briefcase,
  Calendar,
  Crown,
  Gem,
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
  ChevronDown,
  ShieldCheck,
  Star,
  Lock,
  Clock,
  X,
  RefreshCw,
} from "lucide-react";
import { cn } from '../../lib/utils';
import * as LevelModule from '../../services/levelSystemService';
import * as ReadModel from '../../services/profileReadModel.js';
import * as DeviceCaps from '../../utils/deviceCapabilities.js';
import * as LevelNumeralModule from './LevelNumeralBadge';
import { getSafeAvatarUrl } from '../../utils/avatarUtils';
import { sanitizeProfileUrl } from '../../config/profileContracts.js';
import { toast } from 'sonner';
import { useFeatureFlag } from '../../hooks/useFeatureFlag.js';
import { LazyImage } from '../../components/Shared/LazyImage';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { useLayoutChrome } from '../../context/LayoutChromeContext.jsx';

const ProfileSystemRoadmapModal = lazy(() => import('./ProfileSystemRoadmapModal'));

const getLevelInfo = LevelModule.getLevelInfo || (() => null);
const getIdentityBadge = LevelModule.getIdentityBadge || (() => null);

// Canonical resolvers from the read model, with the previous behavior as fallback.
const { pickHandle, pickDisplayName, resolveRoyalFlag, resolveCreatorFlag } = ReadModel;
const resolveVerifiedFlag = ReadModel.resolveVerifiedFlag || ((p) => p?.isVerified === true);
const resolveActiveTitleId = ReadModel.resolveActiveTitleId || (() => null);

const LevelNumeralBadge = LevelNumeralModule.default || LevelNumeralModule.LevelNumeralBadge || null;

const COPIED_RESET_MS = 2000;
const BIO_CLAMP_THRESHOLD = 140;
const PAGE_BG = { dark: '#03071B', light: '#F6F8FC' };

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4431F7] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent';

const PRESS =
  'active:scale-[0.98] motion-reduce:active:scale-100 transition-[transform,background-color,border-color,color,opacity,filter] duration-150 motion-reduce:transition-none';

/**
 * Single source of glass materials for the hero. Lite mode drops every
 * backdrop filter and keeps the surfaces opaque enough to stay legible.
 */
const buildMaterial = (isDark, isLite) => {
  const blur = (px) => (isLite ? {} : { backdropFilter: `blur(${px}px) saturate(150%)`, WebkitBackdropFilter: `blur(${px}px) saturate(150%)` });
  return isDark
    ? {
        tile: {
          background: isLite ? 'rgba(20,28,64,0.92)' : 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 8px 20px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)',
          ...blur(14),
        },
        panel: {
          background:
            'linear-gradient(145deg, rgba(139,30,243,0.10) 0%, rgba(68,49,247,0.05) 50%, rgba(5,91,251,0.09) 100%), rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.11)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
          ...blur(20),
        },
        passport: {
          background: 'linear-gradient(135deg, rgba(139,30,243,0.24) 0%, rgba(68,49,247,0.16) 55%, rgba(5,91,251,0.22) 100%)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
        },
        overlay: {
          background: isLite
            ? 'rgb(14,20,48)'
            : 'linear-gradient(145deg, rgba(139,30,243,0.10) 0%, rgba(5,91,251,0.08) 100%), rgba(12,18,44,0.92)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 14px 34px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)',
          ...blur(22),
        },
        primaryShadow: isLite ? '0 6px 14px -8px rgba(68,49,247,0.6)' : '0 12px 26px -8px rgba(68,49,247,0.6)',
        ringGlow: isLite
          ? '0 0 14px rgba(68,49,247,0.35)'
          : '0 0 26px rgba(139,30,243,0.42), 0 0 46px rgba(5,91,251,0.30)',
        gap: 'rgba(3,7,27,0.9)',
        reflection: 'via-white/30',
        control: 'bg-white/[0.06] hover:bg-white/[0.10] active:bg-white/[0.14] border-white/[0.10] text-slate-100',
      }
    : {
        tile: {
          background: isLite ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.72)',
          border: '1px solid rgba(120,140,170,0.22)',
          boxShadow: '0 8px 20px -12px rgba(30,41,90,0.25), inset 0 1px 0 rgba(255,255,255,0.95)',
          ...blur(14),
        },
        panel: {
          background:
            'linear-gradient(145deg, rgba(139,30,243,0.07) 0%, rgba(68,49,247,0.04) 50%, rgba(5,91,251,0.07) 100%), rgba(255,255,255,0.66)',
          border: '1px solid rgba(120,140,170,0.22)',
          boxShadow: '0 1px 2px rgba(15,23,42,0.05), 0 8px 24px -12px rgba(30,41,90,0.18), inset 0 1px 0 rgba(255,255,255,0.95)',
          ...blur(20),
        },
        passport: {
          background:
            'linear-gradient(135deg, rgba(139,30,243,0.10) 0%, rgba(68,49,247,0.06) 55%, rgba(5,91,251,0.10) 100%), rgba(255,255,255,0.7)',
          border: '1px solid rgba(68,49,247,0.20)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.95)',
        },
        overlay: {
          background: isLite
            ? 'rgb(255,255,255)'
            : 'linear-gradient(145deg, rgba(139,30,243,0.06) 0%, rgba(5,91,251,0.06) 100%), rgba(255,255,255,0.94)',
          border: '1px solid rgba(120,140,170,0.22)',
          boxShadow: '0 14px 34px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.95)',
          ...blur(22),
        },
        primaryShadow: isLite ? '0 6px 14px -8px rgba(68,49,247,0.5)' : '0 12px 24px -10px rgba(68,49,247,0.5)',
        ringGlow: isLite
          ? '0 4px 14px rgba(68,49,247,0.22)'
          : '0 10px 30px rgba(68,49,247,0.28), 0 0 24px rgba(139,30,243,0.16)',
        gap: 'rgba(246,248,252,0.92)',
        reflection: 'via-white',
        control: 'bg-white/70 hover:bg-white active:bg-white border-slate-300/60 text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.05)]',
      };
};

/** Designation material: royal gold, creator violet, premium metallic. */
const DESIGNATION_STYLE = {
  dark: {
    royal: { background: 'linear-gradient(180deg, rgba(245,184,59,0.18), rgba(245,184,59,0.06))', border: '1px solid rgba(245,184,59,0.45)', color: '#F6D58A' },
    creator: { background: 'linear-gradient(180deg, rgba(139,30,243,0.28), rgba(68,49,247,0.14))', border: '1px solid rgba(168,85,247,0.45)', color: '#E9D5FF' },
    premium: { background: 'rgba(226,232,240,0.09)', border: '1px solid rgba(226,232,240,0.28)', color: '#E2E8F0' },
  },
  light: {
    royal: { background: 'linear-gradient(180deg, #FFF8E6, #FFF1CC)', border: '1px solid rgba(217,160,30,0.5)', color: '#8A5A00' },
    creator: { background: 'linear-gradient(180deg, #F5EBFF, #EDE4FF)', border: '1px solid rgba(139,30,243,0.3)', color: '#6B21A8' },
    premium: { background: 'linear-gradient(180deg, #F8FAFC, #EEF2F7)', border: '1px solid #CBD5E1', color: '#334155' },
  },
};

/** Returns a finite number or null. */
const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const cleanString = (value) => (typeof value === 'string' && value.trim() ? value.trim() : '');

/** Humanizes a canonical title id (e.g. "grand-duke" -> "Grand Duke"). */
const humanizeTitle = (id) =>
  String(id).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());

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
 * Compatibility export. The hero no longer renders this panel (detailed XP
 * lives in ProfileProgression) but existing consumers may still import it.
 * No XP or percentage is ever estimated.
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
  const material = buildMaterial(isDark, false);
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

  const plainInsignia = (Icon) => (
    <span
      aria-hidden="true"
      className={cn("w-[42px] h-[42px] rounded-[14px] flex items-center justify-center shrink-0", isDark ? "bg-white/10 text-slate-300" : "bg-slate-900/[0.06] text-slate-500")}
    >
      <Icon className="w-5 h-5" />
    </span>
  );

  if (!showLevel && !isOwner) {
    return (
      <div className={shell} style={material.panel}>
        <div className="flex items-center gap-3 min-h-[48px]">
          {plainInsignia(Lock)}
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
        {plainInsignia(ShieldCheck)}
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
    : isMaxLevel ? `Level ${levelNumber} · Apex` : rankTitle ? `Level ${levelNumber}` : null;

  return (
    <div className={shell} style={material.panel}>
      <button
        type="button"
        onClick={openLevels}
        aria-label={`Level ${levelNumber}${rankTitle ? `, ${rankTitle}` : ''}. Open level roadmap`}
        className={rowButton}
      >
        <span
          aria-hidden="true"
          className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center shrink-0 text-white text-[17px] font-semibold tabular-nums"
          style={{ background: BRAND_GRADIENT, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.28), inset 0 1px 0 rgba(255,255,255,0.35)' }}
        >
          {levelNumber}
        </span>
        <span className="min-w-0 flex-1">
          <span className={overline}>Civic standing</span>
          <span className="block text-[15px] font-semibold leading-tight truncate">{rankTitle || `Level ${levelNumber}`}</span>
          {subtitle && <span className={cn("block text-[12px] leading-snug tabular-nums truncate", muted)}>{subtitle}</span>}
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
            <span className="block h-full rounded-full" style={{ width: `${percent}%`, background: BRAND_GRADIENT }} />
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

/**
 * Locally scoped ambient environment behind the portrait. Decorative only:
 * static CSS gradients plus a few SVG curves, no blur filters, edges masked
 * into the page. Lite mode renders the gradients only.
 */
const AmbientBackdrop = memo(({ isDark, isLite }) => {
  const uid = useId().replace(/:/g, '');
  const fade = 'radial-gradient(ellipse 100% 100% at 50% 38%, #000 55%, transparent 100%)';
  const glow = isDark
    ? 'radial-gradient(55% 40% at 50% 30%, rgba(68,49,247,0.22), transparent 70%), radial-gradient(40% 32% at 8% 8%, rgba(139,30,243,0.22), transparent 70%), radial-gradient(40% 32% at 96% 18%, rgba(0,136,255,0.18), transparent 70%)'
    : 'radial-gradient(55% 40% at 50% 30%, rgba(99,102,241,0.14), transparent 70%), radial-gradient(40% 32% at 8% 8%, rgba(200,43,255,0.12), transparent 70%), radial-gradient(40% 32% at 96% 18%, rgba(0,136,255,0.14), transparent 70%)';
  const c1 = isDark ? '#8B1EF3' : '#B07CFF';
  const c2 = isDark ? '#4431F7' : '#7C8CFF';
  const c3 = isDark ? '#00B7FF' : '#5AB4FF';
  const fillOpacity = isDark ? 0.34 : 0.28;
  const strokeOpacity = isDark ? 0.55 : 0.45;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px] overflow-hidden"
      style={{ maskImage: fade, WebkitMaskImage: fade, background: glow }}
    >
      {!isLite && (
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 500" preserveAspectRatio="xMidYMin slice" focusable="false">
          <defs>
            <linearGradient id={`${uid}-a`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={c1} />
              <stop offset="0.55" stopColor={c2} />
              <stop offset="1" stopColor={c3} />
            </linearGradient>
            <linearGradient id={`${uid}-b`} x1="1" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c3} />
              <stop offset="0.5" stopColor={c2} />
              <stop offset="1" stopColor={c1} />
            </linearGradient>
          </defs>
          <path d="M-20 70 C 70 -10, 150 170, 270 110 S 410 20, 430 -10 L 430 -30 L -20 -30 Z" fill={`url(#${uid}-a)`} opacity={fillOpacity} />
          <path d="M-20 300 C 60 220, 130 330, 210 260 S 360 190, 430 240 L 430 520 L -20 520 Z" fill={`url(#${uid}-b)`} opacity={fillOpacity * 0.45} />
          <path d="M-20 140 C 80 60, 170 230, 280 160 S 400 70, 430 120" fill="none" stroke={`url(#${uid}-a)`} strokeWidth="1.2" opacity={strokeOpacity} />
          <path d="M-20 200 C 90 120, 160 290, 290 220 S 410 150, 430 190" fill="none" stroke={`url(#${uid}-b)`} strokeWidth="1" opacity={strokeOpacity * 0.7} />
          <path d="M-20 360 C 70 300, 150 390, 240 330 S 380 280, 430 320" fill="none" stroke={`url(#${uid}-a)`} strokeWidth="0.9" opacity={strokeOpacity * 0.5} />
        </svg>
      )}
    </div>
  );
});
AmbientBackdrop.displayName = 'AmbientBackdrop';

/** One tile of the secondary dock (icon over label). */
const DockTile = forwardRef(({ icon: Icon, label, onClick, disabled = false, busy = false, style, isDark, title, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-busy={busy || undefined}
    title={title}
    className={cn(
      "w-full min-h-[64px] px-1 py-2 rounded-2xl flex flex-col items-center justify-center gap-1 cursor-pointer",
      "text-[11.5px] leading-[1.15] font-medium text-center",
      "hover:brightness-[1.08] active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100",
      PRESS, FOCUS_RING,
      isDark ? "text-slate-100" : "text-slate-800"
    )}
    style={style}
    {...rest}
  >
    <Icon className={cn("w-5 h-5 shrink-0", busy && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
    <span>{label}</span>
  </button>
));
DockTile.displayName = 'DockTile';

/** One row of the More menu. */
const MenuItem = ({ icon: Icon, label, onClick, disabled = false, busy = false, isDark }) => (
  <button
    type="button"
    role="menuitem"
    tabIndex={-1}
    onClick={onClick}
    disabled={disabled}
    aria-busy={busy || undefined}
    className={cn(
      "w-full min-h-[44px] px-3 rounded-xl flex items-center gap-3 text-[13px] font-medium text-left cursor-pointer",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      PRESS, FOCUS_RING,
      isDark ? "text-slate-100 hover:bg-white/[0.08] active:bg-white/[0.12]" : "text-slate-800 hover:bg-slate-900/[0.05] active:bg-slate-900/[0.08]"
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
  const callsEnabled = useFeatureFlag('messaging.calls');
  const menuId = useId();

  const [isLite] = useState(() => {
    try {
      return Boolean(DeviceCaps.getAdaptiveTuning?.()?.isLiteMode);
    } catch {
      return false;
    }
  });
  const material = useMemo(() => buildMaterial(isDark, isLite), [isDark, isLite]);
  const designationStyle = isDark ? DESIGNATION_STYLE.dark : DESIGNATION_STYLE.light;

  const text = isDark ? 'text-white' : 'text-slate-900';
  const body = isDark ? 'text-slate-200' : 'text-slate-700';
  const muted = isDark ? 'text-slate-400' : 'text-slate-500';
  const accent = isDark ? 'text-sky-300' : 'text-[#055BFB]';

  const [copiedHandle, setCopiedHandle] = useState(false);
  const [showRoadmapModal, setShowRoadmapModal] = useState(false);
  const [roadmapMounted, setRoadmapMounted] = useState(false);
  const [roadmapInitialTab, setRoadmapInitialTab] = useState('levels');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [callPending, setCallPending] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);

  const copiedTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const callInFlightRef = useRef(false);
  const menuWrapRef = useRef(null);
  const menuPanelRef = useRef(null);
  const menuTriggerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  // Menu: outside press and Escape close it; focus moves in on open and back to the trigger on close.
  useEffect(() => {
    if (!menuOpen) return undefined;
    menuPanelRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus();
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

  const handleMenuKeyDown = useCallback((e) => {
    const items = Array.from(menuPanelRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || []);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement);
    let next = null;
    if (e.key === 'ArrowDown') next = items[(index + 1) % items.length];
    else if (e.key === 'ArrowUp') next = items[(index - 1 + items.length) % items.length];
    else if (e.key === 'Home') next = items[0];
    else if (e.key === 'End') next = items[items.length - 1];
    else if (e.key === 'Tab') setMenuOpen(false);
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }, []);

  const handleOpenRoadmap = useCallback((tab = 'levels') => {
    setRoadmapInitialTab(tab);
    setRoadmapMounted(true);
    setShowRoadmapModal(true);
  }, []);

  const profileUid = profile?.id || profile?.uid || null;

  // --- Visibility: owners see everything; visitors only what is explicitly granted (fail closed) ---
  const caps = capabilities || {};
  const titlesAllowed = isOwner || caps.canViewTitles === true;
  const creatorAllowed = isOwner || caps.canViewCreatorInfo === true;
  const presenceAllowed = isOwner || caps.canViewPresence === true;
  const levelAllowed = isOwner || (profile?.showLevel !== false && caps.canViewActivity === true);

  // --- Action permissions (explicit denial blocks; callbacks must also exist) ---
  const canShareAction = Boolean(onShare) && (isOwner || caps.canShare !== false);
  const canMessageAction = Boolean(onOpenMessages) && caps.canMessage !== false;
  const canCallAction = callsEnabled && Boolean(onOpenMessages) && caps.canCall !== false;
  const canTipAction = Boolean(onOpenTipModal) && caps.canTip !== false;
  const canFollowAction = Boolean(onFollowToggle) && (isFollowing ? caps.canUnfollow !== false : caps.canFollow !== false);

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

  // --- Identity ---
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

  const rawLevel = typeof profile?.level === 'number' ? profile.level : toFiniteNumber(level);
  const visibleLevel = levelAllowed && rawLevel !== null && rawLevel > 0 ? Math.floor(rawLevel) : null;
  const isVerified = Boolean(resolveVerifiedFlag(profile));
  const isCreator = creatorAllowed && Boolean(resolveCreatorFlag(profile || {}, {}, levelAllowed ? rawLevel : null));
  // Only an explicit flag counts; an arbitrary `subscription` object is not proof of an active plan.
  const isPremium = profile?.isPremium === true;

  const creatorLabel = useMemo(
    () => (levelAllowed ? getIdentityBadge(profile?.level, { isCreator })?.label : null) || 'Creator',
    [levelAllowed, profile?.level, isCreator],
  );

  // Royal designation: presentation of the resolver result on the projected profile only.
  const royalTitleId = titlesAllowed && resolveRoyalFlag(profile) ? resolveActiveTitleId(profile) : null;
  const isRoyal = titlesAllowed && Boolean(resolveRoyalFlag(profile));
  const royalLabel = typeof royalTitleId === 'string' && royalTitleId ? humanizeTitle(royalTitleId) : 'Royal Family';

  // Crest aura = existing identity styling that complements (never replaces) the brand ring.
  // It is NOT a story indicator; no story-availability prop exists on this component.
  const sovereignGate = LevelModule.LEVEL_GATES?.sovereign ?? null;
  const crestAuraRing = useMemo(() => {
    const aura = titlesAllowed ? profile?.crestAura : null;
    const sovereign = levelAllowed && sovereignGate !== null && rawLevel !== null && rawLevel >= sovereignGate;
    if (aura === 'purple') return 'linear-gradient(135deg,#a855f7,#4f46e5,#d946ef)';
    if (aura === 'royal' || sovereign) return 'linear-gradient(135deg,#3b82f6,#4338ca,#22d3ee)';
    if (aura === 'cyan') return 'linear-gradient(135deg,#22d3ee,#14b8a6,#7dd3fc)';
    if (aura === 'emerald') return 'linear-gradient(135deg,#34d399,#16a34a,#5eead4)';
    if (aura === 'gold') return 'linear-gradient(135deg,#fbbf24,#eab308,#fcd34d)';
    return null;
  }, [titlesAllowed, profile?.crestAura, levelAllowed, sovereignGate, rawLevel]);

  // Presence: only when real presence data says online and the viewer may see it.
  const isOnline = presenceAllowed && Boolean(profile?.presence?.status === 'online' || profile?.isOnline === true);

  const handleCopyHandle = useCallback(async () => {
    if (!username) return;
    try {
      const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
      if (!clipboard || typeof clipboard.writeText !== 'function') throw new Error('Clipboard unavailable');
      await clipboard.writeText(`@${username}`);
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

  // --- Supporting identity (deduplicated so no statement appears twice) ---
  const bio = cleanString(profile?.bio) || cleanString(profile?.about);
  const motto = cleanString(profile?.heraldicMotto);
  const rawTagline = cleanString(profile?.tagline);
  const sameText = (a, b) => a.toLowerCase() === b.toLowerCase();
  const tagline = rawTagline && !sameText(rawTagline, motto) && !sameText(rawTagline, bio) ? rawTagline : '';
  const profession = cleanString(profile?.profession);
  const location = cleanString(profile?.location);
  const website = cleanString(profile?.website);
  const websiteHref = website ? sanitizeProfileUrl(website) : null;
  const websiteLabel = website.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const joinedDate = profile?.createdAt ? formatJoinedDate(profile.createdAt) : null;
  const isLongBio = bio.length > BIO_CLAMP_THRESHOLD;

  const showInlineBack = Boolean(onBack && !hasTopAppBar);
  const showHeroRefresh = Boolean(onRefresh && !showInlineBack);

  // Menu selection: close, restore focus to the trigger, then run the action.
  const closeThen = (fn) => () => {
    setMenuOpen(false);
    menuTriggerRef.current?.focus();
    fn?.();
  };

  // --- Primary action (visitor): a received friend request takes priority over Follow ---
  const acceptIsPrimary = !isOwner && friendshipStatus === 'received' && Boolean(onFriendRequestToggle);
  const friendLabel = friendshipStatus === 'friends' ? 'Friends'
    : friendshipStatus === 'pending' ? (onCancelFriendRequest ? 'Cancel friend request' : 'Friend request sent')
    : 'Add friend';
  const FriendIcon = friendshipStatus === 'friends' ? UserCheck : friendshipStatus === 'pending' ? X : UserPlus;
  const friendAction = friendshipStatus === 'pending' && onCancelFriendRequest ? onCancelFriendRequest : onFriendRequestToggle;
  const followLabel = isFollowing ? 'Following' : requestStatus === 'pending' ? 'Requested' : 'Follow';
  const FollowIcon = isFollowing ? UserCheck : requestStatus === 'pending' ? Clock : UserPlus;

  const menuItems = (isOwner
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
        acceptIsPrimary && { key: 'follow', icon: FollowIcon, label: followLabel, disabled: followLoading || !canFollowAction, busy: followLoading, onClick: closeThen(onFollowToggle) },
        onFriendRequestToggle && !acceptIsPrimary && {
          key: 'friend', icon: FriendIcon, label: friendLabel,
          disabled: friendRequestLoading || friendshipStatus === 'friends' || !friendAction,
          busy: friendRequestLoading, onClick: closeThen(friendAction),
        },
        callsEnabled && { key: 'call', icon: Phone, label: 'Audio call', disabled: !canCallAction || callPending, busy: callPending, onClick: closeThen(handleStartCall) },
        canTipAction && { key: 'gift', icon: Gift, label: 'Send coins', onClick: closeThen(onOpenTipModal) },
        showHeroRefresh && { key: 'refresh', icon: RefreshCw, label: 'Refresh', disabled: isRefreshing, busy: isRefreshing, onClick: closeThen(onRefresh) },
        onOpenOptions && { key: 'options', icon: MoreHorizontal, label: 'More options', onClick: closeThen(onOpenOptions) },
      ]
  ).filter(Boolean);

  const passportUrl = isOwner ? '/passport' : (profileUid ? `/passport/${profileUid}` : null);

  // --- Presentation pieces ---
  const designations = [
    isRoyal && { key: 'royal', label: royalLabel, icon: Crown, style: designationStyle.royal, onClick: () => handleOpenRoadmap('royals') },
    isCreator && { key: 'creator', label: creatorLabel, icon: Star, style: designationStyle.creator },
    isPremium && { key: 'premium', label: 'Premium', icon: Gem, style: designationStyle.premium },
  ].filter(Boolean);

  const metaItems = [
    profession && { key: 'profession', icon: Briefcase, node: <span className="truncate">{profession}</span> },
    location && {
      key: 'location', icon: MapPin,
      node: isOwner && onOpenLocationSetup ? (
        <button type="button" onClick={onOpenLocationSetup} className={cn("truncate rounded-md hover:underline underline-offset-2 cursor-pointer", FOCUS_RING)}>
          {location}
        </button>
      ) : <span className="truncate">{location}</span>,
    },
    websiteLabel && {
      key: 'website', icon: Link2,
      node: websiteHref ? (
        <a
          href={websiteHref}
          target="_blank"
          rel="noopener noreferrer"
          className={cn("truncate rounded-md hover:underline underline-offset-2", accent, FOCUS_RING)}
        >
          {websiteLabel}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : <span className="truncate">{websiteLabel}</span>,
    },
    joinedDate && { key: 'joined', icon: Calendar, node: <span className="truncate">{joinedDate}</span> },
  ].filter(Boolean);

  const portraitSize = 'clamp(148px, calc(100px + 15vw), 200px)';
  const pageBg = isDark ? PAGE_BG.dark : PAGE_BG.light;

  const portraitFace = avatarFailed ? (
    <span
      aria-hidden="true"
      className={cn("w-full h-full flex items-center justify-center text-[44px] font-semibold", isDark ? "bg-[#0B1438] text-slate-200" : "bg-slate-200 text-slate-600")}
    >
      {initials}
    </span>
  ) : (
    <LazyImage
      src={avatarUrl}
      alt={isOwner && onAvatarClick ? '' : `${displayName} profile photo`}
      className="w-full h-full object-cover"
      loading="eager"
      decoding="async"
      onError={() => setFailedAvatarUrl(avatarUrl)}
    />
  );
  const portraitClip = "block relative w-full h-full rounded-full overflow-hidden";
  const canOpenAvatar = Boolean(isOwner && onAvatarClick);

  const verifiedIcon = (
    <BadgeCheck
      className="w-6 h-6 min-[412px]:w-[26px] min-[412px]:h-[26px] text-white"
      style={{ fill: '#055BFB' }}
      aria-hidden="true"
    />
  );

  return (
    <div
      role="group"
      aria-label="Profile header"
      className={cn("relative isolate z-20 w-full font-sans pt-2 pb-1", text)}
    >
      <AmbientBackdrop isDark={isDark} isLite={isLite} />

      {showInlineBack && (
        <div className="flex items-center justify-between gap-2 mb-1">
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
              className={cn("inline-flex items-center justify-center w-11 h-11 rounded-[14px] border cursor-pointer disabled:opacity-50", PRESS, FOCUS_RING, material.control)}
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div className="mx-auto w-full max-w-[560px] flex flex-col items-center text-center">
        {/* 1. Portrait: orbital brand ring, optional crest ring, presence */}
        <div className="relative shrink-0" style={{ width: portraitSize, aspectRatio: '1 / 1' }}>
          <span aria-hidden="true" className="absolute inset-0 rounded-full" style={{ boxShadow: material.ringGlow }} />
          <div
            className={cn("relative w-full h-full rounded-full", crestAuraRing && "p-[2px]")}
            style={crestAuraRing ? { background: crestAuraRing } : undefined}
          >
            <div
              className="relative w-full h-full rounded-full"
              style={crestAuraRing ? { background: pageBg, padding: 2, borderRadius: '9999px' } : undefined}
            >
              <div className="w-full h-full rounded-full p-[4px]" style={{ background: BRAND_GRADIENT }}>
                <div className="w-full h-full rounded-full p-[3px]" style={{ background: material.gap }}>
                  {canOpenAvatar ? (
                    <button
                      type="button"
                      onClick={onAvatarClick}
                      aria-label="Update profile avatar"
                      className={cn(portraitClip, "cursor-pointer", PRESS, FOCUS_RING, isDark ? "bg-[#080F2E]" : "bg-slate-100")}
                    >
                      {portraitFace}
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22)' }} />
                    </button>
                  ) : (
                    <div className={cn(portraitClip, isDark ? "bg-[#080F2E]" : "bg-slate-100")}>
                      {portraitFace}
                      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.22)' }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {isOnline && (
            <span
              role="img"
              aria-label="Online"
              className="absolute right-[9%] bottom-[9%] w-[18px] h-[18px] min-[412px]:w-5 min-[412px]:h-5 rounded-full bg-emerald-500"
              style={{ boxShadow: `0 0 0 3px ${pageBg}` }}
            />
          )}
        </div>

        {/* 2. Display name + verification */}
        <h1
          className={cn("mt-4 max-w-full font-sans font-bold [overflow-wrap:anywhere]", text)}
          style={{
            fontSize: 'clamp(26px, calc(14px + 4vw), 34px)',
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
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
                className={cn("relative inline-flex align-[-4px] ml-1.5 rounded-full cursor-pointer after:absolute after:-inset-2 after:content-['']", PRESS, FOCUS_RING)}
              >
                {verifiedIcon}
              </button>
            ) : (
              <span role="img" aria-label="Verified account" className="inline-flex align-[-4px] ml-1.5">{verifiedIcon}</span>
            )
          )}
        </h1>

        {/* 3. Username + copy */}
        {username && (
          <button
            type="button"
            onClick={handleCopyHandle}
            aria-label={`Copy handle @${username}`}
            className={cn(
              "mt-1 inline-flex items-center gap-1.5 max-w-full min-w-0 min-h-[32px] px-1 rounded-md text-[15px] font-medium cursor-pointer transition-colors motion-reduce:transition-none",
              isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900",
              FOCUS_RING
            )}
          >
            <span className="truncate">@{username}</span>
            {copiedHandle ? (
              <Check className="w-4 h-4 text-emerald-500 shrink-0" aria-hidden="true" />
            ) : (
              <Copy className="w-4 h-4 opacity-70 shrink-0" aria-hidden="true" />
            )}
          </button>
        )}
        <span className="sr-only" role="status" aria-live="polite">{copiedHandle ? 'Handle copied' : ''}</span>

        {/* 4. Level pill (only when this viewer may see standing) */}
        {visibleLevel !== null && (
          <button
            type="button"
            onClick={() => handleOpenRoadmap('levels')}
            aria-label={`Level ${visibleLevel}. Open level roadmap`}
            className={cn("mt-2 inline-flex items-center gap-2 min-h-[36px] pl-1.5 pr-3.5 rounded-full text-[14px] font-semibold cursor-pointer", PRESS, FOCUS_RING, text)}
            style={material.tile}
          >
            {LevelNumeralBadge ? (
              <LevelNumeralBadge level={visibleLevel} theme={isDark ? 'dark' : 'light'} size="sm" />
            ) : (
              <span
                aria-hidden="true"
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[12px] font-semibold tabular-nums"
                style={{ background: BRAND_GRADIENT }}
              >
                {visibleLevel}
              </span>
            )}
            <span>Level {visibleLevel}</span>
          </button>
        )}

        {/* 5. Designations */}
        {designations.length > 0 && (
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            {designations.map(({ key, label, icon: Icon, style, onClick }) => {
              const pill = "inline-flex items-center gap-1.5 min-h-[32px] px-3 rounded-full text-[13px] font-semibold";
              const content = (
                <>
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </>
              );
              return onClick ? (
                <button key={key} type="button" onClick={onClick} className={cn(pill, "cursor-pointer hover:brightness-110", PRESS, FOCUS_RING)} style={style}>
                  {content}
                </button>
              ) : (
                <span key={key} className={pill} style={style}>{content}</span>
              );
            })}
          </div>
        )}

        {/* 6. Motto divider */}
        {motto && (
          <div className="mt-4 w-full flex items-center gap-3">
            <span aria-hidden="true" className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, #8B1EF3)' }} />
            <p className={cn("min-w-0 max-w-[80%] inline-flex items-center justify-center gap-2 text-[14px] italic font-medium leading-snug [overflow-wrap:anywhere]", isDark ? "text-slate-100" : "text-slate-800")}>
              {isRoyal && <Crown className="w-4 h-4 shrink-0 text-amber-500" aria-hidden="true" />}
              <span>{motto}</span>
            </p>
            <span aria-hidden="true" className="h-px flex-1" style={{ background: 'linear-gradient(90deg, #0088FF, transparent)' }} />
          </div>
        )}

        {/* 7. Bio and tagline */}
        {(bio || tagline) && (
          <div className={cn("mt-3.5 w-full max-w-[46ch] text-[14.5px] leading-[1.55] [overflow-wrap:anywhere]", body)}>
            {bio && <p className={cn("whitespace-pre-line", isLongBio && !bioExpanded && "line-clamp-3")}>{bio}</p>}
            {bio && isLongBio && (
              <button
                type="button"
                onClick={() => setBioExpanded((v) => !v)}
                aria-expanded={bioExpanded}
                className={cn("mt-1 inline-flex items-center gap-1 min-h-[32px] px-2 rounded-md text-[13px] font-semibold cursor-pointer", accent, PRESS, FOCUS_RING)}
              >
                <span>{bioExpanded ? 'Less' : 'More'}</span>
                <ChevronDown className={cn("w-4 h-4 transition-transform duration-150 motion-reduce:transition-none", bioExpanded && "rotate-180")} aria-hidden="true" />
              </button>
            )}
            {tagline && <p className={cn("text-[13px] leading-snug", muted, bio && "mt-1.5")}>{tagline}</p>}
          </div>
        )}
        {!bio && !tagline && isOwner && onOpenQuickEdit && (
          <button
            type="button"
            onClick={() => onOpenQuickEdit('bio')}
            className={cn("mt-3 min-h-[36px] px-2 rounded-md text-[13px] font-medium hover:underline underline-offset-2 cursor-pointer", accent, FOCUS_RING)}
          >
            Add a bio
          </button>
        )}

        {/* 8. Metadata: icon + value, thin dividers on wider screens */}
        {metaItems.length > 0 && (
          <div className={cn("mt-3.5 w-full flex items-center justify-center gap-x-3 gap-y-2 flex-wrap text-[13px] leading-5", muted)}>
            {metaItems.map(({ key, icon: Icon, node }, index) => (
              <span key={key} className="inline-flex items-center gap-3 min-w-0 max-w-full">
                {index > 0 && <span aria-hidden="true" className={cn("hidden min-[480px]:block h-4 w-px", isDark ? "bg-white/15" : "bg-slate-300")} />}
                <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {node}
                </span>
              </span>
            ))}
          </div>
        )}

        {/* 9. Primary action */}
        <div className="mt-5 w-full max-w-[460px] space-y-2.5">
          {isOwner ? (
            <button
              type="button"
              onClick={onEditProfile || (() => navigate('/profile/edit'))}
              className={cn(
                "relative w-full min-h-[52px] min-[412px]:min-h-[54px] rounded-[18px] inline-flex items-center justify-center gap-2 overflow-hidden",
                "text-[15px] font-semibold text-white cursor-pointer hover:brightness-110", PRESS, FOCUS_RING
              )}
              style={{ background: BRAND_GRADIENT, boxShadow: material.primaryShadow }}
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }} />
              <Edit3 className="relative w-[18px] h-[18px]" aria-hidden="true" />
              <span className="relative">Edit Profile</span>
            </button>
          ) : acceptIsPrimary ? (
            <button
              type="button"
              onClick={onFriendRequestToggle}
              disabled={friendRequestLoading}
              aria-busy={friendRequestLoading || undefined}
              className={cn(
                "relative w-full min-h-[52px] min-[412px]:min-h-[54px] rounded-[18px] inline-flex items-center justify-center gap-2 overflow-hidden",
                "text-[15px] font-semibold text-white cursor-pointer hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed", PRESS, FOCUS_RING
              )}
              style={{ background: BRAND_GRADIENT, boxShadow: material.primaryShadow }}
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }} />
              <UserPlus className="relative w-[18px] h-[18px]" aria-hidden="true" />
              <span className="relative">Accept Friend Request</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onFollowToggle}
              disabled={followLoading || !canFollowAction}
              aria-busy={followLoading || undefined}
              title={!onFollowToggle ? 'Preview only: this is how your profile looks to others' : undefined}
              className={cn(
                "relative w-full min-h-[52px] min-[412px]:min-h-[54px] rounded-[18px] inline-flex items-center justify-center gap-2 overflow-hidden",
                "text-[15px] font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed", PRESS, FOCUS_RING,
                isFollowing || requestStatus === 'pending' ? text : "text-white hover:brightness-110"
              )}
              style={isFollowing || requestStatus === 'pending'
                ? material.tile
                : { background: BRAND_GRADIENT, boxShadow: material.primaryShadow }}
            >
              {!(isFollowing || requestStatus === 'pending') && (
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }} />
              )}
              <FollowIcon className="relative w-[18px] h-[18px]" aria-hidden="true" />
              <span className="relative">{followLabel}</span>
            </button>
          )}

          {/* 10. Secondary dock: four tiles; More is the last */}
          <div className="grid grid-cols-4 gap-2">
            {isOwner ? (
              <DockTile
                icon={ShieldCheck}
                label="Digital Passport"
                isDark={isDark}
                style={material.tile}
                disabled={!passportUrl}
                onClick={() => passportUrl && navigate(passportUrl)}
              />
            ) : (
              <DockTile
                icon={MessageSquare}
                label="Message"
                isDark={isDark}
                style={material.tile}
                disabled={!canMessageAction}
                title={!onOpenMessages ? 'Preview only' : (caps.canMessage === false ? 'Messaging is not available' : undefined)}
                onClick={onOpenMessages}
              />
            )}

            {isOwner ? (
              <DockTile icon={Share2} label="Share" isDark={isDark} style={material.tile} disabled={!canShareAction} onClick={onShare} />
            ) : (
              <DockTile
                icon={ShieldCheck}
                label="Digital Passport"
                isDark={isDark}
                style={material.tile}
                disabled={!passportUrl}
                onClick={() => passportUrl && navigate(passportUrl)}
              />
            )}

            {isOwner ? (
              <DockTile icon={QrCode} label="QR Code" isDark={isDark} style={material.tile} disabled={!onOpenQrCode} onClick={onOpenQrCode} />
            ) : (
              <DockTile icon={Share2} label="Share" isDark={isDark} style={material.tile} disabled={!canShareAction} onClick={onShare} />
            )}

            <div ref={menuWrapRef} className="relative min-w-0">
              <DockTile
                ref={menuTriggerRef}
                icon={MoreHorizontal}
                label="More"
                isDark={isDark}
                style={material.tile}
                disabled={menuItems.length === 0}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={() => setMenuOpen((open) => !open)}
              />
              <div
                id={menuId}
                ref={menuPanelRef}
                role="menu"
                aria-label="More profile actions"
                onKeyDown={handleMenuKeyDown}
                className={cn(
                  "absolute right-0 top-full mt-1.5 z-30 w-[232px] max-w-[calc(100vw-24px)] max-h-[min(60vh,360px)] overflow-y-auto overscroll-contain p-1 rounded-2xl text-left origin-top-right",
                  "transition-[opacity,transform,visibility] duration-150 motion-reduce:transition-none",
                  menuOpen ? "opacity-100 scale-100 visible" : "opacity-0 scale-95 invisible pointer-events-none"
                )}
                style={material.overlay}
              >
                {menuItems.map(({ key, ...item }) => (
                  <MenuItem key={key} isDark={isDark} {...item} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Level, citizenship and Royal Family roadmap (loaded on first open) */}
      {roadmapMounted && (
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
