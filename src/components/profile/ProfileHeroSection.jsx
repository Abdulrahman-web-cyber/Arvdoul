/**
 * Identity hero for Arvdoul profiles (owner and visitor).
 *
 * Compact centered composition that sits directly on the screen canvas
 * (no hero background, cover, banner or panel):
 *
 *   portrait (Vibes ring only while active Vibes exist) -> name + verification
 *   -> @handle + copy -> "Level N" glass pill with the earned designations
 *   -> ONE metadata row (Location, Website, Joined) -> bio / tagline
 *   -> ONE action row
 *   (owner: [Edit Profile] + icon-only QR code, Digital passport, Share, More)
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
  Info,
} from "lucide-react";
import { cn } from '../../lib/utils';
import * as LevelModule from '../../services/levelSystemService';
import * as ReadModel from '../../services/profileReadModel.js';
import * as DeviceCaps from '../../utils/deviceCapabilities.js';
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
 *
 * Liquid glass is built from real layers on each control (not a flat tint):
 *   1. top specular bloom        2. electric-blue caustic (bottom right)
 *   3. violet caustic (bottom left)  4. body tint over a translucent base
 *   + gradient rim (masked ::before) + gloss band (::after) + inset light
 *   + real backdrop blur / saturation, with an opaque fallback for Lite mode.
 * Material tiers: subtle (icon buttons) · premium (level pill) ·
 * deep (menus) · signature (Edit Profile / primary relationship action).
 * ──────────────────────────────────────────────────────────────────────────── */

const PHS_CSS = `
.phs{
  --v:200,43,255;--b:0,136,255;
  --g-title:#F5F7FF;--g-text:#E9EDFF;--g-muted:#B4BFDE;--g-body:#D2D9F1;--g-link:#8FC4FF;--g-hover:rgba(255,255,255,.08);--g-pop:rgba(11,18,52,.84);
  --lg-spec:.22;--lg-spec2:.05;--lg-v:.16;--lg-b:.22;--lg-gloss:.10;
  --lg-base:rgba(14,20,60,.30);--lg-solid:#0B1234;
  --lg-shadow:0 12px 24px -18px rgba(0,0,0,.55),0 2px 6px -3px rgba(0,0,0,.25),0 0 18px -10px rgba(var(--b),.24);
  --lg-inset:inset 0 1px 1px rgba(255,255,255,.22),inset 0 -1px 1px rgba(150,170,255,.14),inset 0 0 16px rgba(130,110,255,.08),inset 0 -10px 16px -14px rgba(var(--b),.26);
  --lg-rim:linear-gradient(140deg,rgba(255,255,255,.36),rgba(255,255,255,.09) 28%,rgba(255,255,255,.03) 56%,rgba(var(--b),.34));
  --sig-shadow:0 16px 30px -12px rgba(68,49,247,.85),0 0 26px -6px rgba(var(--b),.55);
  --lv-a:#D9A0FF;--lv-b:#5FB2FF;
  --focus:#B2A6FF;--edge:#03071B;--photo-bg:#0B1438;--online:#2EE59D;--ring-glow:rgba(88,70,255,.55);
  --r-gold-bg:linear-gradient(180deg,rgba(245,184,59,.26),rgba(245,184,59,.08));--r-gold-bd:rgba(245,184,59,.55);--r-gold:#F8DC95;
  --r-vio-bg:linear-gradient(180deg,rgba(139,30,243,.38),rgba(68,49,247,.16));--r-vio-bd:rgba(176,132,255,.58);--r-vio:#EBDDFF;
  --r-neu-bg:rgba(226,232,240,.10);--r-neu-bd:rgba(226,232,240,.30);--r-neu:#E2E8F0;
  --ab:clamp(42px,11.4vw,46px);
  position:relative;z-index:20;width:100%;padding-top:2px;color:var(--g-text);
  -webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;
}
.phs[data-theme="light"]{
  --g-title:#121A3A;--g-text:#16204A;--g-muted:#4B5679;--g-body:#38425F;--g-link:#055BFB;--g-hover:rgba(68,49,247,.07);--g-pop:rgba(252,253,255,.97);
  --lg-spec:.96;--lg-spec2:.5;--lg-v:.16;--lg-b:.22;--lg-gloss:.7;
  --lg-base:rgba(255,255,255,.50);--lg-solid:#FFFFFF;
  --lg-shadow:0 16px 28px -18px rgba(40,50,150,.45),0 2px 4px -2px rgba(30,40,110,.12),0 0 20px -10px rgba(var(--b),.30);
  --lg-inset:inset 0 1px 1px #fff,inset 0 -1px 1px rgba(110,120,230,.24),inset 0 0 18px rgba(255,255,255,.55),inset 0 -12px 18px -14px rgba(var(--b),.30);
  --lg-rim:linear-gradient(140deg,#fff,rgba(255,255,255,.55) 28%,rgba(90,80,220,.14) 56%,rgba(var(--b),.52));
  --sig-shadow:0 16px 28px -12px rgba(68,49,247,.55),0 0 22px -8px rgba(var(--b),.40);
  --lv-a:#8B1EF3;--lv-b:#055BFB;
  --focus:#4431F7;--edge:#F6F8FC;--photo-bg:#E2E8F0;--online:#17B97A;--ring-glow:rgba(68,49,247,.34);
  --r-gold-bg:linear-gradient(180deg,#FFF8E6,#FFEBB8);--r-gold-bd:rgba(217,160,30,.6);--r-gold:#7A4E00;
  --r-vio-bg:linear-gradient(180deg,#F8F0FF,#E9DEFF);--r-vio-bd:rgba(139,30,243,.36);--r-vio:#6B21A8;
  --r-neu-bg:linear-gradient(180deg,#F8FAFC,#EEF2F7);--r-neu-bd:#CBD5E1;--r-neu:#334155;
}
.phs *,.phs *::before,.phs *::after{box-sizing:border-box}
.phs button,.phs a{-webkit-tap-highlight-color:transparent}
.phs button:focus-visible,.phs a:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.phs-inner{width:100%;max-width:520px;margin:0 auto;display:flex;flex-direction:column;align-items:center;text-align:center}
.phs-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}

/* ── liquid glass ───────────────────────────────────────────── */
.phs-lg{
  --lg-layers:
    radial-gradient(130% 95% at 16% -28%,rgba(255,255,255,var(--lg-spec)) 0%,rgba(255,255,255,var(--lg-spec2)) 34%,transparent 58%),
    radial-gradient(85% 65% at 102% 118%,rgba(var(--b),var(--lg-b)) 0%,transparent 64%),
    radial-gradient(75% 60% at -8% 118%,rgba(var(--v),var(--lg-v)) 0%,transparent 62%),
    linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.015));
  position:relative;isolation:isolate;border:1px solid transparent;
  background:var(--lg-layers),var(--lg-base);background-origin:border-box;
  box-shadow:var(--lg-shadow),var(--lg-inset);
  -webkit-backdrop-filter:blur(22px) saturate(190%);backdrop-filter:blur(22px) saturate(190%)}
.phs-lg::before{content:"";position:absolute;inset:-1px;padding:1px;border-radius:inherit;pointer-events:none;background:var(--lg-rim);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.phs-lg::after{content:"";position:absolute;z-index:-1;left:5%;right:5%;top:1px;height:46%;border-radius:inherit;pointer-events:none;
  background:linear-gradient(180deg,rgba(255,255,255,var(--lg-gloss)),rgba(255,255,255,0))}
.phs-lg[data-tier="subtle"]{--lg-v:.12;--lg-b:.16;--lg-spec:.18}
.phs[data-theme="light"] .phs-lg[data-tier="subtle"]{--lg-v:.12;--lg-b:.16;--lg-spec:.92}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  .phs-lg{background:var(--lg-layers),var(--lg-solid);background-origin:border-box}
}
.phs[data-lite="true"] .phs-lg{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--lg-layers),var(--lg-solid);background-origin:border-box}
.phs[data-lite="true"] *{transition:none!important}

/* signature liquid glass: Edit Profile / primary relationship action */
.phs-sig{position:relative;isolation:isolate;border:1px solid rgba(255,255,255,.34);color:#fff;
  background:
    radial-gradient(130% 95% at 16% -28%,rgba(255,255,255,.6) 0%,rgba(255,255,255,.10) 36%,transparent 58%),
    radial-gradient(80% 70% at 102% 122%,rgba(0,210,255,.6) 0%,transparent 62%),
    radial-gradient(70% 60% at -6% 122%,rgba(var(--v),.55) 0%,transparent 60%),
    linear-gradient(120deg,#8B1EF3 0%,#4431F7 52%,#055BFB 100%);
  background-origin:border-box;
  box-shadow:var(--sig-shadow),inset 0 1px 1px rgba(255,255,255,.7),inset 0 -10px 16px -10px rgba(5,20,120,.65),inset 0 0 18px rgba(255,255,255,.13)}
.phs-sig::before{content:"";position:absolute;inset:-1px;padding:1px;border-radius:inherit;pointer-events:none;
  background:linear-gradient(140deg,rgba(255,255,255,.95),rgba(255,255,255,.2) 30%,rgba(255,255,255,.06) 58%,rgba(120,220,255,.75));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.phs-sig::after{content:"";position:absolute;z-index:-1;left:5%;right:5%;top:1px;height:46%;border-radius:inherit;pointer-events:none;background:linear-gradient(180deg,rgba(255,255,255,.34),rgba(255,255,255,0))}

/* ── portrait + conditional Vibes ring ─────────────────────── */
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

/* ── identity (tight vertical rhythm) ──────────────────────── */
.phs-name{margin:8px 0 0;max-width:100%;font-size:clamp(22px,calc(16px + 1.6vw),28px);line-height:1.12;font-weight:800;letter-spacing:-.025em;color:var(--g-title);overflow-wrap:anywhere;text-wrap:balance}
.phs-vcheck{position:relative;display:inline-flex;vertical-align:-3px;margin-left:6px;padding:0;border:0;background:none;border-radius:50%;line-height:0}
.phs-vcheck svg{width:20px;height:20px;color:#fff;fill:#055BFB}
button.phs-vcheck{cursor:pointer;transition:transform .15s}
button.phs-vcheck::after{content:"";position:absolute;inset:-9px}
button.phs-vcheck:active{transform:scale(.94)}
.phs-handle{position:relative;margin:0;display:inline-flex;align-items:center;gap:6px;max-width:100%;min-height:24px;padding:0 6px;border:0;border-radius:8px;background:none;
  font:inherit;font-size:14px;font-weight:500;line-height:1.3;color:var(--g-muted);cursor:pointer;transition:color .15s}
.phs-handle::after{content:"";position:absolute;inset:-10px -4px}
.phs-handle:hover{color:var(--g-title)}
.phs-handle span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.phs-handle svg{flex:none;width:14px;height:14px;opacity:.75}
.phs-handle svg[data-ok]{opacity:1;color:var(--online)}
.phs-ident{margin-top:5px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px}
.phs-pill{position:relative;display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 11px 0 9px;border:1px solid transparent;border-radius:999px;font:inherit;font-size:11.5px;font-weight:650;line-height:1;white-space:nowrap;
  box-shadow:inset 0 1px 1px rgba(255,255,255,.34),inset 0 -6px 10px -8px rgba(255,255,255,.18),0 6px 14px -8px rgba(0,0,0,.35)}
.phs-pill svg{flex:none;width:14px;height:14px}
button.phs-pill{cursor:pointer;transition:filter .15s,transform .15s}
button.phs-pill:hover{filter:brightness(1.1)}
button.phs-pill:active{transform:scale(.97)}
.phs-pill[data-kind="royal"]{background:linear-gradient(180deg,rgba(255,255,255,.26),rgba(255,255,255,0) 52%),var(--r-gold-bg);border-color:var(--r-gold-bd);color:var(--r-gold)}
.phs-pill[data-kind="creator"]{background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,0) 52%),var(--r-vio-bg);border-color:var(--r-vio-bd);color:var(--r-vio)}
.phs-pill[data-kind="premium"]{background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,0) 52%),var(--r-neu-bg);border-color:var(--r-neu-bd);color:var(--r-neu)}

/* ── one metadata row: Location · Website · Joined ──────────── */
.phs-meta{margin-top:8px;width:100%;display:flex;align-items:center;justify-content:center;flex-wrap:nowrap;gap:5px clamp(7px,2.4vw,11px);
  font-size:clamp(11px,3vw,12.5px);line-height:1.2;color:var(--g-muted)}
.phs-mi{display:inline-flex;align-items:center;gap:4px;min-width:0;flex:0 1 auto}
.phs-mi svg{flex:none;width:13px;height:13px}
.phs-mi>span,.phs-mi>a,.phs-mi>button{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.phs-mi>a{color:var(--g-link);text-decoration:underline;text-decoration-color:transparent;text-underline-offset:2px;transition:text-decoration-color .15s}
.phs-mi>a:hover{text-decoration-color:currentColor}
.phs-mi>button{padding:0;border:0;background:none;font:inherit;color:inherit;cursor:pointer;border-radius:4px}
.phs-mi>button:hover{text-decoration:underline;text-underline-offset:2px}
.phs-level{display:inline-flex;align-items:center;gap:5px;flex:none;height:28px;padding:0 12px 0 8px;border-radius:999px;font:inherit;font-size:12px;font-weight:750;line-height:1;letter-spacing:.01em;color:var(--g-title);cursor:pointer;
  transition:transform .15s,filter .15s}
.phs-level svg{flex:none;width:16px;height:16px;filter:drop-shadow(0 0 5px rgba(var(--b),.45))}
.phs-level:hover{filter:brightness(1.08)}
.phs-level:active{transform:scale(.97)}
.phs-prof{margin-top:4px;max-width:100%;display:inline-flex;align-items:center;gap:5px;font-size:11.5px;line-height:1.3;color:var(--g-muted)}
.phs-prof svg{flex:none;width:13px;height:13px}
.phs-prof span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* ── bio, tagline, motto ───────────────────────────────────── */
.phs-bio{margin-top:6px;width:100%;max-width:44ch;font-size:13px;line-height:1.4;color:var(--g-body);overflow-wrap:anywhere}
.phs-bio p{margin:0;white-space:pre-line}
.phs-bio p[data-clamp="true"]{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.phs-bio .phs-tag{margin-top:3px;font-size:12.5px;color:var(--g-muted)}
.phs-bio .phs-motto{margin-top:3px;font-size:12.5px;font-style:italic;color:var(--g-muted)}
.phs-more{position:relative;margin-top:1px;display:inline-flex;align-items:center;gap:3px;min-height:22px;padding:0 6px;border:0;border-radius:6px;background:none;font:inherit;font-size:12px;font-weight:650;color:var(--g-link);cursor:pointer}
.phs-more::after{content:"";position:absolute;inset:-11px -6px}
.phs-more svg{width:14px;height:14px;transition:transform .15s}
.phs-more[aria-expanded="true"] svg{transform:rotate(180deg)}
.phs-add{margin-top:6px;min-height:28px;padding:0 10px;border:0;border-radius:8px;background:none;font:inherit;font-size:13px;font-weight:600;color:var(--g-link);cursor:pointer}
.phs-add:hover{text-decoration:underline;text-underline-offset:2px}

/* ── action row: label button + icon-only controls ─────────── */
.phs-actions{position:relative;margin-top:10px;width:100%;display:flex;align-items:stretch;gap:6px}
.phs-cell{flex:none;min-width:0}
.phs-btn{position:relative;display:flex;align-items:center;justify-content:center;gap:6px;flex:1 1 0;min-width:0;height:var(--ab);padding:0 12px;border-radius:16px;
  font:inherit;font-size:clamp(11.5px,3.2vw,13px);font-weight:700;line-height:1;color:var(--g-text);cursor:pointer;
  transition:transform .15s,filter .15s}
.phs-btn.phs-sig{color:#fff}
.phs-btn svg{flex:none;width:17px;height:17px}
.phs-btn>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.phs-ib{display:grid;place-items:center;flex:none;width:var(--ab);height:var(--ab);padding:0;border-radius:16px;color:var(--g-text);cursor:pointer;transition:transform .15s,filter .15s}
.phs-ib svg{width:clamp(18px,4.8vw,20px);height:clamp(18px,4.8vw,20px)}
.phs-btn:active:not(:disabled),.phs-ib:active:not(:disabled){transform:scale(.95)}
.phs-btn:disabled,.phs-ib:disabled{opacity:.5;cursor:not-allowed}
.phs-btn[aria-busy="true"],.phs-ib[aria-busy="true"]{cursor:progress}
@media (hover:hover){.phs-btn:hover:not(:disabled),.phs-ib:hover:not(:disabled){filter:brightness(1.1)}}

.phs-menu{--lg-base:var(--g-pop);position:absolute;top:calc(100% + 6px);right:0;z-index:30;width:min(232px,calc(100vw - 24px));max-height:min(60vh,360px);overflow-y:auto;overscroll-behavior:contain;padding:5px;border-radius:20px;text-align:left;
  opacity:0;visibility:hidden;transform:scale(.96);transform-origin:top right;transition:opacity .15s,transform .15s,visibility .15s}
.phs-menu[data-open="true"]{opacity:1;visibility:visible;transform:none}
.phs-mitem{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:0 12px;border:0;border-radius:14px;background:none;font:inherit;font-size:13px;font-weight:600;color:var(--g-text);text-align:left;cursor:pointer;transition:background-color .15s}
.phs-mitem:hover:not(:disabled),.phs-mitem:focus-visible{background:var(--g-hover)}
.phs-mitem:disabled{opacity:.5;cursor:not-allowed}
.phs-mitem svg{flex:none;width:16px;height:16px;color:var(--g-muted)}
.phs-mitem span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.phs-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:2px}
.phs-back{display:inline-flex;align-items:center;gap:4px;min-height:44px;padding:0 12px 0 6px;margin-left:-6px;border:0;border-radius:12px;background:none;font:inherit;font-size:13px;font-weight:600;color:var(--g-muted);cursor:pointer}
.phs-back:hover{background:var(--g-hover)}
.phs-back svg{width:16px;height:16px}
.phs-spin{animation:phs-spin .8s linear infinite}
@keyframes phs-spin{to{transform:rotate(360deg)}}

@media (min-width:480px){.phs-actions{gap:8px}.phs-name{margin-top:10px}.phs-meta{margin-top:10px}}
@media (max-width:359px){.phs-meta{gap:5px 6px}.phs-mi{gap:3px}.phs-mi svg{width:12px;height:12px}.phs-level{padding:0 10px 0 7px}}
@media (forced-colors:active){
  .phs-lg,.phs-sig,.phs-pill{border:1px solid CanvasText;forced-color-adjust:auto}
  .phs-lg::before,.phs-lg::after,.phs-sig::before,.phs-sig::after{display:none}
  .phs-ring{background:Highlight}
}
@media (prefers-reduced-motion:reduce){
  .phs *,.phs *::before,.phs *::after{transition:none!important}
  .phs-spin{animation:none}
  .phs-btn:active:not(:disabled),.phs-ib:active:not(:disabled),.phs-level:active,button.phs-photo:active{transform:none}
}
`;

/** Epoch ms from ISO, Date, millis, seconds or Firestore Timestamp; else null. */
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

/** Rank shield with rising chevrons: the level insignia (gradient stroke, soft fill). */
const LevelGlyph = () => {
  const gid = useId();
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1="4" y1="3" x2="20" y2="21">
          <stop offset="0" style={{ stopColor: 'var(--lv-a)' }} />
          <stop offset="1" style={{ stopColor: 'var(--lv-b)' }} />
        </linearGradient>
      </defs>
      <path
        d="M12 2.8 19.2 5.6v5.4c0 4.5-2.9 8.2-7.2 10-4.3-1.8-7.2-5.5-7.2-10V5.6L12 2.8Z"
        fill={`url(#${gid})`}
        fillOpacity="0.24"
        stroke={`url(#${gid})`}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m8.6 12.6 3.4-3.4 3.4 3.4M8.6 16l3.4-3.4 3.4 3.4"
        stroke={`url(#${gid})`}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/** Labelled action (Edit Profile and the primary relationship action). */
const ActionButton = forwardRef(({ icon: Icon, label, variant = 'glass', busy = false, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn('phs-btn', variant === 'brand' ? 'phs-sig' : 'phs-lg')}
    data-tier={variant === 'brand' ? undefined : 'subtle'}
    aria-busy={busy || undefined}
    {...rest}
  >
    <Icon className={busy ? 'phs-spin' : undefined} aria-hidden="true" />
    <span>{label}</span>
  </button>
));
ActionButton.displayName = 'ActionButton';

/** Icon-only action. Always carries an accessible name and a tooltip. */
const IconAction = forwardRef(({ icon: Icon, label, busy = false, ...rest }, ref) => (
  <button
    ref={ref}
    type="button"
    className="phs-ib phs-lg"
    data-tier="subtle"
    aria-label={label}
    title={label}
    aria-busy={busy || undefined}
    {...rest}
  >
    <Icon className={busy ? 'phs-spin' : undefined} aria-hidden="true" />
  </button>
));
IconAction.displayName = 'IconAction';

/**
 * Icon button that opens a deep liquid-glass menu. Outside press and Escape close it,
 * focus moves in on open and back to the trigger on close, arrow keys, Home and End move
 * between items. The menu is positioned against the action row.
 */
const PopMenu = ({ icon, label, items, disabled = false }) => {
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
      <IconAction
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
        aria-label={label}
        data-open={open}
        data-tier="deep"
        onKeyDown={handleKeyDown}
        className="phs-menu phs-lg"
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
  const openPassport = useCallback(() => {
    if (passportUrl) navigate(passportUrl);
  }, [passportUrl, navigate]);

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
        ? { key: 'friend', icon: X, label: 'Cancel', ariaLabel: 'Cancel friend request', variant: 'glass', disabled: friendRequestLoading, busy: friendRequestLoading, onClick: onCancelFriendRequest }
        : { key: 'friend', icon: Clock, label: 'Sent', ariaLabel: 'Friend request sent', variant: 'glass', disabled: true };
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
    ariaLabel: 'Accept friend request',
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

  const moreItems = (isOwner
    ? [
        onOpenLocationSetup && { key: 'loc', icon: MapPin, label: 'Location', onClick: onOpenLocationSetup },
        passportUrl && { key: 'passport', icon: ShieldCheck, label: 'Digital Passport', onClick: openPassport },
        { key: 'about', icon: Info, label: 'About profile', onClick: () => navigate('/profile/about') },
        { key: 'insights', icon: BarChart2, label: 'Insights', onClick: onInsightsPress || (() => navigate('/profile/analytics')) },
        { key: 'coins', icon: Coins, label: 'Coins', onClick: () => navigate('/coins') },
        { key: 'settings', icon: Settings, label: 'Settings', onClick: () => navigate('/settings') },
        showHeroRefresh && { key: 'refresh', icon: RefreshCw, label: 'Refresh', disabled: isRefreshing, busy: isRefreshing, onClick: onRefresh },
        onOpenOptions && { key: 'options', icon: MoreHorizontal, label: 'Profile options & View As', onClick: onOpenOptions },
      ]
    : [
        secondaryRelation && {
          key: secondaryRelation.key,
          icon: secondaryRelation.icon,
          label: secondaryRelation.ariaLabel || secondaryRelation.label,
          disabled: secondaryRelation.disabled,
          busy: secondaryRelation.busy,
          onClick: secondaryRelation.onClick,
        },
        onOpenQrCode && { key: 'qr', icon: QrCode, label: 'QR code', onClick: onOpenQrCode },
        passportUrl && { key: 'passport', icon: ShieldCheck, label: 'Digital Passport', onClick: openPassport },
        profileUid && { key: 'about', icon: Info, label: 'About profile', onClick: () => navigate(`/profile/${profileUid}/about`) },
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
  const hasMeta = Boolean(location) || Boolean(websiteLabel) || Boolean(joinedDate);

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
            <IconAction icon={RefreshCw} label="Refresh profile" busy={isRefreshing} disabled={isRefreshing} onClick={onRefresh} />
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

        {/* 4. Level glass directly under the username, with earned designations beside it */}
        {(visibleLevel !== null || designations.length > 0) && (
          <div className="phs-ident">
            {visibleLevel !== null && (
              <button
                type="button"
                onClick={() => handleOpenRoadmap('levels')}
                aria-label={`Level ${visibleLevel}. Open level roadmap`}
                className="phs-level phs-lg"
                data-tier="premium"
              >
                <LevelGlyph />
                <span aria-hidden="true">Level {visibleLevel}</span>
              </button>
            )}
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

        {/* 5. One metadata row: Location · Website · Joined */}
        {hasMeta && (
          <div className="phs-meta">
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
              <div className="inline-flex items-center justify-center gap-2 flex-wrap">
                <button type="button" className="phs-more" onClick={() => setBioExpanded((v) => !v)} aria-expanded={bioExpanded}>
                  <span>{bioExpanded ? 'Less' : 'More'}</span>
                  <ChevronDown aria-hidden="true" />
                </button>
              </div>
            )}
            {tagline && <p className="phs-tag">{tagline}</p>}
            {motto && <p className="phs-motto">{motto}</p>}
          </div>
        )}

        {/* 7. Actions: one row. Label button first, then icon-only controls. */}
        <div className="phs-actions" data-kind={isOwner ? 'owner' : 'visitor'}>
          {isOwner ? (
            <>
              <ActionButton
                icon={Edit3}
                label="Edit Profile"
                variant="brand"
                onClick={onEditProfile || (() => navigate('/profile/edit'))}
              />
              <div className="phs-cell">
                <IconAction icon={QrCode} label="QR code" disabled={!onOpenQrCode} onClick={onOpenQrCode} />
              </div>
              <div className="phs-cell">
                <IconAction icon={ShieldCheck} label="Digital passport" disabled={!passportUrl} onClick={openPassport} />
              </div>
              <div className="phs-cell">
                <IconAction icon={Share2} label="Share profile" disabled={!canShareAction} onClick={onShare} />
              </div>
              <PopMenu icon={MoreHorizontal} label="More actions" items={moreItems} />
            </>
          ) : (
            <>
              <ActionButton
                icon={primaryRelation.icon}
                label={primaryRelation.label}
                variant={primaryRelation.variant}
                busy={primaryRelation.busy}
                disabled={primaryRelation.disabled}
                title={primaryRelation.title}
                aria-label={primaryRelation.ariaLabel}
                onClick={primaryRelation.onClick}
              />
              <div className="phs-cell">
                <IconAction
                  icon={MessageSquare}
                  label="Message"
                  disabled={!canMessageAction}
                  onClick={onOpenMessages}
                />
              </div>
              <div className="phs-cell">
                <IconAction icon={ShieldCheck} label="Digital passport" disabled={!passportUrl} onClick={openPassport} />
              </div>
              <div className="phs-cell">
                <IconAction icon={Share2} label="Share profile" disabled={!canShareAction} onClick={onShare} />
              </div>
              <PopMenu icon={MoreHorizontal} label="More actions" items={moreItems} />
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
