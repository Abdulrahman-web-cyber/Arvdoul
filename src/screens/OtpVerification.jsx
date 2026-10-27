// src/screens/OtpVerification.jsx

import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@context/AuthContext.jsx";
import { useTheme } from "@context/ThemeContext.jsx";
import { markOnboardingRequired } from "../utils/profileCompletion.js";

const DIGIT_COUNT = 6;
const INITIAL_COUNTDOWN = 120;
const AUTO_SUBMIT_DELAY = 200;
const RESEND_COOLDOWN = 60;
const MAX_FAILED_ATTEMPTS_BEFORE_RESET = 3;
const SHAKE_DURATION = 500;

const ERROR_MAP = {
  "auth/invalid-verification-code": {
    title: "That code doesn't look right",
    subtitle: "Double‑check the digits and try again, or request a new code.",
    severity: "soft",
  },
  "auth/code-expired": { title: "Code expired", subtitle: "No worries – request a fresh one below.", severity: "neutral" },
  "auth/invalid-verification-id": { title: "Session timed out", subtitle: "Please request a new code to continue.", severity: "neutral" },
  "auth/too-many-requests": { title: "Too many attempts", subtitle: "Please wait a moment before trying again.", severity: "firm" },
  "auth/credential-already-in-use": { title: "Number already linked", subtitle: "This phone is connected to another account.", severity: "firm" },
  "auth/network-request-failed": { title: "Connection issue", subtitle: "Please check your internet and try again.", severity: "neutral" },
  "auth/session-expired": { title: "Session expired", subtitle: "Request a new code to continue.", severity: "neutral" },
  default: { title: "Verification failed", subtitle: "Please try again or request a new code.", severity: "soft" },
};

const isLowPerformance = () => {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency;
  const memory = navigator.deviceMemory;
  return (cores && cores <= 4) || (memory && memory < 4);
};

const useReducedMotion = () => {
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReduced(mq.matches);
    const handler = (e) => setPrefersReduced(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
    } else {
      mq.addListener(handler);
    }
    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener("change", handler);
      } else {
        mq.removeListener(handler);
      }
    };
  }, []);
  return prefersReduced;
};

const triggerHaptic = (pattern = "light") => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    const patterns = { light: [10], medium: [15, 30, 15], heavy: [20, 50, 20, 50, 20], success: [30, 50, 30, 50, 60], error: [30, 100, 30], tick: [8] };
    navigator.vibrate(patterns[pattern] || patterns.light);
  }
};

/* ────────────────────────────────────────────────────────────────────────────
 * Design system (shared with Signup Step 1 / Step 2 and Login)
 * ──────────────────────────────────────────────────────────────────────────── */

const GRADIENT =
  "linear-gradient(125deg, #8B1EF3 0%, #4431F7 52%, #055BFB 100%)";

const STEPS = [
  { number: 1, label: "Personal" },
  { number: 2, label: "Verify" },
  { number: 3, label: "Complete" },
];

const THEMES = {
  dark: {
    colorScheme: "dark",
    "--bg": "#03071B",
    "--text": "#F3F5FF",
    "--text-2": "#B4BEDF",
    "--text-3": "#8490B8",
    "--accent-text": "#B8AAFF",

    "--card-bg":
      "linear-gradient(145deg, rgba(18,27,70,0.48), rgba(7,12,40,0.25) 48%, rgba(13,23,62,0.36))",
    "--card-border": "rgba(174,185,255,0.20)",
    "--card-shadow":
      "0 36px 90px -32px rgba(0,0,0,0.72), 0 14px 36px -20px rgba(65,49,247,0.32)",
    "--card-inset":
      "inset 0 1px 0 rgba(255,255,255,0.15), inset 0 0 0 1px rgba(255,255,255,0.025)",

    "--field-bg": "rgba(13,22,59,0.30)",
    "--field-bg-focus": "rgba(20,29,78,0.48)",
    "--field-bg-solid": "#0A1030",
    "--field-border": "rgba(162,176,255,0.22)",
    "--field-border-hover": "rgba(174,169,255,0.48)",
    "--field-focus": "#9B8BFF",
    "--field-ring": "rgba(117,99,255,0.23)",
    "--sel-glow": "rgba(120,90,255,0.22)",

    "--danger": "#FF879B",
    "--danger-ring": "rgba(255,90,120,0.18)",
    "--success": "#49E3AC",
    "--warn": "#FFC46B",

    "--pop-bg": "rgba(9,15,43,0.96)",
    "--pop-border": "rgba(162,176,255,0.24)",
    "--pop-shadow": "0 24px 60px -12px rgba(0,0,0,0.72)",
    "--pop-active": "rgba(124,108,255,0.17)",
    "--pop-selected": "rgba(124,108,255,0.26)",

    "--line": "rgba(165,178,255,0.23)",
    "--dot": "rgba(165,178,255,0.11)",
    "--glow-a": "rgba(139,30,243,0.15)",
    "--glow-b": "rgba(5,91,251,0.13)",
    "--glow-c": "rgba(68,49,247,0.07)",

    "--btn-off-bg": "rgba(255,255,255,0.065)",
    "--btn-off-text": "rgba(200,208,245,0.43)",
    "--btn-shadow":
      "0 12px 28px -12px rgba(68,49,247,0.55), inset 0 1px 0 rgba(255,255,255,0.28)",

    "--focus-outline": "#A99BFF",
    "--rim-1": "rgba(196,186,255,0.65)",
    "--rim-2": "rgba(70,140,255,0.48)",
    "--spec": "rgba(255,255,255,0.10)",
    "--field-inset":
      "inset 0 1px 0 rgba(255,255,255,0.075), inset 0 -8px 18px -14px rgba(0,0,0,0.55)",
  },

  light: {
    colorScheme: "light",
    "--bg": "#F6F8FC",
    "--text": "#101735",
    "--text-2": "#4D587B",
    "--text-3": "#7783A5",
    "--accent-text": "#4431F7",

    "--card-bg":
      "linear-gradient(145deg, rgba(255,255,255,0.60), rgba(255,255,255,0.30) 48%, rgba(237,242,255,0.35))",
    "--card-border": "rgba(80,91,177,0.18)",
    "--card-shadow":
      "0 36px 82px -34px rgba(48,56,140,0.27), 0 14px 34px -20px rgba(68,49,247,0.20)",
    "--card-inset":
      "inset 0 1px 0 rgba(255,255,255,0.94), inset 0 0 0 1px rgba(255,255,255,0.24)",

    "--field-bg": "rgba(255,255,255,0.32)",
    "--field-bg-focus": "rgba(255,255,255,0.65)",
    "--field-bg-solid": "#FFFFFF",
    "--field-border": "rgba(61,76,147,0.18)",
    "--field-border-hover": "rgba(68,49,247,0.38)",
    "--field-focus": "#4431F7",
    "--field-ring": "rgba(68,49,247,0.15)",
    "--sel-glow": "rgba(68,49,247,0.12)",

    "--danger": "#D42A49",
    "--danger-ring": "rgba(212,42,73,0.13)",
    "--success": "#0E9468",
    "--warn": "#B45309",

    "--pop-bg": "rgba(250,251,255,0.98)",
    "--pop-border": "rgba(68,49,247,0.17)",
    "--pop-shadow": "0 24px 56px -14px rgba(40,50,130,0.30)",
    "--pop-active": "rgba(68,49,247,0.075)",
    "--pop-selected": "rgba(68,49,247,0.13)",

    "--line": "rgba(61,76,147,0.18)",
    "--dot": "rgba(68,49,247,0.10)",
    "--glow-a": "rgba(139,30,243,0.07)",
    "--glow-b": "rgba(5,91,251,0.07)",
    "--glow-c": "rgba(68,49,247,0.035)",

    "--btn-off-bg": "rgba(40,60,140,0.065)",
    "--btn-off-text": "rgba(71,82,122,0.52)",
    "--btn-shadow":
      "0 12px 26px -12px rgba(68,49,247,0.36), inset 0 1px 0 rgba(255,255,255,0.28)",

    "--focus-outline": "#4431F7",
    "--rim-1": "rgba(139,30,243,0.34)",
    "--rim-2": "rgba(5,91,251,0.30)",
    "--spec": "rgba(255,255,255,0.67)",
    "--field-inset":
      "inset 0 1px 0 rgba(255,255,255,0.72), inset 0 -8px 18px -14px rgba(40,60,140,0.15)",
  },
};

const STYLES = `
.av2-root {
  position:relative;min-height:100vh;min-height:100dvh;overflow-x:clip;
  background:var(--bg);color:var(--text);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  transition:background .3s ease,color .3s ease;
}
.av2-root *,.av2-root *::before,.av2-root *::after {box-sizing:border-box}
.av2-bg {position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.av2-orb {position:absolute;border-radius:50%}
.av2-orb-a {width:75vmax;height:75vmax;top:-43vmax;left:-34vmax;background:radial-gradient(circle,var(--glow-a),transparent 65%)}
.av2-orb-b {width:78vmax;height:78vmax;right:-42vmax;bottom:-46vmax;background:radial-gradient(circle,var(--glow-b),transparent 66%)}
.av2-orb-c {width:48vmax;height:48vmax;top:28%;left:30%;background:radial-gradient(circle,var(--glow-c),transparent 66%)}
.av2-dots {
  position:absolute;inset:0;
  background-image:radial-gradient(var(--dot) .8px,transparent 1px);background-size:28px 28px;
  -webkit-mask-image:radial-gradient(ellipse at 50% 30%,#000,transparent 76%);
  mask-image:radial-gradient(ellipse at 50% 30%,#000,transparent 76%);
}
.av2-shell {
  position:relative;z-index:1;display:flex;flex-direction:column;min-height:100vh;min-height:100dvh;
  padding:max(18px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right))
    max(22px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));
}
.av2-wrap {width:100%;max-width:540px;margin:auto}

/* Offline banner */
.av2-offline {
  position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:center;gap:9px;
  padding:max(10px,env(safe-area-inset-top)) 16px 10px;text-align:center;
  border-bottom:1px solid color-mix(in srgb,var(--warn) 42%,transparent);
  background:color-mix(in srgb,var(--warn) 14%,var(--bg));color:var(--warn);
  font-size:12.5px;font-weight:700;line-height:1.4;overflow:hidden;
}
.av2-offline svg {flex:none}

/* Progress */
.av2-steps {display:flex;align-items:flex-start;justify-content:center;width:100%;max-width:380px;margin:0 auto 24px;padding:0;list-style:none}
.av2-step {display:flex;flex-direction:column;align-items:center;gap:9px;min-width:68px}
.av2-dot {
  display:grid;place-items:center;width:46px;height:46px;border-radius:50%;
  border:1px solid var(--card-border);background:var(--card-bg);color:var(--text-3);
  font-size:15px;font-weight:750;
  -webkit-backdrop-filter:blur(18px) saturate(150%);backdrop-filter:blur(18px) saturate(150%);
  box-shadow:var(--card-inset);transition:background .3s,color .3s,border-color .3s,box-shadow .3s;
}
.av2-dot[data-state="active"] {
  color:#fff;border-color:rgba(255,255,255,.25);background:${GRADIENT};
  box-shadow:0 0 0 4px var(--field-ring),0 9px 22px -10px rgba(68,49,247,.72),inset 0 1px 0 rgba(255,255,255,.42);
}
.av2-dot[data-state="done"] {background:${GRADIENT};color:#fff;border-color:transparent}
.av2-step-label {font-size:12.5px;font-weight:650;letter-spacing:.01em;color:var(--text-3)}
.av2-step-label[data-state="active"] {color:var(--accent-text)}
.av2-line {position:relative;flex:1;height:2px;min-width:16px;margin-top:22px;overflow:hidden;border-radius:5px;background:var(--line)}
.av2-line>span {display:block;width:0;height:100%;background:${GRADIENT};transition:width .35s}
.av2-line[data-done="true"]>span {width:100%}

/* Card */
.av2-card {
  position:relative;isolation:isolate;padding:28px 23px 23px;
  border:1px solid var(--card-border);border-radius:28px;background:var(--card-bg);
  box-shadow:var(--card-shadow),var(--card-inset);
  -webkit-backdrop-filter:blur(34px) saturate(175%);backdrop-filter:blur(34px) saturate(175%);
  transition:background .3s,border-color .3s;
}
.av2-card::before {
  content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;pointer-events:none;
  background:linear-gradient(142deg,rgba(255,255,255,.10),transparent 34%,transparent 74%,rgba(100,130,255,.045));
}
.av2-rim {
  position:absolute;inset:0;padding:1px;border-radius:inherit;pointer-events:none;
  background:linear-gradient(145deg,var(--rim-1),transparent 30%,transparent 69%,var(--rim-2));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;mask-composite:exclude;
}
.av2-spec {position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:-1;background:radial-gradient(105% 42% at 12% 0%,var(--spec),transparent 63%)}
.av2-card>.av2-content,.av2-card>.av2-success {position:relative;z-index:1}
.av2-head {text-align:center}
.av2-h1 {margin:0;font-size:clamp(23px,5vw,28px);line-height:1.17;font-weight:800;letter-spacing:-.035em}
.av2-sub {margin:9px 0 0;color:var(--text-2);font-size:13.5px;line-height:1.55}

/* Header mark */
.av2-mark {
  position:relative;display:grid;place-items:center;width:60px;height:60px;margin:0 auto 18px;border-radius:20px;
  background:${GRADIENT};color:#fff;border:1px solid rgba(255,255,255,.22);
  box-shadow:var(--btn-shadow),0 0 0 6px var(--field-ring);transition:background .3s,box-shadow .3s;
}
.av2-mark[data-state="warn"] {background:var(--warn);box-shadow:0 12px 26px -12px var(--warn),0 0 0 6px color-mix(in srgb,var(--warn) 20%,transparent)}
.av2-mark::after {
  content:"";position:absolute;inset:-6px;border-radius:25px;border:2px solid var(--field-focus);opacity:0;pointer-events:none;
}
.av2-mark[data-busy="true"]::after {animation:av2-pulse 1.4s ease-out infinite}
.av2-phone-chip {
  display:inline-flex;align-items:center;gap:8px;max-width:100%;margin-top:14px;padding:9px 15px;
  border:1px solid var(--field-border);border-radius:999px;background:var(--field-bg);box-shadow:var(--field-inset);
  color:var(--text);font-size:14.5px;font-weight:750;letter-spacing:.01em;font-variant-numeric:tabular-nums;
  -webkit-backdrop-filter:blur(16px) saturate(145%);backdrop-filter:blur(16px) saturate(145%);
}
.av2-phone-chip svg {flex:none;color:var(--accent-text)}
.av2-phone-chip span {min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* OTP digits */
.av2-otp {display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:clamp(6px,2.2vw,12px);margin-top:26px}
.av2-cell {position:relative;min-width:0}
.av2-cell::after {
  content:"";position:absolute;left:10px;right:10px;bottom:-1px;height:2px;border-radius:2px;
  background:${GRADIENT};transform:scaleX(0);transform-origin:left center;
  transition:transform .32s cubic-bezier(.22,1,.36,1);pointer-events:none;
}
.av2-cell:focus-within::after {transform:scaleX(1)}
.av2-cell[data-invalid="true"]::after {background:var(--danger);transform:scaleX(1)}
.av2-digit {
  display:block;width:100%;height:clamp(54px,15vw,66px);padding:0;border:1px solid var(--field-border);border-radius:12px;
  background:var(--field-bg);color:var(--text);box-shadow:var(--field-inset);
  font:inherit;font-size:clamp(22px,6.4vw,30px);font-weight:750;text-align:center;font-variant-numeric:tabular-nums;
  caret-color:var(--field-focus);outline:0;appearance:none;-webkit-appearance:none;
  -webkit-backdrop-filter:blur(16px) saturate(145%);backdrop-filter:blur(16px) saturate(145%);
  transition:border-color .22s,background .22s,box-shadow .22s;
}
.av2-digit:hover:not(:disabled) {border-color:var(--field-border-hover)}
.av2-digit[data-filled="true"] {border-color:color-mix(in srgb,var(--field-focus) 60%,transparent);background:var(--field-bg-focus)}
.av2-digit:focus {border-color:var(--field-focus);background:var(--field-bg-focus);box-shadow:var(--field-inset),0 0 0 3px var(--field-ring)}
.av2-digit[data-invalid="true"] {border-color:var(--danger);color:var(--danger);box-shadow:var(--field-inset),0 0 0 3px var(--danger-ring)}
.av2-digit:disabled {opacity:.55;cursor:not-allowed}
.av2-digit::selection {background:var(--pop-selected)}

/* Alert */
.av2-alert {
  display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:14px;
  border:1px solid color-mix(in srgb,var(--danger) 38%,transparent);background:color-mix(in srgb,var(--danger) 9%,transparent);
  color:var(--danger);font-size:12.5px;font-weight:650;line-height:1.5;
}
.av2-alert[data-severity="neutral"],.av2-alert[data-severity="soft"] {
  border-color:color-mix(in srgb,var(--warn) 42%,transparent);background:color-mix(in srgb,var(--warn) 10%,transparent);color:var(--warn);
}
.av2-alert svg {flex:none;margin-top:1px}
.av2-alert-title {display:block;font-weight:750}
.av2-alert-sub {display:block;margin-top:2px;font-size:12px;font-weight:550;opacity:.92}
.av2-alert-wrap {margin-top:18px;overflow:hidden}

/* Resend strip */
.av2-resend {
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:20px;padding:12px 14px;
  border:1px solid var(--field-border);border-radius:14px;background:var(--field-bg);box-shadow:var(--field-inset);
}
.av2-resend-text {display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 150px}
.av2-resend-title {font-size:13px;font-weight:750}
.av2-resend-sub {color:var(--text-3);font-size:11.5px;line-height:1.4}
.av2-resend-act {display:flex;align-items:center;flex:none}
.av2-ring {position:relative;display:inline-grid;place-items:center}
.av2-ring svg {transform:rotate(-90deg)}
.av2-ring-time {position:absolute;inset:0;display:grid;place-items:center;color:var(--accent-text);font-size:11px;font-weight:800;font-variant-numeric:tabular-nums}
.av2-pill {
  display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:0 15px;
  border:1px solid var(--field-border);border-radius:12px;background:var(--pop-active);color:var(--accent-text);
  font:inherit;font-size:13px;font-weight:800;cursor:pointer;-webkit-tap-highlight-color:transparent;
  transition:border-color .2s,background .2s,transform .2s;
}
.av2-pill:hover:not(:disabled) {border-color:var(--field-border-hover);background:var(--pop-selected)}
.av2-pill:active:not(:disabled) {transform:scale(.97)}
.av2-pill:disabled {opacity:.55;cursor:not-allowed;color:var(--text-3)}

/* Actions */
.av2-btn {
  position:relative;isolation:isolate;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:11px;
  width:100%;min-height:56px;margin-top:20px;padding:0 20px;border:1px solid rgba(255,255,255,.18);border-radius:17px;
  background:${GRADIENT};color:#fff;box-shadow:var(--btn-shadow);font:inherit;font-size:15.5px;font-weight:800;letter-spacing:.005em;
  cursor:pointer;-webkit-tap-highlight-color:transparent;transition:transform .2s,filter .2s,box-shadow .2s;
}
.av2-btn:hover:not(:disabled) {filter:brightness(1.06);transform:translateY(-1px)}
.av2-btn::after {
  content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;
  background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.24) 50%,transparent 70%);transform:translateX(-120%);
}
.av2-btn:hover:not(:disabled)::after {animation:av2-shine .85s ease}
.av2-btn:disabled {
  border-color:var(--field-border);background:var(--btn-off-bg);color:var(--btn-off-text);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08);cursor:not-allowed;
}
.av2-btn:disabled::after {display:none}
.av2-btn[data-loading="true"] {background:${GRADIENT};color:#fff;cursor:progress;box-shadow:var(--btn-shadow);border-color:rgba(255,255,255,.18)}
.av2-back-wrap {margin-top:22px;padding-top:18px;border-top:1px solid var(--line)}
.av2-back {
  display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:48px;padding:0 16px;
  border:1px solid var(--field-border);border-radius:14px;background:var(--field-bg);color:var(--accent-text);
  font:inherit;font-size:13.5px;font-weight:750;cursor:pointer;-webkit-tap-highlight-color:transparent;
  transition:border-color .2s,background .2s;
}
.av2-back:hover:not(:disabled) {border-color:var(--field-border-hover);background:var(--field-bg-focus)}
.av2-back:disabled {opacity:.5;cursor:not-allowed}
.av2-foot {margin:17px 0 0;text-align:center;color:var(--text-3);font-size:12px}
.av2-spin {animation:av2-spin .8s linear infinite;transform-origin:center}

/* Success + loading */
.av2-success {display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:320px;text-align:center}
.av2-success-mark {
  display:grid;place-items:center;width:88px;height:88px;margin-bottom:6px;border-radius:50%;color:#fff;
  background:linear-gradient(135deg,var(--success),color-mix(in srgb,var(--success) 60%,#055BFB));
  box-shadow:0 0 0 8px color-mix(in srgb,var(--success) 16%,transparent),0 20px 36px -14px color-mix(in srgb,var(--success) 70%,transparent);
}
.av2-success-title {margin:0;color:var(--success);font-size:22px;font-weight:800;letter-spacing:-.025em}
.av2-success-sub {margin:0;color:var(--text-2);font-size:13.5px}
.av2-loading {display:flex;flex-direction:column;align-items:center;gap:14px;color:var(--text-2);font-size:14px}

.av2-root button:focus-visible,.av2-root input:focus-visible {outline:2px solid var(--focus-outline);outline-offset:3px}
.av2-root .av2-digit:focus-visible {outline:none}

@keyframes av2-spin {to{transform:rotate(360deg)}}
@keyframes av2-shine {to{transform:translateX(120%)}}
@keyframes av2-pulse {0%{transform:scale(.94);opacity:.7}100%{transform:scale(1.18);opacity:0}}

@media(min-width:520px) {.av2-card {padding:33px 32px 26px}}
@media(max-width:390px) {
  .av2-shell {padding-left:13px;padding-right:13px}
  .av2-card {padding:24px 15px 20px;border-radius:24px}
  .av2-steps {margin-bottom:20px}
  .av2-step {min-width:60px;gap:8px}
  .av2-dot {width:42px;height:42px}
  .av2-line {margin-top:20px;min-width:12px}
  .av2-step-label {font-size:11.5px}
  .av2-mark {width:54px;height:54px;border-radius:18px;margin-bottom:16px}
  .av2-otp {margin-top:22px}
}
@media(max-width:340px) {
  .av2-resend {flex-direction:column;align-items:flex-start}
  .av2-phone-chip {font-size:13.5px;padding:8px 12px}
}
@media(max-height:560px) and (orientation:landscape) {
  .av2-steps {display:none}
  .av2-mark {display:none}
  .av2-success {min-height:240px}
}
.av2-root[data-lowperf="true"] .av2-card,
.av2-root[data-lowperf="true"] .av2-digit,
.av2-root[data-lowperf="true"] .av2-phone-chip,
.av2-root[data-lowperf="true"] .av2-dot {-webkit-backdrop-filter:none;backdrop-filter:none}
.av2-root[data-lowperf="true"] .av2-card {background:var(--field-bg-solid)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))) {
  .av2-card {background:var(--field-bg-solid)}
  .av2-digit,.av2-phone-chip {background:var(--field-bg-solid)}
}
@media(forced-colors:active) {
  .av2-card,.av2-digit,.av2-resend,.av2-phone-chip {border:1px solid CanvasText}
}
@media(prefers-reduced-motion:reduce) {
  .av2-root *,.av2-root *::before,.av2-root *::after {animation:none!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
}
`;

/* ────────────────────────────────────────────────────────────────────────────
 * Icons
 * ──────────────────────────────────────────────────────────────────────────── */

const Svg = ({ size = 20, stroke = 1.9, children, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...rest}
  >
    {children}
  </svg>
);

const PhoneIcon = (p) => (
  <Svg {...p}>
    <path d="M5 4h3.3a1 1 0 0 1 .95.68l1.5 4.5a1 1 0 0 1-.5 1.2l-2.26 1.13a11 11 0 0 0 5.52 5.52l1.13-2.26a1 1 0 0 1 1.2-.5l4.5 1.5a1 1 0 0 1 .68.95V19a2 2 0 0 1-2 2h-1C9.72 21 3 14.28 3 6V5a1 1 0 0 1 1-1z" />
  </Svg>
);
const ShieldCheckIcon = (p) => (
  <Svg {...p}>
    <path d="M12 3 4.5 6v5.5c0 4.4 3.1 8 7.5 9.5 4.4-1.5 7.5-5.1 7.5-9.5V6L12 3z" />
    <path d="m8.8 12.2 2.3 2.3 4.2-4.4" />
  </Svg>
);
const CheckIcon = (p) => (
  <Svg {...p}>
    <path d="m5 12.5 4.6 4.6L19 7.6" />
  </Svg>
);
const AlertIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.8v5M12 16.4h.01" />
  </Svg>
);
const SendIcon = (p) => (
  <Svg {...p}>
    <path d="M21 3 10.5 13.5" />
    <path d="M21 3 14.5 21l-4-7.5L3 9.5 21 3z" />
  </Svg>
);
const ArrowLeftIcon = (p) => (
  <Svg {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Svg>
);
const SpinnerIcon = (p) => (
  <Svg {...p} className="av2-spin">
    <circle cx="12" cy="12" r="9" opacity=".25" />
    <path d="M21 12a9 9 0 0 0-9-9" />
  </Svg>
);

/* ────────────────────────────────────────────────────────────────────────────
 * Components
 * ──────────────────────────────────────────────────────────────────────────── */

const StepIndicator = React.memo(function StepIndicator({ currentStep }) {
  return (
    <nav aria-label="Sign up progress">
      <ol className="av2-steps">
        {STEPS.map((step, index) => {
          const state =
            step.number === currentStep
              ? "active"
              : step.number < currentStep
                ? "done"
                : "todo";

          return (
            <React.Fragment key={step.number}>
              <li className="av2-step" aria-current={state === "active" ? "step" : undefined}>
                <span className="av2-dot" data-state={state}>
                  {state === "done" ? <CheckIcon size={20} stroke={2.5} /> : step.number}
                </span>
                <span className="av2-step-label" data-state={state}>
                  {step.label}
                  <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                    {state === "active" ? " (current step)" : state === "done" ? " (completed)" : ""}
                  </span>
                </span>
              </li>

              {index < STEPS.length - 1 && (
                <li className="av2-line" data-done={step.number < currentStep} aria-hidden="true">
                  <span />
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
});

const OTPDigit = forwardRef(
  ({ digit, index, disabled, hasError, isVerifying, onChange, onKeyDown, onPaste, autoFocus, ariaLabel, describedBy }, ref) => {
    const inputRef = useRef(null);

    useEffect(() => {
      if (ref) {
        if (typeof ref === "function") ref(inputRef.current);
        else ref.current = inputRef.current;
      }
    }, [ref]);

    useEffect(() => {
      if (autoFocus && inputRef.current && !disabled) {
        inputRef.current.focus();
      }
    }, [autoFocus, disabled]);

    return (
      <div className="av2-cell" data-invalid={hasError}>
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={index === 0 ? DIGIT_COUNT : 1}
          value={digit}
          onChange={(e) => {
            onChange(index, e.target.value);
            if (e.target.value && /^\d$/.test(e.target.value)) triggerHaptic("tick");
          }}
          onKeyDown={(e) => onKeyDown(index, e)}
          onFocus={(e) => e.target.select()}
          onPaste={onPaste}
          disabled={disabled || isVerifying}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoCorrect="off"
          spellCheck={false}
          aria-label={ariaLabel || `Digit ${index + 1}`}
          aria-invalid={hasError}
          aria-describedby={hasError ? describedBy : undefined}
          className="av2-digit"
          data-filled={!!digit}
          data-invalid={hasError}
        />
      </div>
    );
  }
);
OTPDigit.displayName = "OTPDigit";

const CircularProgressRing = React.memo(({ progress, size = 48, strokeWidth = 4, children, reducedMotion }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <div className="av2-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="av2-ring-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8B1EF3" />
            <stop offset="55%" stopColor="#4431F7" />
            <stop offset="100%" stopColor="#055BFB" />
          </linearGradient>
        </defs>
        <circle stroke="var(--line)" strokeWidth={strokeWidth} fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
        <motion.circle
          stroke="url(#av2-ring-gradient)"
          strokeWidth={strokeWidth}
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          animate={!reducedMotion ? { strokeDashoffset: offset } : {}}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.8, ease: "easeInOut" }}
        />
      </svg>
      <div className="av2-ring-time">{children}</div>
    </div>
  );
});
CircularProgressRing.displayName = "CircularProgressRing";

const SuccessState = React.memo(({ reducedMotion }) => (
  <motion.div
    className="av2-success"
    role="status"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.25 }}
  >
    <motion.div
      className="av2-success-mark"
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 18, delay: 0.05 }}
    >
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
        <motion.path
          d="m5 12.5 4.6 4.6L19 7.6"
          initial={{ pathLength: reducedMotion ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.45, delay: 0.3, ease: "easeOut" }}
        />
      </svg>
    </motion.div>
    <motion.h2
      className="av2-success-title"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reducedMotion ? 0 : 0.45, duration: 0.3 }}
    >
      Verified Successfully
    </motion.h2>
    <motion.p
      className="av2-success-sub"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: reducedMotion ? 0 : 0.6, duration: 0.3 }}
    >
      Taking you in...
    </motion.p>
  </motion.div>
));
SuccessState.displayName = "SuccessState";

/* ────────────────────────────────────────────────────────────────────────────
 * Screen
 * ──────────────────────────────────────────────────────────────────────────── */

export default function OTPVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const lowPerf = isLowPerformance();

  const [otp, setOtp] = useState(Array(DIGIT_COUNT).fill(""));
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationId, setVerificationId] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [step1Data, setStep1Data] = useState(null);
  const [countdown, setCountdown] = useState(INITIAL_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const [error, setError] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [shakeInputs, setShakeInputs] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isOffline, setIsOffline] = useState(typeof navigator !== "undefined" ? !navigator.onLine : false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const inputRefs = useRef([]);
  const countdownInterval = useRef(null);
  const resendCooldownInterval = useRef(null);
  const autoSubmitTimerRef = useRef(null);
  const submitLock = useRef(false);
  const verificationLoaded = useRef(false);
  const lastAttemptTime = useRef(0);
  const isMounted = useRef(true);

  const resolvedTheme =
    theme === "system"
      ? typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  useEffect(() => {
    const draft = sessionStorage.getItem("otp_draft");
    if (draft && draft.length === DIGIT_COUNT && !otp.some(d => d)) {
      const draftArr = draft.split("");
      setOtp(draftArr);
      draftArr.forEach((d, idx) => {
        if (d && idx < DIGIT_COUNT - 1) setTimeout(() => inputRefs.current[idx + 1]?.focus(), 0);
      });
    }
  }, []);
  useEffect(() => {
    sessionStorage.setItem("otp_draft", otp.join(""));
  }, [otp]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (verificationLoaded.current) return;

    const loadData = () => {
      try {
        const state = location.state || {};
        let data = null;

        if (state.verificationId && state.phoneNumber) {
          data = {
            verificationId: state.verificationId,
            phoneNumber: state.phoneNumber,
            isSignup: state.isSignup ?? false,
            step1Data: state.step1Data || {},
          };
        } else {
          const sess = sessionStorage.getItem("phone_verification");
          if (sess) {
            const parsed = JSON.parse(sess);
            if (parsed.verificationId && parsed.phoneNumber) {
              data = {
                verificationId: parsed.verificationId,
                phoneNumber: parsed.phoneNumber,
                isSignup: parsed.isSignup ?? false,
                step1Data: parsed.step1Data || {},
              };
            }
          }
          if (!data) {
            const local = localStorage.getItem("phone_verification");
            if (local) {
              const parsed = JSON.parse(local);
              if (parsed.verificationId && parsed.phoneNumber) {
                data = {
                  verificationId: parsed.verificationId,
                  phoneNumber: parsed.phoneNumber,
                  isSignup: parsed.isSignup ?? false,
                  step1Data: parsed.step1Data || {},
                };
              }
            }
          }
        }

        if (data) {
          setVerificationId(data.verificationId);
          setPhoneNumber(data.phoneNumber);
          setIsSignup(data.isSignup);
          setStep1Data(data.step1Data || {});
          verificationLoaded.current = true;
          setDataLoaded(true);
        } else {
          toast.error("Verification session expired. Please start over.");
          setTimeout(() => navigate("/signup/step2", { replace: true }), 2000);
        }
      } catch (err) {
        console.error("Failed to load verification data:", err);
        toast.error("Session error. Please start over.");
        setTimeout(() => navigate("/signup/step2", { replace: true }), 2000);
      }
    };

    loadData();
    return () => { isMounted.current = false; };
  }, [location, navigate]);

  useEffect(() => {
    if (countdown > 0 && !canResend) {
      countdownInterval.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval.current);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdownInterval.current);
  }, [countdown, canResend]);

  useEffect(() => {
    const code = otp.join("");
    if (code.length === DIGIT_COUNT && !loading && !isVerifying && dataLoaded && !showSuccess && !submitLock.current) {
      autoSubmitTimerRef.current = setTimeout(() => {
        if (isMounted.current && !submitLock.current) {
          submitLock.current = true;
          handleVerify(code);
        }
      }, AUTO_SUBMIT_DELAY);
    } else {
      if (autoSubmitTimerRef.current) {
        clearTimeout(autoSubmitTimerRef.current);
        autoSubmitTimerRef.current = null;
      }
    }
    return () => {
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    };
  }, [otp, loading, isVerifying, dataLoaded, showSuccess]);

  useEffect(() => {
    return () => {
      clearInterval(countdownInterval.current);
      clearInterval(resendCooldownInterval.current);
      if (autoSubmitTimerRef.current) clearTimeout(autoSubmitTimerRef.current);
    };
  }, []);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleOtpChange = useCallback(
    (index, value) => {
      if (!/^\d*$/.test(value)) return;
      const newOtp = [...otp];
      newOtp[index] = value.slice(-1);
      setOtp(newOtp);
      setError(null);
      if (value && index < DIGIT_COUNT - 1) {
        setTimeout(() => inputRefs.current[index + 1]?.focus(), 0);
      }
    },
    [otp]
  );

  const handleKeyDown = useCallback(
    (index, e) => {
      if (e.key === "Backspace") {
        if (!otp[index] && index > 0) {
          const newOtp = [...otp];
          newOtp[index - 1] = "";
          setOtp(newOtp);
          setTimeout(() => inputRefs.current[index - 1]?.focus(), 0);
          triggerHaptic("light");
        } else if (otp[index]) {
          const newOtp = [...otp];
          newOtp[index] = "";
          setOtp(newOtp);
          triggerHaptic("light");
        }
      }
      if (e.key === "ArrowLeft" && index > 0) setTimeout(() => inputRefs.current[index - 1]?.focus(), 0);
      if (e.key === "ArrowRight" && index < DIGIT_COUNT - 1) setTimeout(() => inputRefs.current[index + 1]?.focus(), 0);
    },
    [otp]
  );

  // Shared by paste and one-time-code autofill (which delivers the whole code at once).
  const applyCode = useCallback(
    (raw) => {
      const pasted = raw.replace(/\D/g, "").slice(0, DIGIT_COUNT);
      if (pasted.length > 0) {
        const newOtp = [...otp];
        pasted.split("").forEach((d, i) => { if (i < DIGIT_COUNT) newOtp[i] = d; });
        for (let i = pasted.length; i < DIGIT_COUNT; i++) newOtp[i] = "";
        setOtp(newOtp);
        setError(null);
        triggerHaptic("medium");
        setTimeout(() => {
          const focusIndex = Math.min(pasted.length, DIGIT_COUNT - 1);
          inputRefs.current[focusIndex]?.focus();
        }, 0);
      }
    },
    [otp]
  );

  const handlePaste = useCallback(
    (e) => {
      e.preventDefault();
      applyCode(e.clipboardData.getData("text"));
    },
    [applyCode]
  );

  const handleDigitChange = useCallback(
    (index, value) => {
      if (index === 0 && value.length >= DIGIT_COUNT) {
        applyCode(value);
        return;
      }
      handleOtpChange(index, value);
    },
    [applyCode, handleOtpChange]
  );

  const handleVerify = useCallback(
    async (codeOverride) => {
      const code = codeOverride || otp.join("");
      if (!dataLoaded || !verificationId) return;
      const now = Date.now();
      if (now - lastAttemptTime.current < 1200) return;
      lastAttemptTime.current = now;

      if (code.length !== DIGIT_COUNT) {
        setError({ title: "Enter all 6 digits", subtitle: "", severity: "soft" });
        submitLock.current = false;
        return;
      }
      if (loading || isVerifying) {
        submitLock.current = false;
        return;
      }

      setIsVerifying(true);
      setLoading(true);
      setError(null);
      triggerHaptic("medium");

      try {
        const fallbackStep1 = step1Data || JSON.parse(
          sessionStorage.getItem('signup_step1') || 
          localStorage.getItem('signup_step1') || 
          sessionStorage.getItem('signup_data') || 
          localStorage.getItem('signup_data') || 
          '{}'
        );
        const result = await auth.verifyPhoneOTP(verificationId, code, fallbackStep1);
        if (!result.success) throw new Error(result.error || "Verification failed");

        sessionStorage.removeItem("phone_verification");
        localStorage.removeItem("phone_verification");
        sessionStorage.removeItem("otp_draft");

        triggerHaptic("success");
        setShowSuccess(true);

        const hasStep1Personal = Boolean(fallbackStep1?.firstName || fallbackStep1?.lastName);
        const isSignupFlow = Boolean(isSignup === true || hasStep1Personal);
        const isNewUser = isSignupFlow || result.isNewUser === true || result.user?.isProfileComplete === false || result.user?.requiresProfileCompletion === true;

        console.log("✅ OTP verified. isSignupFlow =", isSignupFlow, "isNewUser =", isNewUser);

        if (isSignupFlow || isNewUser) {
          const targetUid = result.user?.uid || result.user?.userId || auth.user?.uid;
          markOnboardingRequired(targetUid, {
            method: "phone",
            isSignup: true,
            step1Data: fallbackStep1,
          });
          toast.success("Phone verified! Let's set up your profile.");
          navigate("/setup-profile", {
            state: {
              method: "phone",
              userData: result.user,
              isNewUser: true,
              fromVerification: true,
              step1Data: fallbackStep1,
            },
            replace: true,
          });
        } else {
          toast.success("Welcome back!");
          navigate("/home", { replace: true, state: { welcomeMessage: true } });
        }
      } catch (err) {
        console.error("OTP error:", err);
        triggerHaptic("error");
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        const humanErr = ERROR_MAP[err.code] || ERROR_MAP.default;
        setError(humanErr);
        setShakeInputs(true);
        setTimeout(() => setShakeInputs(false), SHAKE_DURATION);
        if (newAttempts >= MAX_FAILED_ATTEMPTS_BEFORE_RESET) {
          setOtp(Array(DIGIT_COUNT).fill(""));
          setAttempts(0);
          setTimeout(() => inputRefs.current[0]?.focus(), 100);
        }
        if (err.code === "auth/session-expired") {
          setCanResend(true);
          setCountdown(0);
        }
        submitLock.current = false;
      } finally {
        setLoading(false);
        setIsVerifying(false);
      }
    },
    [dataLoaded, verificationId, otp, loading, isVerifying, attempts, auth, navigate, step1Data, isSignup]
  );

  const handleResend = useCallback(async () => {
    if (!canResend || resendCooldown) return;
    setResendCooldown(true);
    setResendTimer(RESEND_COOLDOWN);
    triggerHaptic("medium");
    try {
      const result = await auth.sendPhoneVerificationCode(phoneNumber, null);
      if (result.success) {
        const newVerificationId = result.verificationId;
        setVerificationId(newVerificationId);
        const updatedSession = { verificationId: newVerificationId, phoneNumber, isSignup, step1Data };
        sessionStorage.setItem("phone_verification", JSON.stringify(updatedSession));
        localStorage.setItem("phone_verification", JSON.stringify(updatedSession));
        toast.success("New code sent successfully");
        setCountdown(INITIAL_COUNTDOWN);
        setCanResend(false);
        setOtp(Array(DIGIT_COUNT).fill(""));
        setError(null);
        setAttempts(0);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
        triggerHaptic("success");
      }
    } catch (error) {
      toast.error("Couldn't send code. Check connection.");
      triggerHaptic("error");
    } finally {
      resendCooldownInterval.current = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(resendCooldownInterval.current);
            setResendCooldown(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [canResend, resendCooldown, phoneNumber, auth, isSignup, step1Data]);

  const handleBack = () => navigate("/signup/step2", { replace: true });
  const handleBackToLogin = () => navigate("/login", { replace: true });

  const formattedPhone = useMemo(() => {
    if (!phoneNumber) return "";
    if (phoneNumber.length <= 4) return phoneNumber;
    return `${phoneNumber.slice(0, 4)} •••• ${phoneNumber.slice(-3)}`;
  }, [phoneNumber]);

  const ringProgress = useMemo(() => (countdown > 0 ? ((INITIAL_COUNTDOWN - countdown) / INITIAL_COUNTDOWN) * 100 : 100), [countdown]);
  const isComplete = useMemo(() => otp.join("").length === DIGIT_COUNT, [otp]);

  const rootVariables = resolvedTheme === "dark" ? THEMES.dark : THEMES.light;
  const year = new Date().getFullYear();
  const canSubmit = isComplete && !loading && !isVerifying;

  if (!dataLoaded) {
    return (
      <div className="av2-root" style={rootVariables} data-theme={resolvedTheme} data-lowperf={!!lowPerf}>
        <style>{STYLES}</style>
        <div className="av2-bg" aria-hidden="true">
          <span className="av2-orb av2-orb-a" />
          <span className="av2-orb av2-orb-b" />
          <span className="av2-dots" />
        </div>
        <main className="av2-shell" style={{ alignItems: "center", justifyContent: "center" }}>
          <div className="av2-loading" role="status">
            <SpinnerIcon size={38} stroke={2.2} style={{ color: "#8B1EF3" }} />
            <p style={{ margin: 0 }}>Preparing verification...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="av2-root" style={rootVariables} data-theme={resolvedTheme} data-lowperf={!!lowPerf}>
        <style>{STYLES}</style>

        <div className="av2-bg" aria-hidden="true">
          <span className="av2-orb av2-orb-a" />
          <span className="av2-orb av2-orb-b" />
          <span className="av2-orb av2-orb-c" />
          <span className="av2-dots" />
        </div>

        <AnimatePresence>
          {isOffline && (
            <motion.div
              className="av2-offline"
              role="status"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <AlertIcon size={16} />
              <span>You're offline – verification needs an internet connection</span>
            </motion.div>
          )}
        </AnimatePresence>

        <main className="av2-shell">
          <motion.div
            className="av2-wrap"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            {isSignup && <StepIndicator currentStep={2} />}

            <section className="av2-card" aria-labelledby="otp-title">
              <span className="av2-spec" aria-hidden="true" />
              <span className="av2-rim" aria-hidden="true" />

              <AnimatePresence mode="wait" initial={false}>
                {showSuccess ? (
                  <SuccessState key="success" reducedMotion={reducedMotion} />
                ) : (
                  <motion.div
                    key="content"
                    className="av2-content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <header className="av2-head">
                      <motion.div
                        className="av2-mark"
                        data-state={attempts > 0 ? "warn" : "ok"}
                        data-busy={isVerifying}
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 22, delay: 0.05 }}
                      >
                        <ShieldCheckIcon size={28} stroke={2} />
                      </motion.div>
                      <h1 id="otp-title" className="av2-h1">Enter Verification Code</h1>
                      <p className="av2-sub">We sent a 6‑digit code to</p>
                      <span className="av2-phone-chip">
                        <PhoneIcon size={16} />
                        <span>{formattedPhone}</span>
                      </span>
                    </header>

                    <motion.div
                      role="group"
                      aria-label="6-digit verification code"
                      className="av2-otp"
                      animate={shakeInputs ? { x: [0, -8, 8, -8, 8, -4, 4, 0] } : { x: 0 }}
                      transition={{ duration: reducedMotion ? 0 : 0.5, ease: "easeInOut" }}
                    >
                      {otp.map((digit, idx) => (
                        <OTPDigit
                          key={idx}
                          digit={digit}
                          index={idx}
                          disabled={loading}
                          hasError={error !== null}
                          isVerifying={isVerifying}
                          onChange={handleDigitChange}
                          onKeyDown={handleKeyDown}
                          onPaste={handlePaste}
                          autoFocus={idx === 0 && !loading && !showSuccess}
                          ariaLabel={`Digit ${idx + 1} of ${DIGIT_COUNT}`}
                          describedBy="otp-error"
                          ref={(el) => (inputRefs.current[idx] = el)}
                        />
                      ))}
                    </motion.div>

                    <AnimatePresence initial={false}>
                      {error && (
                        <motion.div
                          key="error-msg"
                          className="av2-alert-wrap"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25 }}
                        >
                          <div id="otp-error" className="av2-alert" role="alert" data-severity={error.severity}>
                            <AlertIcon size={16} />
                            <div>
                              <span className="av2-alert-title">{error.title}</span>
                              {error.subtitle && <span className="av2-alert-sub">{error.subtitle}</span>}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="av2-resend">
                      <div className="av2-resend-text">
                        <span className="av2-resend-title">Didn't get a code?</span>
                        <span className="av2-resend-sub">
                          {!canResend ? `You can request a new one in ${formatTime(countdown)}` : "Request a new code to your phone"}
                        </span>
                      </div>
                      <div className="av2-resend-act">
                        {!canResend ? (
                          <CircularProgressRing progress={ringProgress} size={48} strokeWidth={4} reducedMotion={reducedMotion}>
                            <span role="timer" aria-live="off">{formatTime(countdown)}</span>
                          </CircularProgressRing>
                        ) : (
                          <motion.button
                            type="button"
                            onClick={handleResend}
                            disabled={resendCooldown || loading || isVerifying}
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.25 }}
                            className="av2-pill"
                          >
                            <SendIcon size={15} />
                            <span>{resendCooldown ? `Resend in ${resendTimer}s` : "Resend Code"}</span>
                          </motion.button>
                        )}
                      </div>
                    </div>

                    <motion.button
                      type="button"
                      onClick={() => handleVerify()}
                      disabled={!isComplete || loading || isVerifying || showSuccess}
                      whileTap={canSubmit ? { scale: 0.98 } : undefined}
                      className="av2-btn"
                      data-loading={isVerifying}
                    >
                      {isVerifying ? (
                        <>
                          <SpinnerIcon size={19} />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheckIcon size={19} />
                          <span>Verify Code</span>
                        </>
                      )}
                    </motion.button>

                    <div className="av2-back-wrap">
                      {isSignup ? (
                        <button type="button" className="av2-back" onClick={handleBack} disabled={loading || isVerifying}>
                          <ArrowLeftIcon size={17} stroke={2.2} />
                          Change Phone Number
                        </button>
                      ) : (
                        <button type="button" className="av2-back" onClick={handleBackToLogin} disabled={loading || isVerifying}>
                          <ArrowLeftIcon size={17} stroke={2.2} />
                          Back to Sign In
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            <footer>
              <p className="av2-foot">© {year} Arvdoul</p>
            </footer>
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  );
}
