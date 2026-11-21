/**
 * Identity hero for Arvdoul profiles (owner and visitor).
 *
 * Compact, centered composition that sits directly on the page canvas
 * (the hero draws no background of its own):
 *
 *   avatar (Vibes ring only when active Vibes exist) -> name + verification
 *   -> @handle -> designations -> [Level | Location | Website | Joined]
 *   -> bio / tagline -> one row of four compact glass actions
 *
 * Privacy: level, titles, creator status and presence fail closed for
 * visitors unless the matching capability is explicitly granted. Permission-
 * sensitive actions also require an explicit grant. This component is not a
 * permission engine; it renders the already-projected profile it is given.
 *
 * Props, named exports and callbacks are unchanged, plus two optional props:
 * `vibes` and `vibesLoading` (the already-loaded profile stories).
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
// Used only as the outer edge of the presence dot, never as a background.
const EDGE_COLOR = { dark: '#03071B', light: '#F6F8FC' };
const DEAD_STORY_STATUSES = ['deleted', 'removed', 'expired', 'rejected'];
const DEAD_MODERATION_STATUSES = ['rejected', 'removed', 'blocked'];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4431F7] focus-visible:ring-offset-1 focus-visible:ring-offset-transparent';

const PRESS =
  'active:scale-[0.98] motion-reduce:active:scale-100 transition-[transform,background-color,border-color,color,opacity,filter] duration-150 motion-reduce:transition-none';

/**
 * Glass materials, each built from layers: translucent base, upper sheen,
 * fine border, inner top highlight and a soft natural shadow. Lite mode drops
 * every backdrop filter and keeps the surfaces opaque enough to stay legible.
 */
const buildMaterial = (isDark, isLite) => {
  const blur = (px) => (isLite ? {} : { backdropFilter: `blur(${px}px) saturate(160%)`, WebkitBackdropFilter: `blur(${px}px) saturate(160%)` });
  return isDark
    ? {
        action: {
          background: isLite
            ? 'linear-gradient(180deg, rgba(34,44,96,0.95), rgba(18,26,66,0.95))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 100%), linear-gradient(135deg, rgba(139,30,243,0.10), rgba(5,91,251,0.10)), rgba(16,24,62,0.55)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 6px 14px -6px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.25)',
          ...blur(14),
        },
        chip: {
          background: isLite ? 'rgba(24,32,76,0.95)' : 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03)), rgba(16,24,62,0.5)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
          ...blur(12),
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
            : 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), linear-gradient(145deg, rgba(139,30,243,0.10), rgba(5,91,251,0.08)), rgba(12,18,44,0.9)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 14px 34px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.10)',
          ...blur(22),
        },
        brandShadow: '0 6px 14px -6px rgba(68,49,247,0.6), inset 0 1px 0 rgba(255,255,255,0.3)',
        ringShadow: isLite ? 'none' : 'drop-shadow(0 0 6px rgba(68,49,247,0.5))',
        text: 'text-slate-100',
      }
    : {
        action: {
          background: isLite
            ? 'linear-gradient(180deg, #FFFFFF, #F1F4FA)'
            : 'radial-gradient(120% 90% at 0% 0%, rgba(139,30,243,0.07), transparent 60%), radial-gradient(120% 90% at 100% 100%, rgba(5,91,251,0.07), transparent 60%), linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.60)), rgba(255,255,255,0.5)',
          border: '1px solid rgba(120,140,170,0.24)',
          boxShadow: '0 8px 16px -10px rgba(30,41,90,0.32), inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(120,140,170,0.10)',
          ...blur(14),
        },
        chip: {
          background: isLite ? 'rgb(255,255,255)' : 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.65)), rgba(255,255,255,0.5)',
          border: '1px solid rgba(120,140,170,0.24)',
          boxShadow: '0 4px 10px -6px rgba(30,41,90,0.25), inset 0 1px 0 rgba(255,255,255,1)',
          ...blur(12),
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
            : 'linear-gradient(145deg, rgba(139,30,243,0.06), rgba(5,91,251,0.06)), rgba(255,255,255,0.94)',
          border: '1px solid rgba(120,140,170,0.24)',
          boxShadow: '0 14px 34px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.95)',
          ...blur(22),
        },
        brandShadow: '0 8px 16px -8px rgba(68,49,247,0.55), inset 0 1px 0 rgba(255,255,255,0.35)',
        ringShadow: isLite ? 'none' : 'drop-shadow(0 2px 6px rgba(68,49,247,0.3))',
        text: 'text-slate-800',
      };
};

/** Designation material: royal champagne gold, creator violet, premium metallic. */
const DESIGNATION_STYLE = {
  dark: {
    royal: { background: 'linear-gradient(180deg, rgba(245,184,59,0.20), rgba(245,184,59,0.07))', border: '1px solid rgba(245,184,59,0.45)', color: '#F6D58A', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)' },
    creator: { background: 'linear-gradient(180deg, rgba(139,30,243,0.30), rgba(68,49,247,0.15))', border: '1px solid rgba(168,85,247,0.45)', color: '#E9D5FF', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)' },
    premium: { background: 'rgba(226,232,240,0.09)', border: '1px solid rgba(226,232,240,0.28)', color: '#E2E8F0', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)' },
  },
  light: {
    royal: { background: 'linear-gradient(180deg, #FFF9E8, #FFF0C9)', border: '1px solid rgba(217,160,30,0.5)', color: '#8A5A00', boxShadow: 'inset 0 1px 0 #fff' },
    creator: { background: 'linear-gradient(180deg, #F6ECFF, #EDE4FF)', border: '1px solid rgba(139,30,243,0.3)', color: '#6B21A8', boxShadow: 'inset 0 1px 0 #fff' },
    premium: { background: 'linear-gradient(180deg, #F8FAFC, #EEF2F7)', border: '1px solid #CBD5E1', color: '#334155', boxShadow: 'inset 0 1px 0 #fff' },
  },
};

/** Returns a finite number or null. */
const toFiniteNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const cleanString = (value) => (typeof value === 'string' && value.trim() ? value.trim() : '');

/** Humanizes a title id (e.g. "grand-duke" -> "Grand Duke"); used only when no canonical label exists. */
const humanizeTitle = (id) =>
  String(id).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());

/** Safe timestamp -> milliseconds for Firestore timestamps, Dates, numbers and ISO strings. */
const toMillis = (value) => {
  if (!value) return null;
  try {
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
};

// Joined date. Returns null when absent/unparseable so nothing is fabricated.
const formatJoinedDate = (createdAt) => {
  const ms = toMillis(createdAt);
  if (ms === null) return null;
  return `Joined ${new Date(ms).getFullYear()}`;
};

/** Compact display label for a website: hostname without "www." (falls back to the stripped raw value). */
const websiteDisplay = (raw, href) => {
  try {
    const host = new URL(href || raw).hostname.replace(/^www\./, '');
    if (host) return host;
  } catch {
    /* fall through */
  }
  return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');
};

/**
 * Derives the avatar ring state from the already-loaded profile stories.
 * 'none' when there is nothing authorized and active (or data is missing / loading),
 * 'unseen' / 'seen' when seen status is known, 'active' when it is not.
 * Records the loading path already authorized are trusted; lifecycle fields are only
 * used to drop records that are clearly dead.
 */
const resolveVibesRingState = (vibes, loading) => {
  if (loading || !Array.isArray(vibes) || vibes.length === 0) return 'none';
  const now = Date.now();
  const active = vibes.filter((v) => {
    if (!v || typeof v !== 'object' || v.isDeleted === true) return false;
    if (typeof v.status === 'string' && DEAD_STORY_STATUSES.includes(v.status.toLowerCase())) return false;
    if (typeof v.moderationStatus === 'string' && DEAD_MODERATION_STATUSES.includes(v.moderationStatus.toLowerCase())) return false;
    const expires = toMillis(v.expiresAt);
    return !(expires !== null && expires <= now);
  });
  if (active.length === 0) return 'none';
  if (active.some((v) => v.seen === false)) return 'unseen';
  if (active.every((v) => v.seen === true)) return 'seen';
  return 'active';
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
 * Compact action: icon left, label right, labels wrap to two lines instead of
 * shrinking. `variant="brand"` is the gradient primary at the same height.
 */
const ActionButton = forwardRef(({
  icon: Icon, label, ariaLabel, onClick, disabled = false, busy = false, variant = 'glass', style, material, title, ...rest
}, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-busy={busy || undefined}
    aria-label={ariaLabel}
    title={title}
    className={cn(
      "relative w-full h-[46px] min-[412px]:h-[48px] px-1.5 rounded-[15px] overflow-hidden",
      "inline-flex items-center justify-center gap-1.5 cursor-pointer",
      "text-[10.5px] min-[375px]:text-[11.5px] leading-[1.1] font-semibold text-center",
      "hover:brightness-[1.08] active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100",
      PRESS, FOCUS_RING,
      variant === 'brand' ? "text-white" : material.text
    )}
    style={variant === 'brand' ? { background: BRAND_GRADIENT, boxShadow: material.brandShadow } : { ...material.action, ...style }}
    {...rest}
  >
    {variant === 'brand' && (
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }} />
    )}
    <Icon className={cn("relative w-[17px] h-[17px] shrink-0", busy && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
    <span className="relative min-w-0 whitespace-normal">{label}</span>
  </button>
));
ActionButton.displayName = 'ActionButton';

/** One row of an action menu. */
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

/**
 * Disclosure menu used by both "QR / Passport" and "More": unique id, Escape and
 * outside-press dismissal, arrow/Home/End navigation, focus in on open and back
 * to the trigger on close. The panel stays mounted so it can fade; `invisible`
 * keeps closed items out of the tab order.
 */
const ActionMenu = ({ icon, label, ariaLabel, items, isDark, material, align = 'right' }) => {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    panelRef.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus();
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleKeyDown = useCallback((e) => {
    const enabled = Array.from(panelRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || []);
    if (!enabled.length) return;
    const index = enabled.indexOf(document.activeElement);
    let next = null;
    if (e.key === 'ArrowDown') next = enabled[(index + 1) % enabled.length];
    else if (e.key === 'ArrowUp') next = enabled[(index - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    else if (e.key === 'Tab') setOpen(false);
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }, []);

  const run = (fn) => () => {
    setOpen(false);
    triggerRef.current?.focus();
    fn?.();
  };

  return (
    <div ref={wrapRef} className="relative min-w-0">
      <ActionButton
        ref={triggerRef}
        icon={icon}
        label={label}
        ariaLabel={ariaLabel}
        material={material}
        disabled={items.length === 0}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      />
      <div
        id={menuId}
        ref={panelRef}
        role="menu"
        aria-label={ariaLabel || label}
        onKeyDown={handleKeyDown}
        className={cn(
          "absolute top-full mt-1.5 z-30 w-[224px] max-w-[calc(100vw-24px)] max-h-[min(60vh,360px)] overflow-y-auto overscroll-contain p-1 rounded-2xl text-left",
          align === 'right' ? "right-0 origin-top-right" : "left-0 origin-top-left",
          "transition-[opacity,transform,visibility] duration-150 motion-reduce:transition-none",
          open ? "opacity-100 scale-100 visible" : "opacity-0 scale-95 invisible pointer-events-none"
        )}
        style={material.overlay}
      >
        {items.map(({ key, onClick, ...item }) => (
          <MenuItem key={key} isDark={isDark} onClick={run(onClick)} {...item} />
        ))}
      </div>
    </div>
  );
};

/** Main ProfileHeroSection */
export const ProfileHeroSection = memo(({
  profile,
  isOwner = false,
  level = null,
  theme = 'light',
  vibes,
  vibesLoading = false,
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
  const divider = isDark ? 'bg-white/15' : 'bg-slate-300';
  const edge = isDark ? EDGE_COLOR.dark : EDGE_COLOR.light;

  const [copiedHandle, setCopiedHandle] = useState(false);
  const [showRoadmapModal, setShowRoadmapModal] = useState(false);
  const [roadmapMounted, setRoadmapMounted] = useState(false);
  const [roadmapInitialTab, setRoadmapInitialTab] = useState('levels');
  const [bioExpanded, setBioExpanded] = useState(false);
  const [callPending, setCallPending] = useState(false);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState(null);

  const copiedTimerRef = useRef(null);
  const mountedRef = useRef(true);
  const callInFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
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

  // --- Action permissions: callbacks must exist and visitors need an explicit grant ---
  const grant = (key) => caps[key] === true;
  const canShareAction = Boolean(onShare) && (isOwner || grant('canShare'));
  const canMessageAction = Boolean(onOpenMessages) && grant('canMessage');
  const canCallAction = callsEnabled && Boolean(onOpenMessages) && grant('canCall');
  const canTipAction = Boolean(onOpenTipModal) && grant('canTip');

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
  // Relationship rules need the resolver result even when the creator badge itself is hidden.
  const isCreatorResolved = Boolean(resolveCreatorFlag(profile || {}, {}, rawLevel));
  const showCreator = creatorAllowed && isCreatorResolved;
  // Only an explicit flag counts; an arbitrary `subscription` object is not proof of an active plan.
  const isPremium = profile?.isPremium === true;

  const creatorLabel = useMemo(
    () => (levelAllowed ? getIdentityBadge(profile?.level, { isCreator: true })?.label : null) || 'Creator',
    [levelAllowed, profile?.level],
  );

  // Royal designation: presentation of the resolver result on the projected profile only.
  const isRoyal = titlesAllowed && Boolean(resolveRoyalFlag(profile));
  const royalLabel = useMemo(() => {
    if (!isRoyal) return null;
    const title = profile?.activeTitle ?? profile?.primaryTitle;
    if (title && typeof title === 'object') {
      const canonical = cleanString(title.name) || cleanString(title.label);
      if (canonical) return canonical;
    }
    if (typeof title === 'string' && title.trim()) return humanizeTitle(title);
    const id = resolveActiveTitleId(profile);
    return typeof id === 'string' && id ? humanizeTitle(id) : 'Royal Family';
  }, [isRoyal, profile]);

  // Presence: only when real presence data says online and the viewer may see it.
  const isOnline = presenceAllowed && Boolean(profile?.presence?.status === 'online' || profile?.isOnline === true);

  // Vibes ring: only when active Vibes exist in the already-loaded, authorized stories.
  const vibesState = useMemo(() => resolveVibesRingState(vibes, vibesLoading), [vibes, vibesLoading]);

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
  const rawMotto = titlesAllowed ? cleanString(profile?.heraldicMotto) : '';
  const rawTagline = cleanString(profile?.tagline);
  const sameText = (a, b) => a.toLowerCase() === b.toLowerCase();
  const tagline = rawTagline && !sameText(rawTagline, bio) ? rawTagline : '';
  const motto = rawMotto && !sameText(rawMotto, bio) && !sameText(rawMotto, tagline) ? rawMotto : '';
  const profession = cleanString(profile?.profession);
  const location = cleanString(profile?.location);
  const website = cleanString(profile?.website);
  const websiteHref = website ? sanitizeProfileUrl(website) : null;
  const joinedDate = profile?.createdAt ? formatJoinedDate(profile.createdAt) : null;
  const isLongBio = bio.length > BIO_CLAMP_THRESHOLD;

  const showInlineBack = Boolean(onBack && !hasTopAppBar);
  const showHeroRefresh = Boolean(onRefresh && !showInlineBack);
  const canOpenAvatar = Boolean(isOwner && onAvatarClick);
  const passportUrl = isOwner ? '/passport' : (profileUid ? `/passport/${profileUid}` : null);

  // --- Visitor relationship: Friends-first below the follower gate, Followers after it ---
  const followersGate = toFiniteNumber(LevelModule.LEVEL_GATES?.publicFollowers);
  const friendsFirst = !isOwner
    && followersGate !== null
    && rawLevel !== null
    && rawLevel < followersGate
    && !isCreatorResolved;
  const friendReceived = friendshipStatus === 'received';
  const friendPrimary = !isOwner && Boolean(onFriendRequestToggle) && (friendsFirst || friendReceived);
  const friendCancel = friendshipStatus === 'pending' && onCancelFriendRequest;
  const friendAction = friendCancel ? onCancelFriendRequest : onFriendRequestToggle;
  const friendDisabled = friendRequestLoading || friendshipStatus === 'friends' || !friendAction;
  const friendLabelFull = friendshipStatus === 'friends' ? 'Friends'
    : friendReceived ? 'Accept friend request'
    : friendshipStatus === 'pending' ? (onCancelFriendRequest ? 'Cancel friend request' : 'Friend request sent')
    : 'Add friend';
  const friendLabelShort = friendshipStatus === 'friends' ? 'Friends'
    : friendReceived ? 'Accept'
    : friendshipStatus === 'pending' ? (onCancelFriendRequest ? 'Cancel' : 'Sent')
    : 'Add Friend';
  const FriendIcon = friendshipStatus === 'friends' ? UserCheck : friendshipStatus === 'pending' ? X : UserPlus;

  const followPending = requestStatus === 'pending';
  const canFollowAction = Boolean(onFollowToggle)
    && (isFollowing ? grant('canUnfollow') : followPending ? grant('canCancelRequest') : grant('canFollow'));
  const followLabel = isFollowing ? 'Following' : followPending ? 'Requested' : 'Follow';
  const FollowIcon = isFollowing ? UserCheck : followPending ? Clock : UserPlus;

  // --- Menus ---
  const qrPassportItems = [
    { key: 'qr', icon: QrCode, label: 'QR code', disabled: !onOpenQrCode, onClick: onOpenQrCode },
    { key: 'passport', icon: ShieldCheck, label: 'Digital Passport', disabled: !passportUrl, onClick: () => passportUrl && navigate(passportUrl) },
  ];

  const moreItems = (isOwner
    ? [
        onOpenQuickEdit && { key: 'quick', icon: Edit3, label: 'Quick edit', onClick: () => onOpenQuickEdit('all') },
        onOpenLocationSetup && { key: 'loc', icon: MapPin, label: 'Location', onClick: onOpenLocationSetup },
        { key: 'insights', icon: BarChart2, label: 'Insights', onClick: onInsightsPress || (() => navigate('/profile/analytics')) },
        { key: 'coins', icon: Coins, label: 'Coins', onClick: () => navigate('/coins') },
        { key: 'settings', icon: Settings, label: 'Settings', onClick: () => navigate('/settings') },
        showHeroRefresh && { key: 'refresh', icon: RefreshCw, label: 'Refresh', disabled: isRefreshing, busy: isRefreshing, onClick: onRefresh },
        onOpenOptions && { key: 'options', icon: MoreHorizontal, label: 'Profile options & View As', onClick: onOpenOptions },
      ]
    : [
        // Whichever of Follow / Friend is not the primary action lives here.
        friendPrimary && onFollowToggle && !friendsFirst && {
          key: 'follow', icon: FollowIcon, label: followLabel, disabled: followLoading || !canFollowAction, busy: followLoading, onClick: onFollowToggle,
        },
        !friendPrimary && onFriendRequestToggle && !friendsFirst && {
          key: 'friend', icon: FriendIcon, label: friendLabelFull, disabled: friendDisabled, busy: friendRequestLoading, onClick: friendAction,
        },
        passportUrl && { key: 'passport', icon: ShieldCheck, label: 'Digital Passport', onClick: () => navigate(passportUrl) },
        callsEnabled && { key: 'call', icon: Phone, label: 'Audio call', disabled: !canCallAction || callPending, busy: callPending, onClick: handleStartCall },
        canTipAction && { key: 'gift', icon: Gift, label: 'Send coins', onClick: onOpenTipModal },
        showHeroRefresh && { key: 'refresh', icon: RefreshCw, label: 'Refresh', disabled: isRefreshing, busy: isRefreshing, onClick: onRefresh },
        onOpenOptions && { key: 'options', icon: MoreHorizontal, label: 'More options', onClick: onOpenOptions },
      ]
  ).filter(Boolean);

  // --- Presentation pieces ---
  const designations = [
    isRoyal && { key: 'royal', label: royalLabel, icon: Crown, style: designationStyle.royal, onClick: () => handleOpenRoadmap('royals') },
    showCreator && { key: 'creator', label: creatorLabel, icon: Star, style: designationStyle.creator },
    isPremium && { key: 'premium', label: 'Premium', icon: Gem, style: designationStyle.premium },
  ].filter(Boolean);

  const metaItems = [
    visibleLevel !== null && {
      key: 'level',
      node: (
        <button
          type="button"
          onClick={() => handleOpenRoadmap('levels')}
          aria-label={`Level ${visibleLevel}. Open level roadmap`}
          className={cn("inline-flex items-center gap-1 h-[26px] pl-1 pr-2 rounded-full text-[11.5px] font-semibold cursor-pointer shrink-0", PRESS, FOCUS_RING, text)}
          style={material.chip}
        >
          {LevelNumeralBadge ? (
            <LevelNumeralBadge level={visibleLevel} theme={isDark ? 'dark' : 'light'} size="sm" />
          ) : (
            <span aria-hidden="true" className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-white text-[10px] font-semibold tabular-nums" style={{ background: BRAND_GRADIENT }}>
              {visibleLevel}
            </span>
          )}
          <span className="hidden min-[360px]:inline">Level {visibleLevel}</span>
        </button>
      ),
      keep: true,
    },
    location && {
      key: 'location', icon: MapPin,
      node: isOwner && onOpenLocationSetup ? (
        <button type="button" onClick={onOpenLocationSetup} title="Change location" className={cn("truncate rounded-md hover:underline underline-offset-2 cursor-pointer", FOCUS_RING)}>
          {location}
        </button>
      ) : <span className="truncate">{location}</span>,
    },
    website && {
      key: 'website', icon: Link2,
      node: websiteHref ? (
        <a href={websiteHref} target="_blank" rel="noopener noreferrer" className={cn("truncate rounded-md hover:underline underline-offset-2", accent, FOCUS_RING)}>
          {websiteDisplay(website, websiteHref)}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : <span className="truncate">{websiteDisplay(website, null)}</span>,
    },
    joinedDate && { key: 'joined', icon: Calendar, node: <span className="truncate">{joinedDate}</span>, keep: true },
  ].filter(Boolean);

  // Outer 96-128px; the photo sits 6px inside so the ring (when present) never changes layout.
  const outerSize = 'clamp(96px, 26vw, 128px)';

  const portraitFace = avatarFailed ? (
    <span
      aria-hidden="true"
      className={cn("w-full h-full flex items-center justify-center text-[30px] font-semibold", isDark ? "bg-[#0B1438] text-slate-200" : "bg-slate-200 text-slate-600")}
    >
      {initials}
    </span>
  ) : (
    <LazyImage
      src={avatarUrl}
      alt={canOpenAvatar ? '' : `${displayName} profile photo`}
      className="w-full h-full object-cover"
      loading="eager"
      decoding="async"
      onError={() => setFailedAvatarUrl(avatarUrl)}
    />
  );
  const portraitClip = cn("block absolute inset-[6px] rounded-full overflow-hidden", isDark ? "bg-[#080F2E]" : "bg-slate-100");

  const verifiedIcon = (
    <BadgeCheck className="w-[18px] h-[18px] min-[412px]:w-5 min-[412px]:h-5 text-white" style={{ fill: '#055BFB' }} aria-hidden="true" />
  );

  return (
    <div role="group" aria-label="Profile header" className={cn("relative z-20 w-full font-sans", text)}>
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
              className={cn("inline-flex items-center justify-center w-11 h-11 rounded-[14px] cursor-pointer disabled:opacity-50", PRESS, FOCUS_RING, material.text)}
              style={material.action}
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div className="mx-auto w-full max-w-[440px] flex flex-col items-center text-center">
        {/* 1. Avatar. The gradient ring exists only while active Vibes exist. */}
        <div className="relative shrink-0" style={{ width: outerSize, aspectRatio: '1 / 1' }}>
          {vibesState !== 'none' && (
            <span aria-hidden="true" className="absolute inset-0" style={{ filter: material.ringShadow }}>
              <span
                className="block w-full h-full rounded-full"
                style={{
                  background: BRAND_GRADIENT,
                  opacity: vibesState === 'seen' ? 0.45 : vibesState === 'active' ? 0.8 : 1,
                  WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
                  mask: 'radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 3px))',
                }}
              />
            </span>
          )}

          {canOpenAvatar ? (
            <button
              type="button"
              onClick={onAvatarClick}
              aria-label={vibesState !== 'none' ? 'Update profile avatar (active Vibes)' : 'Update profile avatar'}
              className={cn(portraitClip, "cursor-pointer", PRESS, FOCUS_RING)}
            >
              {portraitFace}
            </button>
          ) : (
            <div className={portraitClip}>{portraitFace}</div>
          )}

          {isOnline && (
            <span
              role="img"
              aria-label="Online"
              className="absolute right-[7%] bottom-[7%] w-[14px] h-[14px] min-[412px]:w-4 min-[412px]:h-4 rounded-full bg-emerald-500"
              style={{ boxShadow: `0 0 0 2.5px ${edge}` }}
            />
          )}
        </div>

        {/* 2. Display name + verification */}
        <h1
          className={cn("mt-2.5 max-w-full font-sans font-bold [overflow-wrap:anywhere]", text)}
          style={{ fontSize: 'clamp(21px, 5.8vw, 28px)', lineHeight: 1.15, letterSpacing: '-0.015em', textWrap: 'balance' }}
        >
          <span>{displayName}</span>
          {isVerified && (
            onOpenVerificationModal ? (
              <button
                type="button"
                onClick={onOpenVerificationModal}
                aria-label="Verified account credentials"
                className={cn("relative inline-flex align-[-3px] ml-1.5 rounded-full cursor-pointer after:absolute after:-inset-2.5 after:content-['']", PRESS, FOCUS_RING)}
              >
                {verifiedIcon}
              </button>
            ) : (
              <span role="img" aria-label="Verified account" className="inline-flex align-[-3px] ml-1.5">{verifiedIcon}</span>
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
              "mt-0.5 inline-flex items-center gap-1.5 max-w-full min-w-0 min-h-[28px] px-1 rounded-md text-[14px] font-medium cursor-pointer transition-colors motion-reduce:transition-none",
              isDark ? "text-slate-300 hover:text-white" : "text-slate-600 hover:text-slate-900",
              FOCUS_RING
            )}
          >
            <span className="truncate">@{username}</span>
            {copiedHandle ? (
              <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5 opacity-70 shrink-0" aria-hidden="true" />
            )}
          </button>
        )}
        <span className="sr-only" role="status" aria-live="polite">{copiedHandle ? 'Handle copied' : ''}</span>

        {/* 4. Designations */}
        {designations.length > 0 && (
          <div className="mt-1.5 flex items-center justify-center gap-1.5 flex-wrap">
            {designations.map(({ key, label, icon: Icon, style, onClick }) => {
              const pill = "inline-flex items-center gap-1 h-[28px] px-2.5 rounded-full text-[12px] leading-none font-semibold";
              const content = (
                <>
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
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

        {/* 5. One compact row: Level | Location | Website | Joined */}
        {metaItems.length > 0 && (
          <div className={cn("mt-2.5 w-full flex flex-nowrap items-center justify-center gap-x-2 text-[11.5px] leading-4", muted)}>
            {metaItems.map(({ key, icon: Icon, node, keep }, index) => (
              <span key={key} className={cn("inline-flex items-center gap-2 min-w-0", keep ? "shrink-0" : "shrink")}>
                {index > 0 && <span aria-hidden="true" className={cn("h-3.5 w-px shrink-0", divider)} />}
                {Icon ? (
                  <span className="inline-flex items-center gap-1 min-w-0">
                    <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    {node}
                  </span>
                ) : node}
              </span>
            ))}
          </div>
        )}

        {/* Profession stays available as a quiet secondary line */}
        {profession && (
          <p className={cn("mt-1 max-w-full inline-flex items-center justify-center gap-1 text-[11.5px] leading-4", muted)}>
            <Briefcase className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{profession}</span>
          </p>
        )}

        {/* 6. Bio, tagline, motto: beneath the metadata row */}
        {(bio || tagline || motto) && (
          <div className={cn("mt-2 w-full max-w-[44ch] text-[13.5px] leading-[1.45] [overflow-wrap:anywhere]", body)}>
            {bio && <p className={cn("whitespace-pre-line", isLongBio && !bioExpanded && "line-clamp-2")}>{bio}</p>}
            {bio && isLongBio && (
              <button
                type="button"
                onClick={() => setBioExpanded((v) => !v)}
                aria-expanded={bioExpanded}
                className={cn("inline-flex items-center gap-0.5 min-h-[28px] px-2 rounded-md text-[12.5px] font-semibold cursor-pointer", accent, PRESS, FOCUS_RING)}
              >
                <span>{bioExpanded ? 'Less' : 'More'}</span>
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-150 motion-reduce:transition-none", bioExpanded && "rotate-180")} aria-hidden="true" />
              </button>
            )}
            {tagline && <p className={cn("text-[12.5px] leading-snug", muted, bio && "mt-1")}>{tagline}</p>}
            {motto && <p className={cn("text-[12.5px] italic leading-snug", muted, (bio || tagline) && "mt-1")}>{motto}</p>}
          </div>
        )}
        {!bio && !tagline && !motto && isOwner && onOpenQuickEdit && (
          <button
            type="button"
            onClick={() => onOpenQuickEdit('bio')}
            className={cn("mt-1.5 min-h-[32px] px-2 rounded-md text-[13px] font-medium hover:underline underline-offset-2 cursor-pointer", accent, FOCUS_RING)}
          >
            Add a bio
          </button>
        )}

        {/* 7. Four compact glass actions in one row */}
        <div className="mt-3.5 w-full grid grid-cols-4 gap-1.5">
          {isOwner ? (
            <>
              <ActionButton
                icon={Edit3}
                label="Edit Profile"
                variant="brand"
                material={material}
                onClick={onEditProfile || (() => navigate('/profile/edit'))}
              />
              <ActionMenu icon={QrCode} label="QR / Passport" ariaLabel="QR code and Digital Passport" items={qrPassportItems} isDark={isDark} material={material} align="left" />
              <ActionButton icon={Share2} label="Share" material={material} disabled={!canShareAction} onClick={onShare} />
              <ActionMenu icon={MoreHorizontal} label="More" ariaLabel="More profile actions" items={moreItems} isDark={isDark} material={material} />
            </>
          ) : (
            <>
              {friendPrimary || friendsFirst ? (
                <ActionButton
                  icon={FriendIcon}
                  label={friendLabelShort}
                  ariaLabel={friendLabelFull}
                  variant={friendshipStatus === 'friends' || friendshipStatus === 'pending' ? 'glass' : 'brand'}
                  material={material}
                  disabled={friendDisabled}
                  busy={friendRequestLoading}
                  onClick={friendAction}
                />
              ) : (
                <ActionButton
                  icon={FollowIcon}
                  label={followLabel}
                  variant={isFollowing || followPending ? 'glass' : 'brand'}
                  material={material}
                  disabled={followLoading || !canFollowAction}
                  busy={followLoading}
                  title={!onFollowToggle ? 'Preview only: this is how your profile looks to others' : undefined}
                  onClick={onFollowToggle}
                />
              )}
              <ActionButton
                icon={MessageSquare}
                label="Message"
                material={material}
                disabled={!canMessageAction}
                title={!onOpenMessages ? 'Preview only' : (!grant('canMessage') ? 'Messaging is not available' : undefined)}
                onClick={onOpenMessages}
              />
              <ActionButton icon={Share2} label="Share" material={material} disabled={!canShareAction} onClick={onShare} />
              <ActionMenu icon={MoreHorizontal} label="More" ariaLabel="More profile actions" items={moreItems} isDark={isDark} material={material} />
            </>
          )}
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
