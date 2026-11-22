/**
 * Identity hero for Arvdoul profiles (owner and visitor).
 *
 * Compact centered composition that sits directly on the screen canvas
 * (no hero background, cover, banner or panel):
 *
 *   portrait (Vibes ring only while active Vibes exist) -> name + verification
 *   -> @handle + copy -> designations -> ONE metadata row
 *   (Level, Location, Website, Joined) -> bio / tagline -> ONE action row
 *   (owner: Edit Profile, QR / Passport, Share, More)
 *
 * Privacy: every identity detail the viewer may not see (level, titles,
 * creator status, presence) fails closed for visitors unless the matching
 * capability is explicitly granted. Visitor actions also require an explicit
 * capability. This component is not a permission engine; it renders the
 * already-projected profile it is given.
 *
 * Vibes: the ring reads the `vibes` / `vibesLoading` props, which the profile
 * screens pass from the stories they already loaded. The hero never queries.
 *
 * Metrics, treasury, progression, highlights, creator analytics, tabs and
 * content belong to their own components.
 *
 * Props, named exports and callbacks are preserved; `vibes` and
 * `vibesLoading` are the only additions.
 *
 * Caller wiring (the only change needed outside this file), in both
 * ProfileMyScreen.jsx and ProfilePublicScreen.jsx, on <ProfileHeroSection>:
 *   owner:   vibes={stories}      vibesLoading={storiesLoading}
 *   visitor: vibes={storeStories} vibesLoading={storeStoriesLoading}
 * Without these props no ring is drawn (the safe default).
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

// Joined date ("Joined 2026"). Returns null when absent/unparseable so nothing is fabricated.
const formatJoinedDate = (createdAt) => {
  if (!createdAt) return null;
  try {
    const d = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
    if (isNaN(d.getTime())) return null;
    return `Joined ${d.getFullYear()}`;
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

/* ────────────────────────────────────────────────────────────────────────────
 * Hero styles. Everything the hero draws is scoped under `.phs`. There is NO
 * hero background: the root is transparent and sits on the screen's canvas.
 * Glass lives only on individual controls (action buttons, level pill, menus).
 * ──────────────────────────────────────────────────────────────────────────── */

const PHS_CSS = `
.phs{
  --g-title:#FFFFFF;--g-text:#EEF1FF;--g-muted:#AEB9DC;--g-body:#CBD3F2;--g-link:#8FC4FF;--g-hover:rgba(255,255,255,.08);
  --g-fill:linear-gradient(180deg,rgba(255,255,255,.115) 0%,rgba(255,255,255,.035) 100%);
  --g-base:rgba(16,24,66,.52);--g-solid:#0E1640;--g-pop:rgba(10,16,46,.95);
  --g-border:rgba(170,182,255,.20);--g-rim1:rgba(208,198,255,.62);--g-rim2:rgba(80,150,255,.42);--g-spec:rgba(255,255,255,.11);
  --g-shadow:0 14px 26px -14px rgba(0,0,0,.78),0 2px 5px -2px rgba(0,0,0,.42);
  --g-inset:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -10px 14px -12px rgba(0,0,0,.55);
  --brand-shadow:0 14px 26px -12px rgba(68,49,247,.72);
  --focus:#A99BFF;--edge:#03071B;--photo-bg:#0B1438;--online:#2EE59D;
  --ring-glow:rgba(88,70,255,.55);
  --r-gold-bg:linear-gradient(180deg,rgba(245,184,59,.22),rgba(245,184,59,.07));--r-gold-bd:rgba(245,184,59,.50);--r-gold:#F7D98E;
  --r-vio-bg:linear-gradient(180deg,rgba(139,30,243,.32),rgba(68,49,247,.14));--r-vio-bd:rgba(168,125,255,.52);--r-vio:#E6D8FF;
  --r-neu-bg:rgba(226,232,240,.09);--r-neu-bd:rgba(226,232,240,.28);--r-neu:#E2E8F0;
  position:relative;z-index:20;width:100%;padding-top:6px;color:var(--g-text);
  -webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;
}
.phs[data-theme="light"]{
  --g-title:#0E1533;--g-text:#111A3D;--g-muted:#4D587B;--g-body:#3A4466;--g-link:#055BFB;--g-hover:rgba(68,49,247,.07);
  --g-fill:linear-gradient(180deg,rgba(255,255,255,.92) 0%,rgba(255,255,255,.58) 100%);
  --g-base:rgba(236,241,255,.55);--g-solid:#FFFFFF;--g-pop:rgba(252,253,255,.97);
  --g-border:rgba(80,91,177,.16);--g-rim1:rgba(139,30,243,.34);--g-rim2:rgba(5,91,251,.30);--g-spec:rgba(255,255,255,.78);
  --g-shadow:0 14px 24px -16px rgba(40,50,130,.36),0 1px 2px rgba(20,30,80,.07);
  --g-inset:inset 0 1px 0 rgba(255,255,255,.96),inset 0 -10px 14px -12px rgba(40,60,140,.13);
  --brand-shadow:0 14px 24px -12px rgba(68,49,247,.5);
  --focus:#4431F7;--edge:#F6F8FC;--photo-bg:#E2E8F0;--online:#17B97A;
  --ring-glow:rgba(68,49,247,.34);
  --r-gold-bg:linear-gradient(180deg,#FFF8E6,#FFEFC2);--r-gold-bd:rgba(217,160,30,.55);--r-gold:#7A4E00;
  --r-vio-bg:linear-gradient(180deg,#F6EEFF,#ECE3FF);--r-vio-bd:rgba(139,30,243,.32);--r-vio:#6B21A8;
  --r-neu-bg:linear-gradient(180deg,#F8FAFC,#EEF2F7);--r-neu-bd:#CBD5E1;--r-neu:#334155;
}
.phs *,.phs *::before,.phs *::after{box-sizing:border-box}
.phs button,.phs a{-webkit-tap-highlight-color:transparent}
.phs button:focus-visible,.phs a:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.phs-inner{width:100%;max-width:520px;margin:0 auto;display:flex;flex-direction:column;align-items:center;text-align:center}
.phs-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}

/* glass: tint + gradient rim + specular + real blur; opaque fallback for Lite / no backdrop-filter */
.phs-glass{position:relative;isolation:isolate;border:1px solid var(--g-border);background:var(--g-fill),var(--g-base);
  box-shadow:var(--g-shadow),var(--g-inset);-webkit-backdrop-filter:blur(18px) saturate(165%);backdrop-filter:blur(18px) saturate(165%)}
.phs-glass::before{content:"";position:absolute;inset:-1px;padding:1px;border-radius:inherit;pointer-events:none;
  background:linear-gradient(145deg,var(--g-rim1),transparent 34%,transparent 66%,var(--g-rim2));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.phs-glass::after{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;pointer-events:none;background:radial-gradient(120% 70% at 16% -10%,var(--g-spec),transparent 62%)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  .phs-glass{background:var(--g-fill),var(--g-solid)}
}
.phs[data-lite="true"] .phs-glass{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--g-fill),var(--g-solid)}
.phs[data-lite="true"] .phs-glass::after{display:none}
.phs[data-lite="true"] *{transition:none!important}

/* portrait + conditional Vibes ring */
.phs-portrait{position:relative;flex:none;border-radius:50%}
.phs-photo{position:absolute;display:block;border-radius:50%;overflow:hidden;background:var(--photo-bg);padding:0;border:0}
button.phs-photo{cursor:pointer;transition:transform .15s}
button.phs-photo:active{transform:scale(.98)}
.phs-photo::after{content:"";position:absolute;inset:0;border-radius:50%;pointer-events:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}
.phs-photo img{display:block;width:100%;height:100%;object-fit:cover}
.phs-initials{display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:34px;font-weight:700;color:var(--g-muted)}
.phs-ring{position:absolute;inset:0;border-radius:50%;padding:3px;pointer-events:none;
  background:conic-gradient(from 200deg,#8B1EF3,#4431F7,#055BFB,#22D3EE,#055BFB,#8B1EF3);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.phs-ring[data-state="seen"]{background:linear-gradient(135deg,rgba(139,30,243,.6),rgba(5,91,251,.6));opacity:.5}
.phs-ring[data-state="active"]{opacity:.82}
.phs-ring-glow{position:absolute;inset:3px;border-radius:50%;pointer-events:none;box-shadow:0 0 20px -2px var(--ring-glow)}
.phs-dot{position:absolute;left:5%;bottom:7%;width:15px;height:15px;border-radius:50%;background:var(--online);box-shadow:0 0 0 3px var(--edge)}
.phs-vbadge{position:absolute;right:3%;bottom:3%;display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:#055BFB;color:#fff;box-shadow:0 0 0 3px var(--edge),0 4px 10px -3px rgba(5,91,251,.6)}
.phs-vbadge svg{width:14px;height:14px}

/* identity */
.phs-name{margin:10px 0 0;max-width:100%;font-size:clamp(22px,calc(16px + 1.6vw),28px);line-height:1.15;font-weight:800;letter-spacing:-.025em;color:var(--g-title);overflow-wrap:anywhere;text-wrap:balance}
.phs-vcheck{position:relative;display:inline-flex;vertical-align:-3px;margin-left:6px;padding:0;border:0;background:none;border-radius:50%;line-height:0}
.phs-vcheck svg{width:20px;height:20px;color:#fff;fill:#055BFB}
button.phs-vcheck{cursor:pointer;transition:transform .15s}
button.phs-vcheck::after{content:"";position:absolute;inset:-9px}
button.phs-vcheck:active{transform:scale(.94)}
.phs-handle{position:relative;margin:2px 0 0;display:inline-flex;align-items:center;gap:6px;max-width:100%;min-height:26px;padding:0 6px;border:0;border-radius:8px;background:none;
  font:inherit;font-size:14px;font-weight:500;line-height:1.3;color:var(--g-muted);cursor:pointer;transition:color .15s}
.phs-handle::after{content:"";position:absolute;inset:-9px -4px}
.phs-handle:hover{color:var(--g-title)}
.phs-handle span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.phs-handle svg{flex:none;width:14px;height:14px;opacity:.75}
.phs-handle svg[data-ok]{opacity:1;color:var(--online)}
.phs-desig{margin-top:6px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px}
.phs-pill{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 11px 0 9px;border:1px solid transparent;border-radius:999px;font:inherit;font-size:11.5px;font-weight:650;line-height:1;white-space:nowrap;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.22)}
.phs-pill svg{flex:none;width:14px;height:14px}
button.phs-pill{cursor:pointer;transition:filter .15s,transform .15s}
button.phs-pill:hover{filter:brightness(1.1)}
button.phs-pill:active{transform:scale(.97)}
.phs-pill[data-kind="royal"]{background:var(--r-gold-bg);border-color:var(--r-gold-bd);color:var(--r-gold)}
.phs-pill[data-kind="creator"]{background:var(--r-vio-bg);border-color:var(--r-vio-bd);color:var(--r-vio)}
.phs-pill[data-kind="premium"]{background:var(--r-neu-bg);border-color:var(--r-neu-bd);color:var(--r-neu)}

/* one compact metadata row: Level · Location · Website · Joined */
.phs-meta{margin-top:10px;width:100%;display:flex;align-items:center;justify-content:center;flex-wrap:nowrap;gap:6px clamp(7px,2.6vw,12px);
  font-size:clamp(11px,3vw,12.5px);line-height:1.2;color:var(--g-muted)}
.phs-mi{display:inline-flex;align-items:center;gap:4px;min-width:0;flex:0 1 auto}
.phs-mi svg{flex:none;width:13px;height:13px}
.phs-mi>span,.phs-mi>a,.phs-mi>button{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.phs-mi>a{color:var(--g-link);text-decoration:underline;text-decoration-color:transparent;text-underline-offset:2px;transition:text-decoration-color .15s}
.phs-mi>a:hover{text-decoration-color:currentColor}
.phs-mi>button{padding:0;border:0;background:none;font:inherit;color:inherit;cursor:pointer;border-radius:4px}
.phs-mi>button:hover{text-decoration:underline;text-underline-offset:2px}
.phs-level{display:inline-flex;align-items:center;gap:5px;flex:none;height:24px;padding:0 9px 0 3px;border-radius:999px;font:inherit;font-size:11.5px;font-weight:700;line-height:1;color:var(--g-title);cursor:pointer;
  transition:transform .15s,filter .15s}
.phs-level:hover{filter:brightness(1.08)}
.phs-level:active{transform:scale(.97)}
.phs-level-text{display:none}
.phs-prof{margin-top:5px;max-width:100%;display:inline-flex;align-items:center;gap:5px;font-size:11.5px;line-height:1.3;color:var(--g-muted)}
.phs-prof svg{flex:none;width:13px;height:13px}
.phs-prof span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* bio, tagline, motto */
.phs-bio{margin-top:8px;width:100%;max-width:44ch;font-size:13.5px;line-height:1.45;color:var(--g-body);overflow-wrap:anywhere}
.phs-bio p{margin:0;white-space:pre-line}
.phs-bio p[data-clamp="true"]{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.phs-bio .phs-tag{margin-top:4px;font-size:12.5px;color:var(--g-muted)}
.phs-bio .phs-motto{margin-top:4px;font-size:12.5px;font-style:italic;color:var(--g-muted)}
.phs-more{position:relative;margin-top:2px;display:inline-flex;align-items:center;gap:3px;min-height:24px;padding:0 6px;border:0;border-radius:6px;background:none;font:inherit;font-size:12px;font-weight:650;color:var(--g-link);cursor:pointer}
.phs-more::after{content:"";position:absolute;inset:-10px -6px}
.phs-more svg{width:14px;height:14px;transition:transform .15s}
.phs-more[aria-expanded="true"] svg{transform:rotate(180deg)}
.phs-add{margin-top:8px;min-height:30px;padding:0 10px;border:0;border-radius:8px;background:none;font:inherit;font-size:13px;font-weight:600;color:var(--g-link);cursor:pointer}
.phs-add:hover{text-decoration:underline;text-underline-offset:2px}

/* one compact action row */
.phs-actions{position:relative;margin-top:14px;width:100%;display:grid;gap:6px;grid-template-columns:minmax(0,1.2fr) minmax(0,1.42fr) minmax(0,.92fr) minmax(0,.86fr)}
.phs-actions[data-kind="visitor"]{grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,.9fr) minmax(0,.8fr)}
.phs-cell{min-width:0}
.phs-btn{position:relative;display:flex;align-items:center;justify-content:center;gap:5px;width:100%;min-height:46px;padding:5px 6px;border-radius:16px;
  font:inherit;font-size:clamp(10.5px,2.7vw,12px);font-weight:650;line-height:1.1;color:var(--g-text);text-align:center;cursor:pointer;
  transition:transform .15s,filter .15s,border-color .15s}
.phs-btn svg{flex:none;width:clamp(16px,4.3vw,18px);height:clamp(16px,4.3vw,18px)}
.phs-btn>span{min-width:0;overflow-wrap:normal;word-break:normal}
.phs-btn:active:not(:disabled){transform:scale(.97)}
.phs-btn:disabled{opacity:.5;cursor:not-allowed}
.phs-btn[aria-busy="true"]{cursor:progress}
.phs-brand{position:relative;isolation:isolate;border:1px solid rgba(255,255,255,.26);color:#fff;
  background:linear-gradient(125deg,#8B1EF3 0%,#4431F7 52%,#055BFB 100%);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 -8px 12px -8px rgba(10,10,90,.45),var(--brand-shadow)}
.phs-brand::after{content:"";position:absolute;z-index:-1;inset:1px 1px 52% 1px;border-radius:15px 15px 50% 50% / 15px 15px 28% 28%;pointer-events:none;background:linear-gradient(180deg,rgba(255,255,255,.26),rgba(255,255,255,0))}
@media (hover:hover){.phs-btn:hover:not(:disabled){filter:brightness(1.07)}}

.phs-menu{position:absolute;top:calc(100% + 6px);z-index:30;width:min(232px,calc(100vw - 24px));max-height:min(60vh,360px);overflow-y:auto;overscroll-behavior:contain;padding:5px;border-radius:18px;text-align:left;
  background:var(--g-fill),var(--g-pop);opacity:0;visibility:hidden;transform:scale(.96);transition:opacity .15s,transform .15s,visibility .15s}
.phs-menu[data-align="left"]{left:0;transform-origin:top left}
.phs-menu[data-align="right"]{right:0;transform-origin:top right}
.phs-menu[data-open="true"]{opacity:1;visibility:visible;transform:none}
.phs-mitem{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:0 12px;border:0;border-radius:12px;background:none;font:inherit;font-size:13px;font-weight:600;color:var(--g-text);text-align:left;cursor:pointer;transition:background-color .15s}
.phs-mitem:hover:not(:disabled),.phs-mitem:focus-visible{background:var(--g-hover)}
.phs-mitem:disabled{opacity:.5;cursor:not-allowed}
.phs-mitem svg{flex:none;width:16px;height:16px;color:var(--g-muted)}
.phs-mitem span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.phs-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:2px}
.phs-back{display:inline-flex;align-items:center;gap:4px;min-height:44px;padding:0 12px 0 6px;margin-left:-6px;border:0;border-radius:12px;background:none;font:inherit;font-size:13px;font-weight:600;color:var(--g-muted);cursor:pointer}
.phs-back:hover{background:var(--g-hover)}
.phs-back svg{width:16px;height:16px}
.phs-iconbtn{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:14px;padding:0;color:var(--g-text);cursor:pointer}
.phs-iconbtn:disabled{opacity:.5}
.phs-iconbtn svg{width:16px;height:16px}
.phs-spin{animation:phs-spin .8s linear infinite}
@keyframes phs-spin{to{transform:rotate(360deg)}}

@media (min-width:400px){.phs-level-text{display:inline}}
@media (min-width:480px){.phs-actions{gap:8px}.phs-name{margin-top:12px}.phs-meta{margin-top:12px}}
@media (max-width:339px){.phs-meta{flex-wrap:wrap}}
@media (max-width:349px){.phs-btn{flex-direction:column;gap:2px;padding:4px 2px}}
@media (forced-colors:active){
  .phs-glass,.phs-brand,.phs-pill{border:1px solid CanvasText;forced-color-adjust:auto}
  .phs-glass::before,.phs-glass::after,.phs-brand::after{display:none}
  .phs-ring{background:Highlight}
}
@media (prefers-reduced-motion:reduce){
  .phs *,.phs *::before,.phs *::after{transition:none!important}
  .phs-spin{animation:none}
  .phs-btn:active:not(:disabled),.phs-level:active,button.phs-photo:active{transform:none}
}
`;

/** Joined date: ISO, Date, millis, seconds or Firestore Timestamp -> epoch ms, else null. */
const toMillis = (value) => {
  if (value === null || value === undefined || value === '') return null;
  try {
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (typeof value === 'object' && typeof value.seconds === 'number') return value.seconds * 1000;
    if (typeof value === 'number') return value < 1e12 ? value * 1000 : value;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : null;
  } catch {
    return null;
  }
};

const INACTIVE_STORY_STATUS = new Set(['deleted', 'removed', 'expired', 'rejected', 'archived']);
const BLOCKED_MODERATION = new Set(['rejected', 'removed', 'blocked', 'hidden']);

/**
 * Vibes availability for the portrait ring. Reads ONLY the list the profile screen
 * already loaded through the authorized story path (no queries here), and drops
 * records that are explicitly deleted, expired, removed or moderated out.
 * Returns null (no ring) when nothing is available, while loading, or when the data
 * is missing; otherwise 'unseen' | 'seen' | 'active' (seen state unknown).
 */
const deriveVibesRingState = (vibes, loading) => {
  if (loading || !vibes) return null;
  const list = Array.isArray(vibes) ? vibes : Array.isArray(vibes.items) ? vibes.items : Array.isArray(vibes.stories) ? vibes.stories : [];
  const now = Date.now();
  const active = list.filter((v) => {
    if (!v || typeof v !== 'object') return false;
    if (v.isDeleted === true) return false;
    if (typeof v.status === 'string' && INACTIVE_STORY_STATUS.has(v.status.toLowerCase())) return false;
    if (typeof v.moderationStatus === 'string' && BLOCKED_MODERATION.has(v.moderationStatus.toLowerCase())) return false;
    const exp = toMillis(v.expiresAt);
    if (exp !== null && exp <= now) return false;
    return true;
  });
  if (active.length === 0) return null;
  const seenFlag = (v) => (v.seen === true || v.viewed === true ? true : v.seen === false || v.viewed === false ? false : null);
  const flags = active.map(seenFlag);
  if (flags.some((f) => f === false)) return 'unseen';
  if (flags.every((f) => f === true)) return 'seen';
  return 'active';
};

/** Compact domain for display ("https://www.arvdoul.com/x" -> "arvdoul.com"). */
const toDomainLabel = (raw, href) => {
  if (!raw) return '';
  try {
    const u = new URL(href || (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`));
    return u.hostname.replace(/^www\./i, '') || raw;
  } catch {
    return raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/[/?#].*$/, '');
  }
};

/** One compact action control (icon left, label right). */
const ActionButton = forwardRef(({ icon: Icon, label, variant = 'glass', busy = false, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn('phs-btn', variant === 'brand' ? 'phs-brand' : 'phs-glass')}
    aria-busy={busy || undefined}
    {...rest}
  >
    <Icon className={busy ? 'phs-spin' : undefined} aria-hidden="true" />
    <span>{label}</span>
  </button>
));
ActionButton.displayName = 'ActionButton';

/**
 * Action button that opens a small glass menu (More, QR / Passport). Outside press and
 * Escape close it, focus moves in on open and back to the trigger on close, arrow keys,
 * Home and End move between items. The menu is positioned against the action row.
 */
const PopMenu = ({ icon, label, items, align = 'left', menuLabel, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const menuId = useId();
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
    const nodes = Array.from(panelRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || []);
    if (!nodes.length) return;
    const index = nodes.indexOf(document.activeElement);
    let next = null;
    if (e.key === 'ArrowDown') next = nodes[(index + 1) % nodes.length];
    else if (e.key === 'ArrowUp') next = nodes[(index - 1 + nodes.length) % nodes.length];
    else if (e.key === 'Home') next = nodes[0];
    else if (e.key === 'End') next = nodes[nodes.length - 1];
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
    <div ref={wrapRef} className="phs-cell">
      <ActionButton
        ref={triggerRef}
        icon={icon}
        label={label}
        disabled={disabled || items.length === 0}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      />
      <div
        id={menuId}
        ref={panelRef}
        role="menu"
        aria-label={menuLabel}
        data-open={open}
        data-align={align}
        onKeyDown={handleKeyDown}
        className="phs-menu phs-glass"
      >
        {items.map(({ key, icon: ItemIcon, label: itemLabel, disabled: itemDisabled, busy, onClick }) => (
          <button
            key={key}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="phs-mitem"
            disabled={itemDisabled}
            aria-busy={busy || undefined}
            onClick={run(onClick)}
          >
            <ItemIcon className={busy ? 'phs-spin' : undefined} aria-hidden="true" />
            <span>{itemLabel}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const PORTRAIT_SIZE = 'clamp(96px, 26vw, 128px)';
const RING_INSET = 6;

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
  vibes = null,
  vibesLoading = false,
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

  // --- Action permissions: visitors need an explicit grant AND a callback ---
  const canShareAction = Boolean(onShare) && (isOwner || caps.canShare === true);
  const canMessageAction = Boolean(onOpenMessages) && caps.canMessage === true;
  const canCallAction = callsEnabled && Boolean(onOpenMessages) && caps.canCall === true;
  const canTipAction = Boolean(onOpenTipModal) && caps.canTip === true;
  const followPermitted = isFollowing
    ? caps.canUnfollow === true
    : requestStatus === 'pending'
      ? caps.canCancelRequest === true
      : caps.canFollow === true;
  const canFollowAction = Boolean(onFollowToggle) && followPermitted;

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
  const isRoyal = titlesAllowed && Boolean(resolveRoyalFlag(profile));
  const royalTitleId = isRoyal ? resolveActiveTitleId(profile) : null;
  const activeTitleObject = profile?.activeTitle && typeof profile.activeTitle === 'object' ? profile.activeTitle : null;
  const canonicalTitleLabel = cleanString(activeTitleObject?.name) || cleanString(activeTitleObject?.label);
  const royalLabel = canonicalTitleLabel
    || (typeof royalTitleId === 'string' && royalTitleId ? humanizeTitle(royalTitleId) : 'Royal Family');

  // Presence: only when real presence data says online and the viewer may see it.
  const isOnline = presenceAllowed && Boolean(profile?.presence?.status === 'online' || profile?.isOnline === true);

  // Vibes ring: the ONLY colourful orbit around the portrait, and only for active Vibes.
  const ringState = useMemo(() => deriveVibesRingState(vibes, vibesLoading), [vibes, vibesLoading]);

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
  const sameText = (a, b) => a.toLowerCase() === b.toLowerCase();
  const rawMotto = titlesAllowed ? cleanString(profile?.heraldicMotto) : '';
  const motto = rawMotto && !sameText(rawMotto, bio) ? rawMotto : '';
  const rawTagline = cleanString(profile?.tagline);
  const tagline = rawTagline && !sameText(rawTagline, motto) && !sameText(rawTagline, bio) ? rawTagline : '';
  const profession = cleanString(profile?.profession);
  const location = cleanString(profile?.location);
  const website = cleanString(profile?.website);
  const websiteHref = website ? sanitizeProfileUrl(website) : null;
  const websiteLabel = toDomainLabel(website, websiteHref);
  const joinedDate = profile?.createdAt ? formatJoinedDate(profile.createdAt) : null;
  const isLongBio = bio.length > BIO_CLAMP_THRESHOLD;

  const showInlineBack = Boolean(onBack && !hasTopAppBar);
  const showHeroRefresh = Boolean(onRefresh && !showInlineBack);
  const passportUrl = isOwner ? '/passport' : (profileUid ? `/passport/${profileUid}` : null);

  // --- Visitor relationship: Friends-first for eligible lower-level, non-creator profiles ---
  // The gate is a relationship rule (never displayed), so it reads the projected level directly.
  const followersGate = toFiniteNumber(LevelModule.LEVEL_GATES?.publicFollowers);
  const relationCreator = !isOwner && Boolean(resolveCreatorFlag(profile || {}, {}, rawLevel));
  const friendsFirst = !isOwner && !relationCreator && followersGate !== null && rawLevel !== null && rawLevel < followersGate;
  const acceptIsPrimary = !isOwner && friendshipStatus === 'received' && Boolean(onFriendRequestToggle);

  const followLabel = isFollowing ? 'Following' : requestStatus === 'pending' ? 'Requested' : 'Follow';
  const FollowIcon = isFollowing ? UserCheck : requestStatus === 'pending' ? Clock : UserPlus;
  const previewHint = 'Preview only: this is how your profile looks to others';

  const followControl = {
    key: 'follow',
    icon: FollowIcon,
    label: followLabel,
    variant: isFollowing || requestStatus === 'pending' ? 'glass' : 'brand',
    disabled: followLoading || !canFollowAction,
    busy: followLoading,
    onClick: onFollowToggle,
    title: !onFollowToggle ? previewHint : undefined,
  };

  const friendControl = (() => {
    if (friendshipStatus === 'friends') {
      return { key: 'friend', icon: UserCheck, label: 'Friends', variant: 'glass', disabled: true };
    }
    if (friendshipStatus === 'pending') {
      return onCancelFriendRequest
        ? { key: 'friend', icon: X, label: 'Cancel request', variant: 'glass', disabled: friendRequestLoading, busy: friendRequestLoading, onClick: onCancelFriendRequest }
        : { key: 'friend', icon: Clock, label: 'Request sent', variant: 'glass', disabled: true };
    }
    return {
      key: 'friend',
      icon: UserPlus,
      label: 'Add friend',
      variant: 'brand',
      disabled: friendRequestLoading || !onFriendRequestToggle,
      busy: friendRequestLoading,
      onClick: onFriendRequestToggle,
      title: !onFriendRequestToggle ? previewHint : undefined,
    };
  })();

  const acceptControl = {
    key: 'accept',
    icon: UserPlus,
    label: 'Accept',
    variant: 'brand',
    disabled: friendRequestLoading,
    busy: friendRequestLoading,
    onClick: onFriendRequestToggle,
  };

  // Primary relationship control. A received request always wins; accepting calls the friend callback.
  const primaryRelation = isOwner ? null : acceptIsPrimary ? acceptControl : friendsFirst ? friendControl : followControl;

  // The other relationship (if legitimately offered) lives in the More menu.
  const secondaryRelation = (() => {
    if (isOwner) return null;
    if (acceptIsPrimary) return friendsFirst ? null : (onFollowToggle ? followControl : null);
    if (friendsFirst) return isFollowing && onFollowToggle ? followControl : null;
    if (!onFriendRequestToggle) return null;
    return friendControl;
  })();

  // Menu selection helpers
  const menuEntry = ({ key, icon, label, disabled, busy, onClick }) => ({ key, icon, label, disabled, busy, onClick });

  const showQrPassport = isOwner;
  const qrPassportItems = [
    { key: 'qr', icon: QrCode, label: 'QR code', disabled: !onOpenQrCode, onClick: onOpenQrCode },
    { key: 'passport', icon: ShieldCheck, label: 'Digital passport', disabled: !passportUrl, onClick: () => passportUrl && navigate(passportUrl) },
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
        secondaryRelation && menuEntry(secondaryRelation),
        onOpenQrCode && { key: 'qr', icon: QrCode, label: 'QR code', onClick: onOpenQrCode },
        passportUrl && { key: 'passport', icon: ShieldCheck, label: 'Digital passport', onClick: () => navigate(passportUrl) },
        callsEnabled && { key: 'call', icon: Phone, label: 'Audio call', disabled: !canCallAction || callPending, busy: callPending, onClick: handleStartCall },
        canTipAction && { key: 'gift', icon: Gift, label: 'Send coins', onClick: onOpenTipModal },
        showHeroRefresh && { key: 'refresh', icon: RefreshCw, label: 'Refresh', disabled: isRefreshing, busy: isRefreshing, onClick: onRefresh },
        onOpenOptions && { key: 'options', icon: MoreHorizontal, label: 'More options', onClick: onOpenOptions },
      ]
  ).filter(Boolean);

  const designations = [
    isRoyal && { key: 'royal', kind: 'royal', label: royalLabel, icon: Crown, onClick: () => handleOpenRoadmap('royals') },
    isCreator && { key: 'creator', kind: 'creator', label: creatorLabel, icon: Star },
    isPremium && { key: 'premium', kind: 'premium', label: 'Premium', icon: Gem },
  ].filter(Boolean);

  const canOpenAvatar = Boolean(isOwner && onAvatarClick);
  const hasMeta = visibleLevel !== null || Boolean(location) || Boolean(websiteLabel) || Boolean(joinedDate);

  const portraitFace = avatarFailed ? (
    <span aria-hidden="true" className="phs-initials">{initials}</span>
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
  const photoStyle = { inset: ringState ? RING_INSET : 0 };

  const verifiedIcon = <BadgeCheck aria-hidden="true" />;

  return (
    <div
      role="group"
      aria-label="Profile header"
      className="phs"
      data-theme={isDark ? 'dark' : 'light'}
      data-lite={isLite ? 'true' : 'false'}
    >
      <style>{PHS_CSS}</style>

      {showInlineBack && (
        <div className="phs-top">
          <button type="button" onClick={onBack} aria-label="Go back" className="phs-back">
            <ChevronLeft aria-hidden="true" />
            <span>Back</span>
          </button>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-busy={isRefreshing}
              aria-label="Refresh profile"
              className="phs-glass phs-iconbtn"
            >
              <RefreshCw className={isRefreshing ? 'phs-spin' : undefined} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div className="phs-inner">
        {/* 1. Portrait. The ring exists only while the profile has active Vibes. */}
        <div className="phs-portrait" style={{ width: PORTRAIT_SIZE, height: PORTRAIT_SIZE }}>
          {ringState && (
            <>
              {!isLite && ringState === 'unseen' && <span aria-hidden="true" className="phs-ring-glow" />}
              <span aria-hidden="true" className="phs-ring" data-state={ringState} />
              <span className="phs-sr">Has active Vibes</span>
            </>
          )}
          {canOpenAvatar ? (
            <button type="button" onClick={onAvatarClick} aria-label="Update profile avatar" className="phs-photo" style={photoStyle}>
              {portraitFace}
            </button>
          ) : (
            <div className="phs-photo" style={photoStyle}>{portraitFace}</div>
          )}
          {isOnline && <span role="img" aria-label="Online" className="phs-dot" />}
          {isVerified && <span aria-hidden="true" className="phs-vbadge"><BadgeCheck style={{ fill: 'none' }} /></span>}
        </div>

        {/* 2. Display name + verification */}
        <h1 className="phs-name">
          <span>{displayName}</span>
          {isVerified && (
            onOpenVerificationModal ? (
              <button type="button" onClick={onOpenVerificationModal} aria-label="Verified account credentials" className="phs-vcheck">
                {verifiedIcon}
              </button>
            ) : (
              <span role="img" aria-label="Verified account" className="phs-vcheck">{verifiedIcon}</span>
            )
          )}
        </h1>

        {/* 3. Username + copy */}
        {username && (
          <button type="button" onClick={handleCopyHandle} aria-label={`Copy handle @${username}`} className="phs-handle">
            <span>@{username}</span>
            {copiedHandle ? <Check data-ok="true" aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </button>
        )}
        <span className="phs-sr" role="status" aria-live="polite">{copiedHandle ? 'Handle copied' : ''}</span>

        {/* 4. Designations (earned and permitted only) */}
        {designations.length > 0 && (
          <div className="phs-desig">
            {designations.map(({ key, kind, label, icon: Icon, onClick }) => {
              const content = (
                <>
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </>
              );
              return onClick ? (
                <button key={key} type="button" onClick={onClick} className="phs-pill" data-kind={kind}>{content}</button>
              ) : (
                <span key={key} className="phs-pill" data-kind={kind}>{content}</span>
              );
            })}
          </div>
        )}

        {/* 5. One metadata row: Level · Location · Website · Joined */}
        {hasMeta && (
          <div className="phs-meta">
            {visibleLevel !== null && (
              <button
                type="button"
                onClick={() => handleOpenRoadmap('levels')}
                aria-label={`Level ${visibleLevel}. Open level roadmap`}
                className="phs-glass phs-level"
              >
                {LevelNumeralBadge ? (
                  <LevelNumeralBadge level={visibleLevel} theme={isDark ? 'dark' : 'light'} size="sm" />
                ) : (
                  <span aria-hidden="true">{visibleLevel}</span>
                )}
                <span className="phs-level-text" aria-hidden="true">Level {visibleLevel}</span>
              </button>
            )}
            {location && (
              <span className="phs-mi">
                <MapPin aria-hidden="true" />
                {isOwner && onOpenLocationSetup ? (
                  <button type="button" onClick={onOpenLocationSetup}>{location}</button>
                ) : (
                  <span>{location}</span>
                )}
              </span>
            )}
            {websiteLabel && (
              <span className="phs-mi">
                <Link2 aria-hidden="true" />
                {websiteHref ? (
                  <a href={websiteHref} target="_blank" rel="noopener noreferrer">
                    {websiteLabel}
                    <span className="phs-sr"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <span>{websiteLabel}</span>
                )}
              </span>
            )}
            {joinedDate && (
              <span className="phs-mi">
                <Calendar aria-hidden="true" />
                <span>{joinedDate}</span>
              </span>
            )}
          </div>
        )}

        {profession && (
          <span className="phs-prof">
            <Briefcase aria-hidden="true" />
            <span>{profession}</span>
          </span>
        )}

        {/* 6. Bio, then distinct tagline / motto */}
        {(bio || tagline || motto) && (
          <div className="phs-bio">
            {bio && <p data-clamp={isLongBio && !bioExpanded ? 'true' : 'false'}>{bio}</p>}
            {bio && isLongBio && (
              <button type="button" className="phs-more" onClick={() => setBioExpanded((v) => !v)} aria-expanded={bioExpanded}>
                <span>{bioExpanded ? 'Less' : 'More'}</span>
                <ChevronDown aria-hidden="true" />
              </button>
            )}
            {tagline && <p className="phs-tag">{tagline}</p>}
            {motto && <p className="phs-motto">{motto}</p>}
          </div>
        )}
        {!bio && !tagline && !motto && isOwner && onOpenQuickEdit && (
          <button type="button" onClick={() => onOpenQuickEdit('bio')} className="phs-add">Add a bio</button>
        )}

        {/* 7. Actions: one compact row */}
        <div className="phs-actions" data-kind={isOwner ? 'owner' : 'visitor'}>
          {isOwner ? (
            <>
              <div className="phs-cell">
                <ActionButton
                  icon={Edit3}
                  label="Edit Profile"
                  variant="brand"
                  onClick={onEditProfile || (() => navigate('/profile/edit'))}
                />
              </div>
              <PopMenu icon={QrCode} label="QR / Passport" items={qrPassportItems} align="left" menuLabel="QR code and Digital passport" disabled={!showQrPassport} />
              <div className="phs-cell">
                <ActionButton icon={Share2} label="Share" disabled={!canShareAction} onClick={onShare} />
              </div>
              <PopMenu icon={MoreHorizontal} label="More" items={moreItems} align="right" menuLabel="More profile actions" />
            </>
          ) : (
            <>
              <div className="phs-cell">
                <ActionButton
                  icon={primaryRelation.icon}
                  label={primaryRelation.label}
                  variant={primaryRelation.variant}
                  busy={primaryRelation.busy}
                  disabled={primaryRelation.disabled}
                  title={primaryRelation.title}
                  onClick={primaryRelation.onClick}
                />
              </div>
              <div className="phs-cell">
                <ActionButton
                  icon={MessageSquare}
                  label="Message"
                  disabled={!canMessageAction}
                  title={!onOpenMessages ? 'Preview only' : (caps.canMessage !== true ? 'Messaging is not available' : undefined)}
                  onClick={onOpenMessages}
                />
              </div>
              <div className="phs-cell">
                <ActionButton icon={Share2} label="Share" disabled={!canShareAction} onClick={onShare} />
              </div>
              <PopMenu icon={MoreHorizontal} label="More" items={moreItems} align="right" menuLabel="More profile actions" />
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