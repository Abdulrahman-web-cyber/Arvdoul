/**
 * Production-grade Civic Metrics Ledger.
 * Renders independent, equally sized liquid-glass metric tiles (Light & Dark theme).
 *
 * Responsibilities (presentation only, no fetching and no calculation):
 * - Applies Arvdoul's Friends-first progression: Followers and Following unlock for
 *   creators (canonical `resolveCreatorFlag`) or at `LEVEL_GATES.publicFollowers`.
 * - Applies the existing capability map strictly: a protected metric renders only when
 *   its capability is exactly `true`; a missing map denies everything protected.
 * - Never fabricates counts: valid zero renders `0`, unavailable renders `—`, and a
 *   metric the viewer may not see is not rendered at all.
 * - Coins renders only when `showCoins` is true AND economic visibility is granted
 *   (the Treasury card normally owns Coins, so `showCoins` defaults to false).
 * - Invokes `onMetricPress(metricKey)` only for actionable metrics.
 *
 * Layout: tiles are flex items with a four-column-equivalent basis, so every tile has the
 * same width, rows wrap after four, and incomplete rows are centred. Sizing is driven by
 * the component's own container width (CSS container queries), never by the viewport.
 *
 * Theme: the `theme` prop is the single authority. All styling hangs off `data-theme`
 * on the root; no global `dark:` classes are used.
 *
 * @component
 */

import { memo } from "react";
import { FileText, Users, UserCheck, UserPlus, Eye, Heart, Coins } from "lucide-react";
import { cn } from '../../lib/utils';
import { unknownNumber } from '../../lib/unknownNumber.js';
import { LEVEL_GATES } from '../../shared/levelConfig.cjs';
import { resolveCreatorFlag } from '../../services/profileReadModel.js';

/* -------------------------------------------------------------------------------------------
 * Styles
 * One static, scoped stylesheet (all selectors prefixed `pmg-`). Every theme value is a custom
 * property on the root, so Dark and Light are fully independent and nothing leaks.
 *
 * Layer order inside a tile (bottom to top):
 *   1. tile background  - translucent glass body + ambient gradients (+ backdrop blur)
 *   2. .pmg-fx          - specular reflection, clipped to the tile radius, never interactive
 *   3. .pmg-content     - icon, value, label
 *   4. .pmg-rim         - gradient rim (progressive enhancement over a real border)
 *   5. .pmg-trend       - growth badge
 * ----------------------------------------------------------------------------------------- */
const STYLES = `
.pmg-root{
  --pmg-blur:blur(22px) saturate(190%);
  position:relative;
  box-sizing:border-box;
  width:100%;
  max-width:100%;
  margin-inline:auto;
  container-type:inline-size;
  -webkit-text-size-adjust:100%;
}
.pmg-root *,.pmg-root *::before,.pmg-root *::after{box-sizing:border-box}
.pmg-root.pmg-has-trend{padding-top:6px}

/* ---------- Dark: zero-contrast transparent liquid glass over #03071B ---------- */
.pmg-root[data-theme="dark"]{
  --pmg-base:rgba(255,255,255,0.025);
  --pmg-layers:
    radial-gradient(125% 85% at 22% -20%,rgba(255,255,255,0.14),transparent 60%),
    radial-gradient(85% 70% at 105% 112%,rgba(0,136,255,0.14),transparent 64%),
    radial-gradient(75% 65% at -8% 108%,rgba(200,43,255,0.10),transparent 64%),
    linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.01));
  --pmg-border:rgba(255,255,255,0.12);
  --pmg-shadow:
    0 12px 24px -18px rgba(0,0,0,0.55),
    0 2px 6px -3px rgba(0,0,0,0.25),
    inset 0 1px 0 rgba(255,255,255,0.16),
    inset 0 -1px 0 rgba(150,170,255,0.10),
    inset 0 0 16px rgba(130,110,255,0.05);
  --pmg-shadow-hover:
    0 14px 26px -16px rgba(0,0,0,0.62),
    0 2px 6px rgba(0,0,0,0.28),
    inset 0 1px 0 rgba(255,255,255,0.22),
    inset 0 -1px 0 rgba(150,170,255,0.15),
    inset 0 0 20px rgba(130,120,255,0.09);
  --pmg-spec:
    linear-gradient(90deg,transparent,rgba(255,255,255,0.34) 50%,transparent) center top/72% 1px no-repeat,
    linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.02) 55%,transparent);
  --pmg-glow:radial-gradient(90% 80% at 50% 0%,rgba(255,255,255,0.16),transparent 70%);
  --pmg-rim:linear-gradient(140deg,rgba(255,255,255,0.34) 0%,rgba(255,255,255,0.08) 30%,rgba(255,255,255,0.03) 58%,rgba(0,136,255,0.34) 100%);
  --pmg-value:#FFFFFF;
  --pmg-label:#B4BFDE;
  --pmg-focus:#A79BFF;
  --pmg-badge-bg:rgba(3,7,27,0.88);
  --pmg-badge-border:rgba(255,255,255,0.18);
  --pmg-up:#6EE7B7;--pmg-down:#FDA4AF;--pmg-zero:#A8B3CC;
  --pmg-a-posts:#C4B5FD;--pmg-a-followers:#D8B4FE;--pmg-a-following:#67E8F9;
  --pmg-a-friends:#7DD3FC;--pmg-a-views:#5EEAD4;--pmg-a-likes:#FDA4AF;--pmg-a-coins:#FCD34D;
}

/* ---------- Light: bright translucent glass, cool blue/lavender reflections ---------- */
.pmg-root[data-theme="light"]{
  --pmg-base:rgba(244,247,255,0.60);
  --pmg-layers:
    radial-gradient(120% 90% at 50% -26%,rgba(255,255,255,0.96),rgba(255,255,255,0) 62%),
    radial-gradient(85% 70% at -6% 112%,rgba(139,92,246,0.11),transparent 64%),
    radial-gradient(85% 70% at 108% 108%,rgba(59,130,246,0.14),transparent 64%),
    linear-gradient(165deg,rgba(255,255,255,0.72),rgba(238,243,255,0.56) 60%,rgba(226,234,253,0.52));
  --pmg-border:rgba(110,130,220,0.26);
  --pmg-shadow:
    0 12px 24px -16px rgba(50,70,150,0.38),
    0 1px 3px rgba(40,60,140,0.08),
    inset 0 1px 0 rgba(255,255,255,0.98),
    inset 0 -1px 0 rgba(120,140,240,0.14),
    inset 1px 0 0 rgba(255,255,255,0.55),
    inset -1px 0 0 rgba(255,255,255,0.35),
    inset 0 0 16px rgba(255,255,255,0.40);
  --pmg-shadow-hover:
    0 14px 28px -16px rgba(50,70,150,0.45),
    0 1px 3px rgba(40,60,140,0.10),
    inset 0 1px 0 #FFFFFF,
    inset 0 -1px 0 rgba(120,140,240,0.20),
    inset 0 0 20px rgba(255,255,255,0.55);
  --pmg-spec:
    linear-gradient(90deg,transparent,rgba(255,255,255,1) 50%,transparent) center top/76% 1px no-repeat,
    linear-gradient(180deg,rgba(255,255,255,0.80),rgba(255,255,255,0.18) 55%,transparent);
  --pmg-glow:radial-gradient(90% 80% at 50% 0%,rgba(255,255,255,0.85),transparent 70%);
  --pmg-rim:linear-gradient(145deg,#FFFFFF 0%,rgba(255,255,255,0.55) 30%,rgba(139,92,246,0.28) 68%,rgba(59,130,246,0.42) 100%);
  --pmg-value:#0F172A;
  --pmg-label:#475569;
  --pmg-focus:var(--arv-brand-indigo);
  --pmg-badge-bg:rgba(255,255,255,0.94);
  --pmg-badge-border:rgba(110,130,220,0.30);
  --pmg-up:#047857;--pmg-down:#E11D48;--pmg-zero:#64748B;
  --pmg-a-posts:#7C1FE0;--pmg-a-followers:var(--arv-brand-violet);--pmg-a-following:#0891B2;
  --pmg-a-friends:var(--arv-brand-blue);--pmg-a-views:#0E7490;--pmg-a-likes:#E11D48;--pmg-a-coins:#B45309;
}

/* ---------- Grid: single horizontal row across Android & Desktop ---------- */
.pmg-grid{
  /* Fallback sizes (no container-query support): Android-first single row. */
  --pmg-gx:4px;--pmg-gy:6px;--pmg-r:13px;--pmg-h:62px;
  --pmg-icon:14px;--pmg-num:13.5px;--pmg-lbl:8.5px;--pmg-trend:7.5px;
  --pmg-px:2px;--pmg-py:6px;--pmg-gap:3px;
  display:grid;
  grid-template-columns:repeat(var(--pmg-cols, 6), minmax(0, 1fr));
  align-items:stretch;
  gap:var(--pmg-gy) var(--pmg-gx);
  margin:0;padding:0;
}
@supports (width:1cqw){
  .pmg-grid{
    --pmg-gx:clamp(3px,1.1cqw,10px);
    --pmg-gy:clamp(6px,1.8cqw,12px);
    --pmg-r:clamp(12px,2.8cqw,18px);
    --pmg-h:clamp(60px,14cqw,90px);
    --pmg-icon:clamp(13px,3.2cqw,19px);
    --pmg-num:clamp(13px,3.5cqw,22px);
    --pmg-lbl:clamp(8px,2.0cqw,11.5px);
    --pmg-trend:clamp(7.5px,1.8cqw,10px);
    --pmg-px:clamp(2px,0.8cqw,8px);
    --pmg-py:clamp(6px,1.5cqw,11px);
    --pmg-gap:clamp(2px,0.7cqw,5px);
  }
}
@supports not (width:1cqw){
  @media (min-width:640px){
    .pmg-grid{--pmg-gx:10px;--pmg-gy:10px;--pmg-r:18px;--pmg-h:88px;--pmg-icon:18px;--pmg-num:21px;--pmg-lbl:11.5px;--pmg-trend:10px;--pmg-px:8px;--pmg-py:10px;--pmg-gap:5px}
  }
}

/* ---------- Tile ---------- */
.pmg-tile{
  position:relative;isolation:isolate;
  width:100%;
  min-width:0;
  min-height:var(--pmg-h);
  padding:var(--pmg-py) var(--pmg-px);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;
  border:1px solid var(--pmg-border);
  border-radius:var(--pmg-r);
  background:var(--pmg-layers),linear-gradient(var(--pmg-base),var(--pmg-base));
  -webkit-backdrop-filter:var(--pmg-blur);
  backdrop-filter:var(--pmg-blur);
  box-shadow:var(--pmg-shadow);
  color:var(--pmg-value);
  margin:0;font:inherit;
  -webkit-appearance:none;appearance:none;
  -webkit-tap-highlight-color:transparent;
  transition:box-shadow .18s ease,border-color .18s ease,transform .12s ease;
}
button.pmg-tile{cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.pmg-tile:focus{outline:none}
.pmg-tile:focus-visible{outline:2px solid var(--pmg-focus);outline-offset:2px}
.pmg-tile[data-actionable="true"]:active{transform:scale(0.97);box-shadow:var(--pmg-shadow-hover)}
.pmg-tile[data-actionable="true"]:active .pmg-fx::after{opacity:1}
@media (hover:hover) and (pointer:fine){
  .pmg-tile[data-actionable="true"]:hover{box-shadow:var(--pmg-shadow-hover)}
  .pmg-tile[data-actionable="true"]:hover .pmg-fx::after{opacity:1}
}

/* Specular layer: clipped to the tile's own radius, decorative only */
.pmg-fx{position:absolute;inset:0;z-index:0;border-radius:inherit;overflow:hidden;pointer-events:none}
.pmg-fx::before{content:"";position:absolute;left:0;right:0;top:0;height:54%;background:var(--pmg-spec)}
.pmg-fx::after{content:"";position:absolute;inset:0;background:var(--pmg-glow);opacity:0;transition:opacity .18s ease}

/* Content */
.pmg-content{
  position:relative;z-index:1;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:var(--pmg-gap);
  width:100%;min-width:0;
}
.pmg-icon{width:var(--pmg-icon);height:var(--pmg-icon);flex:none;display:block}
.pmg-num{
  display:block;max-width:100%;
  font-size:var(--pmg-num);line-height:1;font-weight:700;letter-spacing:-0.02em;
  font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1;
  white-space:nowrap;color:var(--pmg-value);
}
.pmg-num[data-known="false"]{opacity:.7}
.pmg-label{
  display:block;max-width:100%;
  font-size:var(--pmg-lbl);line-height:1.15;font-weight:600;letter-spacing:0.01em;
  color:var(--pmg-label);
  overflow-wrap:break-word;word-break:normal;hyphens:none;
  text-wrap:balance;
}
/* Narrow containers: reserve two label lines on every tile when a long label is present,
   so all tile heights and number baselines stay identical. */
@container (max-width:399px){
  .pmg-has-long .pmg-label{min-height:2.3em}
}
@supports not (width:1cqw){
  .pmg-has-long .pmg-label{min-height:2.3em}
  @media (min-width:640px){.pmg-has-long .pmg-label{min-height:0}}
}

/* Rim: a real border always exists; the gradient rim only enhances it where masks work */
.pmg-rim{display:none;position:absolute;inset:-1px;z-index:2;border-radius:inherit;pointer-events:none}
@supports ((-webkit-mask-composite:xor) or (mask-composite:exclude)){
  .pmg-rim{
    display:block;padding:1px;background:var(--pmg-rim);
    -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;
    mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    mask-composite:exclude;
  }
}

/* Growth badge: straddles the tile's top edge so it never displaces icon, value or label */
.pmg-trend{
  position:absolute;z-index:3;top:0;right:max(4px,calc(var(--pmg-r) * 0.35));
  transform:translateY(-45%);
  padding:1px 5px;border-radius:999px;
  background:var(--pmg-badge-bg);border:1px solid var(--pmg-badge-border);
  font-size:var(--pmg-trend);line-height:1.25;font-weight:700;
  font-variant-numeric:tabular-nums;white-space:nowrap;pointer-events:none;
}
.pmg-trend[data-tone="up"]{color:var(--pmg-up)}
.pmg-trend[data-tone="down"]{color:var(--pmg-down)}
.pmg-trend[data-tone="zero"]{color:var(--pmg-zero)}

.pmg-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

/* Per-metric icon accents */
.pmg-tile[data-metric="posts"] .pmg-icon{color:var(--pmg-a-posts)}
.pmg-tile[data-metric="followers"] .pmg-icon{color:var(--pmg-a-followers)}
.pmg-tile[data-metric="following"] .pmg-icon{color:var(--pmg-a-following)}
.pmg-tile[data-metric="friends"] .pmg-icon{color:var(--pmg-a-friends)}
.pmg-tile[data-metric="views"] .pmg-icon{color:var(--pmg-a-views)}
.pmg-tile[data-metric="likes"] .pmg-icon{color:var(--pmg-a-likes)}
.pmg-tile[data-metric="coins"] .pmg-icon{color:var(--pmg-a-coins)}

/* ---------- Progressive fallbacks ---------- */
/* No backdrop blur: a denser, still-translucent body keeps the tile coherent and readable. */
@supports not ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){
  .pmg-root[data-theme="dark"]{--pmg-base:rgba(3,7,27,0.88)}
  .pmg-root[data-theme="light"]{--pmg-base:rgba(246,248,255,0.90)}
}
/* Reduced transparency and Lite/performance modes: drop blur, keep the layered material. */
@media (prefers-reduced-transparency:reduce){
  .pmg-root{--pmg-blur:none}
  .pmg-root[data-theme="dark"]{--pmg-base:rgba(3,7,27,0.92)}
  .pmg-root[data-theme="light"]{--pmg-base:rgba(246,248,255,0.94)}
}
.lite-mode .pmg-root,[data-lite-mode="true"] .pmg-root,[data-performance="lite"] .pmg-root{--pmg-blur:none}
.lite-mode .pmg-root[data-theme="dark"],[data-lite-mode="true"] .pmg-root[data-theme="dark"],[data-performance="lite"] .pmg-root[data-theme="dark"]{--pmg-base:rgba(3,7,27,0.90)}
.lite-mode .pmg-root[data-theme="light"],[data-lite-mode="true"] .pmg-root[data-theme="light"],[data-performance="lite"] .pmg-root[data-theme="light"]{--pmg-base:rgba(246,248,255,0.92)}

@media (prefers-reduced-motion:reduce){
  .pmg-tile,.pmg-fx::after{transition:none}
  .pmg-tile[data-actionable="true"]:active{transform:none}
}
@media (forced-colors:active){
  .pmg-tile{border-color:CanvasText;background:Canvas;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none}
  .pmg-fx,.pmg-rim{display:none}
  .pmg-num,.pmg-label,.pmg-trend{color:CanvasText}
  .pmg-tile:focus-visible{outline-color:Highlight}
}
`;

/** Metric definitions: key, label, icon. Order is the display order. */
const METRIC_DEFS = {
  posts: { label: 'Posts', icon: FileText },
  followers: { label: 'Followers', icon: Users },
  following: { label: 'Following', icon: UserCheck },
  friends: { label: 'Friends', icon: UserPlus },
  views: { label: 'Profile Views', icon: Eye },
  likes: { label: 'Likes', icon: Heart },
  coins: { label: 'Coins', icon: Coins },
};

// Native compact formatting with a safe manual fallback.
let compactFormatter = null;
let fullFormatter = null;
try {
  compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  fullFormatter = new Intl.NumberFormat('en-US');
} catch {
  compactFormatter = null;
  fullFormatter = null;
}

const COMPACT_UNITS = ['', 'K', 'M', 'B', 'T'];

/** Compact display for a valid count (1250 -> "1.3K", 999999 -> "1M"). */
const formatCompact = (n) => {
  if (compactFormatter) {
    try {
      return compactFormatter.format(n);
    } catch {
      /* fall through to the manual formatter */
    }
  }
  if (n < 1000) return String(n);
  let unit = 0;
  let scaled = n;
  while (scaled >= 1000 && unit < COMPACT_UNITS.length - 1) {
    scaled /= 1000;
    unit += 1;
  }
  let rounded = Math.round(scaled * 10) / 10;
  if (rounded >= 1000 && unit < COMPACT_UNITS.length - 1) {
    rounded = 1;
    unit += 1;
  }
  return `${rounded}${COMPACT_UNITS[unit]}`;
};

/** Canonical count formatter that never fabricates 0 for missing metrics. */
const formatNumber = (num) => {
  if (num === undefined || num === null) return '—';
  return formatCompact(num);
};

/** Full-precision value for assistive technology. */
const formatFull = (n) => {
  if (fullFormatter) {
    try {
      return fullFormatter.format(n);
    } catch {
      /* fall through */
    }
  }
  return String(n);
};

/**
 * First candidate that is a valid count: finite, integer, >= 0. Invalid earlier
 * candidates never block a valid later alias. Returns null when none is valid.
 */
const pickCount = (...candidates) => {
  for (const candidate of candidates) {
    const n = unknownNumber(candidate);
    if (n !== null && Number.isInteger(n) && n >= 0) return n;
  }
  return null;
};

/** Signed percentage ("+2.5%", "0%", "-3%") from a valid finite number; null when unusable. */
const formatGrowth = (value) => {
  const n = unknownNumber(value);
  if (n === null) return null;
  const rounded = Math.round(n * 10) / 10;
  if (!Number.isFinite(rounded)) return null;
  if (rounded === 0) return { text: '0%', tone: 'zero' };
  return { text: `${rounded > 0 ? '+' : ''}${rounded}%`, tone: rounded > 0 ? 'up' : 'down' };
};

/** A usable progression gate: finite positive integer. Anything else unlocks nothing by level. */
const resolveGate = (raw) => {
  const n = unknownNumber(raw);
  return n !== null && Number.isFinite(n) && Number.isInteger(n) && n > 0 ? n : null;
};

const STYLE_MARKUP = { __html: STYLES };

const ProfileMetricsGrid = memo(({
  isOwner = false,
  theme = 'light',
  profile,
  analytics,
  onMetricPress,
  capabilities,
  showCoins = false,
}) => {
  // Single component-level theme authority.
  const themeName = theme === 'dark' ? 'dark' : 'light';

  const hasHandler = typeof onMetricPress === 'function';

  // Security-sensitive: only an exact `true` grants visibility (a missing map denies).
  const canViewFollowers = capabilities?.canViewFollowers === true;
  const canViewFollowing = capabilities?.canViewFollowing === true;
  const canViewFriends = capabilities?.canViewFriends === true;
  const canViewEconomic = capabilities?.canViewEconomicStatus === true;

  // Progression: creators (canonical resolver) or a valid level at the shared gate.
  // Unknown/invalid level or gate never unlocks anything.
  const levelValue = unknownNumber(profile?.level);
  const level = levelValue !== null && Number.isInteger(levelValue) && levelValue > 0 ? levelValue : null;
  const gate = resolveGate(LEVEL_GATES?.publicFollowers);
  const isCreator = Boolean(resolveCreatorFlag(profile || {}, {}, level));
  const followersTierUnlocked = isCreator || (level !== null && gate !== null && level >= gate);

  const showFollowers = followersTierUnlocked && canViewFollowers;
  const showFollowing = followersTierUnlocked && canViewFollowing;
  const showEconomic = showCoins === true && canViewEconomic;

  // Measurements resolved only for metrics that will render.
  const posts = pickCount(profile?.postCount, profile?.postsCount);
  const followers = showFollowers ? pickCount(profile?.followerCount, profile?.followersCount) : null;
  const following = showFollowing ? pickCount(profile?.followingCount) : null;
  const friends = canViewFriends ? pickCount(profile?.friendCount, profile?.friendsCount) : null;
  const views = isOwner ? pickCount(analytics?.totalViews, profile?.profileViews, profile?.viewsCount) : null;
  const likes = pickCount(profile?.likesReceived, profile?.likesCount);
  const coinsCount = showEconomic ? pickCount(profile?.coins, profile?.coinBalance, profile?.balance) : null;

  const followerTrend = showFollowers ? formatGrowth(analytics?.followerGrowth) : null;
  const viewsTrend = isOwner ? formatGrowth(analytics?.viewsGrowth) : null;

  // Order: Posts, Followers, Following, Friends, Profile Views, Likes, Coins.
  const metrics = [
    { key: 'posts', count: posts, actionable: hasHandler },
    showFollowers && { key: 'followers', count: followers, actionable: hasHandler, trend: followerTrend },
    showFollowing && { key: 'following', count: following, actionable: hasHandler },
    canViewFriends && { key: 'friends', count: friends, actionable: hasHandler },
    isOwner && { key: 'views', count: views, actionable: hasHandler, trend: viewsTrend },
    { key: 'likes', count: likes, actionable: false },
    showEconomic && { key: 'coins', count: coinsCount, actionable: hasHandler },
  ].filter(Boolean);

  const hasTrend = metrics.some((m) => m.trend);
  // "Profile Views" is the only label that can wrap on very narrow containers.
  const hasLongLabel = metrics.some((m) => m.key === 'views');

  return (
    <div
      role="group"
      aria-label="Profile metrics"
      data-theme={themeName}
      className={cn("pmg-root", hasTrend && "pmg-has-trend", hasLongLabel && "pmg-has-long")}
    >
      <style dangerouslySetInnerHTML={STYLE_MARKUP} />

      <div className="pmg-grid" style={{ '--pmg-cols': Math.max(metrics.length, 1) }}>
        {metrics.map((item) => {
          const { label, icon: Icon } = METRIC_DEFS[item.key];
          const known = item.count !== null;
          const display = formatNumber(item.count);
          const full = known ? formatFull(item.count) : 'unavailable';
          const trend = item.trend || null;
          const Tag = item.actionable ? 'button' : 'div';

          return (
            <Tag
              key={item.key}
              className="pmg-tile"
              data-metric={item.key}
              data-actionable={item.actionable ? 'true' : 'false'}
              {...(item.actionable ? { type: 'button', onClick: () => onMetricPress(item.key) } : {})}
            >
              <span className="pmg-fx" aria-hidden="true" />

              <span className="pmg-content">
                <Icon className="pmg-icon" strokeWidth={2} aria-hidden="true" focusable="false" />
                <span className="pmg-num font-display" data-known={known ? 'true' : 'false'} aria-hidden="true">
                  {display}
                </span>
                <span className="pmg-sr">{full}</span>
                <span className="pmg-label">{label}</span>
              </span>

              <span className="pmg-rim" aria-hidden="true" />

              {trend && (
                <span className="pmg-trend" data-tone={trend.tone}>
                  <span className="pmg-sr">Growth </span>
                  {trend.text}
                </span>
              )}
            </Tag>
          );
        })}
      </div>
    </div>
  );
});

ProfileMetricsGrid.displayName = 'ProfileMetricsGrid';

export default ProfileMetricsGrid;
