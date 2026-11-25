/**
 * Production-grade Citizen Progression & Civic Standing strip.
 * A compact, transparent liquid-glass strip (Light & Dark). The whole surface is one
 * navigation target; there is no separate call-to-action button.
 *
 * Ownership boundaries (this component only presents; it never computes progression):
 * - `getLevelInfo`      -> XP progress, XP earned/remaining, maximum-level state.
 * - `getRankTitle`      -> the rank title. A neutral "Level N" is used when it is unusable.
 * - `getLevelUpReward`  -> the upcoming reward, shown only when positively established.
 * - `LevelNumeralBadge` -> the emblem (rendered as-is, presentational, never clickable here).
 * - Level, experience, reputation and streak arrive as props and are validated here.
 *
 * Input handling: loose JavaScript coercion is never used. Numbers and explicitly validated
 * numeric strings (e.g. "47") are accepted; booleans, arrays, objects, blank or malformed
 * strings, NaN and Infinity are rejected before any value is rendered or passed to a service.
 *
 * Honesty rules: unknown stays unknown (never rendered as 0); a measured zero renders as 0;
 * a level/XP disagreement verifiable from the service result suppresses the XP block;
 * service failures never throw into the profile page.
 *
 * Theme: `theme` is normalised once and passed to both the root and `LevelNumeralBadge`.
 * All styling hangs off `data-theme`; no global `dark:` classes are used.
 *
 * Styles: one shared, static, `ppr-` scoped stylesheet is inserted into <head> once and
 * reference-counted across instances (safe under StrictMode); nothing dynamic is ever
 * interpolated into it.
 *
 * @component
 */

import { memo, useMemo, useId, useInsertionEffect } from "react";
import { useNavigate } from 'react-router-dom';
import { Crown, Flame, ChevronRight, Award, Sparkles } from "lucide-react";
import { cn } from '../../lib/utils';
import { brandRgba } from '../../design-system/tokens.js';
import LevelNumeralBadge from './LevelNumeralBadge.jsx';
import {
  getLevelInfo,
  getRankTitle,
  getLevelUpReward,
} from '../../services/levelSystemService';

/* -------------------------------------------------------------------------------------------
 * Styles
 *
 * Layers inside the card (bottom to top):
 *   1. card background  - transparent glass body + violet/blue ambient light + backdrop blur
 *   2. press tint       - ::before, only visible on hover/press
 *   3. .ppr-fx          - caustics, curved top gloss, diagonal glass streak (clipped, inert)
 *   4. .ppr-body        - content
 *   5. .ppr-rim         - conic gradient rim over a real border (progressive enhancement)
 *   6. .ppr-hit         - transparent full-surface navigation button (the only control)
 * ----------------------------------------------------------------------------------------- */
const STYLES = `
.ppr-root{
  --ppr-blur:blur(22px) saturate(200%);
  position:relative;display:block;box-sizing:border-box;width:100%;min-width:0;
  container-type:inline-size;-webkit-text-size-adjust:100%;
}
.ppr-root *,.ppr-root *::before,.ppr-root *::after{box-sizing:border-box}

/* ---------- Dark: zero-contrast transparent glass over #03071B ---------- */
.ppr-root[data-theme="dark"]{
  --ppr-base:rgba(255,255,255,0.025);
  --ppr-layers:
    radial-gradient(60% 150% at 0% 0%,rgba(200,43,255,0.12),transparent 64%),
    radial-gradient(60% 150% at 100% 100%,rgba(0,136,255,0.14),transparent 64%),
    radial-gradient(50% 100% at 55% -40%,${brandRgba(0.10)},transparent 70%),
    linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02) 52%,rgba(255,255,255,0.01));
  --ppr-border:rgba(255,255,255,0.12);
  --ppr-shadow:
    0 12px 24px -18px rgba(1,3,22,0.52),
    0 2px 6px -4px rgba(5,10,40,0.22),
    inset 0 1px 0 rgba(255,255,255,0.18),
    inset 0 -1px 0 rgba(0,136,255,0.14),
    inset 1px 0 0 rgba(200,43,255,0.10),
    inset -1px 0 0 rgba(0,136,255,0.10),
    inset 0 0 24px rgba(130,120,255,0.07),
    inset 0 -10px 18px -14px rgba(0,136,255,0.18);
  --ppr-shadow-hover:
    0 14px 26px -18px rgba(1,3,22,0.58),
    0 2px 6px -4px rgba(5,10,40,0.25),
    inset 0 1px 0 rgba(255,255,255,0.24),
    inset 0 -1px 0 rgba(0,136,255,0.20),
    inset 0 0 28px rgba(140,130,255,0.10);
  --ppr-press:linear-gradient(180deg,rgba(190,180,255,0.10),rgba(110,140,255,0.06));
  --ppr-caustic:
    radial-gradient(34% 90% at 9% 0%,rgba(255,255,255,0.10),transparent 74%),
    radial-gradient(26% 80% at 92% 100%,rgba(140,210,255,0.10),transparent 74%);
  --ppr-spec:
    linear-gradient(90deg,transparent,rgba(235,240,255,0.42) 20%,rgba(235,240,255,0.42) 72%,transparent) center top/86% 1px no-repeat,
    linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.03) 60%,transparent);
  --ppr-streak:linear-gradient(90deg,transparent,rgba(255,255,255,0.06) 46%,rgba(255,255,255,0.02) 62%,transparent);
  --ppr-rim:conic-gradient(from 200deg at 50% 50%,rgba(245,248,255,0.36),${brandRgba(0.24)} 22%,rgba(5,91,251,0.34) 46%,rgba(210,220,255,0.10) 66%,rgba(200,43,255,0.22) 84%,rgba(245,248,255,0.36));
  --ppr-sat:90%;--ppr-fl:52%;--ppr-tl:70%;
  --ppr-title:#F6F8FF;--ppr-sub:#BAC4E2;--ppr-meta:#AEB9DA;--ppr-accent:#D3C4FF;
  --ppr-track:rgba(255,255,255,0.10);--ppr-track-edge:rgba(255,255,255,0.08);--ppr-track-inset:rgba(2,4,30,0.34);
  --ppr-rep:#8EC1FF;--ppr-streak-c:#E2A9FF;--ppr-reward:#D5DCF5;
  --ppr-focus:#A79BFF;--ppr-icon-tile:rgba(255,255,255,0.08);--ppr-crown:#D8B4FE;
}

/* ---------- Light: transparent bright glass, soft neutral reflections, violet/blue accents ---------- */
.ppr-root[data-theme="light"]{
  --ppr-base:rgba(250,251,255,0.30);
  --ppr-layers:
    radial-gradient(60% 150% at 0% 0%,rgba(200,43,255,0.11),transparent 64%),
    radial-gradient(60% 150% at 100% 100%,rgba(0,136,255,0.15),transparent 64%),
    radial-gradient(120% 100% at 50% -40%,rgba(255,255,255,0.90),transparent 64%),
    linear-gradient(160deg,rgba(255,255,255,0.54),rgba(240,244,255,0.34) 55%,rgba(226,234,255,0.34));
  --ppr-border:rgba(115,130,225,0.34);
  --ppr-shadow:
    0 12px 28px -18px rgba(52,70,160,0.40),
    0 2px 6px -3px rgba(52,70,160,0.12),
    inset 0 1px 0 #FFFFFF,
    inset 0 -1px 0 rgba(110,130,240,0.20),
    inset 1px 0 0 rgba(255,255,255,0.65),
    inset -1px 0 0 rgba(255,255,255,0.45),
    inset 0 0 28px rgba(255,255,255,0.50),
    inset 0 -14px 24px -18px rgba(80,120,255,0.26);
  --ppr-shadow-hover:
    0 14px 30px -18px rgba(52,70,160,0.46),
    0 2px 6px -3px rgba(52,70,160,0.14),
    inset 0 1px 0 #FFFFFF,
    inset 0 -1px 0 rgba(110,130,240,0.26),
    inset 0 0 32px rgba(255,255,255,0.62);
  --ppr-press:linear-gradient(180deg,rgba(255,255,255,0.55),rgba(190,205,255,0.22));
  --ppr-caustic:
    radial-gradient(34% 90% at 9% 0%,rgba(255,255,255,0.80),transparent 74%),
    radial-gradient(26% 80% at 92% 100%,rgba(185,212,255,0.46),transparent 74%);
  --ppr-spec:
    linear-gradient(90deg,transparent,#FFFFFF 20%,#FFFFFF 72%,transparent) center top/88% 1px no-repeat,
    linear-gradient(180deg,rgba(255,255,255,0.80),rgba(255,255,255,0.20) 60%,transparent);
  --ppr-streak:linear-gradient(90deg,transparent,rgba(255,255,255,0.50) 46%,rgba(255,255,255,0.18) 62%,transparent);
  --ppr-rim:conic-gradient(from 200deg at 50% 50%,#FFFFFF,${brandRgba(0.34)} 22%,rgba(5,91,251,0.46) 46%,rgba(255,255,255,0.70) 66%,rgba(200,43,255,0.30) 84%,#FFFFFF);
  --ppr-sat:86%;--ppr-fl:46%;--ppr-tl:30%;
  --ppr-title:#0F172A;--ppr-sub:#4B5873;--ppr-meta:#51607C;--ppr-accent:#5B21B6;
  --ppr-track:rgba(70,85,170,0.14);--ppr-track-edge:rgba(255,255,255,0.75);--ppr-track-inset:rgba(60,75,160,0.18);
  --ppr-rep:#1D4ED8;--ppr-streak-c:#7E22CE;--ppr-reward:#475569;
  --ppr-focus:var(--arv-brand-indigo);--ppr-icon-tile:rgba(255,255,255,0.72);--ppr-crown:#7C1FE0;
}

/* ---------- Card ---------- */
.ppr-card{
  /* Fallback sizes (no container-query support): compact, Android-first. */
  --ppr-px:12px;--ppr-py:7px;--ppr-gap:10px;--ppr-r:16px;
  --ppr-t:14px;--ppr-p:14px;--ppr-m:11px;
  position:relative;isolation:isolate;width:100%;
  border:1px solid var(--ppr-border);border-radius:var(--ppr-r);
  background:var(--ppr-layers),linear-gradient(var(--ppr-base),var(--ppr-base));
  -webkit-backdrop-filter:var(--ppr-blur);backdrop-filter:var(--ppr-blur);
  box-shadow:var(--ppr-shadow);
  transition:box-shadow .18s ease;
}
@supports (width:1cqw){
  .ppr-card{
    --ppr-px:clamp(12px,3.4cqw,18px);
    --ppr-py:clamp(6px,1.8cqw,9px);
    --ppr-gap:clamp(10px,2.6cqw,13px);
    --ppr-r:clamp(16px,4.4cqw,20px);
    --ppr-t:clamp(14px,3.7cqw,15.5px);
    --ppr-p:clamp(14px,3.6cqw,16px);
    --ppr-m:clamp(11px,2.8cqw,12px);
  }
}
@supports not (width:1cqw){
  @media (min-width:640px){.ppr-card{--ppr-px:18px;--ppr-py:9px;--ppr-gap:13px;--ppr-r:20px;--ppr-t:15.5px;--ppr-p:16px;--ppr-m:12px}}
}
.ppr-card::before{content:"";position:absolute;inset:0;z-index:0;border-radius:inherit;pointer-events:none;background:var(--ppr-press);opacity:0;transition:opacity .15s ease}
@media (hover:hover) and (pointer:fine){
  .ppr-card:hover{box-shadow:var(--ppr-shadow-hover)}
  .ppr-card:hover::before{opacity:.55}
}
.ppr-card:active::before{opacity:1}

/* Glass reflection layers (decorative, clipped to the card radius) */
.ppr-fx{position:absolute;inset:0;z-index:0;border-radius:inherit;overflow:hidden;pointer-events:none;background:var(--ppr-caustic)}
.ppr-fx::before{content:"";position:absolute;left:0;right:0;top:0;height:52%;border-radius:0 0 50% 50% / 0 0 46% 46%;background:var(--ppr-spec)}
.ppr-fx::after{content:"";position:absolute;top:-60%;left:14%;width:34%;height:220%;transform:rotate(20deg);background:var(--ppr-streak)}

.ppr-body{position:relative;z-index:1;padding:var(--ppr-py) var(--ppr-px);color:var(--ppr-title);min-width:0;font-family:inherit}

/* ---------- Compact layout: emblem | identity + progress | chevron ---------- */
.ppr-main{display:flex;align-items:center;gap:var(--ppr-gap);min-width:0}
.ppr-emblem{position:relative;z-index:0;flex:none;display:flex;align-items:center;justify-content:center}
.ppr-col{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px;
  /* Progress colour: hue is set from the validated percentage (0% red -> 90%+ green). */
  --ppr-hue:0;--ppr-hue0:0}
.ppr-chev{flex:none;width:15px;height:15px;color:var(--ppr-sub);opacity:.75}

.ppr-head{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:0 10px;min-width:0}
.ppr-title{
  flex:1 1 7rem;min-width:0;margin:0;font:inherit;font-size:var(--ppr-t);line-height:1.2;font-weight:600;color:var(--ppr-title);
  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;overflow-wrap:anywhere;
}
.ppr-stat{flex:0 0 auto;display:inline-flex;align-items:baseline;gap:5px;white-space:nowrap;font-variant-numeric:tabular-nums}
.ppr-pct{font-size:var(--ppr-p);line-height:1.2;font-weight:700;color:var(--ppr-accent);color:hsl(var(--ppr-hue) var(--ppr-sat) var(--ppr-tl))}
.ppr-next{font-size:var(--ppr-m);line-height:1.2;font-weight:500;color:var(--ppr-sub)}

/* ---------- Progress bar ---------- */
.ppr-bar{position:relative;height:5px;border-radius:999px;background:var(--ppr-track);box-shadow:inset 0 1px 2px var(--ppr-track-inset),0 1px 0 var(--ppr-track-edge)}
.ppr-fill{
  position:relative;height:100%;max-width:100%;border-radius:999px;
  background:hsl(var(--ppr-hue) var(--ppr-sat) var(--ppr-fl));
  background:linear-gradient(90deg,hsl(var(--ppr-hue0) var(--ppr-sat) var(--ppr-fl)),hsl(var(--ppr-hue) var(--ppr-sat) var(--ppr-fl)));
  box-shadow:inset 0 1px 0 rgba(255,255,255,0.42),inset 0 -1px 0 rgba(15,10,80,0.22);
  transition:width .5s cubic-bezier(.22,.8,.3,1);
}
.ppr-fill::after{content:"";position:absolute;left:2px;right:2px;top:1px;height:38%;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,0.50),rgba(255,255,255,0))}
.ppr-fill[data-full="true"]{width:100%}

/* ---------- Single wrapping detail row: XP, reputation, streak, reward ---------- */
.ppr-meta{display:flex;flex-wrap:wrap;align-items:center;gap:0 10px;font-size:var(--ppr-m);line-height:1.3;font-weight:500;color:var(--ppr-meta);font-variant-numeric:tabular-nums}
.ppr-item{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.ppr-item svg{width:13px;height:13px;flex:none}
.ppr-item[data-k="rep"]{color:var(--ppr-rep);font-weight:600}
.ppr-item[data-k="streak"]{color:var(--ppr-streak-c);font-weight:600}
.ppr-item[data-k="streak"] svg{fill:currentColor;fill-opacity:.22}
.ppr-item[data-k="reward"]{color:var(--ppr-reward)}

/* ---------- Unavailable state ---------- */
.ppr-na-icon{flex:none;width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ppr-crown);background:var(--ppr-icon-tile);border:1px solid var(--ppr-border);box-shadow:inset 0 1px 0 rgba(255,255,255,0.5)}
.ppr-na-icon svg{width:15px;height:15px}
.ppr-na-text{margin:0;font-size:var(--ppr-m);line-height:1.3;font-weight:500;color:var(--ppr-sub)}

/* ---------- Gradient rim: a real border always exists; the mask rim only enhances it ---------- */
.ppr-rim{display:none;position:absolute;inset:-1px;z-index:2;border-radius:inherit;pointer-events:none}
@supports ((-webkit-mask-composite:xor) or (mask-composite:exclude)){
  .ppr-rim{
    display:block;padding:1px;background:var(--ppr-rim);
    -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;
    mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
    mask-composite:exclude;
  }
}

/* ---------- The one interactive control: a transparent button covering the whole card ---------- */
.ppr-hit{
  position:absolute;inset:0;z-index:3;display:block;width:100%;height:100%;margin:0;padding:0;border:0;
  border-radius:inherit;background:transparent;color:inherit;cursor:pointer;
  -webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation;
}
.ppr-hit:focus{outline:none}
.ppr-hit:focus-visible{outline:2px solid var(--ppr-focus);outline-offset:2px}

.ppr-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

/* ---------- Progressive fallbacks ---------- */
/* No backdrop blur: denser, still translucent body with the same reflections. */
@supports not ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){
  .ppr-root[data-theme="dark"]{--ppr-base:rgba(3,7,27,0.88)}
  .ppr-root[data-theme="light"]{--ppr-base:rgba(247,249,255,0.88)}
}
@media (prefers-reduced-transparency:reduce){
  .ppr-root{--ppr-blur:none}
  .ppr-root[data-theme="dark"]{--ppr-base:rgba(3,7,27,0.92)}
  .ppr-root[data-theme="light"]{--ppr-base:rgba(247,249,255,0.95)}
}
.lite-mode .ppr-root,[data-lite-mode="true"] .ppr-root,[data-performance="lite"] .ppr-root{--ppr-blur:none}
.lite-mode .ppr-root[data-theme="dark"],[data-lite-mode="true"] .ppr-root[data-theme="dark"],[data-performance="lite"] .ppr-root[data-theme="dark"]{--ppr-base:rgba(3,7,27,0.90)}
.lite-mode .ppr-root[data-theme="light"],[data-lite-mode="true"] .ppr-root[data-theme="light"],[data-performance="lite"] .ppr-root[data-theme="light"]{--ppr-base:rgba(247,249,255,0.92)}

@media (prefers-reduced-motion:reduce){
  .ppr-fill,.ppr-card,.ppr-card::before{transition:none}
}
@media (forced-colors:active){
  .ppr-card{border-color:CanvasText;background:Canvas;box-shadow:none;-webkit-backdrop-filter:none;backdrop-filter:none}
  .ppr-fx,.ppr-rim,.ppr-card::before{display:none}
  .ppr-body,.ppr-title,.ppr-meta,.ppr-pct,.ppr-next,.ppr-item,.ppr-chev,.ppr-na-text{color:CanvasText}
  .ppr-bar{background:Canvas;border:1px solid CanvasText}
  .ppr-fill{background:Highlight;box-shadow:none}
  .ppr-hit:focus-visible{outline-color:Highlight}
}
`;

/* One shared <style> element for all instances, reference-counted so it is inserted once,
 * survives StrictMode's mount/unmount/mount cycle, and is removed with the last instance. */
const STYLE_ELEMENT_ID = 'arvdoul-profile-progression-styles';
let styleConsumers = 0;

const acquireStyles = () => {
  if (typeof document === 'undefined') return undefined;
  let element = document.getElementById(STYLE_ELEMENT_ID);
  if (!element) {
    element = document.createElement('style');
    element.id = STYLE_ELEMENT_ID;
    document.head.appendChild(element);
  }
  if (styleConsumers === 0 || element.textContent !== STYLES) element.textContent = STYLES;
  styleConsumers += 1;
  return () => {
    styleConsumers = Math.max(0, styleConsumers - 1);
    if (styleConsumers === 0) {
      const current = document.getElementById(STYLE_ELEMENT_ID);
      if (current && current.parentNode) current.parentNode.removeChild(current);
    }
  };
};

/* -------------------------------------------------------------------------------------------
 * Validation (file-local). Only numbers and explicitly validated numeric strings pass.
 * ----------------------------------------------------------------------------------------- */
const NUMERIC_STRING = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

/** Finite number from a number or a validated numeric string; otherwise null. */
const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!NUMERIC_STRING.test(trimmed)) return null;
    const parsed = Number(trimmed); // safe: the string was validated above
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/** Positive safe integer (levels). Fractions are rejected, never floored. */
const toLevel = (value) => {
  const n = toNumber(value);
  return n !== null && Number.isSafeInteger(n) && n > 0 ? n : null;
};

/** Finite number >= 0 (experience, XP amounts, rewards). */
const toNonNegative = (value) => {
  const n = toNumber(value);
  return n !== null && n >= 0 ? n : null;
};

/** Safe integer >= 0 (streak days). Zero is a legitimate measured value. */
const toDayCount = (value) => {
  const n = toNumber(value);
  return n !== null && Number.isSafeInteger(n) && n >= 0 ? n : null;
};

/** Percentage within 0..100, one decimal of precision (shared by width and ARIA). */
const toPercent = (value) => {
  const n = toNumber(value);
  if (n === null || n < 0 || n > 100) return null;
  return Math.round(n * 10) / 10;
};

/** Badge size handed to LevelNumeralBadge (existing prop, unchanged contract). */
const BADGE_SIZE = 'md';

/**
 * Progress colour from the validated percentage: 0% is red, passing orange and amber, and
 * 90% and above is green. Purely presentational; returns two numeric hues for the fill gradient.
 */
const GREEN_HUE = 142;
const hueForProgress = (percent) => {
  const p = Math.min(100, Math.max(0, percent));
  const hue = p >= 90 ? GREEN_HUE : Math.round(GREEN_HUE * Math.pow(p / 90, 1.8));
  return { hue, start: Math.max(0, hue - 14) };
};

let numberFormatter = null;
try {
  numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
} catch {
  numberFormatter = null;
}
const formatNumber = (n) => {
  if (numberFormatter) {
    try {
      return numberFormatter.format(n);
    } catch {
      /* fall through */
    }
  }
  return String(n);
};

/**
 * Validates the untrusted `getLevelInfo` result without recreating any of its logic.
 * - Every level field the service returns (`level`, `currentLevel`) must be valid AND equal
 *   to the supplied level; a present-but-invalid field counts as a mismatch, so an invalid
 *   value can never create a false match.
 * - Maximum level is confirmed only by `isMaxLevel === true`; a next level is established
 *   only by `isMaxLevel === false`. Anything else is unknown and claims neither.
 */
const readLevelInfo = (raw, suppliedLevel) => {
  if (!raw || typeof raw !== 'object') return null;

  for (const reported of [raw.level, raw.currentLevel]) {
    if (reported === undefined || reported === null) continue;
    if (toLevel(reported) !== suppliedLevel) return { mismatch: true };
  }

  const isMax = raw.isMaxLevel === true;
  return {
    mismatch: false,
    isMax,
    nextEstablished: raw.isMaxLevel === false,
    progress: isMax ? null : toPercent(raw.progress),
    xpIntoLevel: isMax ? null : toNonNegative(raw.xpIntoLevel),
    xpToNext: isMax ? null : toNonNegative(raw.xpToNext),
  };
};

const ProfileProgression = memo(({
  level = null,
  experience = null,
  streak = null, // null = unknown; a supplied 0 is a measured zero
  reputation = null,
  showLevel = true,
  showReputation = true,
  showStreak = true,
  isOwner = false,
  theme = 'light',
  className = '',
}) => {
  const navigate = useNavigate();
  const titleId = useId();

  useInsertionEffect(() => acquireStyles(), []);

  // Normalised once; used for the root and for LevelNumeralBadge.
  const themeName = theme === 'dark' ? 'dark' : 'light';

  // Strict booleans: only a real `true` enables a flag. Anything else (strings, objects, null)
  // hides the corresponding information or treats the viewer as a visitor (privacy-safe).
  const levelVisible = showLevel === true;
  const reputationVisible = showReputation === true;
  const streakVisible = showStreak === true;
  const owner = isOwner === true;

  const validLevel = toLevel(level);
  const validExperience = toNonNegative(experience);

  // Service-derived values are computed only when level details are visible and the level is valid.
  const info = useMemo(() => {
    if (!levelVisible || validLevel === null || validExperience === null) return null;
    try {
      return readLevelInfo(getLevelInfo(validExperience), validLevel);
    } catch {
      return null;
    }
  }, [levelVisible, validLevel, validExperience]);

  const rankTitle = useMemo(() => {
    if (!levelVisible || validLevel === null) return null;
    try {
      const title = getRankTitle(validLevel);
      return typeof title === 'string' && title.trim() ? title.trim() : null;
    } catch {
      return null;
    }
  }, [levelVisible, validLevel]);

  const xp = info && !info.mismatch ? info : null;
  // Never create an unsafe next level.
  const nextLevel = validLevel !== null && validLevel < Number.MAX_SAFE_INTEGER ? validLevel + 1 : null;
  const nextKnown = Boolean(xp && xp.nextEstablished && nextLevel !== null);

  const reward = useMemo(() => {
    if (!nextKnown || validLevel === null || nextLevel === null) return null;
    try {
      return toNonNegative(getLevelUpReward(validLevel, nextLevel));
    } catch {
      return null;
    }
  }, [nextKnown, validLevel, nextLevel]);

  const reputationValue = reputationVisible ? toNumber(reputation) : null;
  const streakDays = streakVisible ? toDayCount(streak) : null;
  const hasSupport = reputationValue !== null || streakDays !== null;

  const showStanding = levelVisible && validLevel !== null;
  const showUnavailable = levelVisible && validLevel === null && owner;
  // Level hidden: supporting metrics may still render, but visitors without a level never see a card.
  const showSupportingOnly = !levelVisible && hasSupport && (validLevel !== null || owner);

  if (!showStanding && !showUnavailable && !showSupportingOnly) return null;

  const destination = showUnavailable ? '/passport' : owner ? '/progress' : '/passport';
  const hitLabel = showUnavailable
    ? 'View Passport'
    : owner
      ? 'Open progression and perks'
      : 'Open citizen standing and perks';

  const supportItems = (
    <>
      {reputationValue !== null && (
        <span className="ppr-item" data-k="rep">
          <Award aria-hidden="true" focusable="false" />
          <span>{formatNumber(reputationValue)} Reputation</span>
        </span>
      )}
      {streakDays !== null && (
        <span className="ppr-item" data-k="streak">
          <Flame aria-hidden="true" focusable="false" />
          <span>{`${formatNumber(streakDays)} Day Streak${streakDays === 1 ? '' : 's'}`}</span>
        </span>
      )}
    </>
  );

  const shell = (children) => (
    <div className={cn('ppr-root', className)} data-theme={themeName}>
      <section className="ppr-card" aria-labelledby={titleId}>
        <span className="ppr-fx" aria-hidden="true" />
        <div className="ppr-body">{children}</div>
        <span className="ppr-rim" aria-hidden="true" />
        <button type="button" className="ppr-hit" aria-label={hitLabel} onClick={() => navigate(destination)} />
      </section>
    </div>
  );

  if (showUnavailable) {
    return shell(
      <div className="ppr-main">
        <span className="ppr-na-icon" aria-hidden="true">
          <Crown focusable="false" />
        </span>
        <div className="ppr-col" style={{ gap: 1 }}>
          <h3 id={titleId} className="ppr-title">Civic standing unavailable</h3>
          <p className="ppr-na-text">Your progression information is not currently available.</p>
        </div>
        <ChevronRight className="ppr-chev" aria-hidden="true" focusable="false" />
      </div>
    );
  }

  if (showSupportingOnly) {
    return shell(
      <div className="ppr-main">
        <div className="ppr-col" style={{ gap: 2 }}>
          <h3 id={titleId} className="ppr-title">Citizen standing</h3>
          <div className="ppr-meta">{supportItems}</div>
        </div>
        <ChevronRight className="ppr-chev" aria-hidden="true" focusable="false" />
      </div>
    );
  }

  // ---- Standing: emblem, rank, XP progress, supporting details ----
  const title = rankTitle || `Level ${validLevel}`;
  const isMax = Boolean(xp && xp.isMax);
  const progress = xp ? xp.progress : null;
  const hasBar = progress !== null;
  const percentText = hasBar ? `${Math.floor(progress)}%` : null;
  const nextLabel = nextKnown ? `To Level ${nextLevel}` : null;
  const earned = xp ? xp.xpIntoLevel : null;
  const toNext = xp ? xp.xpToNext : null;
  // Experience was supplied but no trustworthy XP result exists (failure, malformed, mismatch).
  const xpUnavailable = validExperience !== null && !xp;
  const showReward = reward !== null && reward > 0;

  const tone = isMax ? { hue: GREEN_HUE, start: GREEN_HUE - 14 } : hasBar ? hueForProgress(progress) : null;
  const colStyle = tone ? { '--ppr-hue': tone.hue, '--ppr-hue0': tone.start } : undefined;

  const hasMeta = earned !== null || toNext !== null || xpUnavailable || hasSupport || showReward;

  return shell(
    <div className="ppr-main">
      <div className="ppr-emblem">
        <LevelNumeralBadge level={validLevel} theme={themeName} size={BADGE_SIZE} />
      </div>

      <div className="ppr-col" style={colStyle}>
        <div className="ppr-head">
          <h3 id={titleId} className="ppr-title">
            {title}
            <span className="ppr-sr">{rankTitle ? `, Level ${validLevel}` : ''}</span>
          </h3>

          {isMax && (
            <span className="ppr-stat">
              <span className="ppr-pct">Max</span>
              <span className="ppr-next">level reached</span>
            </span>
          )}
          {!isMax && (hasBar || nextLabel) && (
            <span className="ppr-stat">
              {hasBar && <span className="ppr-pct" aria-hidden="true">{percentText}</span>}
              {nextLabel && <span className="ppr-next">{nextLabel}</span>}
            </span>
          )}
        </div>

        {isMax && (
          <>
            <div className="ppr-bar" aria-hidden="true">
              <div className="ppr-fill" data-full="true" />
            </div>
            <span className="ppr-sr">Maximum level reached.</span>
          </>
        )}

        {hasBar && (
          <div
            className="ppr-bar"
            role="progressbar"
            aria-label={`Level ${validLevel} progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-valuetext={nextLabel ? `${percentText}, ${nextLabel.toLowerCase()}` : percentText}
          >
            <div className="ppr-fill" style={{ width: `${progress}%` }} />
          </div>
        )}

        {hasMeta && (
          <div className="ppr-meta">
            {earned !== null && <span className="ppr-item">{formatNumber(earned)} XP earned</span>}
            {toNext !== null && <span className="ppr-item">{formatNumber(toNext)} XP left</span>}
            {xpUnavailable && earned === null && toNext === null && (
              <span className="ppr-item">XP progress unavailable</span>
            )}
            {supportItems}
            {showReward && (
              <span className="ppr-item" data-k="reward">
                <Sparkles aria-hidden="true" focusable="false" />
                <span>{`Next Level Reward · +${formatNumber(reward)} Coins`}</span>
              </span>
            )}
          </div>
        )}
      </div>

      <ChevronRight className="ppr-chev" aria-hidden="true" focusable="false" />
    </div>
  );
});

ProfileProgression.displayName = 'ProfileProgression';

export default ProfileProgression;
