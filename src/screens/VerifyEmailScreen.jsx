// src/screens/VerifyEmailScreen.jsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import { getOnboardingSession, clearOnboardingRequired } from "../utils/profileCompletion.js";

/* ────────────────────────────────────────────────────────────────────────────
 * Design system (shared with Signup, Login and OTP screens)
 * ──────────────────────────────────────────────────────────────────────────── */

const GRADIENT =
  "linear-gradient(125deg, #8B1EF3 0%, #4431F7 52%, #055BFB 100%)";

const STEPS = [
  { number: 1, label: "Personal" },
  { number: 2, label: "Verify" },
  { number: 3, label: "Complete" },
];

const CONFETTI_COLORS = ["#8B1EF3", "#4431F7", "#055BFB", "#49E3AC", "#FFC46B", "#FF879B", "#B8AAFF"];

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
.av2-confetti {position:fixed;inset:0;z-index:200;overflow:hidden;pointer-events:none}

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
.av2-card>.av2-content {position:relative;z-index:1}
.av2-head {text-align:center}
.av2-h1 {margin:0;font-size:clamp(23px,5vw,28px);line-height:1.17;font-weight:800;letter-spacing:-.035em}
.av2-sub {margin:9px 0 0;color:var(--text-2);font-size:13.5px;line-height:1.55}

/* Header mark */
.av2-mark {
  position:relative;display:grid;place-items:center;width:60px;height:60px;margin:0 auto 18px;border-radius:20px;
  background:${GRADIENT};color:#fff;border:1px solid rgba(255,255,255,.22);
  box-shadow:var(--btn-shadow),0 0 0 6px var(--field-ring);transition:background .3s,box-shadow .3s;
}
.av2-mark[data-state="verified"] {
  background:linear-gradient(135deg,var(--success),color-mix(in srgb,var(--success) 60%,#055BFB));
  box-shadow:0 12px 26px -12px var(--success),0 0 0 6px color-mix(in srgb,var(--success) 18%,transparent);
}
.av2-mark[data-state="error"] {background:var(--danger);box-shadow:0 12px 26px -12px var(--danger),0 0 0 6px var(--danger-ring)}
.av2-mark::after {content:"";position:absolute;inset:-6px;border-radius:25px;border:2px solid var(--field-focus);opacity:0;pointer-events:none}
.av2-mark[data-busy="true"]::after {animation:av2-pulse 1.4s ease-out infinite}
.av2-id-chip {
  display:inline-flex;align-items:center;gap:9px;max-width:100%;margin-top:14px;padding:9px 14px;
  border:1px solid var(--field-border);border-radius:14px;background:var(--field-bg);box-shadow:var(--field-inset);
  color:var(--text);font-size:14px;font-weight:750;text-align:left;
  -webkit-backdrop-filter:blur(16px) saturate(145%);backdrop-filter:blur(16px) saturate(145%);
}
.av2-id-chip svg {flex:none;color:var(--accent-text)}
.av2-id-chip span {min-width:0;overflow-wrap:anywhere;line-height:1.35}

/* Verification list */
.av2-vlist {
  margin:24px 0 0;padding:4px 14px;list-style:none;
  border:1px solid var(--field-border);border-radius:16px;background:var(--field-bg);box-shadow:var(--field-inset);
  -webkit-backdrop-filter:blur(16px) saturate(145%);backdrop-filter:blur(16px) saturate(145%);
}
.av2-vstep {display:flex;align-items:center;gap:12px;min-height:50px;padding:8px 0}
.av2-vstep+.av2-vstep {border-top:1px solid var(--line)}
.av2-vdot {
  display:grid;place-items:center;flex:none;width:28px;height:28px;border-radius:50%;
  border:1px solid var(--field-border);color:var(--text-3);font-size:12px;font-weight:750;
  transition:background .3s,color .3s,border-color .3s,box-shadow .3s;
}
.av2-vstep[data-state="done"] .av2-vdot {background:var(--success);border-color:transparent;color:#fff}
.av2-vstep[data-state="active"] .av2-vdot {background:${GRADIENT};border-color:transparent;color:#fff;box-shadow:0 0 0 3px var(--field-ring)}
.av2-vlabel {flex:1;min-width:0;color:var(--text-3);font-size:13.5px;font-weight:650;transition:color .3s}
.av2-vstep[data-state="done"] .av2-vlabel,.av2-vstep[data-state="active"] .av2-vlabel {color:var(--text)}
.av2-vtag {flex:none;color:var(--text-3);font-size:11.5px;font-weight:700}
.av2-vstep[data-state="done"] .av2-vtag {color:var(--success)}
.av2-vstep[data-state="active"] .av2-vtag {color:var(--accent-text)}

/* Status */
.av2-status {
  display:flex;align-items:center;justify-content:center;gap:8px;margin-top:18px;min-height:22px;
  color:var(--accent-text);font-size:13.5px;font-weight:750;text-align:center;
}
.av2-status[data-state="verified"] {color:var(--success)}
.av2-status[data-state="error"] {color:var(--danger)}
.av2-tip {margin:8px 0 0;text-align:center;color:var(--text-3);font-size:12px;line-height:1.55}

/* Alert */
.av2-alert {
  display:flex;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:14px;
  border:1px solid color-mix(in srgb,var(--danger) 38%,transparent);background:color-mix(in srgb,var(--danger) 9%,transparent);
  color:var(--danger);font-size:12.5px;font-weight:650;line-height:1.5;
}
.av2-alert svg {flex:none;margin-top:1px}
.av2-alert-title {display:block;font-weight:750}
.av2-alert-sub {display:block;margin-top:2px;font-size:12px;font-weight:550;opacity:.92}
.av2-alert-wrap {margin-top:16px;overflow:hidden}

/* Resend strip */
.av2-resend {
  display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:14px;padding:12px 14px;
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
.av2-danger {
  display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:48px;padding:0 16px;
  border:1px solid color-mix(in srgb,var(--danger) 45%,transparent);border-radius:14px;
  background:color-mix(in srgb,var(--danger) 10%,transparent);color:var(--danger);
  font:inherit;font-size:13.5px;font-weight:800;cursor:pointer;-webkit-tap-highlight-color:transparent;
  transition:background .2s,border-color .2s;
}
.av2-danger:hover:not(:disabled) {background:color-mix(in srgb,var(--danger) 16%,transparent);border-color:var(--danger)}
.av2-danger:disabled {opacity:.5;cursor:not-allowed}
.av2-confirm {text-align:center}
.av2-confirm-title {margin:0;font-size:15px;font-weight:800;letter-spacing:-.01em}
.av2-confirm-sub {margin:5px 0 14px;color:var(--text-2);font-size:12.5px;line-height:1.5}
.av2-confirm-actions {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}

.av2-secure {display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px 12px;margin:18px 0 0;color:var(--text-3);font-size:12px;font-weight:600}
.av2-secure span {display:inline-flex;align-items:center;gap:6px}
.av2-secure i {width:3px;height:3px;border-radius:50%;background:var(--text-3);opacity:.6}
.av2-foot {margin:10px 0 0;text-align:center;color:var(--text-3);font-size:12px}
.av2-spin {animation:av2-spin .8s linear infinite;transform-origin:center}

.av2-root button:focus-visible,.av2-root input:focus-visible {outline:2px solid var(--focus-outline);outline-offset:3px}

@keyframes av2-spin {to{transform:rotate(360deg)}}
@keyframes av2-shine {to{transform:translateX(120%)}}
@keyframes av2-pulse {0%{transform:scale(.94);opacity:.7}100%{transform:scale(1.18);opacity:0}}
@keyframes av2-blink {0%,100%{opacity:1}50%{opacity:.35}}

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
  .av2-vlist {padding:2px 12px}
  .av2-vstep {min-height:46px;gap:10px}
}
@media(max-width:340px) {
  .av2-resend {flex-direction:column;align-items:flex-start}
  .av2-confirm-actions {grid-template-columns:minmax(0,1fr)}
  .av2-vtag {display:none}
}
@media(max-height:560px) and (orientation:landscape) {
  .av2-steps {display:none}
  .av2-mark {display:none}
}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))) {
  .av2-card {background:var(--field-bg-solid)}
  .av2-vlist,.av2-id-chip {background:var(--field-bg-solid)}
}
@media(forced-colors:active) {
  .av2-card,.av2-vlist,.av2-resend,.av2-id-chip {border:1px solid CanvasText}
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

const MailIcon = (p) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.5 7.5 7.4 4.6a2 2 0 0 0 2.2 0l7.4-4.6" />
  </Svg>
);
const LockIcon = (p) => (
  <Svg {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
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
const ArrowRightIcon = (p) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
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

const ConfettiBurst = ({ isActive }) => {
  const particles = useMemo(() => Array.from({ length: 48 }, (_, i) => {
    const size = Math.random() * 8 + 4;
    const angle = Math.random() * 360;
    const velocity = Math.random() * 4 + 2;
    const rad = angle * (Math.PI / 180);
    return {
      id: i,
      size,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      destX: Math.cos(rad) * 80 * velocity,
      destY: Math.sin(rad) * 80 * velocity,
      duration: Math.random() * 1.5 + 1,
      delay: Math.random() * 0.5,
      shape: Math.random() > 0.5 ? "circle" : "rect",
      rotation: Math.random() * 360,
    };
  }), []);

  if (!isActive) return null;
  return (
    <div className="av2-confetti" aria-hidden="true">
      {particles.map(p => (
        <motion.div
          key={p.id}
          style={{
            position: "absolute",
            width: p.size, height: p.size, backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            left: "50%", top: "42%",
          }}
          initial={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
          animate={{ opacity: 0, x: p.destX, y: p.destY, rotate: p.rotation }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
        />
      ))}
    </div>
  );
};

const VerificationList = React.memo(({ steps, sending }) => {
  const activeIndex = steps.findIndex((s) => !s.completed);
  return (
    <ol className="av2-vlist" aria-label="Verification progress">
      {steps.map((step, index) => {
        const state = step.completed ? "done" : index === activeIndex ? "active" : "todo";
        const isSendingStep = state === "active" && sending;
        return (
          <motion.li
            key={step.key}
            className="av2-vstep"
            data-state={state}
            aria-current={state === "active" ? "step" : undefined}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + index * 0.07, duration: 0.3 }}
          >
            <span className="av2-vdot">
              {state === "done" ? (
                <CheckIcon size={15} stroke={3} />
              ) : isSendingStep ? (
                <SpinnerIcon size={15} stroke={2.4} />
              ) : (
                index + 1
              )}
            </span>
            <span className="av2-vlabel">{step.label}</span>
            <span className="av2-vtag">
              {state === "done" ? "Done" : state === "active" ? (isSendingStep ? "Sending..." : "Waiting") : ""}
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
});
VerificationList.displayName = "VerificationList";

const CircularProgressRing = React.memo(({ progress, size = 48, strokeWidth = 4, children }) => {
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
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        />
      </svg>
      <div className="av2-ring-time">{children}</div>
    </div>
  );
});
CircularProgressRing.displayName = "CircularProgressRing";

/* ────────────────────────────────────────────────────────────────────────────
 * Screen
 * ──────────────────────────────────────────────────────────────────────────── */

export default function EmailVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
  const resolvedTheme = theme === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : theme;

  const { user, checkEmailVerification, resendEmailVerification, signOut, authInitialized, loading: authLoading } = useAuth();

  const [verificationStatus, setVerificationStatus] = useState("sent");
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(() => location.state?.email || location.state?.userEmail || new URLSearchParams(location.search).get("email") || "");
  const [userId, setUserId] = useState(() => location.state?.userId || location.state?.uid || new URLSearchParams(location.search).get("userId") || "");
  const [showConfetti, setShowConfetti] = useState(false);
  const [confirmChange, setConfirmChange] = useState(false);

  const intervalRef = useRef(null);
  const isMounted = useRef(true);
  const checkVerificationRef = useRef();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlUserId = params.get("userId");
    const urlEmail = params.get("email");
    const stateUserId = location.state?.userId || location.state?.uid;
    const stateEmail = location.state?.email || location.state?.userEmail;
    const oobCode = params.get("oobCode");

    if (urlUserId || stateUserId) setUserId(prev => prev || urlUserId || stateUserId);
    if (urlEmail || stateEmail) setEmail(prev => prev || urlEmail || stateEmail);

    // If recipient clicked the email link containing the action code (oobCode)
    if (oobCode) {
      const applyVerificationCode = async () => {
        try {
          setVerificationStatus("checking");
          const { getAuthService } = await import("../services/authService.js");
          await getAuthService().applyEmailActionCode(oobCode);
          if (isMounted.current) {
            setVerificationStatus("verified");
            toast.success("Email successfully verified!");
            triggerSuccess();
          }
        } catch (oobError) {
          console.warn("oobCode verification note:", oobError.message);
          // If code is already applied or expired, fall back to checking auth user status
        }
      };
      applyVerificationCode();
    }
  }, [location.search, location.state]);

  useEffect(() => {
    // If user is already verified, navigate immediately
    if (user?.emailVerified) {
      triggerSuccess();
      return;
    }

    // Set email and userId from user if available
    if (user?.email && !email) setEmail(user.email);
    if (user?.uid && !userId) setUserId(user.uid);

    // Start the verification check
    const performCheck = async () => {
      if (checkVerificationRef.current) {
        await checkVerificationRef.current();
      } else {
        const verified = await checkVerification();
        if (verified && isMounted.current) triggerSuccess();
      }
    };
    performCheck();

    // Set up periodic check every 3 seconds
    intervalRef.current = setInterval(() => {
      if (isMounted.current && checkVerificationRef.current) {
        checkVerificationRef.current();
      }
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [authInitialized, authLoading, user]); // eslint-disable-line

  const checkVerification = useCallback(async () => {
    if (!userId && !user?.uid) {
      setVerificationStatus("error");
      return false;
    }
    const uidToCheck = userId || user?.uid;
    if (!uidToCheck) return false;

    setVerificationStatus(prev => {
      if (prev === "verified") return prev;
      if (prev === "sending") return prev;
      return "checking";
    });

    try {
      const result = await checkEmailVerification(uidToCheck);
      if (!isMounted.current) return false;

      if (result.verified) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setVerificationStatus("verified");
        triggerSuccess();
        return true;
      } else {
        setVerificationStatus(prev => prev === "verified" ? "verified" : "sent");
        return false;
      }
    } catch (error) {
      if (isMounted.current) {
        setVerificationStatus(prev => prev === "verified" ? "verified" : "error");
      }
      return false;
    }
  }, [userId, user, checkEmailVerification]);

  // Keep ref updated
  useEffect(() => {
    checkVerificationRef.current = checkVerification;
  }, [checkVerification]);

  const triggerSuccess = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.deviceMemory >= 4) setShowConfetti(true);
    const uid = userId || user?.uid;
    const mode = new URLSearchParams(location.search).get("mode");
    const fromLogin = location.state?.fromLogin === true;
    const fromSignup =
      !fromLogin && (
        location.state?.fromSignup === true ||
        location.state?.isNewUser === true ||
        mode === "signup" ||
        !!getOnboardingSession(uid)
      );
    const hasIncompleteProfile = !fromLogin && (user?.isProfileComplete === false || user?.requiresProfileCompletion === true);
    const goToSetup = !fromLogin && (fromSignup || hasIncompleteProfile);
    if (!goToSetup) {
      clearOnboardingRequired();
    }
    toast.success(goToSetup ? "Email verified! Let's finish your profile." : "Email verified! Welcome back.");
    const step1Data = location.state?.step1Data || JSON.parse(sessionStorage.getItem('signup_step1') || localStorage.getItem('signup_data') || '{}');
    setTimeout(() => {
      if (goToSetup) {
        navigate("/setup-profile", {
          state: {
            email: email || user?.email,
            userId: uid,
            method: "email",
            isNewUser: true,
            step1Data,
          },
          replace: true,
        });
        return;
      }
      navigate("/home", { replace: true, state: { welcomeMessage: true } });
    }, 1200);
  }, [email, userId, user, location.state, navigate]);

  const handleResendEmail = async () => {
    if (!canResend || loading) return;
    setLoading(true);
    setVerificationStatus("sending");
    try {
      await resendEmailVerification(userId || user?.uid);
      setVerificationStatus("sent");
      setResendCooldown(60);
      setCanResend(false);
      toast.success("Verification email resent!");
    } catch (err) {
      setVerificationStatus("error");
      const msg = err.code === "auth/too-many-requests"
        ? "Too many attempts. Please wait 5 minutes."
        : err.message || "Failed to resend";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheck = async () => {
    if (verificationStatus === "verified") {
      triggerSuccess();
      return;
    }
    setLoading(true);
    const verified = await checkVerification();
    setLoading(false);
    if (!verified) {
      toast.info("Email not verified yet. Check your inbox.");
    }
  };

  // The "are you sure?" confirmation now lives in the UI (see confirmChange),
  // so this runs only after the user has confirmed.
  const handleChangeEmail = async () => {
    setLoading(true);
    try {
      if (userId || user?.uid) {
        const { getAuthService } = await import("../services/authService.js");
        // Delete before signing out: deleteUser needs a current user.
        await getAuthService().deleteCurrentUser().catch(() => {});
        await signOut();
      }
      sessionStorage.clear();
      toast.info("Please sign up again with your new email.");
      navigate("/signup/step2", { replace: true });
    } catch (err) {
      toast.error("Could not change email. Try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (resendCooldown <= 0) { setCanResend(true); return; }
    const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const steps = useMemo(() => [
    { key: "emailValid", label: "Email Validated", completed: !!email },
    { key: "emailSent", label: "Email Sent", completed: verificationStatus !== "sending" },
    { key: "linkClicked", label: "Link Clicked", completed: verificationStatus === "verified" },
    { key: "verified", label: "Verified", completed: verificationStatus === "verified" }
  ], [email, verificationStatus]);

  const resendProgress = (resendCooldown / 60) * 100;

  // UI-only derivations -----------------------------------------------------
  const isVerified = verificationStatus === "verified";
  const isSending = verificationStatus === "sending";
  const isError = verificationStatus === "error";
  // Background polls flip the status to "checking" every few seconds; only
  // surface it when the person actively asked for a check.
  const displayStatus = verificationStatus === "checking" && !loading ? "sent" : verificationStatus;

  const isSignupFlow = useMemo(() => {
    const mode = new URLSearchParams(location.search).get("mode");
    if (location.state?.fromLogin === true) return false;
    return (
      location.state?.fromSignup === true ||
      location.state?.isNewUser === true ||
      mode === "signup" ||
      !!getOnboardingSession(userId || user?.uid)
    );
  }, [location.search, location.state, userId, user?.uid]);

  const rootVariables = resolvedTheme === "dark" ? THEMES.dark : THEMES.light;
  const year = new Date().getFullYear();
  const shownEmail = email || user?.email || "your email";
  const markState = isVerified ? "verified" : isError ? "error" : "ok";

  return (
    <MotionConfig reducedMotion="user">
      <div className="av2-root" style={rootVariables} data-theme={resolvedTheme}>
        <style>{STYLES}</style>

        <div className="av2-bg" aria-hidden="true">
          <span className="av2-orb av2-orb-a" />
          <span className="av2-orb av2-orb-b" />
          <span className="av2-orb av2-orb-c" />
          <span className="av2-dots" />
        </div>

        <ConfettiBurst isActive={showConfetti && !prefersReducedMotion} />

        <main className="av2-shell">
          <motion.div
            className="av2-wrap"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            {isSignupFlow && <StepIndicator currentStep={isVerified ? 3 : 2} />}

            <section className="av2-card" aria-labelledby="verify-email-title" aria-busy={loading || isSending}>
              <span className="av2-spec" aria-hidden="true" />
              <span className="av2-rim" aria-hidden="true" />

              <div className="av2-content">
                <header className="av2-head">
                  <motion.div
                    className="av2-mark"
                    data-state={markState}
                    data-busy={isSending || loading}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 320, damping: 22, delay: 0.05 }}
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={markState}
                        style={{ display: "grid", placeItems: "center" }}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.5, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        {isVerified ? <CheckIcon size={30} stroke={2.6} /> : isError ? <AlertIcon size={28} /> : <MailIcon size={28} stroke={2} />}
                      </motion.span>
                    </AnimatePresence>
                  </motion.div>

                  <h1 id="verify-email-title" className="av2-h1">
                    {isVerified ? "Email Verified" : "Verify Your Email"}
                  </h1>
                  <p className="av2-sub">
                    {isVerified ? "Your email address is confirmed" : "We sent a verification link to"}
                  </p>
                  <span className="av2-id-chip">
                    <MailIcon size={16} />
                    <span>{shownEmail}</span>
                  </span>
                </header>

                <VerificationList steps={steps} sending={isSending} />

                <div className="av2-status" data-state={displayStatus === "checking" ? "sent" : displayStatus} role="status" aria-live="polite">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={displayStatus}
                      style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18 }}
                    >
                      {displayStatus === "verified" ? (
                        <><CheckIcon size={16} stroke={2.6} /> Verified</>
                      ) : displayStatus === "checking" ? (
                        <><SpinnerIcon size={15} stroke={2.4} /> Checking...</>
                      ) : displayStatus === "sending" ? (
                        <><SpinnerIcon size={15} stroke={2.4} /> Resending...</>
                      ) : displayStatus === "error" ? (
                        <><AlertIcon size={15} /> Something went wrong</>
                      ) : (
                        <><ShieldCheckIcon size={15} /> Check your inbox</>
                      )}
                    </motion.span>
                  </AnimatePresence>
                </div>

                <AnimatePresence initial={false}>
                  {isError && (
                    <motion.div
                      key="verify-error"
                      className="av2-alert-wrap"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="av2-alert" role="alert">
                        <AlertIcon size={16} />
                        <div>
                          <span className="av2-alert-title">We couldn't check your verification status</span>
                          <span className="av2-alert-sub">Check your connection, then tap the button below to try again.</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {!isVerified && !isError && (
                  <p className="av2-tip">
                    This page updates on its own once you open the link. Can't find it? Check your spam folder.
                  </p>
                )}

                <motion.button
                  type="button"
                  onClick={handleManualCheck}
                  disabled={loading}
                  whileTap={!loading ? { scale: 0.98 } : undefined}
                  className="av2-btn"
                  data-loading={loading}
                >
                  {loading ? (
                    <>
                      <SpinnerIcon size={19} />
                      <span>Checking...</span>
                    </>
                  ) : isVerified ? (
                    <>
                      <span>Continue</span>
                      <ArrowRightIcon size={19} />
                    </>
                  ) : (
                    <>
                      <CheckIcon size={19} stroke={2.4} />
                      <span>I've verified, continue</span>
                    </>
                  )}
                </motion.button>

                {!isVerified && (
                  <div className="av2-resend">
                    <div className="av2-resend-text">
                      <span className="av2-resend-title">Didn't get the email?</span>
                      <span className="av2-resend-sub">
                        {!canResend ? `You can request another in ${resendCooldown}s` : "Send a new verification link"}
                      </span>
                    </div>
                    <div className="av2-resend-act">
                      {!canResend ? (
                        <CircularProgressRing progress={resendProgress} size={48} strokeWidth={4}>
                          <span role="timer" aria-live="off">{resendCooldown}s</span>
                        </CircularProgressRing>
                      ) : (
                        <motion.button
                          type="button"
                          onClick={handleResendEmail}
                          disabled={!canResend || loading}
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.25 }}
                          className="av2-pill"
                        >
                          {isSending ? <SpinnerIcon size={15} stroke={2.4} /> : <SendIcon size={15} />}
                          <span>{isSending ? "Sending..." : "Resend"}</span>
                        </motion.button>
                      )}
                    </div>
                  </div>
                )}

                {!isVerified && (
                  <div className="av2-back-wrap">
                    <AnimatePresence mode="wait" initial={false}>
                      {confirmChange ? (
                        <motion.div
                          key="confirm"
                          className="av2-confirm"
                          role="alertdialog"
                          aria-labelledby="change-email-title"
                          aria-describedby="change-email-desc"
                          onKeyDown={(e) => { if (e.key === "Escape") setConfirmChange(false); }}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.18 }}
                        >
                          <p id="change-email-title" className="av2-confirm-title">Use a different email?</p>
                          <p id="change-email-desc" className="av2-confirm-sub">This will cancel your current signup.</p>
                          <div className="av2-confirm-actions">
                            <button type="button" className="av2-back" onClick={() => setConfirmChange(false)} disabled={loading} autoFocus>
                              Keep this email
                            </button>
                            <button
                              type="button"
                              className="av2-danger"
                              onClick={() => { setConfirmChange(false); handleChangeEmail(); }}
                              disabled={loading}
                            >
                              Yes, start over
                            </button>
                          </div>
                        </motion.div>
                      ) : (
                        <motion.button
                          key="change"
                          type="button"
                          className="av2-back"
                          onClick={() => setConfirmChange(true)}
                          disabled={loading}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.15 }}
                        >
                          <ArrowLeftIcon size={17} stroke={2.2} />
                          Use a different email
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </section>

            <footer>
              <p className="av2-secure">
                <span><LockIcon size={14} />Encrypted</span>
                <i aria-hidden="true" />
                <span><ShieldCheckIcon size={14} />Secure</span>
              </p>
              <p className="av2-foot">© {year} Arvdoul</p>
            </footer>
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  );
}
