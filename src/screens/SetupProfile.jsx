// src/screens/SetupProfile.jsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "@context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { clearOnboardingRequired } from "../utils/profileCompletion.js";

import {
  createUserProfile,
  checkUsernameAvailability,
  generateDefaultAvatar,
  getUserProfile,
} from "../services/userService.js";
import storageService from "../services/storageService.js";

/* ────────────────────────────────────────────────────────────────────────────
 * Design system (shared with Signup, Login, OTP and Verify Email screens)
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
    "--success-ring": "rgba(73,227,172,0.18)",
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
    "--success-ring": "rgba(14,148,104,0.14)",
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
.av2-id-chip {
  display:inline-flex;align-items:center;gap:9px;max-width:100%;margin-top:14px;padding:8px 14px;
  border:1px solid var(--field-border);border-radius:14px;background:var(--field-bg);box-shadow:var(--field-inset);
  color:var(--text);font-size:13.5px;font-weight:700;text-align:left;
  -webkit-backdrop-filter:blur(16px) saturate(145%);backdrop-filter:blur(16px) saturate(145%);
}
.av2-id-chip svg {flex:none;color:var(--accent-text)}
.av2-id-chip span {min-width:0;overflow-wrap:anywhere;line-height:1.35}
.av2-divider {
  display:flex;align-items:center;gap:12px;margin:26px 0 18px;color:var(--text-3);
  font-size:10.5px;font-weight:750;letter-spacing:.15em;text-transform:uppercase;
}
.av2-divider::before,.av2-divider::after {content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--line))}
.av2-divider::after {background:linear-gradient(270deg,transparent,var(--line))}
.av2-group {display:flex;flex-direction:column;gap:20px}

/* Avatar */
.av2-avatar-wrap {display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center}
.av2-avatar {
  position:relative;display:block;width:clamp(116px,32vw,140px);height:clamp(116px,32vw,140px);padding:4px;
  border:0;border-radius:50%;background:${GRADIENT};cursor:pointer;
  box-shadow:0 18px 38px -18px rgba(68,49,247,.65);
  transition:transform .25s,box-shadow .25s;-webkit-tap-highlight-color:transparent;
}
.av2-avatar:hover:not(:disabled) {transform:translateY(-2px)}
.av2-avatar:disabled {opacity:.55;cursor:not-allowed}
.av2-avatar[data-drag="true"] {transform:scale(1.05);box-shadow:0 0 0 6px var(--field-ring),0 18px 38px -18px rgba(68,49,247,.85)}
.av2-avatar-img {position:relative;display:block;width:100%;height:100%;overflow:hidden;border-radius:50%;background:var(--field-bg-solid)}
.av2-avatar-img img {display:block;width:100%;height:100%;object-fit:cover}
.av2-avatar-empty {display:grid;place-items:center;width:100%;height:100%;color:var(--text-3)}
.av2-avatar-badge {
  position:absolute;right:-2px;bottom:-2px;display:grid;place-items:center;width:40px;height:40px;
  border:3px solid var(--bg);border-radius:50%;background:${GRADIENT};color:#fff;
  box-shadow:0 8px 18px -8px rgba(68,49,247,.7);
}
.av2-avatar-progress {position:absolute;inset:0;display:grid;place-items:center;background:rgba(3,7,27,.6);color:#fff}
.av2-avatar-progress .av2-ring {width:70px;height:70px}
.av2-ring {position:relative;display:inline-grid;place-items:center}
.av2-ring svg {width:100%;height:100%}
.av2-ring-time {position:absolute;inset:0;display:grid;place-items:center;font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}
.av2-photo-title {margin:0;font-size:14px;font-weight:750}
.av2-photo-sub {margin:3px 0 0;color:var(--text-3);font-size:12px;line-height:1.5}

/* Labels + messages */
.av2-label-row {display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px 2px}
.av2-label {display:flex;align-items:center;gap:3px;color:var(--text-2);font-size:13px;font-weight:700;transition:color .2s}
.av2-label[data-focus="true"] {color:var(--accent-text)}
.av2-label[data-invalid="true"] {color:var(--danger)}
.av2-req {color:var(--danger);font-weight:800}
.av2-hint {color:var(--text-3);font-size:11px;font-weight:650;font-variant-numeric:tabular-nums}
.av2-hint[data-warn="true"] {color:var(--warn)}
.av2-fmsg {display:flex;align-items:center;gap:7px;margin:9px 2px 0;font-size:12px;font-weight:650;line-height:1.45;overflow:hidden}
.av2-fmsg svg {flex:none}
.av2-fmsg[data-state="available"] {color:var(--success)}
.av2-fmsg[data-state="taken"],.av2-fmsg[data-state="error"] {color:var(--danger)}
.av2-fmsg[data-state="invalid"] {color:var(--warn)}
.av2-fmsg[data-state="checking"] {color:var(--accent-text)}
.av2-fmsg[data-state="idle"] {color:var(--text-3)}

/* Rectangular glass field */
.av2-field {
  position:relative;display:flex;align-items:center;gap:10px;min-width:0;height:56px;padding:0 13px;
  border:1px solid var(--field-border);border-radius:12px;background:var(--field-bg);
  color:var(--text-3);box-shadow:var(--field-inset);
  -webkit-backdrop-filter:blur(16px) saturate(145%);backdrop-filter:blur(16px) saturate(145%);
  transition:border-color .22s,background .22s,box-shadow .22s,color .22s;
}
.av2-field::after {
  content:"";position:absolute;left:10px;right:10px;bottom:-1px;height:2px;border-radius:2px;
  background:${GRADIENT};transform:scaleX(0);transform-origin:left center;
  transition:transform .32s cubic-bezier(.22,1,.36,1);pointer-events:none;
}
.av2-field:hover {border-color:var(--field-border-hover)}
.av2-field:focus-within {
  border-color:var(--field-focus);background:var(--field-bg-focus);color:var(--accent-text);
  box-shadow:var(--field-inset),0 0 0 3px var(--field-ring);
}
.av2-field:focus-within::after {transform:scaleX(1)}
.av2-field[data-valid="true"] {border-color:var(--success);color:var(--success);box-shadow:var(--field-inset),0 0 0 3px var(--success-ring)}
.av2-field[data-valid="true"]::after {background:var(--success);transform:scaleX(1)}
.av2-field[data-invalid="true"] {border-color:var(--danger);color:var(--danger);box-shadow:var(--field-inset),0 0 0 3px var(--danger-ring)}
.av2-field[data-invalid="true"]::after {background:var(--danger);transform:scaleX(1)}
.av2-field[data-disabled="true"] {opacity:.55;cursor:not-allowed}
.av2-field[data-area="true"] {height:auto;align-items:flex-start;padding:15px 13px}
.av2-field-ico {display:grid;place-items:center;flex:none}
.av2-at {flex:none;font-size:16px;font-weight:750;line-height:1}
.av2-input {
  flex:1;min-width:0;height:100%;padding:0;border:0;outline:0;background:transparent;
  color:var(--text);font:inherit;font-size:16px;font-weight:600;letter-spacing:-.01em;
  text-overflow:ellipsis;appearance:none;-webkit-appearance:none;
}
.av2-input::placeholder {color:var(--text-3);font-size:15px;font-weight:450;letter-spacing:0}
.av2-input:disabled {cursor:not-allowed}
.av2-input:-webkit-autofill,.av2-input:-webkit-autofill:focus {
  -webkit-text-fill-color:var(--text);caret-color:var(--text);-webkit-box-shadow:0 0 0 1000px var(--field-bg-solid) inset;
}
.av2-area {height:auto;min-height:78px;resize:none;line-height:1.55;font-weight:550;text-overflow:clip}
.av2-state-ico {display:grid;place-items:center;flex:none;width:22px;height:22px;border-radius:50%;color:#fff}
.av2-state-ico[data-state="available"] {background:var(--success)}
.av2-state-ico[data-state="bad"] {background:var(--danger)}
.av2-state-ico[data-state="busy"] {color:var(--accent-text)}

/* Actions */
.av2-btn {
  position:relative;isolation:isolate;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:11px;
  width:100%;min-height:56px;padding:0 20px;border:1px solid rgba(255,255,255,.18);border-radius:17px;
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
.av2-btn[data-done="true"] {
  background:linear-gradient(135deg,var(--success),color-mix(in srgb,var(--success) 60%,#055BFB));
  color:#fff;cursor:default;border-color:rgba(255,255,255,.18);box-shadow:0 12px 26px -12px var(--success)
}
.av2-secondary {
  display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:48px;padding:0 16px;
  border:1px solid var(--field-border);border-radius:14px;background:var(--field-bg);color:var(--accent-text);
  font:inherit;font-size:13.5px;font-weight:750;cursor:pointer;-webkit-tap-highlight-color:transparent;
  transition:border-color .2s,background .2s;
}
.av2-secondary:hover:not(:disabled) {border-color:var(--field-border-hover);background:var(--field-bg-focus)}
.av2-secondary:disabled {opacity:.5;cursor:not-allowed}
.av2-secondary[data-muted="true"] {color:var(--text-2)}
.av2-actions {display:flex;flex-direction:column;gap:12px;margin-top:28px}
.av2-note {margin:0;text-align:center;color:var(--text-3);font-size:12px;line-height:1.55}
.av2-note[data-tone="warn"] {color:var(--warn);font-weight:650}
.av2-foot {margin:17px 0 0;text-align:center;color:var(--text-3);font-size:12px}
.av2-spin {animation:av2-spin .8s linear infinite;transform-origin:center}
.av2-loading {display:flex;flex-direction:column;align-items:center;gap:14px;color:var(--text-2);font-size:14px}

.av2-root button:focus-visible,.av2-root input:focus-visible,.av2-root textarea:focus-visible {outline:2px solid var(--focus-outline);outline-offset:3px}
.av2-root .av2-input:focus-visible {outline:none}
.av2-root .av2-avatar:focus-visible {outline-offset:5px}

@keyframes av2-spin {to{transform:rotate(360deg)}}
@keyframes av2-shine {to{transform:translateX(120%)}}

@media(min-width:520px) {.av2-card {padding:33px 32px 26px}}
@media(max-width:390px) {
  .av2-shell {padding-left:13px;padding-right:13px}
  .av2-card {padding:24px 15px 20px;border-radius:24px}
  .av2-steps {margin-bottom:20px}
  .av2-step {min-width:60px;gap:8px}
  .av2-dot {width:42px;height:42px}
  .av2-line {margin-top:20px;min-width:12px}
  .av2-step-label {font-size:11.5px}
  .av2-field {padding:0 11px;height:54px}
  .av2-field[data-area="true"] {height:auto;padding:14px 11px}
  .av2-divider {margin:22px 0 16px}
}
@media(max-height:560px) and (orientation:landscape) {.av2-steps {display:none}}
.av2-root[data-lowperf="true"] .av2-card,
.av2-root[data-lowperf="true"] .av2-field,
.av2-root[data-lowperf="true"] .av2-id-chip,
.av2-root[data-lowperf="true"] .av2-dot {-webkit-backdrop-filter:none;backdrop-filter:none}
.av2-root[data-lowperf="true"] .av2-card {background:var(--field-bg-solid)}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))) {
  .av2-card {background:var(--field-bg-solid)}
  .av2-field,.av2-id-chip {background:var(--field-bg-solid)}
}
@media(forced-colors:active) {
  .av2-card,.av2-field,.av2-id-chip {border:1px solid CanvasText}
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

const UserIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
  </Svg>
);
const CameraIcon = (p) => (
  <Svg {...p}>
    <path d="M3 9a2 2 0 0 1 2-2h.93a2 2 0 0 0 1.66-.89l.82-1.22A2 2 0 0 1 10.07 4h3.86a2 2 0 0 1 1.66.89l.82 1.22A2 2 0 0 0 18.07 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z" />
    <circle cx="12" cy="13" r="3.2" />
  </Svg>
);
const BoltIcon = (p) => (
  <Svg {...p}>
    <path d="M13 3 4.5 13.5H11L10 21l8.5-10.5H12L13 3z" />
  </Svg>
);
const CheckIcon = (p) => (
  <Svg {...p}>
    <path d="m5 12.5 4.6 4.6L19 7.6" />
  </Svg>
);
const CloseIcon = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
const AlertIcon = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.8v5M12 16.4h.01" />
  </Svg>
);
const ArrowRightIcon = (p) => (
  <Svg {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
const MailIcon = (p) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m3.5 7.5 7.4 4.6a2 2 0 0 0 2.2 0l7.4-4.6" />
  </Svg>
);
const PhoneIcon = (p) => (
  <Svg {...p}>
    <path d="M5 4h3.3a1 1 0 0 1 .95.68l1.5 4.5a1 1 0 0 1-.5 1.2l-2.26 1.13a11 11 0 0 0 5.52 5.52l1.13-2.26a1 1 0 0 1 1.2-.5l4.5 1.5a1 1 0 0 1 .68.95V19a2 2 0 0 1-2 2h-1C9.72 21 3 14.28 3 6V5a1 1 0 0 1 1-1z" />
  </Svg>
);
const GoogleIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
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

const PerfectAvatarUploader = React.memo(
  ({ onUpload, currentAvatar, displayName, userId, loading = false }) => {
    const [avatarPreview, setAvatarPreview] = useState(currentAvatar);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
      if (!currentAvatar && displayName && userId) {
        try {
          setAvatarPreview(generateDefaultAvatar(userId, displayName));
        } catch (error) {
          setAvatarPreview("/assets/default-profile.png");
        }
      } else if (currentAvatar) {
        setAvatarPreview(currentAvatar);
      }
    }, [currentAvatar, displayName, userId]);

    const handleFileSelect = async (file) => {
      if (!file || !file.type.startsWith("image/")) {
        toast.error("Please select a valid image");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Maximum file size is 5MB");
        return;
      }
      try {
        const reader = new FileReader();
        reader.onloadend = () => setAvatarPreview(reader.result);
        reader.readAsDataURL(file);
        setUploadProgress(10);
        const uploadPath = `avatars/${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}_${file.name.replace(/\s+/g, "_")}`;
        const result = await storageService.uploadFileWithProgress(
          file,
          uploadPath,
          {
            onProgress: (progressData) =>
              setUploadProgress(progressData.progress),
          }
        );
        setUploadProgress(100);
        if (result.success && onUpload) {
          onUpload(result.downloadURL);
          toast.success("🎉 Profile picture updated!");
        }
        setTimeout(() => setUploadProgress(0), 1000);
      } catch (error) {
        console.error("Avatar upload error:", error);
        toast.error("Upload failed. Please try again.");
        setUploadProgress(0);
      }
    };

    const handleClick = () => {
      if (!loading && fileInputRef.current) fileInputRef.current.click();
    };

    // Drag & drop (desktop convenience) feeds the same handler as the picker.
    const handleDragOver = (e) => {
      if (loading) return;
      e.preventDefault();
      setIsDragging(true);
    };
    const handleDragLeave = () => setIsDragging(false);
    const handleDrop = (e) => {
      e.preventDefault();
      setIsDragging(false);
      if (loading) return;
      handleFileSelect(e.dataTransfer?.files?.[0]);
    };

    const circumference = 2 * Math.PI * 40;

    return (
      <div className="av2-avatar-wrap">
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            handleFileSelect(e.target.files?.[0]);
            e.target.value = "";
          }}
          accept="image/*"
          style={{ display: "none" }}
          disabled={loading}
          tabIndex={-1}
          aria-hidden="true"
        />

        <motion.button
          type="button"
          className="av2-avatar"
          data-drag={isDragging}
          onClick={handleClick}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={loading}
          whileTap={!loading ? { scale: 0.97 } : undefined}
          aria-label="Change profile picture"
        >
          <span className="av2-avatar-img">
            {avatarPreview ? (
              <motion.img
                src={avatarPreview}
                alt="Your profile picture preview"
                initial={{ scale: 1 }}
                animate={{
                  scale: isHovering ? 1.1 : 1,
                  filter: isHovering ? "brightness(1.05)" : "brightness(1)",
                }}
                transition={{ duration: 0.3 }}
                draggable={false}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = generateDefaultAvatar(
                    userId || "temp",
                    displayName || "User"
                  );
                }}
              />
            ) : (
              <span className="av2-avatar-empty">
                <UserIcon size={58} stroke={1.3} />
              </span>
            )}

            {uploadProgress > 0 && (
              <motion.span
                className="av2-avatar-progress"
                role="progressbar"
                aria-label="Uploading profile picture"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(uploadProgress)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <span className="av2-ring">
                  <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
                    <defs>
                      <linearGradient id="av2-avatar-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#B8AAFF" />
                        <stop offset="55%" stopColor="#7A6BFF" />
                        <stop offset="100%" stopColor="#5AA2FF" />
                      </linearGradient>
                    </defs>
                    <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="8" />
                    <motion.circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="url(#av2-avatar-ring)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset: circumference * (1 - uploadProgress / 100) }}
                      transition={{ duration: 0.5 }}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <span className="av2-ring-time">{Math.round(uploadProgress)}%</span>
                </span>
              </motion.span>
            )}
          </span>

          <span className="av2-avatar-badge" aria-hidden="true">
            <CameraIcon size={18} />
          </span>
        </motion.button>

        <div>
          <p className="av2-photo-title">Profile Picture</p>
          <p className="av2-photo-sub">Tap to upload or we'll generate one<br />Images up to 5MB</p>
        </div>
      </div>
    );
  }
);
PerfectAvatarUploader.displayName = "PerfectAvatarUploader";

const SmartUsernameGenerator = React.memo(
  ({ username, onChange, loading = false, displayName = "", userId = null }) => {
    const [status, setStatus] = useState("idle");
    const [message, setMessage] = useState("");
    const [isChecking, setIsChecking] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const timeoutRef = useRef(null);
    const generatedRef = useRef(null);

    const validateUsername = useCallback(
      async (value) => {
        if (!value || value.trim().length < 3) {
          setStatus("idle");
          setMessage(value && value.trim().length > 0 ? "Minimum 3 characters" : "");
          return;
        }
        if (!/^[a-zA-Z0-9_.-]+$/.test(value)) {
          setStatus("invalid");
          setMessage("Use letters, numbers, dots, dashes, or underscores");
          return;
        }
        if (value.length > 30) {
          setStatus("invalid");
          setMessage("Maximum 30 characters");
          return;
        }

        setIsChecking(true);
        setStatus("checking");
        setMessage("Checking availability...");

        try {
          const result = await checkUsernameAvailability(value, userId);
          if (result.available) {
            setStatus("available");
            setMessage("Username available!");
          } else if (result.error) {
            setStatus("error");
            setMessage("Unable to verify – try again");
          } else {
            setStatus("taken");
            setMessage("Username is taken");
          }
        } catch (error) {
          setStatus("error");
          setMessage("Unable to verify");
        } finally {
          setIsChecking(false);
        }
      },
      [userId]
    );

    const generateSmartUsername = useCallback(async () => {
      if (!displayName || !displayName.trim()) {
        toast.error("Please enter a display name first");
        return;
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsGenerating(true);
      setStatus("checking");
      setMessage("Generating unique username...");

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Generation timeout")), 8000)
      );

      try {
        const { generateUniqueUsername } = await import("../services/userService.js");
        const generationPromise = generateUniqueUsername(displayName, userId);
        const generated = await Promise.race([generationPromise, timeoutPromise]);

        if (generated && generated.length >= 3) {
          generatedRef.current = generated;
          onChange(generated);
          setStatus("available");
          setMessage("Username available!");
          setIsGenerating(false);
          toast.success("Username generated!");
          return;
        }
        throw new Error("Empty username generated");
      } catch (error) {
        console.warn("Username generation fallback triggered:", error);
        try {
          const { generateUniqueUsername } = await import("../services/userService.js");
          const fallback = await generateUniqueUsername("user", userId);
          if (fallback && fallback.length >= 3) {
            generatedRef.current = fallback;
            onChange(fallback);
            setStatus("available");
            setMessage("Username available!");
            setIsGenerating(false);
            toast.info("Auto‑generated username: " + fallback);
            return;
          }
        } catch (err) {
          console.warn("Username fallback error:", err);
        }
        setIsGenerating(false);
        setStatus("error");
        setMessage("Could not generate a username. Pick one manually.");
        toast.error("Username generation failed — please enter a username manually.");
      }
    }, [displayName, onChange, userId]);

    useEffect(() => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // If the current username was just produced by the generator, skip redundant check
      if (generatedRef.current && username === generatedRef.current) {
        return;
      }
      // User typed something else -> invalidate generated cache
      generatedRef.current = null;

      if (username.length >= 3) {
        timeoutRef.current = setTimeout(() => validateUsername(username), 400);
      } else {
        setStatus("idle");
        setMessage(username.length > 0 ? "Minimum 3 characters" : "");
      }
      return () => clearTimeout(timeoutRef.current);
    }, [username, validateUsername]);

    const isBad = status === "taken" || status === "invalid" || status === "error";
    const isGood = status === "available";
    const showIndicator = username.length >= 3 && status !== "idle";
    const disabled = loading || isGenerating;
    const genDisabled = loading || isGenerating || !displayName;

    return (
      <div>
        <div className="av2-label-row">
          <label
            htmlFor="setup-username"
            className="av2-label"
            data-focus={isFocused}
            data-invalid={isBad}
          >
            Username <span className="av2-req" aria-hidden="true">*</span>
          </label>
          <span className="av2-hint" data-warn={username.length > 30}>{username.length}/30</span>
        </div>

        <div className="av2-field" data-valid={isGood && !isFocused} data-invalid={isBad} data-disabled={!!disabled}>
          <span className="av2-at" aria-hidden="true">@</span>
          <input
            id="setup-username"
            name="username"
            type="text"
            className="av2-input"
            value={username}
            onChange={(e) => onChange(e.target.value.replace(/\s+/g, "").toLowerCase())}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            placeholder="yourusername"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-invalid={isBad}
            aria-describedby="setup-username-msg"
          />
          {showIndicator && (
            <span
              className="av2-state-ico"
              data-state={isChecking || isGenerating ? "busy" : isGood ? "available" : isBad ? "bad" : undefined}
              aria-hidden="true"
            >
              {isChecking || isGenerating ? (
                <SpinnerIcon size={18} stroke={2.4} />
              ) : isGood ? (
                <CheckIcon size={13} stroke={3.2} />
              ) : isBad ? (
                <CloseIcon size={12} stroke={3.2} />
              ) : null}
            </span>
          )}
        </div>

        <div id="setup-username-msg" role="status" aria-live="polite">
          <AnimatePresence initial={false}>
            {message && (
              <motion.p
                key={status + message}
                className="av2-fmsg"
                data-state={status}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
              >
                {isGood ? <CheckIcon size={14} stroke={2.6} /> : status === "checking" ? <SpinnerIcon size={14} stroke={2.4} /> : status === "idle" ? null : <AlertIcon size={14} />}
                <span>{message}</span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={generateSmartUsername}
          disabled={genDisabled}
          className="av2-secondary"
          style={{ marginTop: 12 }}
        >
          {isGenerating ? (
            <>
              <SpinnerIcon size={16} stroke={2.4} />
              <span>Generating smart username...</span>
            </>
          ) : (
            <>
              <BoltIcon size={16} />
              <span>Generate Smart Username</span>
            </>
          )}
        </button>
      </div>
    );
  }
);
SmartUsernameGenerator.displayName = "SmartUsernameGenerator";

/* ────────────────────────────────────────────────────────────────────────────
 * Screen
 * ──────────────────────────────────────────────────────────────────────────── */

export default function SetupProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const themeCtx = useTheme?.() || { theme: "light" };
  const { theme } = themeCtx;
  const { user, updateUserProfile, authService, needsOnboarding, profileResolved } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user || !profileResolved) return;
    if (!needsOnboarding) {
      console.log("Profile already complete, redirecting to /home");
      navigate("/home", { replace: true });
    }
  }, [user, needsOnboarding, profileResolved, navigate]);

  const signupData = useMemo(() => {
    try {
      const step1Session = sessionStorage.getItem("signup_step1");
      const step1Local = localStorage.getItem("signup_step1");
      const signupSession = sessionStorage.getItem("signup_data");
      const signupLocal = localStorage.getItem("signup_data");
      const parsedStep1 = step1Session ? JSON.parse(step1Session) : (step1Local ? JSON.parse(step1Local) : {});
      const parsedSignup = signupSession ? JSON.parse(signupSession) : (signupLocal ? JSON.parse(signupLocal) : {});
      return { ...parsedStep1, ...parsedSignup };
    } catch {
      return {};
    }
  }, []);

  const stateData = location.state?.userData || {};
  const stateMethod = location.state?.method || null;
  const step1FromState = location.state?.step1Data || {};

  const resolvedTheme =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  const buildDisplayName = useCallback(() => {
    const step1 = signupData.firstName ? signupData : (step1FromState.firstName ? step1FromState : (() => {
      try {
        return JSON.parse(sessionStorage.getItem("signup_step1") || "{}");
      } catch { return {}; }
    })());
    if (step1.firstName && step1.lastName) {
      return `${step1.firstName} ${step1.lastName}`.trim();
    }
    if (step1.firstName) return step1.firstName;
    if (step1.lastName) return step1.lastName;
    if (stateData.displayName && !/^User\s+\d{2,6}$/i.test(stateData.displayName)) return stateData.displayName;
    if (user?.displayName && !/^User\s+\d{2,6}$/i.test(user.displayName)) return user.displayName;
    if (user?.email) return user.email.split('@')[0];
    return "";
  }, [signupData, step1FromState, stateData, user]);

  const getInitials = useCallback(() => {
    const displayName = buildDisplayName();
    const step1 = signupData.firstName ? signupData : (step1FromState.firstName ? step1FromState : (() => {
      try {
        return JSON.parse(sessionStorage.getItem("signup_step1") || "{}");
      } catch { return {}; }
    })());

    const isPhoneLike = (str) => /^\+?\d+$/.test(String(str || '').trim());
    let username = "";
    if (signupData.username && !signupData.username.startsWith("user_") && !isPhoneLike(signupData.username)) {
      username = signupData.username;
    } else if (stateData.username && !stateData.username.startsWith("user_") && !isPhoneLike(stateData.username)) {
      username = stateData.username;
    } else if (step1.firstName) {
      const nameBase = `${step1.firstName}${step1.lastName ? '_' + step1.lastName : ''}`.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (nameBase.length >= 3) username = nameBase.slice(0, 20);
    } else if (displayName && !/^User\s+\d{2,6}$/i.test(displayName)) {
      const nameBase = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (nameBase.length >= 3) username = nameBase.slice(0, 20);
    } else if (user?.email) {
      username = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
    }

    const avatar = signupData.photoURL || stateData.photoURL || user?.photoURL || "";
    const authProvider = signupData.authProvider || stateData.authProvider || stateMethod || user?.authProvider || "email";
    const identifier = signupData.phoneNumber || signupData.email || stateData.phoneNumber || stateData.email || user?.phoneNumber || user?.email || "";
    return { displayName, username, avatar, authProvider, identifier };
  }, [buildDisplayName, signupData, stateData, stateMethod, step1FromState, user]);

  const [displayName, setDisplayName] = useState(() => getInitials().displayName);
  const [username, setUsername] = useState(() => getInitials().username);
  const [avatarUrl, setAvatarUrl] = useState(() => getInitials().avatar);
  const [authProvider, setAuthProvider] = useState(() => getInitials().authProvider);
  const [identifier, setIdentifier] = useState(() => getInitials().identifier);
  const [bio, setBio] = useState(() => signupData.bio || stateData.bio || user?.bio || "");
  const [loading, setLoading] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [bioFocused, setBioFocused] = useState(false);

  const initialLoadedRef = useRef(false);

  useEffect(() => {
    if (!initialLoadedRef.current && (user?.uid || signupData.firstName || stateData.displayName)) {
      initialLoadedRef.current = true;
      const initial = getInitials();
      if (!displayName || displayName === "Arvdoul User") setDisplayName(initial.displayName);
      if (!username || username.startsWith("user_") || /^\+?\d+$/.test(username)) setUsername(initial.username);
      if (!avatarUrl && initial.avatar) setAvatarUrl(initial.avatar);
      if (initial.authProvider) setAuthProvider(initial.authProvider);
      if (initial.identifier) setIdentifier(initial.identifier);
      if (!bio && (signupData.bio || stateData.bio || user?.bio)) {
        setBio(signupData.bio || stateData.bio || user?.bio || "");
      }
    }
  }, [user?.uid, signupData, stateData, getInitials, bio, displayName, username, avatarUrl]);

  const handleAvatarUpload = (url) => setAvatarUrl(url);

  const updateFirebaseAuthProfile = async (authUser, profile) => {
    if (!authUser) return;
    try {
      const { getAuthService } = await import('../services/authService.js');
      await getAuthService().updateAuthProfile({
        displayName: profile.displayName,
        photoURL: profile.photoURL,
      });
    } catch (err) {
      console.warn("Failed to update Auth profile", err);
    }
  };

  // Refresh user profile from Firestore without illegal full-doc update
  const refreshUserProfile = async () => {
    if (!user?.uid) return;
    setRefreshing(true);
    try {
      const freshProfile = await getUserProfile(user.uid);
      if (freshProfile) {
        console.log("Profile refreshed:", freshProfile);
      }
    } catch (err) {
      console.warn("Failed to refresh profile", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSubmit = async () => {
    if (loading || profileComplete || !displayName.trim() || username.length < 3) return;
    setLoading(true);
    try {
      const avail = await checkUsernameAvailability(username, user?.uid);
      if (!avail.available) {
        toast.error(avail.error || "Username not available");
        setLoading(false);
        return;
      }

      const finalAvatar = avatarUrl || generateDefaultAvatar(user.uid, displayName);
      const step1 = signupData.firstName ? signupData : (step1FromState.firstName ? step1FromState : (() => {
        try {
          return JSON.parse(sessionStorage.getItem("signup_step1") || "{}");
        } catch { return {}; }
      })());

      const result = await createUserProfile(user.uid, {
        uid: user.uid,
        displayName: displayName.trim(),
        firstName: step1.firstName || "",
        lastName: step1.lastName || "",
        gender: step1.gender || "",
        dob: step1.dob || {},
        username: username.toLowerCase().trim(),
        bio: bio.trim(),
        photoURL: finalAvatar,
        email: user?.email || "",
        emailVerified: user?.emailVerified || false,
        phoneNumber: user?.phoneNumber || "",
        isProfileComplete: true,
        authProvider: authProvider || "email",
      });

      if (!result.success) throw new Error(result.error || "Profile creation failed");

      // Update Firebase Auth user profile
      if (authService?.auth?.currentUser) {
        await updateFirebaseAuthProfile(authService.auth.currentUser, {
          displayName: displayName.trim(),
          photoURL: finalAvatar,
        });
      }

      await refreshUserProfile();

      sessionStorage.removeItem("signup_step1");
      sessionStorage.removeItem("signup_data");
      localStorage.removeItem("signup_step1");
      localStorage.removeItem("signup_data");
      localStorage.removeItem("signup_data_persist");
      clearOnboardingRequired();
      setProfileComplete(true);
      toast.success("🎉 Profile setup complete!");
      setTimeout(() => navigate("/home", { replace: true, state: { welcomeMessage: true } }), 500);
    } catch (error) {
      const msg = error?.message?.includes("does not exist") || error?.message?.includes("datastore/setup")
        ? "Database connection updating. Please tap again."
        : (error?.message || "Failed to create profile");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!displayName.trim()) return toast.error("Display name required");
    const finalUsername = username || `user_${Date.now().toString(36).slice(-8)}`;
    setUsername(finalUsername);
    setLoading(true);
    try {
      const finalAvatar = avatarUrl || generateDefaultAvatar(user.uid, displayName);
      const step1 = signupData.firstName ? signupData : (step1FromState.firstName ? step1FromState : (() => {
        try {
          return JSON.parse(sessionStorage.getItem("signup_step1") || "{}");
        } catch { return {}; }
      })());

      const result = await createUserProfile(user.uid, {
        uid: user.uid,
        displayName: displayName.trim(),
        firstName: step1.firstName || "",
        lastName: step1.lastName || "",
        gender: step1.gender || "",
        dob: step1.dob || {},
        username: finalUsername.toLowerCase(),
        bio: bio.trim(),
        photoURL: finalAvatar,
        email: user?.email || "",
        emailVerified: user?.emailVerified || false,
        phoneNumber: user?.phoneNumber || "",
        isProfileComplete: true,
        authProvider: authProvider || "email",
      });
      if (!result.success) throw new Error(result.error || "Profile creation failed");
      if (authService?.auth?.currentUser) {
        await updateFirebaseAuthProfile(authService.auth.currentUser, {
          displayName: displayName.trim(),
          photoURL: finalAvatar,
        });
      }
      await refreshUserProfile();
      sessionStorage.removeItem("signup_step1");
      sessionStorage.removeItem("signup_data");
      localStorage.removeItem("signup_step1");
      localStorage.removeItem("signup_data");
      localStorage.removeItem("signup_data_persist");
      clearOnboardingRequired();
      setProfileComplete(true);
      toast.success("🎉 Profile setup complete!");
      setTimeout(() => navigate("/home", { replace: true, state: { welcomeMessage: true } }), 500);
    } catch (err) {
      const msg = err?.message?.includes("does not exist") || err?.message?.includes("datastore/setup")
        ? "Database connection updating. Please tap again."
        : (err?.message || "Profile creation failed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const providerMeta = {
    phone: { label: "Phone", icon: <PhoneIcon size={16} /> },
    email: { label: "Email", icon: <MailIcon size={16} /> },
    google: { label: "Google", icon: <GoogleIcon size={16} /> },
  }[authProvider] || null;

  // UI-only derivations -----------------------------------------------------
  const canSubmit = !loading && !profileComplete && !!displayName.trim() && username.length >= 3;
  const missingHint = !displayName.trim() && username.length < 3
    ? "Add a display name and a username of at least 3 characters to continue."
    : !displayName.trim()
      ? "Add a display name to continue."
      : username.length < 3
        ? "Choose a username of at least 3 characters to continue."
        : "";
  const bioLeft = 150 - bio.length;
  const rootVariables = resolvedTheme === "dark" ? THEMES.dark : THEMES.light;
  const lowPerf = typeof navigator !== "undefined" && !!navigator.deviceMemory && navigator.deviceMemory < 4;
  const year = new Date().getFullYear();

  if (!user?.uid) {
    return (
      <div className="av2-root" style={rootVariables} data-theme={resolvedTheme} data-lowperf={lowPerf}>
        <style>{STYLES}</style>
        <div className="av2-bg" aria-hidden="true">
          <span className="av2-orb av2-orb-a" />
          <span className="av2-orb av2-orb-b" />
          <span className="av2-dots" />
        </div>
        <main className="av2-shell" style={{ alignItems: "center", justifyContent: "center" }}>
          <div className="av2-loading" role="status">
            <SpinnerIcon size={38} stroke={2.2} style={{ color: "#8B1EF3" }} />
            <p style={{ margin: 0 }}>Redirecting to login…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="av2-root" style={rootVariables} data-theme={resolvedTheme} data-lowperf={lowPerf}>
        <style>{STYLES}</style>

        <div className="av2-bg" aria-hidden="true">
          <span className="av2-orb av2-orb-a" />
          <span className="av2-orb av2-orb-b" />
          <span className="av2-orb av2-orb-c" />
          <span className="av2-dots" />
        </div>

        <main className="av2-shell">
          <motion.div
            className="av2-wrap"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <StepIndicator currentStep={3} />

            <section className="av2-card" aria-labelledby="setup-title" aria-busy={loading}>
              <span className="av2-spec" aria-hidden="true" />
              <span className="av2-rim" aria-hidden="true" />

              <form
                className="av2-content"
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit();
                }}
              >
                <header className="av2-head">
                  <h1 id="setup-title" className="av2-h1">Complete Your Profile</h1>
                  <p className="av2-sub">Almost done! Let's personalize your account</p>
                  {providerMeta && identifier && (
                    <span className="av2-id-chip" title={`Signed up with ${providerMeta.label}`}>
                      {providerMeta.icon}
                      <span>{identifier}</span>
                    </span>
                  )}
                </header>

                <div className="av2-divider" aria-hidden="true">Profile photo</div>

                <PerfectAvatarUploader
                  onUpload={handleAvatarUpload}
                  currentAvatar={avatarUrl}
                  displayName={displayName}
                  userId={user?.uid}
                  loading={loading}
                />

                <div className="av2-divider" aria-hidden="true">Your identity</div>

                <div className="av2-group">
                  <div>
                    <div className="av2-label-row">
                      <label htmlFor="setup-display-name" className="av2-label" data-focus={nameFocused}>
                        Display Name <span className="av2-req" aria-hidden="true">*</span>
                      </label>
                      <span className="av2-hint" data-warn={displayName.length >= 45}>{displayName.length}/50</span>
                    </div>
                    <div className="av2-field" data-disabled={!!loading}>
                      <span className="av2-field-ico"><UserIcon size={19} /></span>
                      <input
                        id="setup-display-name"
                        name="displayName"
                        type="text"
                        className="av2-input"
                        value={displayName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDisplayName(val);
                          if (!username || username.startsWith("user_")) {
                            const generated = val.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 15);
                            if (generated.length >= 3) {
                              setUsername(generated);
                            }
                          }
                        }}
                        onFocus={() => setNameFocused(true)}
                        onBlur={() => setNameFocused(false)}
                        disabled={loading}
                        placeholder="Enter your name"
                        maxLength={50}
                        autoComplete="name"
                        autoCapitalize="words"
                        enterKeyHint="next"
                      />
                    </div>
                  </div>

                  <SmartUsernameGenerator
                    username={username}
                    onChange={setUsername}
                    loading={loading}
                    displayName={displayName}
                    userId={user?.uid}
                  />
                </div>

                <div className="av2-divider" aria-hidden="true">About you</div>

                <div>
                  <div className="av2-label-row">
                    <label htmlFor="setup-bio" className="av2-label" data-focus={bioFocused}>
                      Bio <span className="av2-hint" style={{ marginLeft: 4 }}>(Optional)</span>
                    </label>
                    <span className="av2-hint" data-warn={bioLeft <= 20}>{bioLeft} chars left</span>
                  </div>
                  <div className="av2-field" data-area="true" data-disabled={!!loading}>
                    <textarea
                      id="setup-bio"
                      name="bio"
                      className="av2-input av2-area"
                      value={bio}
                      onChange={(e) => setBio(e.target.value.slice(0, 150))}
                      onFocus={() => setBioFocused(true)}
                      onBlur={() => setBioFocused(false)}
                      disabled={loading}
                      placeholder="Tell us about yourself..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="av2-actions">
                  <motion.button
                    type="submit"
                    disabled={loading || profileComplete || !displayName.trim() || username.length < 3}
                    whileTap={canSubmit ? { scale: 0.98 } : undefined}
                    className="av2-btn"
                    data-loading={loading}
                    data-done={profileComplete}
                  >
                    {loading ? (
                      <>
                        <SpinnerIcon size={19} />
                        <span>Creating Profile...</span>
                      </>
                    ) : profileComplete ? (
                      <>
                        <CheckIcon size={20} stroke={2.6} />
                        <span>Profile Created</span>
                      </>
                    ) : (
                      <>
                        <span>Complete Setup</span>
                        <ArrowRightIcon size={19} />
                      </>
                    )}
                  </motion.button>

                  <AnimatePresence initial={false}>
                    {!canSubmit && !loading && !profileComplete && missingHint && (
                      <motion.p
                        key="hint"
                        className="av2-note"
                        data-tone="warn"
                        role="status"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: "hidden" }}
                      >
                        {missingHint}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <button
                    type="button"
                    onClick={handleSkip}
                    disabled={loading || !displayName.trim()}
                    className="av2-secondary"
                    data-muted="true"
                  >
                    Skip for now
                  </button>
                  <p className="av2-note">Skipping keeps what you've entered so far.</p>

                  {refreshing && (
                    <p className="av2-note" role="status">Refreshing profile...</p>
                  )}
                </div>
              </form>
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
