// src/screens/SplashScreen.jsx
// Arvdoul splash — "The orbit closes".
//
// Same architecture as before: one default export, no required props, reads AuthContext
// (authInitialized / isAuthenticated) and ThemeContext, routes with react-router
// (`/home` or `/intro`, replace, state.fromSplash) and keeps the sessionStorage flag.
//
// Artwork
//   LOGO       the supplied arvdoul-mark-transparent.svg, exactly: same three paths and
//              stroke widths, the same nine-stop gradient (#BD03F6 → #0074F8), and the same
//              "cast" and "body" filters. At rest the mark IS the master file.
//   WORDMARK   a custom drawn lettering, not a font. Monoline, heavy, round-capped and
//              round-joined, built from the same circle-and-arc language as the logo.
//              Metrics (units, cap height 100): stroke 18 · x-height 66 · ascender 100 ·
//              round letters r 24 · explicit optical spacing per pair. See WORDMARK below.
//   Surface    flat canvas only (#F6F8FC / #03071B). No background glow, aurora, spotlight,
//              vignette or grain.
//
// Motion
//   A point of light draws the orbit along the real path; the A and crossbar follow; the
//   master finish (bevel + shadow) resolves over the drawing; the wordmark is then written
//   letter by letter with the same round-capped stroke. One sheen pass, one hand-off ring,
//   then stillness. If startup is genuinely still pending after the reveal, the light keeps
//   lapping the orbit. There is never fake progress.
//
// Engineering
//   - ONE timeline (motion value `t`) drives the reveal; nothing re-renders per frame.
//   - Readiness-driven: ready early → the reveal finishes in ~160 ms. No minimum wait.
//   - Lifecycle (container) is separate from presentation (SplashView), and the view sits
//     inside an error boundary: a render failure degrades to a static lockup while startup
//     and routing continue.
//   - Filters run on a STATIC layer that is rasterised once; animated strokes are flat.
//   - Tiers: "rich" (7-dot tail + sheen) · "lite" (3-dot tail) · "static" (reduced motion).
//   - Single guarded navigation; ignored after unmount; completes when the tab is visible.
//   - Optional props (all default to the previous behaviour):
//       startup={{ state, destination, retry? }}  richer state from your bootstrap
//       getDestination({ isAuthenticated })       replaces the /home · /intro default
//       onMetrics(metrics) · onRenderError(error, info)
//
// Not verifiable from source alone: check the rendered result at real device sizes, and set
// the canvas colour in index.html before React loads to avoid a wrong-theme first paint.

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  motion,
  animate,
  cubicBezier,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";

/* ───────────────────────── Constants ───────────────────────── */

const STORAGE_KEY = "arvdoul:splash-seen";

const FONT_STACK =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

// Geometry and gradient copied from the supplied master SVG (512 × 512).
const LOGO = Object.freeze({
  viewBox: 512,
  orbit: { d: "M328.2 446.3 A197 197 0 1 1 390.3 407.1", width: 39 },
  monogram: { d: "M154 352 L226.4 192 Q256.5 119 286.6 192 L386 408", width: 47.5 },
  crossbar: { d: "M154 352 Q256 257 358 352", width: 41 },
  gradient: {
    x1: 60,
    y1: 96,
    x2: 440,
    y2: 446,
    stops: [
      [0, "#BD03F6"],
      [0.2, "#A508F9"],
      [0.3, "#9210F8"],
      [0.4, "#7A1AF8"],
      [0.5, "#5A25FA"],
      [0.6, "#3434FA"],
      [0.7, "#1048FA"],
      [0.8, "#0160FB"],
      [1, "#0074F8"],
    ],
  },
  orbitStart: { x: 328.2, y: 446.3 },
  orbitCenter: { x: 256, y: 263 },
  orbitRadius: 197,
});

// Flat surfaces only.
const PALETTE = Object.freeze({
  light: {
    bg: "#F6F8FC",
    text: "#0C1130",
    muted: "#566083",
    line: "rgba(12,17,48,0.22)",
    error: "#EF4444",
  },
  dark: {
    bg: "#03071B",
    text: "#F3F5FF",
    muted: "#9AA3CC",
    line: "rgba(243,245,255,0.28)",
    error: "#EF4444",
  },
});

/* Custom wordmark ─────────────────────────────────────────────────────────────────────────
   Design spec (all units; cap/ascender height = 100, baseline y = 100)
     stroke 18 (round caps, round joins) · centreline top of ascenders y = 9
     x-height outer top y = 34 (centreline 43) · baseline centreline y = 91
     bowls: circle r = 24 centred (33, 67) — counters stay open at small sizes
     A: the logo's own construction — rounded apex (quadratic, peak y = 9) and an arched
        crossbar that springs from the feet and peaks at y = 60, just like the monogram
     Spacing is set per pair by eye (straight↔round pairs open, diagonals tucked):
        A→r 6 · r→v 8 · v→d 4 · d→o 12 · o→u 12 · u→l 16   (outer edge to outer edge)
   Every letter is a set of centreline strokes, so the same motion that draws the logo
   writes the word. Replace with final approved outlines if the design is revised. */
const WORDMARK = Object.freeze({
  label: "Arvdoul",
  width: 496,
  height: 100,
  stroke: 18,
  letters: [
    { ch: "A", x: 0, paths: ["M9 91 L36 26 Q50 -8 64 26 L91 91", "M9 91 Q50 29 91 91"] },
    { ch: "r", x: 106, paths: ["M9 91 V43", "M9 66 Q9 43 33 43"] },
    { ch: "v", x: 156, paths: ["M9 43 L40 91 L71 43"] },
    { ch: "d", x: 240, paths: ["M9 67 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0", "M57 9 V91"] },
    { ch: "o", x: 318, paths: ["M9 67 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0"] },
    { ch: "u", x: 396, paths: ["M9 43 V67 A24 24 0 0 0 57 67", "M57 43 V91"] },
    { ch: "l", x: 478, paths: ["M9 9 V91"] },
  ],
});

// Reveal length in seconds. "quick" is a repeat launch in the same session.
const REVEAL_S = Object.freeze({ full: 1.3, quick: 0.5, reduced: 0 });
// Time to finish the reveal when the app is ready early.
const SNAP_S = 0.16;
// Shortest presence once ready, so a near-instant start never reads as a flicker.
const SETTLE_MS = Object.freeze({ full: 240, quick: 120, reduced: 0 });
const EXIT_MS = Object.freeze({ full: 320, quick: 220, reduced: 80 });
// One lap of the "still working" light around the orbit.
const WAIT_LOOP_S = 2.2;

// Status escalation while startup is genuinely unresolved.
const STATUS_DELAY_MS = 2500;
const SLOW_MS = 8000;
const STUCK_MS = 20000;

// Segments of the single reveal timeline (fractions of REVEAL_S).
const SEG = Object.freeze({
  orbit: [0, 0.42],
  monogram: [0.18, 0.54],
  crossbar: [0.42, 0.62],
  penFade: [0.4, 0.5],
  master: [0.54, 0.76],
  lift: [0.36, 0.8],
  sheen: [0.8, 1],
  letters: { start: 0.46, step: 0.04, span: 0.26 },
});

const STATES = Object.freeze({
  INITIALIZING: "INITIALIZING",
  RESOLVING_SESSION: "RESOLVING_SESSION",
  RESOLVING_DESTINATION: "RESOLVING_DESTINATION",
  READY: "READY",
  RETRYABLE_ERROR: "RETRYABLE_ERROR",
  RECOVERY_REQUIRED: "RECOVERY_REQUIRED",
});

const PENDING_STATES = new Set([
  STATES.INITIALIZING,
  STATES.RESOLVING_SESSION,
  STATES.RESOLVING_DESTINATION,
]);

// Legacy fallback so the app keeps working. Prefer passing real destination logic.
const LEGACY_DESTINATION = ({ isAuthenticated }) => (isAuthenticated ? "/home" : "/intro");

const COPY = Object.freeze({
  checking: "Checking your session…",
  preparing: "Preparing your experience…",
  offline: "You’re offline. Arvdoul will continue when you reconnect.",
  slow: "This is taking longer than usual.",
  stuck: "Arvdoul still isn’t ready. You can reload to try again.",
  retryable: "Unable to complete startup. Please try again.",
  recovery: "Arvdoul can’t start right now. Please try again in a moment.",
  retry: "Try again",
  retrying: "Trying again…",
  reload: "Reload",
});

const srOnly = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

/* ───────────────────────── Motion helpers ───────────────────────── */

const easeIO = cubicBezier(0.65, 0, 0.35, 1);
const easeOut = cubicBezier(0.16, 1, 0.3, 1);
const easeSoft = cubicBezier(0.4, 0, 0.2, 1);

/** Map the shared timeline `t` (0→1) onto one segment, with its own easing. */
function useSeg(t, range, ease = easeIO) {
  return useTransform(t, range, [0, 1], { clamp: true, ease });
}

/** 0 until a stroke has started, then 1. Round caps otherwise paint a dot at length 0. */
function useGate(progress, epsilon = 0.002) {
  return useTransform(progress, [0, epsilon], [0, 1], { clamp: true });
}

const lengthCache = new WeakMap();

/** Point at fraction `p` along a real SVG path element. Falls back to the orbit start. */
function pointOnPath(el, p) {
  if (!el || typeof el.getTotalLength !== "function" || typeof el.getPointAtLength !== "function") {
    return LOGO.orbitStart;
  }
  let length = lengthCache.get(el);
  if (!length) {
    length = el.getTotalLength();
    lengthCache.set(el, length);
  }
  const clamped = p < 0 ? 0 : p > 1 ? 1 : p;
  const point = el.getPointAtLength(clamped * length);
  return { x: point.x, y: point.y };
}

/* ───────────────────────── Hooks ───────────────────────── */

function useResolvedTheme(theme) {
  const query = "(prefers-color-scheme: dark)";
  const getSystem = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;
  const [systemDark, setSystemDark] = useState(getSystem);

  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }
    const mql = window.matchMedia(query);
    const onChange = (e) => setSystemDark(e.matches);
    setSystemDark(mql.matches);
    if (mql.addEventListener) mql.addEventListener("change", onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", onChange);
      else mql.removeListener(onChange);
    };
  }, [theme]);

  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return systemDark ? "dark" : "light";
}

/** Keeps the mobile browser chrome in the splash surface colour, then restores it. */
function useThemeColorMeta(color) {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    let meta = document.querySelector('meta[name="theme-color"]');
    let created = false;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
      created = true;
    }
    const previous = meta.getAttribute("content");
    meta.setAttribute("content", color);
    return () => {
      if (created) meta.remove();
      else if (previous === null) meta.removeAttribute("content");
      else meta.setAttribute("content", previous);
    };
  }, [color]);
}

// navigator.onLine is a hint only. It never creates an error state by itself.
function useOnlineHint() {
  const [online, setOnline] = useState(() =>
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? navigator.onLine : true
  );
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

/** "rich" adds the sheen and a longer tail; "lite" is leaner; "static" is reduced motion. */
function detectTier() {
  if (typeof navigator === "undefined") return "lite";
  const connection = navigator.connection || {};
  const memory = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  if (connection.saveData) return "lite";
  if (typeof memory === "number" && memory <= 2) return "lite";
  if (typeof cores === "number" && cores <= 3) return "lite";
  return "rich";
}

function usePerformanceTier(reducedMotion) {
  const [base] = useState(detectTier);
  return reducedMotion ? "static" : base;
}

// The flag only picks a shorter reveal. It never skips startup work or routing.
function readSplashSeen() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSplashSeen() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* storage unavailable — harmless */
  }
}

/** Reads the existing AuthContext. No second listener, no duplicated auth logic. */
function useDefaultStartup(getDestination) {
  const { authInitialized, isAuthenticated } = useAuth();
  if (!authInitialized) return { state: STATES.RESOLVING_SESSION };
  return { state: STATES.READY, destination: getDestination({ isAuthenticated }) };
}

function perfMark(name) {
  try {
    if (typeof performance !== "undefined" && performance.mark) performance.mark(`arvdoul:splash:${name}`);
  } catch {
    /* ignore */
  }
}

/* ───────────────────────── Status ───────────────────────── */
// Pure: real startup state → what the screen says and offers. No timers, no React.

const NO_STATUS = Object.freeze({ message: "", isError: false, showRetry: false, showReload: false });

function resolveStatus({ state, stage, online, exiting, canRetry }) {
  if (exiting) return NO_STATUS;

  if (state === STATES.RETRYABLE_ERROR) {
    return { message: COPY.retryable, isError: true, showRetry: canRetry, showReload: !canRetry };
  }
  if (state === STATES.RECOVERY_REQUIRED) {
    return { message: COPY.recovery, isError: true, showRetry: canRetry, showReload: true };
  }

  if (PENDING_STATES.has(state)) {
    if (stage >= 3) return { message: COPY.stuck, isError: false, showRetry: false, showReload: true };
    if (stage >= 1 && !online) return { ...NO_STATUS, message: COPY.offline };
    if (stage >= 2) return { ...NO_STATUS, message: COPY.slow };
    if (stage >= 1) {
      return {
        ...NO_STATUS,
        message: state === STATES.RESOLVING_DESTINATION ? COPY.preparing : COPY.checking,
      };
    }
  }
  return NO_STATUS;
}

/* ───────────────────────── Master logo (exact) ───────────────────────── */

function makeIds(uid) {
  return {
    brand: `av-${uid}-brand`,
    shape: `av-${uid}-shape`,
    cast: `av-${uid}-cast`,
    body: `av-${uid}-body`,
    sheen: `av-${uid}-sheen`,
    mask: `av-${uid}-mask`,
    ring: `av-${uid}-ring`,
  };
}

function BrandGradient({ id }) {
  const g = LOGO.gradient;
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
      {g.stops.map(([offset, color]) => (
        <stop key={offset} offset={offset} stopColor={color} />
      ))}
    </linearGradient>
  );
}

/** Gradient, shape and both filters, transcribed from the master file. */
function MasterDefs({ ids }) {
  return (
    <>
      <BrandGradient id={ids.brand} />

      <g id={ids.shape} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={LOGO.orbit.d} strokeWidth={LOGO.orbit.width} />
        <path d={LOGO.monogram.d} strokeWidth={LOGO.monogram.width} />
        <path d={LOGO.crossbar.d} strokeWidth={LOGO.crossbar.width} />
      </g>

      {/* cast shadow: wide bluish shadow + tight contact shadow */}
      <filter id={ids.cast} x="-15%" y="-15%" width="130%" height="135%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="9" result="b1" />
        <feOffset in="b1" dy="8" result="o1" />
        <feFlood floodColor="#3B44E0" floodOpacity="0.26" />
        <feComposite in2="o1" operator="in" result="wide" />
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.8" result="b2" />
        <feOffset in="b2" dy="2.5" result="o2" />
        <feFlood floodColor="#2A2FA0" floodOpacity="0.30" />
        <feComposite in2="o2" operator="in" result="tight" />
        <feMerge>
          <feMergeNode in="wide" />
          <feMergeNode in="tight" />
        </feMerge>
      </filter>

      {/* rounded corners (fillets) + directional bevel */}
      <filter id={ids.body} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3.8" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          result="shape"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 14 -6.5"
        />
        <feComponentTransfer in="shape" result="inv">
          <feFuncA type="table" tableValues="1 0" />
        </feComponentTransfer>

        <feGaussianBlur in="inv" stdDeviation="0.9" result="l1" />
        <feOffset in="l1" dx="1.8" dy="2.2" result="l2" />
        <feComposite in="l2" in2="shape" operator="in" result="lm" />
        <feFlood floodColor="#E9CCFF" floodOpacity="0.62" />
        <feComposite in2="lm" operator="in" result="rim" />

        <feGaussianBlur in="inv" stdDeviation="0.9" result="d1" />
        <feOffset in="d1" dx="-1.8" dy="-2.2" result="d2" />
        <feComposite in="d2" in2="shape" operator="in" result="dm" />
        <feFlood floodColor="#26107E" floodOpacity="0.62" />
        <feComposite in2="dm" operator="in" result="dark" />

        <feGaussianBlur in="inv" stdDeviation="4.5" result="s1" />
        <feOffset in="s1" dx="-3" dy="-4" result="s2" />
        <feComposite in="s2" in2="shape" operator="in" result="sm" />
        <feFlood floodColor="#1B1AA8" floodOpacity="0.22" />
        <feComposite in2="sm" operator="in" result="soft" />

        <feMerge>
          <feMergeNode in="shape" />
          <feMergeNode in="soft" />
          <feMergeNode in="dark" />
          <feMergeNode in="rim" />
        </feMerge>
      </filter>
    </>
  );
}

/** The finished logo, exactly as the master file composes it. */
function MasterFinal({ ids }) {
  return (
    <>
      <g filter={`url(#${ids.cast})`} stroke="#000">
        <use href={`#${ids.shape}`} />
      </g>
      <g filter={`url(#${ids.body})`} stroke={`url(#${ids.brand})`}>
        <use href={`#${ids.shape}`} />
      </g>
    </>
  );
}

/* ───────────────────────── Mark ───────────────────────── */
// Layers (back to front)
//   1. drawing   flat gradient strokes, pathLength-driven (cheap while animating)
//   2. master    the exact filtered logo, rasterised once, resolves over the drawing
//   3. sheen     one diagonal light pass masked to the strokes (rich + first launch)
//   4. pens      intro: draws the orbit · wait: laps it only while startup is pending

const TRAIL_COUNT = { rich: 7, lite: 3, static: 0 };
const TRAIL_LAG = 0.022;

function TrailDot({ progress, orbitRef, lag, index, count }) {
  const lagged = useTransform(progress, (v) => Math.max(0, v - lag));
  const cx = useTransform(lagged, (v) => pointOnPath(orbitRef.current, v).x);
  const cy = useTransform(lagged, (v) => pointOnPath(orbitRef.current, v).y);
  const falloff = Math.pow(1 - index / count, 1.6) * 0.8;
  const opacity = useTransform(progress, (v) => (v <= lag ? 0 : falloff));
  const radius = 9 * (1 - (index / count) * 0.72);
  return <motion.circle cx={cx} cy={cy} r={radius} fill="#ffffff" style={{ opacity }} />;
}

/** A point of light with a short tail. Position comes from the actual orbit geometry. */
function Pen({ progress, gate, orbitRef, trailCount }) {
  const cx = useTransform(progress, (v) => pointOnPath(orbitRef.current, v).x);
  const cy = useTransform(progress, (v) => pointOnPath(orbitRef.current, v).y);
  const dots = Array.from({ length: trailCount }, (_, i) => i + 1);
  return (
    <motion.g aria-hidden="true" style={{ opacity: gate }}>
      {dots.map((i) => (
        <TrailDot
          key={i}
          index={i}
          count={trailCount + 1}
          lag={i * TRAIL_LAG}
          progress={progress}
          orbitRef={orbitRef}
        />
      ))}
      <motion.circle cx={cx} cy={cy} r="9.5" fill="#ffffff" />
    </motion.g>
  );
}

function SplashMark({ t, wait, waitOn, tier, mode, ring, ringSeconds }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ids = makeIds(uid);
  const orbitRef = useRef(null);

  const animated = tier !== "static";
  const withSheen = tier === "rich" && mode === "full";
  const trailCount = TRAIL_COUNT[tier] ?? 0;

  // Drawing progress per stroke, each with its own easing on the shared timeline.
  const pOrbit = useSeg(t, SEG.orbit);
  const pMono = useSeg(t, SEG.monogram);
  const pBar = useSeg(t, SEG.crossbar);
  const gOrbit = useGate(pOrbit);
  const gMono = useGate(pMono);
  const gBar = useGate(pBar);

  // The exact logo resolves over the drawing; the flat strokes then drop away.
  const masterGate = useSeg(t, SEG.master, easeSoft);
  const drawOpacity = useTransform(masterGate, [0.5, 1], [1, 0], { clamp: true });

  // Intro pen: visible while the orbit draws, gone before the wordmark is written.
  const penGate = useTransform(t, [SEG.orbit[0], 0.015, SEG.penFade[0], SEG.penFade[1]], [0, 1, 1, 0], {
    clamp: true,
  });

  const sheenP = useSeg(t, SEG.sheen, easeIO);
  const sheenX = useTransform(sheenP, [0, 1], [-260, 640]);
  const sheenOpacity = useTransform(sheenP, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);

  // Waiting light: one lap per loop, fading at the ends of the open arc.
  const waitP = useTransform(wait, [0, 1], [0, 1], { ease: easeIO });
  const waitGate = useTransform([wait, waitOn], ([w, on]) =>
    on * Math.max(0, Math.min(1, w / 0.08, (1 - w) / 0.1))
  );

  const flat = { fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };

  return (
    <div style={{ position: "relative", width: "clamp(104px, 29vw, 168px)", aspectRatio: "1 / 1" }}>
      <svg
        viewBox={`0 0 ${LOGO.viewBox} ${LOGO.viewBox}`}
        width="100%"
        height="100%"
        aria-hidden="true"
        focusable="false"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <MasterDefs ids={ids} />
          {withSheen && (
            <>
              <linearGradient id={ids.sheen} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.55" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
              <mask id={ids.mask} maskUnits="userSpaceOnUse" x="-40" y="-40" width="592" height="592">
                <g stroke="#ffffff">
                  <use href={`#${ids.shape}`} />
                </g>
              </mask>
            </>
          )}
        </defs>

        {/* 1 · The drawing */}
        <motion.g {...flat} stroke={`url(#${ids.brand})`} style={{ opacity: drawOpacity }}>
          <motion.path
            ref={orbitRef}
            d={LOGO.orbit.d}
            strokeWidth={LOGO.orbit.width}
            style={{ pathLength: pOrbit, opacity: gOrbit }}
          />
          <motion.path
            d={LOGO.monogram.d}
            strokeWidth={LOGO.monogram.width}
            style={{ pathLength: pMono, opacity: gMono }}
          />
          <motion.path
            d={LOGO.crossbar.d}
            strokeWidth={LOGO.crossbar.width}
            style={{ pathLength: pBar, opacity: gBar }}
          />
        </motion.g>

        {/* 2 · The master logo, exactly */}
        <motion.g style={{ opacity: masterGate }}>
          <MasterFinal ids={ids} />
        </motion.g>

        {/* 3 · One sheen pass */}
        {withSheen && (
          <g mask={`url(#${ids.mask})`}>
            <motion.g style={{ x: sheenX, opacity: sheenOpacity }}>
              <rect
                x="-120"
                y="-160"
                width="120"
                height="840"
                fill={`url(#${ids.sheen})`}
                transform="rotate(18 256 256)"
              />
            </motion.g>
          </g>
        )}

        {/* 4 · Pens */}
        {animated && (
          <>
            <Pen progress={pOrbit} gate={penGate} orbitRef={orbitRef} trailCount={trailCount} />
            <Pen progress={waitP} gate={waitGate} orbitRef={orbitRef} trailCount={trailCount} />
          </>
        )}
      </svg>

      {/* Hand-off: the orbit expands once as the app takes over */}
      {ring && (
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: [0, 0.5, 0], scale: [1, 1.5, 3.8] }}
          transition={{ duration: ringSeconds, ease: "easeOut", times: [0, 0.2, 1] }}
          style={{ position: "absolute", inset: 0, pointerEvents: "none", willChange: "transform, opacity" }}
        >
          <svg
            viewBox={`0 0 ${LOGO.viewBox} ${LOGO.viewBox}`}
            width="100%"
            height="100%"
            focusable="false"
            style={{ display: "block", overflow: "visible" }}
          >
            <defs>
              <BrandGradient id={ids.ring} />
            </defs>
            <circle
              cx={LOGO.orbitCenter.x}
              cy={LOGO.orbitCenter.y}
              r={LOGO.orbitRadius}
              fill="none"
              stroke={`url(#${ids.ring})`}
              strokeWidth="4"
            />
          </svg>
        </motion.div>
      )}
    </div>
  );
}

/* ───────────────────────── Wordmark ───────────────────────── */

const WORD_ASPECT = WORDMARK.height / WORDMARK.width;

/** One letter, written with the same round-capped stroke as the logo. */
function WordLetter({ t, index, letter, color }) {
  const { start, step, span } = SEG.letters;
  const from = start + index * step;
  const p = useSeg(t, [from, from + span], easeOut);
  const gate = useGate(p);
  return (
    <g transform={`translate(${letter.x} 0)`}>
      {letter.paths.map((d) => (
        <motion.path key={d} d={d} stroke={color} style={{ pathLength: p, opacity: gate }} />
      ))}
    </g>
  );
}

function SplashWordmark({ t, color }) {
  return (
    <h1 style={{ margin: 0, lineHeight: 0, width: "1em" }}>
      <span style={srOnly}>{WORDMARK.label}</span>
      <svg
        viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}
        width="100%"
        height="auto"
        aria-hidden="true"
        focusable="false"
        style={{ display: "block", width: "100%", height: "auto", aspectRatio: `${WORDMARK.width} / ${WORDMARK.height}`, overflow: "visible" }}
      >
        <g fill="none" strokeWidth={WORDMARK.stroke} strokeLinecap="round" strokeLinejoin="round">
          {WORDMARK.letters.map((letter, i) => (
            <WordLetter key={`${letter.ch}-${i}`} t={t} index={i} letter={letter} color={color} />
          ))}
        </g>
      </svg>
    </h1>
  );
}

/* ───────────────────────── Presentation ───────────────────────── */
// Presentation only. Owns no timers, no navigation and no startup logic.

const VIEW_CSS = `
.av-splash-btn{min-height:44px;min-width:44px;padding:0 26px;border-radius:999px;border:1px solid transparent;
  font-family:inherit;font-size:.9375rem;font-weight:600;cursor:pointer;
  transition:transform .12s ease,opacity .12s ease}
.av-splash-btn:active{transform:scale(.98)}
.av-splash-btn:focus-visible{outline:2px solid #3434FA;outline-offset:3px}
.av-splash-btn:disabled{opacity:.55;cursor:default}
.av-splash-btn-primary{color:#fff;background:linear-gradient(135deg,#BD03F6,#5A25FA 55%,#3434FA)}
@media (prefers-reduced-motion:reduce){.av-splash-btn{transition:none}}
`;

function ErrorGlyph({ color }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ flex: "none", marginTop: 1 }}
    >
      <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="2" />
      <path d="M12 7v6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1.2" fill={color} />
    </svg>
  );
}

function SplashView({
  t,
  wait,
  waitOn,
  tier,
  mode,
  state,
  phase,
  colors,
  status,
  retrying,
  onRetry,
  onReload,
}) {
  const exiting = phase === "exiting";
  const reduced = mode === "reduced";
  const exitSeconds = EXIT_MS[mode] / 1000;

  // The mark starts alone at the optical centre; the lockup forms around it.
  const lift = useSeg(t, SEG.lift, easeSoft);
  const y = useTransform(lift, (v) => `${(1 - v) * 0.15}em`);

  const { message, isError, showRetry, showReload } = status;

  return (
    <main
      data-splash=""
      data-state={state}
      data-phase={phase}
      data-mode={mode}
      data-tier={tier}
      aria-busy={!exiting}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: colors.bg,
        fontFamily: FONT_STACK,
        overflow: "hidden",
        overscrollBehavior: "contain",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        paddingLeft: "env(safe-area-inset-left, 0px)",
        paddingRight: "env(safe-area-inset-right, 0px)",
        WebkitTapHighlightColor: "transparent",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        userSelect: "none",
      }}
    >
      <style>{VIEW_CSS}</style>

      {/* Identity group: never reflows when status appears. The canvas itself never fades. */}
      <div style={{ position: "relative", width: "min(84vw, 360px)", transform: "translateY(-4dvh)" }}>
        <motion.div
          initial={false}
          animate={exiting && !reduced ? { opacity: 0, scale: 1.035 } : { opacity: 1, scale: 1 }}
          transition={{ duration: exiting ? exitSeconds : 0, ease: "easeIn" }}
        >
          <motion.div
            style={{
              y: reduced ? 0 : y,
              // 1em = wordmark width ≈ clamp(150px, 46vw, 240px)
              fontSize: "clamp(150px, 46vw, 240px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "clamp(20px, 4.5dvh, 28px)",
            }}
          >
            <SplashMark
              t={t}
              wait={wait}
              waitOn={waitOn}
              tier={tier}
              mode={mode}
              ring={exiting && tier === "rich" && !reduced}
              ringSeconds={exitSeconds + 0.1}
            />
            <SplashWordmark t={t} color={colors.text} />
          </motion.div>
        </motion.div>
      </div>

      {/* Status and recovery: separate layer with reserved space, so the logo never shifts */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "calc(env(safe-area-inset-bottom, 0px) + clamp(28px, 8dvh, 72px))",
          transform: "translateX(-50%)",
          width: "min(84vw, 320px)",
          minHeight: 104,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div role="status" aria-live="polite" aria-atomic="true" style={{ minHeight: 24 }}>
          {message && (
            <motion.p
              key={message}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                margin: 0,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                fontSize: "0.9375rem",
                lineHeight: 1.45,
                color: colors.muted,
              }}
            >
              {isError && <ErrorGlyph color={colors.error} />}
              <span>{message}</span>
            </motion.p>
          )}
        </div>

        {(showRetry || showReload) && (
          <div style={{ display: "flex", gap: 12, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
            {showRetry && (
              <button
                type="button"
                className="av-splash-btn av-splash-btn-primary"
                onClick={onRetry}
                disabled={retrying}
              >
                {retrying ? COPY.retrying : COPY.retry}
              </button>
            )}
            {showReload && (
              <button
                type="button"
                className={`av-splash-btn${showRetry ? "" : " av-splash-btn-primary"}`}
                onClick={onReload}
                style={
                  showRetry ? { background: "transparent", color: colors.text, borderColor: colors.line } : undefined
                }
              >
                {COPY.reload}
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

/* ───────────────────────── Fallback and boundary ───────────────────────── */
// Last-resort presentation if the animated view throws. No framer-motion, no effects.
// The container keeps running, so the app still opens.

function StaticLockup({ colors }) {
  const ids = makeIds(`${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-s`);
  return (
    <main
      data-splash=""
      data-fallback="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        background: colors.bg,
        fontFamily: FONT_STACK,
      }}
    >
      <svg
        viewBox={`0 0 ${LOGO.viewBox} ${LOGO.viewBox}`}
        aria-hidden="true"
        focusable="false"
        style={{ width: "clamp(104px, 29vw, 168px)", height: "auto", display: "block", overflow: "visible" }}
      >
        <defs>
          <MasterDefs ids={ids} />
        </defs>
        <MasterFinal ids={ids} />
      </svg>
      <h1 style={{ margin: 0, lineHeight: 0, width: "clamp(150px, 46vw, 240px)" }}>
        <span style={srOnly}>{WORDMARK.label}</span>
        <svg
          viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}
          aria-hidden="true"
          focusable="false"
          style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}
        >
          <g fill="none" stroke={colors.text} strokeWidth={WORDMARK.stroke} strokeLinecap="round" strokeLinejoin="round">
            {WORDMARK.letters.map((letter) => (
              <g key={letter.ch + letter.x} transform={`translate(${letter.x} 0)`}>
                {letter.paths.map((d) => (
                  <path key={d} d={d} />
                ))}
              </g>
            ))}
          </g>
        </svg>
      </h1>
    </main>
  );
}

// Isolates rendering failures in the animated view. The lifecycle lives OUTSIDE this boundary.
class SplashBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    if (typeof this.props.onError === "function") {
      try {
        this.props.onError(error, info);
      } catch {
        /* reporting must never throw */
      }
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/* ───────────────────────── Container ───────────────────────── */

export default function SplashScreen({
  startup: startupProp,
  getDestination = LEGACY_DESTINATION,
  onMetrics,
  onRenderError,
}) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const resolvedTheme = useResolvedTheme(theme);
  const colors = PALETTE[resolvedTheme];
  const prefersReduced = useReducedMotion();
  const online = useOnlineHint();
  const tier = usePerformanceTier(Boolean(prefersReduced));

  const fallbackStartup = useDefaultStartup(getDestination);
  const startup = startupProp || fallbackStartup;
  const { state, destination, retry } = startup;

  // Reveal length only. The flag never skips startup work or routing.
  const [seenBefore] = useState(readSplashSeen);
  const mode = prefersReduced ? "reduced" : seenBefore ? "quick" : "full";

  const [phase, setPhase] = useState("intro"); // intro → exiting → (navigate)
  const [stage, setStage] = useState(0); // 0 quiet · 1 status · 2 slow · 3 stuck
  const [retrying, setRetrying] = useState(false);
  const [revealDone, setRevealDone] = useState(mode === "reduced");

  const exiting = phase === "exiting";
  const pending = PENDING_STATES.has(state);
  const ready = state === STATES.READY && Boolean(destination);
  const canRetry = typeof retry === "function";

  // One timeline drives the whole reveal. `wait` is the "still working" lap.
  const t = useMotionValue(mode === "reduced" ? 1 : 0);
  const wait = useMotionValue(0);
  const waitOn = useMotionValue(0);

  const mountedRef = useRef(false);
  const navigatedRef = useRef(false);
  const retryingRef = useRef(false);
  const reloadingRef = useRef(false);
  const snappedRef = useRef(false);
  const mountedAtRef = useRef(Date.now());
  const readyAtRef = useRef(null);
  const destinationRef = useRef(destination);
  const metricsRef = useRef(onMetrics);
  destinationRef.current = destination;
  metricsRef.current = onMetrics;

  useThemeColorMeta(colors.bg);

  /* ───────────── Mount / unmount ───────────── */

  useEffect(() => {
    mountedRef.current = true;
    mountedAtRef.current = Date.now();
    perfMark("mount");
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ───────────── Reveal timeline ───────────── */

  useEffect(() => {
    if (mode === "reduced") {
      t.set(1);
      return undefined;
    }
    const controls = animate(t, 1, {
      duration: REVEAL_S[mode],
      ease: "linear",
      onComplete: () => {
        if (mountedRef.current) setRevealDone(true);
      },
    });
    return () => controls.stop();
  }, [mode, t]);

  // Ready mid-reveal: finish it quickly instead of making the app wait.
  useEffect(() => {
    if (!ready) return undefined;
    if (readyAtRef.current === null) {
      readyAtRef.current = Date.now();
      perfMark("ready");
    }
    if (mode === "reduced" || t.get() >= 1) return undefined;
    snappedRef.current = true;
    const controls = animate(t, 1, {
      duration: SNAP_S,
      ease: "easeOut",
      onComplete: () => {
        if (mountedRef.current) setRevealDone(true);
      },
    });
    return () => controls.stop();
  }, [ready, mode, t]);

  /* ───────────── "Still working" light ───────────── */
  // Only while startup is genuinely unresolved, after the reveal, never during exit.

  const waiting = revealDone && pending && !exiting && tier !== "static";

  useEffect(() => {
    if (!waiting) return undefined;
    wait.set(0);
    const fadeIn = animate(waitOn, 1, { duration: 0.3 });
    const loop = animate(wait, [0, 1], {
      duration: WAIT_LOOP_S,
      ease: "linear",
      repeat: Infinity,
      repeatDelay: 0.25,
    });
    return () => {
      fadeIn.stop();
      loop.stop();
      animate(waitOn, 0, { duration: 0.18 });
    };
  }, [waiting, wait, waitOn]);

  /* ───────────── Status escalation ───────────── */

  useEffect(() => {
    setStage(0);
    if (!pending) return undefined;
    const timers = [
      setTimeout(() => setStage(1), STATUS_DELAY_MS),
      setTimeout(() => setStage(2), SLOW_MS),
      setTimeout(() => setStage(3), STUCK_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [pending, state]);

  /* ───────────── Ready → settle → exit → hand-off ───────────── */

  useEffect(() => {
    if (!ready || phase !== "intro") return undefined;
    const elapsed = Date.now() - mountedAtRef.current;
    const settle = Math.max(0, SETTLE_MS[mode] - elapsed);
    // Never cut the snap short: the mark must finish forming before we leave.
    const delay = Math.max(settle, mode === "reduced" ? 0 : SNAP_S * 1000);
    const timer = setTimeout(() => {
      perfMark("exit");
      setPhase("exiting");
    }, delay);
    return () => clearTimeout(timer);
  }, [ready, phase, mode]);

  // One guarded navigation. Ignored after unmount and after the first call.
  const handoff = useCallback(() => {
    if (navigatedRef.current || !mountedRef.current || !destinationRef.current) return;
    navigatedRef.current = true;
    perfMark("handoff");
    writeSplashSeen();
    if (typeof metricsRef.current === "function") {
      const now = Date.now();
      try {
        metricsRef.current({
          mode,
          tier,
          snapped: snappedRef.current,
          msToReady: readyAtRef.current === null ? null : readyAtRef.current - mountedAtRef.current,
          msToHandoff: now - mountedAtRef.current,
        });
      } catch {
        /* reporting must never block navigation */
      }
    }
    navigate(destinationRef.current, { replace: true, state: { fromSplash: true } });
  }, [navigate, mode, tier]);

  useEffect(() => {
    if (phase !== "exiting") return undefined;
    const timer = setTimeout(handoff, EXIT_MS[mode]);
    // Backgrounded pages throttle timers; finish as soon as the page is visible again.
    const onVisible = () => {
      if (document.visibilityState === "visible") handoff();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [phase, mode, handoff]);

  /* ───────────── Recovery actions ───────────── */

  // Retries the failed operation (not the animation). Concurrent retries are ignored.
  const onRetry = useCallback(async () => {
    if (!canRetry || retryingRef.current) return;
    retryingRef.current = true;
    setRetrying(true);
    try {
      await retry();
    } catch {
      /* the startup source reports failure through its own state */
    } finally {
      retryingRef.current = false;
      if (mountedRef.current) setRetrying(false);
    }
  }, [canRetry, retry]);

  // Manual only. Never automatic, so it cannot create a reload loop.
  const onReload = useCallback(() => {
    if (reloadingRef.current) return;
    reloadingRef.current = true;
    window.location.reload();
  }, []);

  /* ───────────── Render ───────────── */

  const status = resolveStatus({ state, stage, online, exiting, canRetry });

  return (
    <SplashBoundary onError={onRenderError} fallback={<StaticLockup colors={colors} />}>
      <SplashView
        t={t}
        wait={wait}
        waitOn={waitOn}
        tier={tier}
        mode={mode}
        state={state}
        phase={phase}
        colors={colors}
        status={status}
        retrying={retrying}
        onRetry={onRetry}
        onReload={onReload}
      />
    </SplashBoundary>
  );
}
