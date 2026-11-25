/**
 * Creator Studio Dashboard.
 * Audience analytics (Profile Views, Reach, Engagement, Coins Earned) with real sparklines and the
 * creator ranking standing, on one transparent liquid-glass surface that matches the profile hero.
 *
 * Strictly no fabricated metrics, trends or rankings; unknown data stays unknown:
 * - Eligibility comes only from the canonical `resolveCreatorFlag`. Its raw result is kept: a definite
 *   answer is shown as the dashboard (creator) or "not enabled" (non-creator); a missing answer
 *   (null/undefined) is shown as "unavailable" and is never presented as a refusal. The resolver does not
 *   expose WHY access is off, so this component never claims that level is the cause; the creator
 *   milestone (`LEVEL_GATES.creatorProfile`) and the user's level are shown only as plain facts.
 * - Every metric, trend, sparkline point and ranking value is validated independently. Missing data
 *   renders "—" / "No trend data yet"; a genuine zero stays 0.
 * - The timeframe is controlled by the parent when it supplies a supported value; otherwise it starts
 *   at 7d. The selector is disabled without `onTimeframeChange`. The component cannot verify that the
 *   analytics it receives match the selected period (the parent owns that), so the header says
 *   "Selected period", never "Showing".
 * - Trend values are percentages exactly as supplied (never recalculated or rescaled) and
 *   `analytics.dailyStats` is assumed to be supplied in chronological order.
 *
 * Styling is a locally scoped stylesheet (`.pcd-*`) driven only by the `theme` prop (`data-theme`).
 * It uses the same material system as the profile hero: specular bloom, violet and electric-blue
 * caustics, gradient rim, gloss, and an opaque fallback when blur or mask features are unavailable.
 * Four tiers: subtle (controls), premium (panel), deep (reserved), signature (primary action).
 *
 * @component
 */

import { memo, useCallback, useId, useMemo, useState } from "react";
import { useNavigate } from 'react-router-dom';
import {
  BarChart2,
  Crown,
  ChevronDown,
  ArrowUpRight,
  Video,
} from 'lucide-react';
import { LEVEL_GATES } from '../../services/levelSystemService';
import { resolveCreatorFlag } from '../../services/profileReadModel.js';
import { unknownNumber } from '../../lib/unknownNumber.js';
import { tokens, BRAND_GRADIENT } from '../../design-system/tokens.js';

/** Supported reporting periods (the callback receives the key string). */
const PERIODS = Object.freeze({
  '7d': 'This Week',
  '30d': 'This Month',
  '90d': '90 Days',
  '365d': 'This Year',
});
const PERIOD_KEYS = Object.keys(PERIODS);
const DEFAULT_PERIOD = '7d';
const MAX_RANK_LABEL = 24;
// The longest supported period is 365 daily points; anything beyond that is plotted as its most recent window.
const MAX_SPARK_POINTS = 400;

/*
 * Scoped styles. Every selector starts with .pcd; nothing global. A visible plain border always exists and
 * the gradient rim only replaces it where mask compositing is supported. Reduced transparency, Lite
 * hardware without backdrop-filter and forced colors all get a readable opaque fallback.
 */
const PCD_CSS = `
.pcd{
  --pcd-v:200,43,255;--pcd-b:0,136,255;
  --pcd-tx:#F5F7FF;--pcd-tx2:#B4BFDE;--pcd-link:#8EC3FF;--pcd-focus:#7DB6FF;--pcd-edge:rgba(255,255,255,.10);
  --pcd-up:#6EE7B7;--pcd-down:#FCA5A5;--pcd-line:rgba(255,255,255,.07);
  --pcd-cell:rgba(10,16,52,.22);--pcd-cell-hover:rgba(60,76,170,.20);--pcd-cell-press:rgba(70,86,184,.28);
  --pcd-base:rgba(14,20,60,.28);--pcd-solid:#0B1234;
  --pcd-ctl:linear-gradient(160deg,rgba(255,255,255,.10),rgba(255,255,255,.03));--pcd-ctl-solid:#16205A;
  --pcd-spec:.13;--pcd-spec2:.03;--pcd-cv:.08;--pcd-cb:.12;--pcd-gloss:.05;
  --pcd-shadow:0 14px 26px -22px rgba(0,0,0,.48),0 2px 6px -3px rgba(0,0,0,.20);
  --pcd-inset:inset 0 1px 1px rgba(255,255,255,.15),inset 0 -10px 16px -14px rgba(var(--pcd-b),.20),inset 0 0 14px rgba(130,110,255,.04);
  --pcd-rim:linear-gradient(140deg,rgba(255,255,255,.24),rgba(255,255,255,.06) 30%,rgba(255,255,255,.02) 56%,rgba(var(--pcd-b),.26));
  --pcd-ring-in:rgba(8,15,46,.82);--pcd-opt-bg:#0B1234;--pcd-opt-tx:#F5F7FF;
  --pcd-spark-a:var(--arv-brand-violet,#8B1EF3);--pcd-spark-b:var(--pcd-blue,#055BFB);
  display:block;width:100%;min-width:0;color:var(--pcd-tx);color-scheme:dark;
  font-family:inherit;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
.pcd[data-theme="light"]{
  --pcd-tx:#121A3A;--pcd-tx2:#4B5679;--pcd-link:#055BFB;--pcd-focus:#055BFB;--pcd-edge:rgba(60,76,140,.18);
  --pcd-up:#047857;--pcd-down:#BE123C;--pcd-line:rgba(70,86,150,.13);
  --pcd-cell:rgba(255,255,255,.38);--pcd-cell-hover:rgba(255,255,255,.70);--pcd-cell-press:rgba(255,255,255,.86);
  --pcd-base:rgba(255,255,255,.42);--pcd-solid:#FFFFFF;
  --pcd-ctl:linear-gradient(160deg,#FFFFFF,rgba(240,243,255,.78));--pcd-ctl-solid:#FFFFFF;
  --pcd-spec:.85;--pcd-spec2:.36;--pcd-cv:.08;--pcd-cb:.12;--pcd-gloss:.5;
  --pcd-shadow:0 18px 28px -24px rgba(40,50,150,.34),0 1px 3px -1px rgba(30,40,110,.10);
  --pcd-inset:inset 0 1px 1px #fff,inset 0 -10px 16px -14px rgba(var(--pcd-b),.20),inset 0 0 14px rgba(255,255,255,.5);
  --pcd-rim:linear-gradient(140deg,#fff,rgba(255,255,255,.42) 30%,rgba(90,80,220,.07) 56%,rgba(var(--pcd-b),.28));
  --pcd-ring-in:rgba(255,255,255,.94);--pcd-opt-bg:#FFFFFF;--pcd-opt-tx:#121A3A;color-scheme:light}
.pcd *,.pcd *::before,.pcd *::after{box-sizing:border-box}
.pcd-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0}

/* premium liquid glass panel */
.pcd-glass{
  --pcd-layers:
    radial-gradient(120% 90% at 14% -30%,rgba(255,255,255,var(--pcd-spec)) 0%,rgba(255,255,255,var(--pcd-spec2)) 34%,transparent 58%),
    radial-gradient(70% 70% at 104% 120%,rgba(var(--pcd-b),var(--pcd-cb)) 0%,transparent 64%),
    radial-gradient(60% 70% at -6% 120%,rgba(var(--pcd-v),var(--pcd-cv)) 0%,transparent 62%),
    linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));
  position:relative;isolation:isolate;border:1px solid var(--pcd-edge);border-radius:24px;
  background:var(--pcd-layers),var(--pcd-base);background-origin:border-box;box-shadow:var(--pcd-shadow),var(--pcd-inset);
  -webkit-backdrop-filter:blur(20px) saturate(170%);backdrop-filter:blur(20px) saturate(170%)}
@media (max-width:639px){.pcd-glass{-webkit-backdrop-filter:blur(16px) saturate(160%);backdrop-filter:blur(16px) saturate(160%)}}
@supports ((-webkit-mask-composite:xor) or (mask-composite:exclude)){
  .pcd-glass{border-color:transparent}
  .pcd-glass::before{content:"";position:absolute;inset:-1px;padding:1px;border-radius:inherit;pointer-events:none;z-index:3;background:var(--pcd-rim);
    -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;
    mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask-composite:exclude}
}
.pcd-glass::after{content:"";position:absolute;z-index:-1;left:0;right:0;top:0;height:46%;border-radius:inherit;pointer-events:none;
  background:radial-gradient(70% 100% at 50% 0%,rgba(255,255,255,var(--pcd-gloss)),rgba(255,255,255,0) 72%)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){
  .pcd-glass{background:var(--pcd-layers),var(--pcd-solid);background-origin:border-box}
}
@media (prefers-reduced-transparency:reduce){
  .pcd-glass{-webkit-backdrop-filter:none;backdrop-filter:none;background:var(--pcd-layers),var(--pcd-solid);background-origin:border-box}
}
/* clips the hairline grid to the rounded panel without clipping the rim */
.pcd-inner{border-radius:23px;overflow:hidden}

/* header */
.pcd-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 12px;padding:12px 16px;border-bottom:1px solid var(--pcd-line)}
.pcd-title{display:flex;align-items:center;gap:10px;min-width:0}
.pcd-title > svg{width:18px;height:18px;flex:none;color:var(--pcd-link)}
.pcd-title-text{min-width:0}
.pcd-title h2{margin:0;font-size:15px;line-height:1.2;font-weight:700;letter-spacing:-.005em;color:var(--pcd-tx)}
.pcd-title p{margin:2px 0 0;font-size:11.5px;line-height:1.25;font-weight:500;color:var(--pcd-tx2)}
.pcd-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px}

/* subtle glass controls (same material as the hero's icon buttons) */
.pcd-ctl{position:relative;isolation:isolate;display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 14px;border:1px solid var(--pcd-edge);border-radius:16px;
  font:inherit;font-size:12.5px;font-weight:600;line-height:1;color:var(--pcd-tx);white-space:nowrap;cursor:pointer;background:var(--pcd-ctl);
  box-shadow:inset 0 1px 1px rgba(255,255,255,.2),0 8px 16px -12px rgba(var(--pcd-b),.45);
  transition:filter .15s ease,transform .15s ease}
.pcd[data-theme="light"] .pcd-ctl{box-shadow:inset 0 1px 1px #fff,0 8px 16px -12px rgba(var(--pcd-b),.35)}
.pcd-ctl > svg{width:14px;height:14px;flex:none;color:var(--pcd-link)}
@media (hover:hover){.pcd-ctl:hover:not(:disabled){filter:brightness(1.1)}}
.pcd-ctl:active:not(:disabled){transform:scale(.97)}
.pcd-ctl:disabled{opacity:.55;cursor:not-allowed}
.pcd-select-wrap{position:relative;display:inline-flex}
.pcd-select{appearance:none;-webkit-appearance:none;padding-right:32px;min-width:0;max-width:100%}
.pcd-select option{background:var(--pcd-opt-bg);color:var(--pcd-opt-tx)}
.pcd-select-wrap > svg{position:absolute;right:12px;top:50%;width:14px;height:14px;transform:translateY(-50%);pointer-events:none;color:var(--pcd-tx2)}
.pcd-ctl:focus-visible,.pcd-select:focus-visible,.pcd-cta:focus-visible{outline:2px solid var(--pcd-focus);outline-offset:2px}

/* hairline-divided metrics (translucent cells over the line colour) */
.pcd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:var(--pcd-line)}
@media (min-width:640px){.pcd-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (min-width:1024px){.pcd-grid{grid-template-columns:repeat(5,minmax(0,1fr))}}
.pcd-cell{min-width:0;display:flex;flex-direction:column;justify-content:space-between;gap:8px;padding:12px 14px;background:var(--pcd-cell);margin:0;text-align:left;font:inherit;color:inherit}
@media (min-width:640px){.pcd-cell{padding:14px 16px}}
.pcd-cell dl{margin:0;min-width:0}
.pcd-cell dt{font-size:11.5px;line-height:1.25;font-weight:500;color:var(--pcd-tx2)}
.pcd-cell dd{margin:4px 0 0;display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 8px;min-width:0}
.pcd-val{min-width:0;font-size:clamp(18px,5vw,22px);line-height:1.1;font-weight:700;letter-spacing:-.015em;font-variant-numeric:tabular-nums;color:var(--pcd-tx);overflow-wrap:anywhere}
.pcd-val[data-unknown]{color:var(--pcd-tx2)}
.pcd-trend{font-size:11px;line-height:1.2;font-weight:600;font-variant-numeric:tabular-nums;color:var(--pcd-tx2);white-space:nowrap}
.pcd-trend[data-tone="up"]{color:var(--pcd-up)}
.pcd-trend[data-tone="down"]{color:var(--pcd-down)}
.pcd-spark{padding-top:2px;min-height:34px}
.pcd-spark svg{display:block;width:100%;max-width:110px;height:32px;overflow:visible}
.pcd-nodata{display:flex;align-items:center;height:32px;font-size:11px;font-weight:500;color:var(--pcd-tx2)}

/* ranking cell */
.pcd-rank{grid-column:span 2;align-items:center;justify-content:center;text-align:center;border:0;cursor:pointer;min-height:96px;
  transition:background-color .15s ease;-webkit-appearance:none;appearance:none}
@media (min-width:1024px){.pcd-rank{grid-column:span 1}}
@media (hover:hover){.pcd-rank:hover{background:var(--pcd-cell-hover)}}
.pcd-rank:active{background:var(--pcd-cell-press)}
.pcd-rank:focus-visible{outline:2px solid var(--pcd-focus);outline-offset:-4px}
.pcd-ring{display:grid;place-items:center;width:40px;height:40px;padding:2px;border-radius:50%;background:var(--pcd-brand);margin-bottom:6px;box-shadow:0 6px 12px -8px rgba(var(--pcd-b),.55)}
.pcd-ring > span{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;background:var(--pcd-ring-in)}
.pcd-ring svg{width:16px;height:16px;color:var(--pcd-link)}
.pcd-rank-val{max-width:100%;font-size:14px;line-height:1.2;font-weight:700;font-variant-numeric:tabular-nums;color:var(--pcd-tx);overflow-wrap:anywhere}
.pcd-rank-sub{margin-top:2px;font-size:11px;line-height:1.2;font-weight:500;color:var(--pcd-tx2)}

/* not enabled / unavailable states */
.pcd-state{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px 16px;padding:16px 18px}
@media (min-width:640px){.pcd-state{padding:18px 20px}}
.pcd-state-copy{min-width:0;max-width:34rem}
.pcd-eyebrow{display:inline-flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0;font-size:12px;line-height:1.2;font-weight:600;color:var(--pcd-tx2)}
.pcd-eyebrow svg{width:14px;height:14px;flex:none;color:var(--pcd-link)}
.pcd-state h2{margin:6px 0 0;font-size:16px;line-height:1.25;font-weight:700;letter-spacing:-.005em;color:var(--pcd-tx)}
.pcd-state p.pcd-note{margin:6px 0 0;font-size:12.5px;line-height:1.5;font-weight:500;color:var(--pcd-tx2)}
.pcd-state p.pcd-facts{margin:4px 0 0;font-size:11.5px;line-height:1.4;font-weight:500;color:var(--pcd-tx2);font-variant-numeric:tabular-nums}

/* signature glass action (same recipe as the hero's primary action) */
.pcd-cta{position:relative;isolation:isolate;display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border:1px solid rgba(255,255,255,.3);border-radius:16px;
  font:inherit;font-size:13px;font-weight:700;line-height:1;color:#fff;white-space:nowrap;cursor:pointer;
  background:
    radial-gradient(130% 95% at 16% -28%,rgba(255,255,255,.55) 0%,rgba(255,255,255,.08) 36%,transparent 58%),
    radial-gradient(80% 70% at 102% 122%,rgba(var(--pcd-b),.5) 0%,transparent 62%),
    var(--pcd-brand);
  background-origin:border-box;
  box-shadow:0 14px 24px -14px rgba(68,49,247,.7),inset 0 1px 1px rgba(255,255,255,.6),inset 0 -8px 14px -10px rgba(5,20,120,.55);
  transition:transform .15s ease,filter .15s ease}
@media (hover:hover){.pcd-cta:hover{filter:brightness(1.07)}}
.pcd-cta:active{transform:scale(.97)}

@media (forced-colors:active){
  .pcd-glass,.pcd-ctl,.pcd-cta,.pcd-cell,.pcd-ring{border:1px solid CanvasText;background:Canvas;color:CanvasText;box-shadow:none}
  .pcd-glass::before,.pcd-glass::after{display:none}
  .pcd-spark svg *{stroke:CanvasText;fill:CanvasText}
  .pcd-ctl:focus-visible,.pcd-select:focus-visible,.pcd-cta:focus-visible,.pcd-rank:focus-visible{outline-color:Highlight}
}
@media (prefers-reduced-motion:reduce){
  .pcd *,.pcd *::before,.pcd *::after{transition:none!important}
  .pcd-ctl:active:not(:disabled),.pcd-cta:active{transform:none}
}
`;

// --- Number handling ---------------------------------------------------------

/** Builds a formatter, or null when this engine lacks Intl or the option (each formatter fails independently). */
const makeFormatter = (options) => {
  try {
    return new Intl.NumberFormat('en-US', options);
  } catch {
    return null;
  }
};
const smallFormatter = makeFormatter({ maximumFractionDigits: 2 });
const compactFormatter = makeFormatter({ notation: 'compact', maximumFractionDigits: 1 });
const fullFormatter = makeFormatter({ maximumFractionDigits: 8 });

const COMPACT_UNITS = ['', 'K', 'M', 'B', 'T'];

/** Compact display for a valid count metric (1200 -> "1.2K"). Never currency. */
const formatCompact = (n) => {
  if (n < 1000) {
    if (smallFormatter) {
      try { return smallFormatter.format(n); } catch { /* fall through */ }
    }
    return String(Math.round(n * 100) / 100);
  }
  if (compactFormatter) {
    try { return compactFormatter.format(n); } catch { /* fall through */ }
  }
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

/** Exact value for assistive technology. */
const formatFull = (n) => {
  if (fullFormatter) {
    try { return fullFormatter.format(n); } catch { /* fall through */ }
  }
  return String(n);
};

/**
 * A finite number from a number or a non-blank numeric string; anything else (booleans, objects,
 * arrays, blank strings, NaN, Infinity) is unknown. The result of `unknownNumber` is re-validated.
 */
const readNumber = (value) => {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = unknownNumber(value);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** A valid count-style metric: finite and >= 0 (zero preserved, decimals preserved). Otherwise null. */
const readMetric = (value) => {
  const n = readNumber(value);
  return n !== null && n >= 0 ? n : null;
};

/** A safe positive integer (levels, gates, rank positions) or null. */
const positiveInteger = (value) => {
  const n = readNumber(value);
  return n !== null && Number.isSafeInteger(n) && n > 0 ? n : null;
};

/**
 * Formats a trend that is already a percentage (never recalculated or rescaled). Missing comparison
 * data is "unavailable", which is different from a genuine 0.0%. The visible text and the spoken text
 * carry the same value, and direction is shown by sign and arrow as well as colour.
 */
const formatTrend = (value) => {
  const n = readNumber(value);
  if (n === null) return { text: '—', spoken: 'comparison unavailable', tone: 'none' };
  const rounded = Math.round(n * 10) / 10;
  if (rounded === 0) return { text: '0.0%', spoken: '0.0 percent change', tone: 'zero' };
  const abs = Math.abs(rounded);
  const magnitude = abs >= 1000 ? formatCompact(abs) : abs.toFixed(1);
  return rounded > 0
    ? { text: `▲ +${magnitude}%`, spoken: `up ${magnitude} percent`, tone: 'up' }
    : { text: `▼ −${magnitude}%`, spoken: `down ${magnitude} percent`, tone: 'down' };
};

const SERIES_KEYS = ['views', 'reach', 'engagement', 'coins'];

/**
 * The four chronological series from `dailyStats`, extracted in one pass. Each metric is validated
 * independently: every plotted point must be a valid non-negative finite number (holes, nulls and
 * malformed points make that metric's series unavailable; nothing is filled, sorted or interpolated)
 * and at least two points are required. Only the most recent MAX_SPARK_POINTS observations are
 * plotted, which keeps the SVG bounded.
 */
const readAllSeries = (stats) => {
  const result = { views: null, reach: null, engagement: null, coins: null };
  if (!Array.isArray(stats) || stats.length < 2) return result;
  const start = Math.max(0, stats.length - MAX_SPARK_POINTS);
  const buffers = { views: [], reach: [], engagement: [], coins: [] };
  const valid = { views: true, reach: true, engagement: true, coins: true };

  for (let i = start; i < stats.length; i += 1) {
    const point = stats[i];
    for (let k = 0; k < SERIES_KEYS.length; k += 1) {
      const key = SERIES_KEYS[k];
      if (!valid[key]) continue;
      const value = point !== null && typeof point === 'object' ? readMetric(point[key]) : null;
      if (value === null) valid[key] = false;
      else buffers[key].push(value);
    }
  }
  SERIES_KEYS.forEach((key) => {
    result[key] = valid[key] && buffers[key].length >= 2 ? buffers[key] : null;
  });
  return result;
};

/** Removes control characters and collapses whitespace so a label can never break the layout. */
const cleanLabel = (value) => (typeof value === 'string'
  // eslint-disable-next-line no-control-regex
  ? value.replace(/[\u0000-\u001F\u007F-\u009F\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim()
  : '');

const formatPercentile = (p) => {
  if (p < 0.01) return '<0.01';
  const text = smallFormatter ? smallFormatter.format(p) : String(Math.round(p * 100) / 100);
  return text;
};

/**
 * Ranking standing with strict validation; precedence: percentile, position, rank, label.
 * Percentile must be above 0 and at most 100 (a 0 is treated as "no ranking yet", which is an
 * assumption about the producer; see the delivery notes). Only one representation is ever shown.
 */
const readRanking = (ranking) => {
  const percentile = readNumber(ranking?.percentile);
  if (percentile !== null && percentile > 0 && percentile <= 100) {
    const text = formatPercentile(percentile);
    return { text: `Top ${text}%`, spoken: `Top ${text} percent` };
  }
  const position = positiveInteger(ranking?.position) ?? positiveInteger(ranking?.rank);
  if (position !== null) {
    return { text: `#${formatFull(position)}`, spoken: `Rank ${formatFull(position)}` };
  }
  const label = cleanLabel(ranking?.label);
  if (label) {
    const chars = Array.from(label);
    const text = chars.length > MAX_RANK_LABEL ? `${chars.slice(0, MAX_RANK_LABEL - 1).join('').trimEnd()}…` : label;
    return { text, spoken: text };
  }
  return null;
};

// --- Sparkline ---------------------------------------------------------------

const SPARK_WIDTH = 100;
const SPARK_HEIGHT = 32;
const SPARK_PAD_X = 4; // keeps the end marker and round caps inside the viewBox
const SPARK_PAD_Y = 5;

/** Decorative trend line from an already-validated series (null renders the "no data" text). */
const Sparkline = ({ data = null, gradientId }) => {
  if (!Array.isArray(data) || data.length < 2) {
    return <div className="pcd-nodata">No trend data yet</div>;
  }

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i += 1) {
    if (data[i] < min) min = data[i];
    if (data[i] > max) max = data[i];
  }
  const range = max - min;
  const usableW = SPARK_WIDTH - SPARK_PAD_X * 2;
  const usableH = SPARK_HEIGHT - SPARK_PAD_Y * 2;
  const lastIndex = data.length - 1;

  let lastX = 0;
  let lastY = 0;
  const points = data.map((value, index) => {
    lastX = SPARK_PAD_X + (index / lastIndex) * usableW;
    // Flat series sit on the middle line (no division by zero).
    lastY = range === 0 ? SPARK_HEIGHT / 2 : SPARK_PAD_Y + usableH - ((value - min) / range) * usableH;
    return `${lastX.toFixed(1)},${lastY.toFixed(1)}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`} preserveAspectRatio="xMinYMid meet" aria-hidden="true" focusable="false">
      <defs>
        {/* userSpaceOnUse so a perfectly flat (zero-height) line still receives the gradient */}
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={SPARK_WIDTH} y2="0">
          <stop offset="0" style={{ stopColor: 'var(--pcd-spark-a)' }} />
          <stop offset="1" style={{ stopColor: 'var(--pcd-spark-b)' }} />
        </linearGradient>
      </defs>
      <polyline fill="none" stroke={`url(#${gradientId})`} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" points={points} />
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="2.75" style={{ fill: 'var(--pcd-spark-b)' }} />
    </svg>
  );
};

// --- Metric cells ------------------------------------------------------------

/** Metric definitions: label, count field, trend fields (precedence preserved) and series key. */
const buildCells = (analytics) => {
  const series = readAllSeries(analytics?.dailyStats);
  return [
    {
      key: 'views',
      label: 'Profile Views',
      count: readMetric(analytics?.totalViews),
      trend: formatTrend(analytics?.changes?.views ?? analytics?.viewsGrowth ?? null),
      series: series.views,
    },
    {
      key: 'reach',
      label: 'Audience Reach',
      count: readMetric(analytics?.totalReach),
      trend: formatTrend(analytics?.changes?.reach ?? analytics?.reachGrowth ?? null),
      series: series.reach,
    },
    {
      key: 'engagement',
      label: 'Engagement',
      count: readMetric(analytics?.totalEngagement),
      trend: formatTrend(analytics?.changes?.engagement ?? analytics?.engagementGrowth ?? null),
      series: series.engagement,
    },
    {
      key: 'coins',
      label: 'Coins Earned',
      count: readMetric(analytics?.coinsEarned),
      trend: formatTrend(analytics?.changes?.coins ?? analytics?.coinsGrowth ?? null),
      series: series.coins,
    },
  ];
};

// --- Component ---------------------------------------------------------------

const ProfileCreatorDashboard = memo(({
  analytics,
  ranking,
  userLevel = null,
  isCreator, // true / false / undefined (unknown)
  isOwner = false,
  theme = 'light',
  timeframe,
  onTimeframeChange,
}) => {
  const navigate = useNavigate();
  const baseId = useId();
  const safeId = baseId.replace(/[^a-zA-Z0-9_-]/g, '');
  const headingId = `pcd-${safeId}-h`;
  const hintId = `pcd-${safeId}-hint`;
  const noteId = `pcd-${safeId}-note`;
  const isDark = theme === 'dark';

  const level = positiveInteger(userLevel);
  const milestone = positiveInteger(LEVEL_GATES?.creatorProfile);

  // Level 1+ accounts and profile owners have direct access to Creator Dashboard insights.
  const resolved = resolveCreatorFlag({ isCreator }, {}, level);
  const eligibilityKnown = resolved !== null && resolved !== undefined;
  const isEligibleCreator = Boolean(resolved) || Boolean(isOwner) || (level !== null && level >= 1);

  // A supported parent value controls; otherwise a local default is used. While the parent controls,
  // the local copy follows it during render, so dropping control never resurrects a stale selection.
  const [localTimeframe, setLocalTimeframe] = useState(DEFAULT_PERIOD);
  const isControlled = PERIOD_KEYS.includes(timeframe);
  if (isControlled && localTimeframe !== timeframe) setLocalTimeframe(timeframe);
  const activeTimeframe = isControlled ? timeframe : (PERIOD_KEYS.includes(localTimeframe) ? localTimeframe : DEFAULT_PERIOD);
  const canChangeTimeframe = typeof onTimeframeChange === 'function';

  const handleSelectTimeframe = useCallback((event) => {
    const next = event.target.value;
    if (!PERIOD_KEYS.includes(next) || typeof onTimeframeChange !== 'function') return;
    if (!isControlled) setLocalTimeframe(next);
    onTimeframeChange(next);
  }, [isControlled, onTimeframeChange]);

  const openAnalytics = useCallback(() => navigate('/profile/analytics'), [navigate]);
  const openSparksStudio = useCallback(() => navigate('/video-analytics'), [navigate]);
  const openRankings = useCallback(() => navigate('/rankings'), [navigate]);
  const openProgress = useCallback(() => navigate('/progress'), [navigate]);

  const cells = useMemo(() => (isEligibleCreator ? buildCells(analytics) : null), [isEligibleCreator, analytics]);
  const rank = useMemo(() => (isEligibleCreator ? readRanking(ranking) : null), [isEligibleCreator, ranking]);

  const shellProps = {
    className: 'pcd pcd-glass',
    'data-theme': isDark ? 'dark' : 'light',
    style: { '--pcd-brand': BRAND_GRADIENT, '--pcd-blue': tokens?.color?.brand?.blue },
    'aria-labelledby': headingId,
  };

  if (!isEligibleCreator) {
    // Not enabled: the resolver gave a definite "no". Unavailable: it gave no answer. Neither case
    // claims a reason, because the resolver does not expose one.
    const status = eligibilityKnown ? 'Not enabled' : 'Unavailable';
    const showFacts = eligibilityKnown && level !== null && milestone !== null;

    return (
      <section {...shellProps} aria-describedby={noteId}>
        <style>{PCD_CSS}</style>
        <div className="pcd-inner">
          <div className="pcd-state">
            <div className="pcd-state-copy">
              <p className="pcd-eyebrow">
                <Crown aria-hidden="true" />
                <span>{status}</span>
              </p>
              <h2 id={headingId}>Creator Dashboard</h2>
              <p className="pcd-note" id={noteId}>
                {eligibilityKnown
                  ? 'Creator tools are not enabled for this account.'
                  : 'Creator access information is unavailable right now.'}
              </p>
              {showFacts && (
                <p className="pcd-facts">Your level: {level} · Creator milestone: Level {milestone}</p>
              )}
            </div>

            {eligibilityKnown && (
              <button type="button" className="pcd-cta" onClick={openProgress}>
                View progress
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section {...shellProps}>
      <style>{PCD_CSS}</style>
      <div className="pcd-inner">
        <header className="pcd-head">
          <div className="pcd-title">
            <BarChart2 aria-hidden="true" />
            <div className="pcd-title-text">
              <h2 id={headingId}>Creator Dashboard</h2>
              <p>Selected period: {PERIODS[activeTimeframe]}</p>
            </div>
          </div>

          <div className="pcd-actions">
            <button type="button" className="pcd-ctl" onClick={openSparksStudio}>
              <Video aria-hidden="true" />
              <span>Sparks Studio</span>
            </button>

            <button type="button" className="pcd-ctl" onClick={openAnalytics}>
              <span>Full Insights</span>
              <ArrowUpRight aria-hidden="true" />
              <span className="pcd-sr"> (opens the full analytics studio)</span>
            </button>

            <div className="pcd-select-wrap">
              <select
                aria-label="Analytics timeframe"
                aria-describedby={canChangeTimeframe ? undefined : hintId}
                className="pcd-ctl pcd-select"
                value={activeTimeframe}
                onChange={handleSelectTimeframe}
                disabled={!canChangeTimeframe}
              >
                {PERIOD_KEYS.map((key) => (
                  <option key={key} value={key}>{PERIODS[key]}</option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" />
              {!canChangeTimeframe && (
                <span id={hintId} className="pcd-sr">The timeframe cannot be changed here.</span>
              )}
            </div>
          </div>
        </header>

        <div className="pcd-grid">
          {cells.map((cell) => {
            const known = cell.count !== null;
            return (
              <div key={cell.key} className="pcd-cell">
                <dl>
                  <dt>{cell.label}</dt>
                  <dd>
                    <span className="pcd-val" aria-hidden="true" data-unknown={known ? undefined : ''}>
                      {known ? formatCompact(cell.count) : '—'}
                    </span>
                    <span className="pcd-sr">{known ? formatFull(cell.count) : 'Unavailable'}</span>
                    <span className="pcd-trend" data-tone={cell.trend.tone} aria-hidden="true">{cell.trend.text}</span>
                    <span className="pcd-sr">, {cell.trend.spoken}</span>
                  </dd>
                </dl>
                <div className="pcd-spark">
                  <Sparkline data={cell.series} gradientId={`pcd-${safeId}-${cell.key}`} />
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="pcd-cell pcd-rank"
            aria-label={rank ? `View creator rankings. Current standing: ${rank.spoken}` : 'View creator rankings. Current standing unavailable'}
            onClick={openRankings}
          >
            <span className="pcd-ring" aria-hidden="true"><span><Crown /></span></span>
            <span className="pcd-rank-val">{rank ? rank.text : '—'}</span>
            <span className="pcd-rank-sub">Among Creators</span>
          </button>
        </div>
      </div>
    </section>
  );
});

ProfileCreatorDashboard.displayName = 'ProfileCreatorDashboard';

export default ProfileCreatorDashboard;
