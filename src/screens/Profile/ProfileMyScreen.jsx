/**
 * Owner view of the authenticated user's profile.
 *
 * Composition (top to bottom), each section delegated to an existing component:
 *  1. Identity            - ProfileHeroSection
 *  2. Social presence     - ProfileMetricsGrid + Coins Treasury
 *  3. Digital standing    - ProfileProgression + ProfileHighlightsSection
 *  4. Creator intelligence- ProfileCreatorDashboard (owner perspective only)
 *  5. Content hub         - ProfileTabsBar, ProfilePinnedPosts, ProfileFeedGrid
 *  6. Secondary interfaces- modals, options menu, view-as banner
 *
 * Ownership rules
 *  - The AuthContext UID is the only ownership authority. App-store user data is used for
 *    supplementary display fields only when it carries the same UID.
 *  - The profile store is global and not account-scoped, so this screen scopes every slice itself:
 *    a slice is shown only after OUR load for the current account and perspective has completed
 *    successfully. Anything left in the store by a previous account or perspective is never rendered.
 *    (A store-level owner stamp would make this airtight; see the delivery report.)
 *  - Perspective, modals, tab selection, refresh and avatar state are all keyed by the current UID,
 *    so they are correct on the very first render after an account switch.
 *  - Visitor previews never receive owner-only collections (highlights, stories, saved posts,
 *    analytics, raw balance) because the existing loaders cannot filter them by perspective.
 *  - Every delegated section and every lazy modal sits behind its own failure boundary, so one failing
 *    component degrades to a compact notice instead of taking the whole profile down.
 *
 * @component
 */
import {
  Component, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense, lazy,
} from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, RefreshCw, Coins, ChevronRight, AlertCircle } from "lucide-react";
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

// Core above-the-fold profile components (eager for instant frame-1 paint)
import ProfileHeroSection from '../../components/profile/ProfileHeroSection';
import ProfileProgression from '../../components/profile/ProfileProgression';
import ProfileMetricsGrid from '../../components/profile/ProfileMetricsGrid';
import ProfileHighlightsSection from '../../components/profile/ProfileHighlightsSection';
import ProfileTabsBar from '../../components/profile/ProfileTabsBar';
import ProfilePinnedPosts from '../../components/profile/ProfilePinnedPosts';
import ProfileFeedGrid from '../../components/profile/ProfileFeedGrid';
import ProfileSkeleton from '../../components/profile/ProfileSkeleton';

/**
 * Lazy-loads a component through its default export (or the named export that matches the
 * component's own name). Any other export shape fails loudly so the error boundary handles it,
 * instead of silently rendering an unrelated helper.
 */
const lazyComponent = (loader, exportName) => lazy(async () => {
  const mod = await loader();
  const candidate = mod?.default?.default ?? mod?.default ?? mod?.[exportName];
  const isComponent = typeof candidate === 'function' || (candidate && typeof candidate === 'object' && candidate.$$typeof);
  if (!isComponent) throw new Error(`Component export "${exportName}" was not found`);
  return { default: candidate };
});

// Heavy below-the-fold panels & modal surfaces (lazy-loaded for fast low-RAM paint)
const ProfileCreatorDashboard = lazyComponent(() => import('../../components/profile/ProfileCreatorDashboard'), 'ProfileCreatorDashboard');
const ProfileQRCodeModal = lazyComponent(() => import('../../components/profile/ProfileQRCodeModal'), 'ProfileQRCodeModal');
const ProfileLocationModal = lazyComponent(() => import('../../components/profile/ProfileLocationModal'), 'ProfileLocationModal');
const ProfilePerspectiveModal = lazyComponent(() => import('../../components/profile/ProfilePerspectiveModal'), 'ProfilePerspectiveModal');
const ProfileVerificationModal = lazyComponent(() => import('../../components/profile/ProfileVerificationModal'), 'ProfileVerificationModal');
const ProfileOptionsMenu = lazyComponent(() => import('../../components/profile/ProfileOptionsMenu'), 'ProfileOptionsMenu');
const AvatarUploadModal = lazyComponent(() => import('../../components/profile/AvatarUploadModal'), 'AvatarUploadModal');
const ProfileQuickEditModal = lazyComponent(() => import('../../components/profile/ProfileQuickEditModal'), 'ProfileQuickEditModal');

/* ── constants ─────────────────────────────────────────────────────────── */

const VIEW_MODE_STORAGE_KEY = 'arvdoul_profile_view_mode';

const PERSPECTIVES = Object.freeze(['owner', 'public', 'follower', 'connection']);
const PERSPECTIVE_LABELS = Object.freeze({ public: 'Public', follower: 'Follower', connection: 'Connection' });

// Surfaces and tabs that only exist for the real owner.
const OWNER_ONLY_MODALS = Object.freeze(['avatar', 'location', 'verification', 'options', 'quickEdit']);
const OWNER_ONLY_TABS = Object.freeze(['saved', 'stories']);

const PREVIEW_POST_LIMIT = 12;
const MAX_USERNAME_ATTEMPTS = 2;
const TREASURY_DEBOUNCE_MS = 800;

const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_SLICES = Object.freeze({});
const EMPTY_MODAL = Object.freeze({ uid: null, name: null, field: null });

// Static presentation values (theme-independent inputs), computed once instead of on every render.
const SHELL_STYLE = Object.freeze({
  '--pms-brand': BRAND_GRADIENT,
  '--pms-brand-soft': brandRgba(0.22),
  '--pms-blue-soft': brandHexRgba(tokens.color.brand.blue, 0.2),
});

/* ── pure helpers ──────────────────────────────────────────────────────── */

const asArray = (value) => (Array.isArray(value) ? value : EMPTY_ARRAY);
const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');
const asUid = (value) => cleanText(value) || null;
const asId = (value) => {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};
const safeHttpUrl = (value) => {
  const text = cleanText(value);
  return /^https?:\/\//i.test(text) ? text : null;
};

/** Finite number from a number or numeric string; blank strings, NaN and Infinity are unknown. */
const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};
/** Non-negative whole number (counters, levels). */
const toCount = (value) => {
  const n = toNumber(value);
  return n !== null && n >= 0 ? Math.trunc(n) : null;
};
/** Non-negative amount that keeps decimals (coins, experience). */
const toAmount = (value) => {
  const n = toNumber(value);
  return n !== null && n >= 0 ? n : null;
};
const firstKnown = (reader, candidates) => {
  for (const candidate of candidates) {
    const value = reader(candidate);
    if (value !== null) return value;
  }
  return null;
};

const formatAmount = (value) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 }).format(value);

/** Visible coin figure: full grouping normally, compact only for very large balances so it never overflows. */
const formatCoins = (value) => (value >= 1e9
  ? new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 }).format(value)
  : formatAmount(value));

/** Treat an explicit `false` / `{ ok:false }` / `{ success:false }` result as a failure. */
const outcomeOk = (result) => {
  if (result === false) return false;
  if (result && typeof result === 'object' && (result.ok === false || result.success === false)) return false;
  return true;
};

/** Runs a store action, tolerating sync or async actions. Never throws; logs code only. */
const settleAction = async (action) => {
  try {
    return outcomeOk(await action());
  } catch (err) {
    console.warn('[ProfileMyScreen] operation failed:', err?.code || err?.name || 'error');
    return false;
  }
};

const readHandleBase = (...candidates) => {
  for (const candidate of candidates) {
    const text = cleanText(candidate);
    if (text) return text;
  }
  return '';
};
const normalizeUsernameBase = (raw, fallback) => {
  const cleaned = String(raw || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12);
  return cleaned || fallback;
};

/* Tab classification: one pass over validated records. */
const isCountablePost = (p) =>
  Boolean(p) && typeof p === 'object' && p.isDeleted !== true && p.status !== 'deleted' && p.status !== 'scheduled';

const isTaggedUser = (entry, uid) => {
  const id = asId(entry && typeof entry === 'object' ? (entry.uid ?? entry.id ?? entry.userId) : entry);
  return id !== null && id === uid;
};

const buildTabCounts = ({ posts, stories, savedPosts, uid, postsLoaded, postsComplete, lifetimePosts, storiesLoaded, savedLoaded }) => {
  const counts = {};
  const ids = new Set();
  let anonymousStories = 0;
  let videos = 0; let reels = 0; let photos = 0; let audio = 0; let tagged = 0; let feed = 0;

  asArray(posts).forEach((p) => {
    if (!isCountablePost(p)) return;
    const type = typeof p.type === 'string' ? p.type.toLowerCase() : '';
    const isVibe = type === 'story' || type === 'vibe' || p.isStory === true || p.isVibe === true;
    const isAudio = type === 'audio' || type === 'track' || type === 'music' || Boolean(p.audioURL || p.audioUrl);
    const isReel = type === 'reel' || type === 'spark' || p.isReel === true || p.isSpark === true;
    const isVideo = isReel || type === 'video' || Boolean(p.videoURL || p.videoUrl || p.mediaType === 'video');
    const isPhoto = !isVideo && !isAudio && (type === 'image' || type === 'photo' || type === 'gallery'
      || Boolean(p.mediaURL || p.imageUrl || (Array.isArray(p.media) && p.media.length > 0)));

    if (isVibe) {
      const id = asId(p.id);
      if (id) ids.add(id);
    } else if (type !== 'audio' && type !== 'track') {
      feed += 1;
    }
    if (isVideo) videos += 1;
    if (isReel) reels += 1;
    if (isPhoto) photos += 1;
    if (isAudio) audio += 1;
    if (Array.isArray(p.taggedUsers) && p.taggedUsers.some((entry) => isTaggedUser(entry, uid))) tagged += 1;
  });

  if (postsLoaded) {
    // Lifetime total when the store supplies one; the loaded page is only a total once every page is loaded.
    if (lifetimePosts !== null) counts.posts = lifetimePosts;
    else if (postsComplete) counts.posts = feed;
    // Category counts come from loaded pages, so they are shown only when nothing is left to load.
    if (postsComplete) Object.assign(counts, { videos, reels, photos, audio, tagged });
  }

  if (storiesLoaded) {
    asArray(stories).forEach((s) => {
      if (!s || typeof s !== 'object') return;
      const id = asId(s.id);
      if (id) ids.add(id);
      else anonymousStories += 1;
    });
    counts.stories = ids.size + anonymousStories;
  }
  if (savedLoaded) counts.saved = asArray(savedPosts).length;
  return counts;
};

/* ── presentation ──────────────────────────────────────────────────────── */

/*
 * Transparent liquid glass, scoped to this screen (.pms). Four tiers:
 *   subtle (sticky tabs, banners) · premium (default panels) · deep (state panels) · signature (primary actions)
 * Each surface layers a specular bloom, two low-opacity brand caustics, a gradient rim and a gloss,
 * over a translucent base with backdrop blur. Lite Mode removes the blur and uses an opaque base.
 * Arvdoul tokens: dark glass rgba(255,255,255,.06) · light glass rgba(255,255,255,.8) · accents #C82BFF / #0088FF.
 */
const PMS_CSS = `
.pms{
  --v:200,43,255;--b:0,136,255;--gold:241,205,115;
  --tx:#F5F7FF;--tx2:#B4BFDE;--link:#8EC3FF;--focus:#7DB6FF;
  --err:#FCA5A5;--err-bg:rgba(239,68,68,.10);--err-bd:rgba(239,68,68,.30);
  --base:rgba(14,20,60,.28);--solid:#0B1234;
  --spec:.12;--spec2:.03;--cv:.08;--cb:.12;--cg:.11;--gloss:.045;--blur:20px;
  --shadow:0 14px 26px -22px rgba(0,0,0,.48),0 2px 6px -3px rgba(0,0,0,.20);
  --inset:inset 0 1px 1px rgba(255,255,255,.15),inset 0 -10px 16px -14px rgba(var(--b),.20),inset 0 0 14px rgba(130,110,255,.04);
  --rim:linear-gradient(140deg,rgba(255,255,255,.24),rgba(255,255,255,.06) 30%,rgba(255,255,255,.02) 56%,rgba(var(--b),.26));
  --chip:linear-gradient(160deg,rgba(255,255,255,.12),rgba(255,255,255,.03));--chip-rim:rgba(255,255,255,.12);
  --coin:#F1CD73;--sk:rgba(255,255,255,.07);
  color:var(--tx);-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;
}
.pms[data-theme="light"]{
  --gold:224,163,38;
  --tx:#121A3A;--tx2:#4B5679;--link:#055BFB;--focus:#055BFB;
  --err:#B91C1C;--err-bg:rgba(239,68,68,.08);--err-bd:rgba(239,68,68,.28);
  --base:rgba(255,255,255,.8);--solid:#FFFFFF;
  --spec:.5;--spec2:.2;--cv:.07;--cb:.11;--cg:.16;--gloss:.4;
  --shadow:0 16px 26px -22px rgba(40,50,150,.34),0 1px 3px -1px rgba(30,40,110,.10);
  --inset:inset 0 1px 1px #fff,inset 0 -10px 16px -14px rgba(var(--b),.14),inset 0 0 14px rgba(255,255,255,.5);
  --rim:linear-gradient(140deg,rgba(255,255,255,.95),rgba(35,49,84,.13) 32%,rgba(35,49,84,.09) 58%,rgba(var(--b),.30));
  --chip:linear-gradient(160deg,#FFFFFF,rgba(240,243,255,.78));--chip-rim:rgba(35,49,84,.12);
  --coin:#9A6B12;--sk:rgba(35,49,84,.07);
}
.pms *,.pms *::before,.pms *::after{box-sizing:border-box}

.pms-glass{
  --layers:
    radial-gradient(120% 90% at 14% -30%,rgba(255,255,255,var(--spec)) 0%,rgba(255,255,255,var(--spec2)) 34%,transparent 58%),
    radial-gradient(70% 70% at 104% 120%,rgba(var(--b),var(--cb)) 0%,transparent 64%),
    radial-gradient(60% 70% at -6% 120%,rgba(var(--v),var(--cv)) 0%,transparent 62%),
    linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.01));
  position:relative;isolation:isolate;border:1px solid transparent;border-radius:24px;
  background:var(--layers),var(--base);background-origin:border-box;box-shadow:var(--shadow),var(--inset);
  -webkit-backdrop-filter:blur(var(--blur)) saturate(180%);backdrop-filter:blur(var(--blur)) saturate(180%)}
.pms-glass::before{content:"";position:absolute;inset:-1px;padding:1px;border-radius:inherit;pointer-events:none;background:var(--rim);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
.pms-glass::after{content:"";position:absolute;z-index:-1;left:0;right:0;top:0;height:56%;border-radius:inherit;pointer-events:none;
  background:radial-gradient(70% 100% at 50% 0%,rgba(255,255,255,var(--gloss)),rgba(255,255,255,0) 72%)}
.pms-glass[data-tier="subtle"]{--blur:14px;--spec:.12;--cv:.07;--cb:.10;--gloss:.04;border-radius:22px}
.pms[data-theme="light"] .pms-glass[data-tier="subtle"]{--spec:.45;--gloss:.3}
.pms-glass[data-tier="deep"]{--blur:28px;--spec:.24;--cv:.16;--cb:.22;--gloss:.10}
.pms[data-theme="light"] .pms-glass[data-tier="deep"]{--spec:.6;--cv:.10;--cb:.15;--gloss:.5}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  .pms-glass,.pms-btn.pms-glass{background:var(--layers),var(--solid);background-origin:border-box}
}
@media (prefers-reduced-transparency:reduce){
  .pms-glass,.pms-btn.pms-glass{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--layers),var(--solid);background-origin:border-box}
}
.pms[data-lite="true"] .pms-glass,.pms[data-lite="true"] .pms-btn.pms-glass{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--layers),var(--solid);background-origin:border-box}
.pms[data-lite="true"] .pms-glass::after{display:none}

/* signature action + glass action */
.pms-btn{position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:0 20px;
  border:1px solid rgba(255,255,255,.3);border-radius:16px;font:inherit;font-size:14px;font-weight:700;line-height:1;color:#fff;cursor:pointer;
  background:
    radial-gradient(130% 95% at 16% -28%,rgba(255,255,255,.55) 0%,rgba(255,255,255,.08) 36%,transparent 58%),
    radial-gradient(80% 70% at 102% 122%,rgba(var(--b),.5) 0%,transparent 62%),
    var(--pms-brand);
  background-origin:border-box;
  box-shadow:0 16px 28px -14px rgba(68,49,247,.7),inset 0 1px 1px rgba(255,255,255,.6),inset 0 -10px 16px -10px rgba(5,20,120,.55);
  transition:transform .15s,filter .15s}
/* glass variant: restores the glass surface that the signature rule above would otherwise override */
.pms-btn.pms-glass{color:var(--tx);border-color:transparent;border-radius:14px;
  background:var(--layers),var(--base);background-origin:border-box;box-shadow:var(--shadow),var(--inset)}
.pms-btn:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
.pms-btn:active:not(:disabled){transform:scale(.97)}
.pms-btn:disabled{opacity:.55;cursor:not-allowed}
@media (hover:hover){.pms-btn:hover:not(:disabled){filter:brightness(1.07)}}
.pms-btn svg{width:16px;height:16px;flex:none}

/* state panels and banners */
.pms-note{display:flex;flex-direction:column;align-items:center;gap:10px;padding:28px 20px;text-align:center}
.pms-note h2,.pms-note h3{margin:0;font-size:16px;line-height:1.25;font-weight:700;color:var(--tx)}
.pms-note p{margin:0;max-width:44ch;font-size:13.5px;line-height:1.5;font-weight:500;color:var(--tx2)}
.pms-note-icon{display:grid;place-items:center;width:52px;height:52px;border-radius:50%;background:var(--chip);border:1px solid var(--chip-rim);box-shadow:inset 0 1px 1px rgba(255,255,255,.2);color:var(--tx)}
.pms-note-icon svg{width:24px;height:24px}
.pms-note[data-tone="error"] .pms-note-icon{color:var(--err);border-color:var(--err-bd)}
.pms-note--inline{flex-direction:row;justify-content:center;gap:12px;padding:14px 16px;text-align:left}
.pms-note--inline .pms-note-icon{width:36px;height:36px;flex:none}
.pms-note--inline .pms-note-icon svg{width:18px;height:18px}
.pms-note--inline h3{font-size:14px}
.pms-note--inline p{font-size:12.5px}
.pms-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 8px 8px 16px;font-size:13.5px;font-weight:600;color:var(--tx)}
.pms-banner[data-tone="error"]{--base:var(--err-bg)}
.pms-banner[data-tone="error"] > span{color:var(--err)}
.pms-banner .pms-btn{min-height:40px;padding:0 14px;font-size:13px;flex:none}
.pms-skel{width:100%;border-radius:24px;background:var(--sk)}
.pms-pulse{animation:pms-pulse 1.6s ease-in-out infinite}
@keyframes pms-pulse{0%,100%{opacity:1}50%{opacity:.55}}

/* gentle section entrance (opacity + 8px rise; never persists a transform after it ends) */
.pms-rise{animation:pms-rise .38s cubic-bezier(.2,.7,.2,1) backwards;animation-delay:calc(var(--i,0) * 45ms)}
@keyframes pms-rise{from{opacity:0;transform:translateY(8px)}}

/* coins treasury: warm gold light behind the existing coin mark, brand light on the opposite corner */
.pms-treasury{
  --layers:
    radial-gradient(120% 90% at 14% -30%,rgba(255,255,255,var(--spec)) 0%,rgba(255,255,255,var(--spec2)) 34%,transparent 58%),
    radial-gradient(60% 110% at 0% 50%,rgba(var(--gold),var(--cg)) 0%,transparent 68%),
    radial-gradient(70% 70% at 104% 120%,rgba(var(--b),var(--cb)) 0%,transparent 64%),
    linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.01));
  display:flex;align-items:center;justify-content:space-between;gap:14px;width:100%;height:100%;min-height:76px;min-width:0;
  padding:14px 16px 14px 14px;margin:0;text-align:left;font:inherit;color:var(--tx);
  -webkit-appearance:none;appearance:none;transition:transform .18s ease,filter .18s ease}
button.pms-treasury{cursor:pointer}
button.pms-treasury:focus-visible{outline:2px solid var(--focus);outline-offset:3px}
button.pms-treasury:active{transform:scale(.985)}
.pms-treasury-main{display:flex;align-items:center;gap:14px;min-width:0}
.pms-treasury-text{display:flex;flex-direction:column;gap:3px;min-width:0}
.pms-coin{position:relative;display:grid;place-items:center;flex:none;width:48px;height:48px;border-radius:16px;color:var(--coin);
  background:radial-gradient(80% 80% at 30% 15%,rgba(var(--gold),.42),rgba(var(--gold),0) 66%),linear-gradient(150deg,var(--pms-brand-soft),var(--pms-blue-soft));
  border:1px solid rgba(var(--gold),.38);
  box-shadow:inset 0 1px 1px rgba(255,255,255,.3),inset 0 -8px 12px -10px rgba(var(--b),.4),0 8px 16px -10px rgba(var(--gold),.5)}
.pms-coin svg{width:24px;height:24px;stroke-width:1.75;filter:drop-shadow(0 1px 3px rgba(var(--gold),.45))}
.pms-eyebrow{display:block;font-size:12.5px;line-height:1.2;font-weight:600;letter-spacing:.01em;color:var(--tx2)}
.pms-balance{display:flex;align-items:baseline;gap:6px;min-width:0;min-height:28px}
.pms-balance strong{font-size:clamp(20px,5.6vw,26px);line-height:1.1;font-weight:800;letter-spacing:-.015em;font-variant-numeric:tabular-nums;color:var(--tx);overflow-wrap:anywhere}
.pms-balance span{font-size:13px;font-weight:600;color:var(--tx2)}
.pms-balance em{align-self:center;font-style:normal;font-size:13px;font-weight:600;color:var(--tx2)}
.pms-bar{display:inline-block;align-self:center;width:96px;height:22px;border-radius:8px;background:var(--sk)}
.pms-chev{display:grid;place-items:center;flex:none;width:32px;height:32px;border-radius:50%;background:var(--chip);border:1px solid var(--chip-rim);color:var(--tx2);transition:transform .18s ease,color .18s ease}
.pms-chev svg{width:16px;height:16px}
@media (hover:hover){
  button.pms-treasury:hover{filter:brightness(1.06)}
  button.pms-treasury:hover .pms-chev{transform:translateX(2px);color:var(--tx)}
}

/* sticky tabs: lighter, more transparent glass so the identity stays the visual focus */
.pms-tabs{position:sticky;top:0;z-index:30;overflow:hidden;min-width:0}

@media (forced-colors:active){
  .pms-glass,.pms-btn,.pms-btn.pms-glass,.pms-treasury{border:1px solid CanvasText;background:Canvas;color:CanvasText}
  .pms-glass::before,.pms-glass::after{display:none}
}
@media (prefers-reduced-motion:reduce){
  .pms *,.pms *::before,.pms *::after{transition:none!important}
  .pms-pulse,.pms-rise{animation:none}
  .pms-btn:active:not(:disabled),button.pms-treasury:active{transform:none}
  button.pms-treasury:hover .pms-chev{transform:none}
}
.pms[data-lite="true"] .pms-rise{animation:none}
`;

/** Shared state panel (sign-in gate, missing profile, private account, section failures). */
function StatePanel({
  icon: Icon, title, text, actionLabel, onAction, busy = false, tier = 'deep', headingLevel = 'h3', label,
  tone, compact = false, role = 'status',
}) {
  const Heading = headingLevel;
  return (
    <section
      role={role}
      aria-label={label || title}
      className={cn('pms-glass pms-note', compact && 'pms-note--inline')}
      data-tier={tier}
      data-tone={tone}
    >
      <span className="pms-note-icon" aria-hidden="true"><Icon /></span>
      <div className="min-w-0">
        <Heading>{title}</Heading>
        {text && <p>{text}</p>}
      </div>
      {actionLabel && (
        <button type="button" className="pms-btn" onClick={onAction} disabled={busy} aria-busy={busy || undefined}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}

/**
 * Failure boundary scoped to one delegated section or modal. It renders no wrapper element, so layout
 * (including the sticky tab bar) is unchanged. A failed lazy chunk stays failed until reload, so no
 * in-place retry is offered; `resetKey` clears the failure when the account or perspective changes.
 */
class SectionBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prevProps) {
    if (this.state.failed && prevProps.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  componentDidCatch(error) {
    console.warn('[ProfileMyScreen] section failed:', error?.code || error?.name || 'error');
    if (typeof this.props.onFail === 'function') this.props.onFail();
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}

/** A delegated profile section that degrades to a compact notice instead of crashing its siblings. */
function SectionGuard({ label, resetKey, children }) {
  return (
    <SectionBoundary
      resetKey={resetKey}
      fallback={(
        <StatePanel
          compact
          tier="subtle"
          tone="error"
          role="alert"
          icon={AlertCircle}
          title={`${label} is unavailable`}
          text="The rest of your profile is still available."
        />
      )}
    >
      {children}
    </SectionBoundary>
  );
}

/** Lazy modal host: loads on demand, and a failing modal closes itself instead of crashing the screen. */
function LazyModal({ onFail, children }) {
  return (
    <SectionBoundary onFail={onFail}>
      <Suspense fallback={null}>{children}</Suspense>
    </SectionBoundary>
  );
}

/* ── screen ────────────────────────────────────────────────────────────── */

export default function ProfileMyScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [searchParams] = useSearchParams();

  // --- Authenticated identity -------------------------------------------
  // AuthContext is the sole ownership authority. `authInitialized` is the readiness flag the
  // existing AuthContext exposes (used by IntroScreen); when it is absent the screen behaves as before.
  const auth = useAuth();
  const authContextUser = auth?.user ?? null;
  const authPending = auth?.authInitialized === false;
  const appStoreUser = useAppStore((state) => state.currentUser);
  const currentUserId = asUid(authContextUser?.uid);

  const authDisplayName = cleanText(authContextUser?.displayName) || null;
  const authEmail = cleanText(authContextUser?.email) || null;
  const authPhotoURL = safeHttpUrl(authContextUser?.photoURL);

  // Latest-value refs, updated in a layout effect so async completions always compare against the
  // committed account/perspective (an effect-updated ref can lag one commit behind).
  const uidRef = useRef(currentUserId);
  const viewAsRef = useRef('owner');
  const timeframeRef = useRef(null);
  const mountedRef = useRef(true);

  // --- Account-scoped UI state (every value carries the UID it belongs to) ---
  const [viewAsState, setViewAsState] = useState({ uid: null, mode: 'owner' });
  const [modalState, setModalState] = useState(EMPTY_MODAL);
  const [tabState, setTabState] = useState({ uid: null, tab: null });
  const [savedState, setSavedState] = useState({ uid: null, status: null });
  const [loadState, setLoadState] = useState({ key: null, slices: EMPTY_SLICES });
  const [refreshState, setRefreshState] = useState({ uid: null, op: 0 });
  const [avatarOverride, setAvatarOverride] = useState({ uid: null, url: null });

  const viewAs = viewAsState.uid === currentUserId && PERSPECTIVES.includes(viewAsState.mode) ? viewAsState.mode : 'owner';
  const isOwnerView = viewAs === 'owner';
  const ctxKey = currentUserId ? `${currentUserId}|${viewAs}` : null;

  const [isLiteMode] = useState(() => {
    try {
      return Boolean(getAdaptiveTuning().isLiteMode);
    } catch {
      return false;
    }
  });

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

  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    const supplement = appStoreUser && appStoreUser.uid === currentUserId ? appStoreUser : {};
    return {
      ...supplement,
      uid: currentUserId,
      displayName: authDisplayName || cleanText(supplement.displayName) || undefined,
      email: authEmail || cleanText(supplement.email) || undefined,
      photoURL: authPhotoURL || safeHttpUrl(supplement.photoURL) || undefined,
    };
  }, [currentUserId, appStoreUser, authDisplayName, authEmail, authPhotoURL]);

  // --- Store selectors (granular) ---------------------------------------
  const profile = useProfileStore((state) => state.profile);
  const loading = useProfileStore((state) => state.loading);
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

  const analytics = useAnalyticsStore((state) => (state.analyticsUserId === currentUserId && state.analyticsTimeframe === state.timeframe ? state.analytics : null));
  const timeframe = useAnalyticsStore((state) => state.timeframe);
  const ranking = useAnalyticsStore((state) => (state.analyticsUserId === currentUserId && state.analyticsTimeframe === state.timeframe ? state.ranking : null));
  const setTimeframe = useAnalyticsStore((state) => state.setTimeframe);

  // --- Slice ownership ---------------------------------------------------
  // A slice is trusted only after this account + perspective finished loading it successfully.
  const sliceMap = loadState.key === ctxKey ? loadState.slices : EMPTY_SLICES;
  const sliceOk = (name) => sliceMap[name] === 'ok';
  const profileReady = sliceOk('profile');
  const postsReady = sliceOk('posts');
  const storiesReady = isOwnerView && sliceOk('stories');
  const highlightsReady = isOwnerView && sliceOk('highlights');
  const levelReady = isOwnerView && sliceOk('level');
  const balanceReady = isOwnerView && sliceOk('balance');
  const savedStatus = savedState.uid === currentUserId ? savedState.status : null;

  // The profile must positively belong to the authenticated UID. A profile carrying no identifier is
  // accepted only after our own load for this account/perspective completed.
  const ownedProfile = useMemo(() => {
    if (!currentUserId || !profile || typeof profile !== 'object') return null;
    const ids = [asUid(profile.uid), asUid(profile.id)].filter(Boolean);
    if (ids.length > 0) return ids.every((id) => id === currentUserId) ? profile : null;
    return profileReady ? profile : null;
  }, [currentUserId, profile, profileReady]);

  const profileUsername = ownedProfile?.username;
  const profileDisplayName = ownedProfile?.displayName;

  // --- Derived profile --------------------------------------------------
  // Identity/count derivation is the shared read model. Email is never a handle or display name.
  // Private fields (balance, level, experience, bio, location, website) never fall back to owner
  // data in a visitor preview, and the loaded posts page is never used as a lifetime count.
  const effectiveProfile = useMemo(() => {
    const base = ownedProfile ?? {};
    const viewer = currentUser || {};
    const ownerFallback = isOwnerView ? viewer : {};

    const lifetimePosts = postsReady ? toCount(postsCount) : null;
    const identity = deriveProfileIdentity(base, {
      viewer,
      handleCandidates: [base.username, viewer.username],
      handleFallbacks: [viewer.displayName, base.displayName],
      handleFallback: null,
      displayCandidates: [viewer.displayName, viewer.name, base.displayName, base.name],
      displayFallback: currentUserId ? `user ${String(currentUserId).slice(0, 6)}` : '—',
      followerCandidates: [base.followerCount, base.followersCount, ownerFallback.followerCount],
      followingCandidates: [base.followingCount, ownerFallback.followingCount],
      postCandidates: [lifetimePosts, toCount(base.postCount)],
      levelCandidates: [levelReady ? toCount(level) : null, toCount(base.level), toCount(ownerFallback.level)],
      withCoins: false,
      userId: currentUserId,
    });

    const resolvedExperience = firstKnown(toAmount, [levelReady ? experience : null, base.experience, base.xp]);
    const resolvedCoins = firstKnown(toAmount, [
      balanceReady ? balance : null,
      base.coins,
      base.coinBalance,
    ]);
    const resolvedLikes = firstKnown(toCount, [postsReady ? postsLikesCount : null, base.likesReceived, base.likesCount]);
    const resolvedFriends = firstKnown(toCount, [profileReady ? friendCount : null, base.friendCount]);
    const overrideUrl = isOwnerView && avatarOverride.uid === currentUserId ? avatarOverride.url : null;

    return {
      ...base,
      ...identity,
      coins: resolvedCoins,
      ...(resolvedExperience !== null ? { experience: resolvedExperience } : {}),
      ...(resolvedLikes !== null ? { likesReceived: resolvedLikes } : {}),
      ...(resolvedFriends !== null ? { friendCount: resolvedFriends } : {}),
      ...(overrideUrl !== null ? { photoURL: overrideUrl } : {}),
      bio: cleanText(base.bio) || cleanText(ownerFallback.bio),
      location: cleanText(base.location) || cleanText(ownerFallback.location),
      website: cleanText(base.website) || cleanText(ownerFallback.website),
    };
  }, [
    ownedProfile, currentUser, currentUserId, isOwnerView, postsReady, profileReady, levelReady, balanceReady,
    postsCount, postsLikesCount, friendCount, level, experience, balance, avatarOverride,
  ]);

  // Capabilities from the existing engine. The preview viewer is a synthetic identity used only for
  // that preview contract; it is never an authenticated user or a credential.
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

  // Profile handed to the share and QR flows. A visitor preview receives only the projected profile,
  // never the owner's unfiltered data.
  const shareableProfile = useMemo(
    () => (ownedProfile && currentUserId ? { ...displayedProfile, id: currentUserId, uid: currentUserId } : null),
    [ownedProfile, displayedProfile, currentUserId],
  );

  // --- Tabs (derived; never overrides a manual selection, resets per account) ---
  const requestedTab = searchParams.get('tab');
  const preferredTab = displayedProfile?.defaultTab;
  const resolvedTab = (() => {
    const manual = tabState.uid === currentUserId ? tabState.tab : null;
    if (manual && PROFILE_TABS.includes(manual)) return manual;
    if (requestedTab && PROFILE_TABS.includes(requestedTab)) return requestedTab;
    if (preferredTab && PROFILE_TABS.includes(preferredTab)) return preferredTab;
    return 'posts';
  })();
  const activeTab = !isOwnerView && OWNER_ONLY_TABS.includes(resolvedTab) ? 'posts' : resolvedTab;

  // --- Modals: one at a time, keyed by UID, owner-only surfaces gated at render ---
  const activeModal = modalState.uid === currentUserId ? modalState.name : null;
  const visibleModal = activeModal && OWNER_ONLY_MODALS.includes(activeModal) && !isOwnerView ? null : activeModal;

  const isRefreshing = refreshState.uid !== null && refreshState.uid === currentUserId;

  useLayoutEffect(() => {
    uidRef.current = currentUserId;
    viewAsRef.current = viewAs;
    timeframeRef.current = timeframe;
  });
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const openModal = useCallback((name, field = null) => {
    const uid = uidRef.current;
    if (!uid) return;
    if (OWNER_ONLY_MODALS.includes(name) && viewAsRef.current !== 'owner') return;
    setModalState({ uid, name, field });
  }, []);
  const closeModal = useCallback((name) => {
    setModalState((prev) => (name === undefined || prev.name === name ? EMPTY_MODAL : prev));
  }, []);

  // --- Data loading: one orchestration path for load, perspective, refresh and retry ---
  const ctxGenRef = useRef(0);

  const markSlice = useCallback((key, gen, name, status) => {
    if (!mountedRef.current || ctxGenRef.current !== gen) return;
    setLoadState((prev) => (prev.key === key ? { ...prev, slices: { ...prev.slices, [name]: status } } : prev));
  }, []);

  /**
   * Loads the datasets that belong to an account + perspective through the existing store actions.
   * Owner: profile, highlights, stories, level, balance, position, posts. Preview: only the
   * perspective-aware profile and posts. Resolves to { slice: boolean } built from real outcomes.
   */
  const loadContext = useCallback(async (uid, mode, gen, { refresh = false, quiet = false, only = null } = {}) => {
    const store = useProfileStore.getState();
    const isOwnerCtx = mode === 'owner';
    const key = `${uid}|${mode}`;
    const tasks = [];
    const add = (name, run) => { if (!only || only.includes(name)) tasks.push({ name, run }); };

    add('profile', () => (isOwnerCtx
      ? (refresh ? store.refreshProfile(uid, uid) : store.loadProfile(uid, uid))
      : store.loadProfile(uid, uid, { viewAs: mode })));
    add('posts', () => (isOwnerCtx
      ? store.loadPosts(uid, refresh ? { force: true } : {})
      : store.loadPosts(uid, { limit: PREVIEW_POST_LIMIT, viewAs: mode })));
    if (isOwnerCtx) {
      add('highlights', () => store.loadHighlights(uid));
      add('stories', () => store.loadStories(uid));
      add('level', () => store.loadLevel(uid));
      add('balance', () => store.loadBalance(uid));
      add('position', () => store.loadPosition(uid));
    }

    if (!refresh && !quiet) tasks.forEach((task) => markSlice(key, gen, task.name, 'loading'));

    const results = {};
    await Promise.all(tasks.map(async (task) => {
      let success = await settleAction(task.run);
      // loadProfile may record its failure in the store instead of throwing.
      if (success && task.name === 'profile' && useProfileStore.getState().error) success = false;
      results[task.name] = success;
      if (success) {
        markSlice(key, gen, task.name, 'ok');
      } else if (!refresh && !quiet) {
        markSlice(key, gen, task.name, 'error');
      } else {
        // A failed refresh or background sync keeps data that was already loaded.
        setLoadState((prev) => (prev.key === key && prev.slices[task.name] !== 'ok' && ctxGenRef.current === gen
          ? { ...prev, slices: { ...prev.slices, [task.name]: 'error' } }
          : prev));
      }
    }));
    return results;
  }, [markSlice]);

  // Initial load and every perspective change share this single effect. Rapid switching is safe:
  // each run bumps the generation, so earlier runs can no longer update the screen.
  useEffect(() => {
    if (!currentUserId) return;
    const gen = ctxGenRef.current + 1;
    ctxGenRef.current = gen;
    const key = `${currentUserId}|${viewAs}`;
    const snap = useProfileStore.getState();
    const hasWarmOwnerStore = Boolean(
      viewAs === 'owner' &&
      snap.profile &&
      (snap.profile.uid === currentUserId || snap.profile.id === currentUserId) &&
      !snap.error
    );
    if (hasWarmOwnerStore) {
      setLoadState({
        key,
        slices: {
          profile: 'ok',
          ...(snap.postsCount !== null || (Array.isArray(snap.posts) && snap.posts.length > 0) ? { posts: 'ok' } : {}),
          ...(Array.isArray(snap.highlights) ? { highlights: 'ok' } : {}),
          ...(Array.isArray(snap.stories) ? { stories: 'ok' } : {}),
          ...(snap.level !== null || snap.profile?.level != null ? { level: 'ok' } : {}),
          ...(snap.balance !== null || snap.profile?.coins != null ? { balance: 'ok' } : {}),
          ...(snap.position !== null ? { position: 'ok' } : {}),
        },
      });
      loadContext(currentUserId, viewAs, gen, { quiet: true });
      return;
    }
    setLoadState({ key, slices: EMPTY_SLICES });
    loadContext(currentUserId, viewAs, gen);
  }, [currentUserId, viewAs, loadContext]);

  // Analytics load separately so a timeframe change never re-fetches profile or posts. Owner only.
  useEffect(() => {
    if (!currentUserId || !isOwnerView) return;
    settleAction(() => useAnalyticsStore.getState().loadAnalytics(currentUserId, timeframe));
  }, [currentUserId, isOwnerView, timeframe]);

  // Saved posts load on demand (owner only). The status distinguishes not-loaded, loading, empty and failed.
  const loadSaved = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid || viewAsRef.current !== 'owner') return;
    setSavedState({ uid, status: 'loading' });
    const ok = await settleAction(() => useProfileStore.getState().loadSavedPosts(uid));
    if (!mountedRef.current || uidRef.current !== uid) return;
    setSavedState((prev) => (prev.uid === uid ? { uid, status: ok ? 'ok' : 'error' } : prev));
  }, []);

  useEffect(() => {
    if (activeTab === 'saved' && isOwnerView && currentUserId && savedStatus === null) loadSaved();
  }, [activeTab, isOwnerView, currentUserId, savedStatus, loadSaved]);

  const loadStateRef = useRef(EMPTY_SLICES);
  useLayoutEffect(() => { loadStateRef.current = sliceMap; });

  // Retry reloads only the slices that failed. The lock stops rapid taps from starting parallel loads.
  const retryLockRef = useRef(false);
  const handleRetryLoad = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid || retryLockRef.current) return;
    retryLockRef.current = true;
    try {
      const mode = viewAsRef.current;
      const failed = Object.entries(loadStateRef.current).filter(([, status]) => status === 'error').map(([name]) => name);
      await loadContext(uid, mode, ctxGenRef.current, failed.length > 0 ? { only: failed } : {});
    } finally {
      retryLockRef.current = false;
    }
  }, [loadContext]);

  const refreshingRef = useRef(new Set());
  const refreshOpRef = useRef(0);
  const handleRefresh = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid || refreshingRef.current.has(uid)) return;
    refreshingRef.current.add(uid);
    const op = refreshOpRef.current + 1;
    refreshOpRef.current = op;
    const mode = viewAsRef.current;
    const gen = ctxGenRef.current;
    setRefreshState({ uid, op });
    try {
      const tasks = [loadContext(uid, mode, gen, { refresh: true })];
      if (mode === 'owner') {
        tasks.push(settleAction(() => useAnalyticsStore.getState().loadAnalytics(uid, timeframeRef.current))
          .then((ok) => ({ analytics: ok })));
      }
      const settled = await Promise.all(tasks);
      // Nothing below runs for a different account or perspective: no stale toast, no stale state.
      if (!mountedRef.current || uidRef.current !== uid || viewAsRef.current !== mode) return;
      const outcomes = Object.values(Object.assign({}, ...settled));
      const failed = outcomes.filter((ok) => !ok).length;
      if (failed === 0) toast.success('Profile refreshed');
      else if (failed < outcomes.length) toast.warning('Some sections could not be refreshed');
      else toast.error('Could not refresh your profile');
    } finally {
      refreshingRef.current.delete(uid);
      if (mountedRef.current) setRefreshState((prev) => (prev.op === op ? { uid: null, op } : prev));
    }
  }, [loadContext]);

  const reloadOwnerProfile = useCallback(() => {
    const uid = uidRef.current;
    if (!uid || viewAsRef.current !== 'owner') return;
    settleAction(() => useProfileStore.getState().loadProfile(uid, uid));
  }, []);

  // --- Perspective switching (allowlisted, deduplicated) ----------------
  const handleViewAsChange = useCallback((mode) => {
    const uid = uidRef.current;
    if (!uid || !PERSPECTIVES.includes(mode) || mode === viewAsRef.current) return;
    setViewAsState({ uid, mode });
    setModalState((prev) => (prev.name && OWNER_ONLY_MODALS.includes(prev.name) ? EMPTY_MODAL : prev));
    if (mode !== 'owner') setTabState((prev) => (OWNER_ONLY_TABS.includes(prev.tab) ? { uid, tab: 'posts' } : prev));
  }, []);

  // --- Username auto-generation (existing userService contract) ---------
  // Bounded, per-account attempts: no loop, and a failure leaves room for one more try.
  const usernameAttemptsRef = useRef(new Map());
  useEffect(() => {
    if (!isOwnerView || !currentUserId || loading || !ownedProfile) return;
    if (profileUsername && !isPlaceholderHandle(profileUsername)) return;
    const record = usernameAttemptsRef.current.get(currentUserId) || { inFlight: false, failures: 0, done: false };
    if (record.inFlight || record.done || record.failures >= MAX_USERNAME_ATTEMPTS) return;
    usernameAttemptsRef.current.set(currentUserId, { ...record, inFlight: true });
    const uid = currentUserId;
    const baseName = readHandleBase(authDisplayName, profileDisplayName);

    (async () => {
      let succeeded = false;
      try {
        const { getUserService } = await import('../../services/userService.js');
        const userService = getUserService();
        const uidFallback = `user${String(uid).slice(0, 6)}`;
        const generated = await userService.generateUniqueUsername(normalizeUsernameBase(baseName, uidFallback), uid);
        if (generated) {
          await userService.updateUserProfile(uid, { username: generated });
          succeeded = true;
        }
      } catch (err) {
        console.warn('[ProfileMyScreen] username generation failed:', err?.code || err?.name || 'error');
      }
      const latest = usernameAttemptsRef.current.get(uid) || record;
      usernameAttemptsRef.current.set(uid, {
        inFlight: false,
        done: succeeded,
        failures: succeeded ? latest.failures : latest.failures + 1,
      });
      // Reload only while the same account is still showing its owner view.
      if (succeeded && mountedRef.current && uidRef.current === uid && viewAsRef.current === 'owner') {
        settleAction(() => useProfileStore.getState().loadProfile(uid, uid));
      }
    })();
  }, [isOwnerView, currentUserId, loading, ownedProfile, profileUsername, profileDisplayName, authDisplayName]);

  // --- Owner-only actions (inert while previewing another perspective) --
  const openLocationSetup = useCallback(() => openModal('location'), [openModal]);
  const openOptions = useCallback(() => openModal('options'), [openModal]);
  const openAvatarModal = useCallback(() => openModal('avatar'), [openModal]);
  const openVerification = useCallback(() => openModal('verification'), [openModal]);
  const openQrCode = useCallback(() => openModal('qr'), [openModal]);
  const openPerspective = useCallback(() => openModal('perspective'), [openModal]);
  const openQuickEdit = useCallback((field) => openModal('quickEdit', cleanText(field) || 'bio'), [openModal]);

  const handleEditProfile = useCallback(() => {
    if (viewAsRef.current === 'owner') navigate('/profile/edit');
  }, [navigate]);
  const handleInsights = useCallback(() => {
    if (viewAsRef.current === 'owner') navigate('/profile/analytics');
  }, [navigate]);
  const handleAddHighlight = useCallback(() => {
    if (viewAsRef.current === 'owner') navigate('/profile/highlights?create=true');
  }, [navigate]);
  // A modal whose chunk or render fails is dismissed so the profile underneath stays usable.
  const handleModalFailure = useCallback(() => {
    closeModal();
    toast.error('That panel could not be opened. Please try again later.');
  }, [closeModal]);

  const lastTreasuryOpenRef = useRef(0);
  const handleOpenTreasury = useCallback(() => {
    if (viewAsRef.current !== 'owner') return;
    const now = Date.now();
    if (now - lastTreasuryOpenRef.current < TREASURY_DEBOUNCE_MS) return;
    lastTreasuryOpenRef.current = now;
    navigate('/coins');
  }, [navigate]);

  const handlePostClick = useCallback((post) => {
    const id = asId(post && typeof post === 'object' ? post.id : null);
    if (id) navigate(`/post/${encodeURIComponent(id)}`);
  }, [navigate]);

  const handleTabChange = useCallback((tab) => {
    const uid = uidRef.current;
    if (!uid || typeof tab !== 'string' || !PROFILE_TABS.includes(tab)) return;
    if (viewAsRef.current !== 'owner' && OWNER_ONLY_TABS.includes(tab)) return;
    setTabState({ uid, tab });
  }, []);

  const handleMetricPress = useCallback((key) => {
    const uid = uidRef.current;
    if (!uid) return;
    const ownerNow = viewAsRef.current === 'owner';
    switch (key) {
      case 'followers':
      case 'following':
      case 'friends':
        // Relationship lists are the owner's real data; a simulated visitor must not open them.
        if (ownerNow) navigate(`/profile/${encodeURIComponent(uid)}/${key}`);
        break;
      case 'posts':
        handleTabChange('posts');
        break;
      case 'coins':
        if (ownerNow) navigate('/coins');
        break;
      case 'views':
        if (ownerNow) navigate('/profile/analytics');
        break;
      default:
        break;
    }
  }, [navigate, handleTabChange]);

  const loadMoreLockRef = useRef(false);
  const handleLoadMorePosts = useCallback(async () => {
    const uid = uidRef.current;
    // Pagination exists only for the owner view: the loader has no perspective option, and a cursor
    // from another account or perspective must never be reused.
    if (!uid || viewAsRef.current !== 'owner' || loadMoreLockRef.current) return;
    const store = useProfileStore.getState();
    if (store.postsLoading) return;
    loadMoreLockRef.current = true;
    try {
      await settleAction(() => store.loadMorePosts(uid));
    } finally {
      loadMoreLockRef.current = false;
    }
  }, []);

  const handleShare = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid) return;
    try {
      const target = { ...(shareableProfile ?? {}), id: uid, uid };
      const result = await shareProfile(target);
      if (uidRef.current === uid && result?.copied) toast.success('Profile link copied to clipboard!');
    } catch {
      if (uidRef.current === uid) toast.error('Could not share profile');
    }
  }, [shareableProfile]);

  // Cross-component events from the app shell. Listeners are registered once and always call the
  // latest handlers through a ref, so none are duplicated or stale.
  const eventHandlersRef = useRef({});
  useLayoutEffect(() => {
    eventHandlersRef.current = {
      qr: openQrCode,
      perspective: openPerspective,
      share: handleShare,
      options: openOptions,
      location: openLocationSetup,
    };
  });
  useEffect(() => {
    const onOpenQrCode = () => eventHandlersRef.current.qr?.();
    const onOpenPerspective = () => eventHandlersRef.current.perspective?.();
    const onShareProfile = () => eventHandlersRef.current.share?.();
    const onOpenOptions = () => eventHandlersRef.current.options?.();
    const onOpenLocation = () => eventHandlersRef.current.location?.();

    window.addEventListener('arvdoul:open_qr_code', onOpenQrCode);
    window.addEventListener('arvdoul:open_perspective_modal', onOpenPerspective);
    window.addEventListener('arvdoul:share_profile', onShareProfile);
    window.addEventListener('arvdoul:open_profile_options', onOpenOptions);
    window.addEventListener('arvdoul:open_location_setup', onOpenLocation);

    return () => {
      window.removeEventListener('arvdoul:open_qr_code', onOpenQrCode);
      window.removeEventListener('arvdoul:open_perspective_modal', onOpenPerspective);
      window.removeEventListener('arvdoul:share_profile', onShareProfile);
      window.removeEventListener('arvdoul:open_profile_options', onOpenOptions);
      window.removeEventListener('arvdoul:open_location_setup', onOpenLocation);
    };
  }, []);

  // --- Avatar handlers --------------------------------------------------
  const syncAppStoreAvatar = useCallback((uid, photoURL) => {
    const appUser = useAppStore.getState().currentUser;
    if (appUser && (appUser.uid === uid || appUser.id === uid)) {
      useAppStore.getState().setCurrentUser({ ...appUser, photoURL });
    }
  }, []);

  const avatarBusyRef = useRef(false);
  const handleAvatarUpload = useCallback(async (croppedFile) => {
    const uid = uidRef.current;
    if (!uid || viewAsRef.current !== 'owner' || avatarBusyRef.current) return;
    avatarBusyRef.current = true;
    const toastId = toast.loading('Uploading avatar...');
    try {
      const { getUserService } = await import('../../services/userService.js');
      const uploadRes = await getUserService().uploadAvatar(uid, croppedFile);
      const nextUrl = safeHttpUrl(
        typeof uploadRes === 'string'
          ? uploadRes
          : (uploadRes?.downloadURL || uploadRes?.photoURL || uploadRes?.url)
      );
      if (uidRef.current !== uid) { toast.dismiss(toastId); return; }
      if (!nextUrl) {
        const confirmErr = new Error('We could not confirm the new avatar. Please try again.');
        confirmErr._toastShown = true;
        toast.error(confirmErr.message, { id: toastId });
        reloadOwnerProfile();
        throw confirmErr;
      }
      // The visible avatar must not depend on AuthContext's (older) photo URL.
      setAvatarOverride({ uid, url: nextUrl });
      syncAppStoreAvatar(uid, nextUrl);
      toast.success('Avatar updated', { id: toastId });
      closeModal('avatar');
      reloadOwnerProfile();
    } catch (err) {
      console.warn('[ProfileMyScreen] avatar upload failed:', err?.code || err?.name || 'error');
      if (uidRef.current === uid) {
        if (!err?._toastShown) {
          toast.error('Failed to upload avatar. Please try again.', { id: toastId });
        }
      } else {
        toast.dismiss(toastId);
      }
      if (err && typeof err === 'object') {
        err._toastShown = true;
      }
      throw err;
    } finally {
      avatarBusyRef.current = false;
    }
  }, [closeModal, reloadOwnerProfile, syncAppStoreAvatar]);

  const handleAvatarRemove = useCallback(async () => {
    const uid = uidRef.current;
    if (!uid || viewAsRef.current !== 'owner' || avatarBusyRef.current) return;
    avatarBusyRef.current = true;
    const toastId = toast.loading('Removing avatar...');
    try {
      const { getUserService } = await import('../../services/userService.js');
      await getUserService().updateUserProfile(uid, { photoURL: '' });
      if (uidRef.current !== uid) { toast.dismiss(toastId); return; }
      setAvatarOverride({ uid, url: '' });
      syncAppStoreAvatar(uid, '');
      toast.success('Avatar removed', { id: toastId });
      closeModal('avatar');
      reloadOwnerProfile();
    } catch (err) {
      console.warn('[ProfileMyScreen] avatar removal failed:', err?.code || err?.name || 'error');
      if (uidRef.current === uid) toast.error('Failed to remove avatar. Please try again.', { id: toastId });
      else toast.dismiss(toastId);
      if (err && typeof err === 'object') {
        err._toastShown = true;
      }
      throw err;
    } finally {
      avatarBusyRef.current = false;
    }
  }, [closeModal, reloadOwnerProfile, syncAppStoreAvatar]);

  // --- Scoped content for children ---------------------------------------
  const safePosts = postsReady ? asArray(posts) : EMPTY_ARRAY;
  const safeStories = storiesReady ? asArray(stories) : EMPTY_ARRAY;
  const safeSaved = isOwnerView && savedStatus === 'ok' ? asArray(savedPosts) : EMPTY_ARRAY;
  const safeHighlights = highlightsReady ? asArray(highlights) : EMPTY_ARRAY;

  const tabCounts = useMemo(() => buildTabCounts({
    posts: safePosts,
    stories: safeStories,
    savedPosts: safeSaved,
    uid: currentUserId,
    postsLoaded: postsReady,
    postsComplete: postsReady && postsHasMore === false,
    lifetimePosts: postsReady ? toCount(postsCount) : null,
    storiesLoaded: storiesReady,
    savedLoaded: isOwnerView && savedStatus === 'ok',
  }), [safePosts, safeStories, safeSaved, currentUserId, postsReady, postsHasMore, postsCount, storiesReady, isOwnerView, savedStatus]);

  // --- Treasury: owner uses the economy-backed balance; visitors only a projected, permitted value ---
  const treasuryBalance = isOwnerView
    ? firstKnown(toAmount, [balanceReady ? balance : null, ownedProfile?.coins, ownedProfile?.coinBalance])
    : (capabilities?.canViewEconomicStatus === true ? toAmount(displayedProfile?.coins) : null);
  const treasuryLoading = isOwnerView && treasuryBalance === null && sliceMap.balance !== 'error' && sliceMap.balance !== 'ok';
  const canShowTreasury = isOwnerView || treasuryBalance !== null;
  const treasuryText = treasuryBalance !== null
    ? `${formatAmount(treasuryBalance)} ${treasuryBalance === 1 ? 'coin' : 'coins'}`
    : (treasuryLoading ? 'loading balance' : 'balance unavailable');

  // --- Feed state --------------------------------------------------------
  const feedSliceStatus = activeTab === 'saved' && isOwnerView
    ? savedStatus
    : (activeTab === 'stories' && isOwnerView ? sliceMap.stories : sliceMap.posts);
  const feedFailed = feedSliceStatus === 'error';
  const feedPending = feedSliceStatus !== 'ok' && !feedFailed;
  const handleFeedRetry = activeTab === 'saved' && isOwnerView ? loadSaved : handleRetryLoad;

  const failedSlices = Object.entries(sliceMap).filter(([, status]) => status === 'error').map(([name]) => name);
  const isSyncing = Boolean(ownedProfile) && (loading || Object.values(sliceMap).includes('loading'));

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('arvdoul:sync_progress', {
      detail: { source: 'profile-my', active: isSyncing },
    }));
    return () => {
      window.dispatchEvent(new CustomEvent('arvdoul:sync_progress', {
        detail: { source: 'profile-my', active: false },
      }));
    };
  }, [isSyncing]);

  const shell = (children, extraClass) => (
    <ErrorBoundary>
      <div
        className={cn('pms relative isolate w-full', extraClass)}
        data-theme={isDark ? 'dark' : 'light'}
        data-lite={isLiteMode ? 'true' : 'false'}
        style={SHELL_STYLE}
      >
        <style>{PMS_CSS}</style>
        {children}
      </div>
    </ErrorBoundary>
  );

  // --- Gate: authentication ---------------------------------------------
  if (!currentUserId) {
    if (authPending) {
      return shell(<ProfileSkeleton theme={theme} variant="owner" />, 'pb-[calc(5rem+env(safe-area-inset-bottom,0px))]');
    }
    return shell(
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <StatePanel
            icon={Lock}
            headingLevel="h2"
            title="Sign in to view your profile"
            text="Access your Arvdoul identity, progression, creations, and settings by signing in."
            actionLabel="Sign In"
            onAction={() => navigate('/login')}
            label="Sign in required"
          />
        </div>
      </div>
    );
  }

  // --- Gate: profile availability ---------------------------------------
  if (!ownedProfile) {
    const profileStatus = sliceMap.profile;
    if (profileStatus === 'error' || profileStatus === 'ok') {
      return shell(
        <div className="w-full max-w-[1040px] mx-auto px-3 sm:px-5 lg:px-7 py-6">
          <StatePanel
            icon={AlertCircle}
            tone={profileStatus === 'error' ? 'error' : undefined}
            role={profileStatus === 'error' ? 'alert' : 'status'}
            title={profileStatus === 'error' ? "We couldn't load your profile" : 'Your profile is not available yet'}
            text={profileStatus === 'error'
              ? 'Check your connection and try again.'
              : 'We could not find a profile for this account. Try again in a moment.'}
            actionLabel="Try again"
            onAction={handleRetryLoad}
          />
        </div>,
        'pb-[calc(5rem+env(safe-area-inset-bottom,0px))]'
      );
    }
    return shell(<ProfileSkeleton theme={theme} variant="owner" />, 'pb-[calc(5rem+env(safe-area-inset-bottom,0px))]');
  }

  const showPrivateState = !isOwnerView && !capabilities?.canViewContent;
  const TreasurySurface = isOwnerView ? 'button' : 'div';
  const treasurySurfaceProps = isOwnerView
    ? {
      type: 'button',
      onClick: handleOpenTreasury,
      'aria-label': `Open Coins Treasury, ${treasuryText}`,
      'aria-busy': treasuryLoading || undefined,
    }
    : {};
  return shell(
    <>
      {/* Load failures: sanitized; details are logged, never shown */}
      {failedSlices.length > 0 && (
        <div className="w-full max-w-[1040px] mx-auto px-3 sm:px-5 lg:px-7 pt-2">
          <div role="alert" className="pms-glass pms-banner" data-tier="subtle" data-tone="error">
            <span className="min-w-0">
              {failedSlices.includes('profile')
                ? "We couldn't refresh your profile details."
                : "Some parts of your profile couldn't load."}
            </span>
            <button type="button" className="pms-btn pms-glass" data-tier="subtle" onClick={handleRetryLoad}>
              <RefreshCw aria-hidden="true" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      )}

      {/* Master container */}
      <div className="relative w-full max-w-[1040px] mx-auto px-3 sm:px-5 lg:px-7 pt-2 pb-4 sm:pt-3 sm:pb-6 space-y-4 sm:space-y-5 lg:space-y-6">

        {/* 01. Identity */}
        <section aria-label="Profile identity" className="min-w-0">
          <SectionGuard label="Profile identity" resetKey={ctxKey}>
            <ProfileHeroSection
              profile={displayedProfile}
              isOwner={isOwnerView}
              level={displayedProfile?.level}
              theme={theme}
              onOpenQrCode={openQrCode}
              onOpenLocationSetup={isOwnerView ? openLocationSetup : undefined}
              onOpenOptions={isOwnerView ? openOptions : undefined}
              onAvatarClick={isOwnerView ? openAvatarModal : undefined}
              onShare={handleShare}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              onEditProfile={isOwnerView ? handleEditProfile : undefined}
              onOpenQuickEdit={isOwnerView ? openQuickEdit : undefined}
              onOpenVerificationModal={isOwnerView ? openVerification : undefined}
              onInsightsPress={isOwnerView ? handleInsights : undefined}
              capabilities={capabilities}
              vibes={storiesReady ? safeStories : null}
              vibesLoading={isOwnerView && sliceMap.stories === 'loading'}
            />
          </SectionGuard>
        </section>

        {/* 02. Social presence + Coins Treasury */}
        <div
          className={cn('pms-rise grid grid-cols-1 gap-4 sm:gap-5 items-stretch', canShowTreasury && 'lg:grid-cols-12')}
          style={{ '--i': 1 }}
        >
          <section aria-label="Social presence" className={cn('min-w-0', canShowTreasury ? 'lg:col-span-7' : 'w-full')}>
            <SectionGuard label="Profile metrics" resetKey={ctxKey}>
              <ProfileMetricsGrid
                isOwner={isOwnerView}
                theme={theme}
                profile={displayedProfile}
                analytics={isOwnerView ? analytics : null}
                capabilities={capabilities}
                showCoins={false}
                onMetricPress={handleMetricPress}
              />
            </SectionGuard>
          </section>

          {canShowTreasury && (
            <section aria-label="Arvdoul Coins Treasury" className="min-w-0 lg:col-span-5">
              {/* Owner: the whole surface is the control. Visitor with permission: read-only. */}
              <TreasurySurface className="pms-glass pms-treasury" {...treasurySurfaceProps}>
                <span className="pms-treasury-main">
                  <span className="pms-coin" aria-hidden="true"><Coins /></span>
                  <span className="pms-treasury-text">
                    <span className="pms-eyebrow">Coins Treasury</span>
                    <span className="pms-balance">
                      {treasuryBalance !== null ? (
                        <>
                          <strong>{formatCoins(treasuryBalance)}</strong>
                          <span>{treasuryBalance === 1 ? 'Coin' : 'Coins'}</span>
                        </>
                      ) : treasuryLoading ? (
                        <span className="pms-bar pms-pulse" aria-hidden="true" />
                      ) : (
                        <em>Balance unavailable</em>
                      )}
                    </span>
                  </span>
                </span>
                {isOwnerView && <span className="pms-chev" aria-hidden="true"><ChevronRight /></span>}
              </TreasurySurface>
            </section>
          )}
        </div>

        {showPrivateState ? (
          <StatePanel
            icon={Lock}
            title="This Account is Private"
            text={`Visitors in the ${PERSPECTIVE_LABELS[viewAs] || viewAs} perspective cannot view private highlights, pinned posts, or the media gallery.`}
            actionLabel="Return to owner view"
            onAction={() => handleViewAsChange('owner')}
            label="Private content"
          />
        ) : (
          <>
            {/* 03. Progression & Highlights (highlights are owner-only: the loader cannot filter by perspective) */}
            <div
              className={cn('pms-rise grid grid-cols-1 gap-4 sm:gap-5 lg:items-start', isOwnerView && 'lg:grid-cols-12')}
              style={{ '--i': 2 }}
            >
              <section aria-label="Progression" className={cn('min-w-0', isOwnerView && 'lg:col-span-7')}>
                <SectionGuard label="Progression" resetKey={ctxKey}>
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
                </SectionGuard>
              </section>

              {isOwnerView && (
                <section aria-label="Story highlights" className="min-w-0 lg:col-span-5">
                  {highlightsReady ? (
                    <SectionGuard label="Highlights" resetKey={ctxKey}>
                      <ProfileHighlightsSection
                        highlights={safeHighlights}
                        userId={currentUserId}
                        isOwner={isOwnerView}
                        managedByParent={true}
                        theme={theme}
                        onAddHighlight={handleAddHighlight}
                      />
                    </SectionGuard>
                  ) : sliceMap.highlights === 'error' ? (
                    <StatePanel
                      icon={AlertCircle}
                      tier="subtle"
                      tone="error"
                      role="alert"
                      title="Highlights couldn't load"
                      actionLabel="Retry"
                      onAction={handleRetryLoad}
                    />
                  ) : (
                    <div className="pms-glass pms-skel pms-pulse" data-tier="subtle" style={{ height: 128 }} aria-busy="true" />
                  )}
                </section>
              )}
            </div>

            {/* 04. Creator intelligence (owner perspective only) */}
            {isOwnerView && (
              <section aria-label="Creator dashboard" className="pms-rise min-w-0" style={{ '--i': 3 }}>
                <SectionGuard label="Creator dashboard" resetKey={ctxKey}>
                  <Suspense fallback={<div className="pms-glass pms-skel pms-pulse" style={{ height: 144 }} aria-busy="true" />}>
                    <ProfileCreatorDashboard
                      analytics={analytics}
                      ranking={ranking}
                      userLevel={effectiveProfile?.level ?? null}
                      isCreator={effectiveProfile?.isCreator}
                      isOwner={isOwnerView}
                      theme={theme}
                      timeframe={timeframe}
                      onTimeframeChange={setTimeframe}
                    />
                  </Suspense>
                </SectionGuard>
              </section>
            )}

            {/* 05. Content hub */}
            <section aria-label="Profile content" className="min-w-0 space-y-4 sm:space-y-5">
              <SectionGuard label="Profile tabs" resetKey={ctxKey}>
                <div className="pms-tabs">
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
              </SectionGuard>

              {feedFailed ? (
                <StatePanel
                  icon={AlertCircle}
                  tone="error"
                  role="alert"
                  title="This section couldn't load"
                  text="Check your connection and try again."
                  actionLabel="Retry"
                  onAction={handleFeedRetry}
                />
              ) : (
                <SectionGuard label="Profile content" resetKey={ctxKey}>
                  {activeTab === 'posts' && (
                    <ProfilePinnedPosts
                      posts={safePosts}
                      profileId={currentUserId}
                      isOwner={isOwnerView}
                      theme={theme}
                      onPostClick={handlePostClick}
                    />
                  )}

                  <ProfileFeedGrid
                    posts={safePosts}
                    savedPosts={safeSaved}
                    stories={safeStories}
                    activeTab={activeTab}
                    viewMode={viewMode}
                    loading={feedPending || postsLoading || (isOwnerView && (savedLoading || (activeTab === 'stories' && storiesLoading)))}
                    theme={theme}
                    profile={displayedProfile}
                    isOwner={isOwnerView}
                    onPostClick={handlePostClick}
                    hasMore={Boolean(isOwnerView && postsReady && postsCursor && postsHasMore)}
                    loadingMore={isOwnerView && postsLoading}
                    onLoadMore={handleLoadMorePosts}
                  />
                </SectionGuard>
              )}
            </section>
          </>
        )}
      </div>

      {/* 06. Secondary interfaces (mounted and fetched strictly on demand) */}
      {visibleModal === 'perspective' && (
        <LazyModal onFail={handleModalFailure}>
          <ProfilePerspectiveModal
            isOpen
            onClose={() => closeModal('perspective')}
            currentPerspective={viewAs}
            onSelectPerspective={(mode) => { handleViewAsChange(mode); closeModal('perspective'); }}
            theme={theme}
          />
        </LazyModal>
      )}

      {visibleModal === 'qr' && (
        <LazyModal onFail={handleModalFailure}>
          <ProfileQRCodeModal
            isOpen
            onClose={() => closeModal('qr')}
            profile={shareableProfile ?? effectiveProfile}
            theme={theme}
          />
        </LazyModal>
      )}

      {visibleModal === 'location' && (
        <LazyModal onFail={handleModalFailure}>
          <ProfileLocationModal
            isOpen
            onClose={() => closeModal('location')}
            currentLocation={effectiveProfile?.location}
            currentPrivacy={effectiveProfile?.locationPrivacy}
            userId={currentUserId}
            theme={theme}
            onLocationUpdated={reloadOwnerProfile}
          />
        </LazyModal>
      )}

      {visibleModal === 'verification' && (
        <LazyModal onFail={handleModalFailure}>
          <ProfileVerificationModal
            isOpen
            onClose={() => closeModal('verification')}
            isVerified={Boolean(effectiveProfile?.isVerified)}
            profile={effectiveProfile}
            isOwner={isOwnerView}
            theme={theme}
            onVerificationSubmitted={reloadOwnerProfile}
          />
        </LazyModal>
      )}

      {visibleModal === 'options' && (
        <LazyModal onFail={handleModalFailure}>
          <ProfileOptionsMenu
            profile={effectiveProfile}
            isOwner={isOwnerView}
            theme={theme}
            onOpenLocationSetup={openLocationSetup}
            onClose={() => closeModal('options')}
          />
        </LazyModal>
      )}

      {visibleModal === 'avatar' && (
        <LazyModal onFail={handleModalFailure}>
          <AvatarUploadModal
            isOpen
            onClose={() => closeModal('avatar')}
            onUpload={handleAvatarUpload}
            onRemoveAvatar={handleAvatarRemove}
            currentAvatarUrl={effectiveProfile?.photoURL}
            theme={theme}
          />
        </LazyModal>
      )}

      {visibleModal === 'quickEdit' && (
        <LazyModal onFail={handleModalFailure}>
          <ProfileQuickEditModal
            isOpen
            initialField={modalState.field}
            onClose={() => closeModal('quickEdit')}
            profile={effectiveProfile}
            userId={currentUserId}
            theme={theme}
            onProfileUpdated={reloadOwnerProfile}
          />
        </LazyModal>
      )}

      {/* Persistent banner for simulated view-as perspectives */}
      <ProfileViewAsBanner
        viewAs={viewAs}
        onViewAsChange={handleViewAsChange}
        onExit={() => handleViewAsChange('owner')}
      />
    </>,
    cn(
      'overflow-x-clip pb-[calc(5rem+env(safe-area-inset-bottom,0px))]',
      isDark ? 'selection:bg-blue-500/30' : 'selection:bg-blue-500/20'
    )
  );
}
