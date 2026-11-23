/**
 * Production-grade label-first navigation for Arvdoul profiles.
 *
 * Owns exactly two things:
 *  1. The profile section tabs (selection is reported through `onTabChange(tabId)`).
 *  2. The optional Grid/Feed switcher (reported through `onViewModeChange('grid' | 'feed')`).
 *
 * The parent owns everything else: the active section, the view mode, permissions, counts,
 * content, data, sticky positioning, page scrolling and scroll restoration. This component keeps
 * no selected-tab or view-mode state, persists nothing and fetches nothing. It is NOT sticky.
 *
 * Accessibility pattern: ARIA tabs with a roving tabindex and manual activation. Arrow keys,
 * Home and End only move focus; Enter/Space (or a tap/click) selects. No tab panels exist here,
 * so tabs carry no `aria-controls` (panels live in the parent); with no `onTabChange` the tabs are
 * rendered natively `disabled` because they cannot do what they advertise.
 *
 * Styling: the `theme` prop is the single authority (`'dark'`, anything else is light). One static
 * `ptb-` scoped stylesheet is rendered through React's resource-style API (`href` + `precedence`):
 * React 19 hoists it into <head> and de-duplicates it across instances and during SSR, so this file
 * never touches `document` itself. Nothing dynamic is interpolated into the CSS.
 *
 * @component
 */

import { memo, useEffect, useRef, useState } from "react";
import { LayoutGrid, Rows3 } from 'lucide-react';
import { BRAND_GRADIENT } from '../../design-system/tokens.js';
import { getAdaptiveTuning } from '../../utils/deviceCapabilities.js';

/* -------------------------------------------------------------------------------------------
 * Static definitions
 * ----------------------------------------------------------------------------------------- */

/** Canonical order. `ownerOnly` is a presentation rule only; authorization stays with the parent. */
const TABS = [
  { id: 'posts', label: 'Posts' },
  { id: 'videos', label: 'Videos' },
  { id: 'reels', label: 'Reels' },
  { id: 'photos', label: 'Photos' },
  { id: 'stories', label: 'Vibes' },
  { id: 'audio', label: 'Audio' },
  { id: 'saved', label: 'Saved', ownerOnly: true },
  { id: 'tagged', label: 'Tagged' },
  { id: 'citizenship', label: 'Citizenship' },
  { id: 'about', label: 'About' },
];
const OWNER_TABS = TABS;
const VISITOR_TABS = TABS.filter((tab) => !tab.ownerOnly);

/** Sections with no Grid/Feed presentation (existing rule, unchanged). */
const NO_VIEW_MODE_TABS = new Set(['about', 'citizenship', 'audio']);

const VIEW_MODES = [
  { id: 'grid', label: 'Grid view', icon: LayoutGrid },
  { id: 'feed', label: 'Feed view', icon: Rows3 },
];

/** Brand gradient accent. Anything that is not a plain gradient string is ignored, and the
 *  stylesheet always has a solid colour underneath, so selection stays recognisable without it. */
const GRADIENT =
  typeof BRAND_GRADIENT === 'string' && /gradient\(/i.test(BRAND_GRADIENT) && !/[;{}]/.test(BRAND_GRADIENT)
    ? BRAND_GRADIENT.trim()
    : undefined;

/* Counts come from the parent. Only own, positive safe integers are shown: no strings, NaN,
 * Infinity, negatives, decimals, unsafe integers or inherited properties. */
let compactFormatter = null;
let fullFormatter = null;
try {
  compactFormatter = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  fullFormatter = new Intl.NumberFormat('en-US');
} catch {
  compactFormatter = null;
  fullFormatter = null;
}

const readCount = (counts, id) => {
  if (!counts || typeof counts !== 'object' || !Object.prototype.hasOwnProperty.call(counts, id)) return null;
  const value = counts[id];
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;
};
/** Compact label. Values under 1,000 are exact; larger values round to the nearest tenth of a
 *  thousand-unit, so a positive count can never display as zero. */
const formatCompact = (n) => {
  if (n < 1000) return String(n);
  try {
    return compactFormatter ? compactFormatter.format(n) : String(n);
  } catch {
    return String(n);
  }
};
/** Exact value for assistive technology. */
const formatFull = (n) => {
  try {
    return fullFormatter ? fullFormatter.format(n) : String(n);
  } catch {
    return String(n);
  }
};

/** Device lite mode. The utility's implementation is not visible from this file, so it is called
 *  as before (no caching assumed) and guarded: an incomplete result or a browser-API failure
 *  (e.g. during SSR) falls back to the normal visual mode and never breaks rendering. Lite mode
 *  only removes backdrop blur; it never changes tabs, semantics or behaviour. */
const readLiteMode = () => {
  try {
    return getAdaptiveTuning()?.isLiteMode === true;
  } catch {
    return false;
  }
};

/** Scroll the strip horizontally (never the page) so `el` sits clear of the edge fades.
 *  Uses bounding rects, so it is correct in both LTR and RTL. */
const revealInList = (list, el) => {
  if (!list || !el) return;
  const margin = 24;
  const listRect = list.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  if (elRect.left < listRect.left + margin) {
    list.scrollLeft -= listRect.left + margin - elRect.left;
  } else if (elRect.right > listRect.right - margin) {
    list.scrollLeft += elRect.right - (listRect.right - margin);
  }
};

/* -------------------------------------------------------------------------------------------
 * Styles (static)
 *
 * Responsive strategy (container width of the bar, not the viewport), first six labels + switcher:
 *   < 420px  : compact tabs; the strip scrolls horizontally, the next label peeks in.
 *   >= 420px : the first six full labels fit (estimated, see report).
 *   >= 460 / 520px : comfortable padding.
 *   >= 720px : natural-width tabs; all nine/ten labels fit from roughly 840px.
 * ----------------------------------------------------------------------------------------- */
const STYLES = `
.ptb-wrap{container-type:inline-size;width:100%;min-width:0}
.ptb-root{
  --ptb-blur:blur(14px) saturate(140%);
  position:relative;isolation:isolate;display:flex;align-items:stretch;box-sizing:border-box;
  width:100%;min-width:0;margin:0;padding:0;border-radius:0;
  -webkit-backdrop-filter:var(--ptb-blur);backdrop-filter:var(--ptb-blur);
  background:var(--ptb-surface);box-shadow:var(--ptb-hairline);
  color:var(--ptb-active);font-family:inherit;-webkit-text-size-adjust:100%;
}
.ptb-root *,.ptb-root *::before,.ptb-root *::after{box-sizing:border-box}

/* Dark: low-contrast translucent deep-navy glass (unchanged contrast) */
.ptb-root[data-theme='dark']{
  --ptb-surface:
    linear-gradient(90deg,rgba(139,30,243,0.05),transparent 38%,transparent 62%,rgba(0,136,255,0.05)),
    linear-gradient(90deg,transparent,rgba(255,255,255,0.07) 50%,transparent) top/100% 1px no-repeat,
    linear-gradient(180deg,rgba(14,20,60,0.30),rgba(6,10,38,0.36));
  --ptb-hairline:inset 0 -1px 0 rgba(165,175,255,0.12);
  --ptb-active:#F4F6FF;--ptb-muted:#98A4C6;--ptb-hover:#D3DAF2;--ptb-count:#8591B6;
  --ptb-accent:#7C6BFF;--ptb-tint:0.30;--ptb-focus:#A79BFF;
  --ptb-edge:inset 0 0 0 1px rgba(170,160,255,0.38),inset 0 1px 0 rgba(255,255,255,0.18);
  --ptb-hover-bg:rgba(255,255,255,0.05);--ptb-mode-on:rgba(255,255,255,0.10);
  --ptb-mode-edge:inset 0 0 0 1px rgba(190,198,255,0.26),inset 0 1px 0 rgba(255,255,255,0.14);
  --ptb-sep:rgba(165,175,255,0.16);
}
/* Light: clean translucent white, cool-neutral hairlines, deeper text for contrast */
.ptb-root[data-theme='light']{
  --ptb-surface:
    linear-gradient(90deg,rgba(139,30,243,0.04),transparent 38%,transparent 62%,rgba(5,91,251,0.05)),
    linear-gradient(90deg,transparent,rgba(255,255,255,0.95) 50%,transparent) top/100% 1px no-repeat,
    linear-gradient(180deg,rgba(255,255,255,0.78),rgba(246,248,252,0.68));
  --ptb-hairline:inset 0 -1px 0 rgba(100,116,170,0.26);
  --ptb-active:#0B1226;--ptb-muted:#4F5B7C;--ptb-hover:#18233F;--ptb-count:#5C6886;
  --ptb-accent:#4431F7;--ptb-tint:0.17;--ptb-focus:#4431F7;
  --ptb-edge:inset 0 0 0 1px rgba(68,49,247,0.30),inset 0 1px 0 rgba(255,255,255,0.90);
  --ptb-hover-bg:rgba(40,60,140,0.06);--ptb-mode-on:rgba(68,49,247,0.10);
  --ptb-mode-edge:inset 0 0 0 1px rgba(68,49,247,0.24),inset 0 1px 0 rgba(255,255,255,0.85);
  --ptb-sep:rgba(100,116,170,0.26);
}

/* ---------- Tab strip: full labels, horizontal scroll only when needed ---------- */
.ptb-list{
  position:relative;flex:1 1 auto;min-width:0;display:flex;align-items:stretch;
  padding:0 8px;scroll-padding-inline:24px;
  overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain;
  -webkit-overflow-scrolling:touch;scrollbar-width:none;
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 10px,#000 calc(100% - 10px),transparent 100%);
  mask-image:linear-gradient(90deg,transparent 0,#000 10px,#000 calc(100% - 10px),transparent 100%);
}
.ptb-list::-webkit-scrollbar{display:none}

.ptb-tab{
  position:relative;flex:1 0 auto;display:inline-flex;align-items:center;justify-content:center;gap:5px;
  min-height:44px;margin:0;padding:0 8px;border:0;border-radius:10px;background:none;
  font:inherit;font-size:13px;font-weight:600;line-height:1;letter-spacing:0;white-space:nowrap;
  color:var(--ptb-muted);cursor:pointer;user-select:none;-webkit-user-select:none;
  -webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation;
  transition:color .15s ease;
}
.ptb-tab:disabled{cursor:default}
.ptb-tab[aria-selected='true']{color:var(--ptb-active)}
.ptb-label,.ptb-count{position:relative;z-index:1}
.ptb-count{font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--ptb-count)}
.ptb-tab[aria-selected='true'] .ptb-count{color:var(--ptb-active);opacity:.82}

/* Arvdoul DNA selection: a soft brand-gradient surface with a fine edge and a faint top highlight.
 * ::before carries the tint (solid accent underneath, gradient on top); ::after carries the edge.
 * Both are absolutely positioned, so selecting a tab never shifts the layout. */
.ptb-tab::before,.ptb-tab::after{content:'';position:absolute;inset:6px 1px;border-radius:10px;pointer-events:none;z-index:0}
.ptb-tab::before{background:var(--ptb-hover-bg);opacity:0;transition:opacity .18s ease}
.ptb-tab::after{box-shadow:var(--ptb-edge);opacity:0;transition:opacity .18s ease}
.ptb-tab[aria-selected='true']::before{
  background-color:var(--ptb-accent);background-image:var(--ptb-grad);opacity:var(--ptb-tint);
}
.ptb-tab[aria-selected='true']::after{opacity:1}

.ptb-tab:focus,.ptb-mode:focus{outline:none}
.ptb-tab:focus-visible,.ptb-mode:focus-visible{outline:2px solid var(--ptb-focus);outline-offset:-2px}

@media (hover:hover) and (pointer:fine){
  .ptb-tab[aria-selected='false']:not(:disabled):hover{color:var(--ptb-hover)}
  .ptb-tab[aria-selected='false']:not(:disabled):hover::before{opacity:1}
  .ptb-mode[aria-pressed='false']:hover{color:var(--ptb-hover)}
}

/* ---------- Grid/Feed switcher: compact, separate, quiet (no gradient) ---------- */
.ptb-modes{flex:none;position:relative;display:flex;align-items:stretch;gap:0;padding:0 6px 0 8px}
.ptb-modes::before{content:'';position:absolute;left:0;top:50%;height:20px;margin-top:-10px;width:1px;background:var(--ptb-sep)}
.ptb-mode{
  position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;
  width:34px;min-height:44px;margin:0;padding:0;border:0;border-radius:8px;background:none;
  color:var(--ptb-muted);cursor:pointer;
  -webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation;
  transition:color .15s ease;
}
.ptb-mode::before,.ptb-mode::after{content:'';position:absolute;inset:6px 1px;border-radius:8px;pointer-events:none;z-index:0;opacity:0;transition:opacity .18s ease}
.ptb-mode::before{background:var(--ptb-mode-on)}
.ptb-mode::after{box-shadow:var(--ptb-mode-edge)}
.ptb-mode[aria-pressed='true']{color:var(--ptb-active)}
.ptb-mode[aria-pressed='true']::before,.ptb-mode[aria-pressed='true']::after{opacity:1}
.ptb-mode svg{position:relative;z-index:1;width:18px;height:18px;display:block}

.ptb-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

/* ---------- Responsive steps (by the bar's own width) ---------- */
@container (min-width:460px){
  .ptb-tab{padding:0 10px}
  .ptb-mode{width:36px}
}
@container (min-width:520px){
  .ptb-list{padding:0 12px}
  .ptb-tab{padding:0 12px}
}
@container (min-width:720px){
  .ptb-list{padding:0 16px;scroll-padding-inline:32px}
  .ptb-tab{flex:0 0 auto;padding:0 14px;font-size:14px;gap:6px}
  .ptb-modes{padding:0 12px 0 10px}
}
/* Browsers without container queries keep the compact base; viewport steps approximate them. */
@supports not (container-type:inline-size){
  @media (min-width:460px){.ptb-tab{padding:0 10px}.ptb-mode{width:36px}}
  @media (min-width:720px){.ptb-tab{flex:0 0 auto;padding:0 14px;font-size:14px}}
}

/* ---------- Fallbacks ---------- */
@supports not ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))){
  .ptb-root[data-theme='dark']{--ptb-surface:linear-gradient(180deg,rgba(14,20,60,0.88),rgba(6,10,38,0.92))}
  .ptb-root[data-theme='light']{--ptb-surface:linear-gradient(180deg,rgba(255,255,255,0.94),rgba(246,248,252,0.92))}
}
@media (prefers-reduced-transparency:reduce){
  .ptb-root{--ptb-blur:none}
  .ptb-root[data-theme='dark']{--ptb-surface:linear-gradient(180deg,rgba(14,20,60,0.92),rgba(6,10,38,0.94))}
  .ptb-root[data-theme='light']{--ptb-surface:linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,248,252,0.95))}
}
/* Device lite mode: no backdrop blur, denser surface. Tabs and behaviour are unchanged. */
.ptb-root[data-lite='true']{--ptb-blur:none}
.ptb-root[data-lite='true'][data-theme='dark']{--ptb-surface:linear-gradient(180deg,rgba(14,20,60,0.90),rgba(6,10,38,0.94))}
.ptb-root[data-lite='true'][data-theme='light']{--ptb-surface:linear-gradient(180deg,rgba(255,255,255,0.95),rgba(246,248,252,0.94))}

@media (prefers-reduced-motion:reduce){
  .ptb-tab,.ptb-mode,.ptb-tab::before,.ptb-tab::after,.ptb-mode::before,.ptb-mode::after{transition:none}
}
@media (forced-colors:active){
  .ptb-root{background:Canvas;box-shadow:none;border-bottom:1px solid CanvasText;-webkit-backdrop-filter:none;backdrop-filter:none}
  .ptb-list{-webkit-mask-image:none;mask-image:none}
  .ptb-tab,.ptb-mode{color:ButtonText}
  .ptb-tab[aria-selected='true']::before,.ptb-mode[aria-pressed='true']::before{background:Highlight;opacity:1}
  .ptb-tab[aria-selected='true'],.ptb-mode[aria-pressed='true'],.ptb-tab[aria-selected='true'] .ptb-count{color:HighlightText;opacity:1}
  .ptb-tab::after,.ptb-mode::after{box-shadow:none}
  .ptb-modes::before{background:CanvasText}
  .ptb-tab:focus-visible,.ptb-mode:focus-visible{outline-color:CanvasText}
}
`;

const ProfileTabsBar = memo(({
  activeTab = 'posts',
  onTabChange,
  viewMode = 'grid',
  onViewModeChange,
  isOwner = false,
  theme = 'light',
  counts = {},
}) => {
  const listRef = useRef(null);
  // Keyboard focus position only. The selected tab is always the parent's `activeTab`.
  const [focusId, setFocusId] = useState(null);

  const themeName = theme === 'dark' ? 'dark' : 'light';
  const isLite = readLiteMode();

  const visibleTabs = isOwner === true ? OWNER_TABS : VISITOR_TABS;
  // An unsupported or unavailable `activeTab` (including `saved` for a non-owner) selects nothing.
  const activeId = visibleTabs.some((tab) => tab.id === activeTab) ? activeTab : null;

  const canChangeTab = typeof onTabChange === 'function';
  const validMode = viewMode === 'grid' || viewMode === 'feed' ? viewMode : null;
  const showViewToggle =
    typeof onViewModeChange === 'function' && activeId !== null && !NO_VIEW_MODE_TABS.has(activeId);

  // Roving tabindex: always exactly one visible tab is in the tab order. A stale focus id (e.g. the
  // owner-only Saved tab disappeared) falls back to the selected tab, then to the first tab.
  const focusableId = visibleTabs.some((tab) => tab.id === focusId)
    ? focusId
    : activeId ?? visibleTabs[0].id;

  // Bring the selected tab into view when the parent changes it (e.g. a restored deep link).
  useEffect(() => {
    const list = listRef.current;
    if (!list || activeId === null) return;
    revealInList(list, list.querySelector("[role='tab'][aria-selected='true']"));
  }, [activeId]);

  const handleKeyDown = (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const list = listRef.current;
    const origin = event.target && event.target.closest ? event.target.closest("[role='tab']") : null;
    if (!list || !origin) return;

    const nodes = Array.from(list.querySelectorAll("[role='tab']:not(:disabled)"));
    const current = nodes.indexOf(origin);
    if (current < 0) return;

    let rtl = false;
    try {
      rtl = window.getComputedStyle(list).direction === 'rtl';
    } catch {
      rtl = false;
    }
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';

    let next;
    if (event.key === forward) next = (current + 1) % nodes.length;
    else if (event.key === backward) next = (current - 1 + nodes.length) % nodes.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = nodes.length - 1;
    else return;

    event.preventDefault();
    // Focus only (never selects) and without a page-level scroll jump; the strip scrolls itself.
    nodes[next].focus({ preventScroll: true });
    revealInList(list, nodes[next]);
  };

  const handleListBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocusId(null);
  };

  return (
    <div className="ptb-wrap">
      <style href="arvdoul-profile-tabs-bar" precedence="medium">{STYLES}</style>
      <div
        className="ptb-root"
        data-theme={themeName}
        data-lite={isLite ? 'true' : 'false'}
        style={GRADIENT ? { '--ptb-grad': GRADIENT } : undefined}
      >
        <div
          ref={listRef}
          role="tablist"
          aria-label="Profile sections"
          className="ptb-list"
          onKeyDown={handleKeyDown}
          onBlur={handleListBlur}
        >
          {visibleTabs.map((tab) => {
            const isActive = tab.id === activeId;
            const count = readCount(counts, tab.id);

            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={!canChangeTab}
                tabIndex={tab.id === focusableId ? 0 : -1}
                className="ptb-tab"
                onFocus={(event) => {
                  setFocusId(tab.id);
                  revealInList(listRef.current, event.currentTarget);
                }}
                onClick={() => {
                  if (canChangeTab) onTabChange(tab.id);
                }}
              >
                <span className="ptb-label">{tab.label}</span>
                {count !== null && (
                  <>
                    <span className="ptb-count" aria-hidden="true">{formatCompact(count)}</span>
                    <span className="ptb-sr">{`, ${formatFull(count)} ${count === 1 ? 'item' : 'items'}`}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {showViewToggle && (
          <div className="ptb-modes" role="group" aria-label="Profile layout">
            {VIEW_MODES.map((mode) => {
              const Icon = mode.icon;
              return (
                <button
                  key={mode.id}
                  type="button"
                  className="ptb-mode"
                  title={mode.label}
                  aria-label={mode.label}
                  aria-pressed={validMode === mode.id}
                  onClick={() => onViewModeChange(mode.id)}
                >
                  <Icon aria-hidden="true" focusable="false" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

ProfileTabsBar.displayName = 'ProfileTabsBar';

export default ProfileTabsBar;
