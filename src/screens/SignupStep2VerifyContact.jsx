// src/screens/SignupStep2VerifyContact.jsx

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@context/AuthContext.jsx";
import { useTheme } from "@context/ThemeContext.jsx";
import { countryCodes, getCountryByIso } from "../data/countryCodes.js";

/* ────────────────────────────────────────────────────────────────────────────
 * Design system (shared with Signup Step 1)
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
.av2-card>header,.av2-card>.av2-body {position:relative;z-index:1}
.av2-h1 {margin:0;font-size:clamp(23px,5vw,28px);line-height:1.17;font-weight:800;letter-spacing:-.035em}
.av2-sub {margin:9px 0 0;color:var(--text-2);font-size:13.5px;line-height:1.55}
.av2-divider {
  display:flex;align-items:center;gap:12px;margin:23px 0 17px;color:var(--text-3);
  font-size:10.5px;font-weight:750;letter-spacing:.15em;text-transform:uppercase;
}
.av2-divider::before,.av2-divider::after {content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--line))}
.av2-divider::after {background:linear-gradient(270deg,transparent,var(--line))}
.av2-panel {display:flex;flex-direction:column;gap:19px;margin-top:20px}

/* Method switch */
.av2-seg {
  position:relative;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;padding:6px;
  border:1px solid var(--field-border);border-radius:20px;background:var(--field-bg);box-shadow:var(--field-inset);
  -webkit-backdrop-filter:blur(16px) saturate(150%);backdrop-filter:blur(16px) saturate(150%);
}
.av2-seg-btn {
  position:relative;isolation:isolate;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;
  padding:11px 4px 10px;border:0;border-radius:15px;background:transparent;color:var(--text-2);
  font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:color .2s;
}
.av2-seg-btn:hover {color:var(--text)}
.av2-seg-btn[aria-selected="true"] {color:#fff}
.av2-seg-btn:disabled {opacity:.55;cursor:not-allowed}
.av2-seg-pill {
  position:absolute;inset:0;z-index:-1;border-radius:15px;background:${GRADIENT};
  box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 9px 18px -12px rgba(68,49,247,.6);
}
.av2-seg-ico {display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--pop-active);transition:background .2s}
.av2-seg-btn[aria-selected="true"] .av2-seg-ico {background:rgba(255,255,255,.2)}
.av2-seg-ico[data-google="true"] {background:#fff}
.av2-seg-label {font-size:13px;font-weight:750}
.av2-seg-desc {font-size:10.5px;font-weight:600;opacity:.72}

/* Labels + messages */
.av2-label-row {display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px 2px}
.av2-label {display:flex;align-items:center;gap:3px;color:var(--text-2);font-size:13px;font-weight:700;transition:color .2s}
.av2-label[data-focus="true"] {color:var(--accent-text)}
.av2-label[data-invalid="true"] {color:var(--danger)}
.av2-req {color:var(--danger);font-weight:800}
.av2-hint {color:var(--text-3);font-size:11px;font-weight:600}
.av2-msg {display:flex;align-items:flex-start;gap:6px;margin:8px 2px 0;color:var(--danger);font-size:12px;font-weight:650;line-height:1.45}
.av2-msg svg {flex:none;margin-top:1px}

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
.av2-field[data-invalid="true"] {border-color:var(--danger);color:var(--danger);box-shadow:var(--field-inset),0 0 0 3px var(--danger-ring)}
.av2-field[data-invalid="true"]::after {background:var(--danger);transform:scaleX(1)}
.av2-field[data-disabled="true"] {opacity:.55;cursor:not-allowed}
.av2-field-ico {display:grid;place-items:center;flex:none}
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
.av2-iconbtn {
  display:grid;place-items:center;flex:none;width:38px;height:38px;margin-right:-8px;border:0;border-radius:10px;
  background:transparent;color:var(--text-3);cursor:pointer;-webkit-tap-highlight-color:transparent;transition:background .2s,color .2s;
}
.av2-iconbtn:hover {background:var(--pop-active);color:var(--text)}
.av2-iconbtn:disabled {opacity:.5;cursor:not-allowed}

/* Phone */
.av2-phone {display:flex;align-items:stretch;gap:10px}
.av2-phone>.av2-field {flex:1}
.av2-cc {position:relative;flex:none;width:124px}
.av2-cc-btn {
  display:flex;align-items:center;justify-content:space-between;gap:6px;width:100%;height:56px;padding:0 11px;
  border:1px solid var(--field-border);border-radius:12px;background:var(--field-bg);color:var(--text);
  box-shadow:var(--field-inset);font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;
  -webkit-backdrop-filter:blur(16px) saturate(145%);backdrop-filter:blur(16px) saturate(145%);
  transition:border-color .2s,box-shadow .2s,background .2s;
}
.av2-cc-btn:hover {border-color:var(--field-border-hover)}
.av2-cc-btn[data-open="true"] {border-color:var(--field-focus);background:var(--field-bg-focus);box-shadow:var(--field-inset),0 0 0 3px var(--field-ring)}
.av2-cc-btn:disabled {opacity:.55;cursor:not-allowed}
.av2-cc-main {display:flex;align-items:baseline;gap:6px;min-width:0}
.av2-cc-code {font-size:15px;font-weight:750}
.av2-cc-iso {color:var(--text-3);font-size:10.5px;font-weight:700;letter-spacing:.04em}
.av2-chev {flex:none;color:var(--text-3);transition:transform .2s,color .2s}
.av2-cc-btn[data-open="true"] .av2-chev {transform:rotate(180deg);color:var(--field-focus)}
.av2-pop {
  position:absolute;z-index:80;top:calc(100% + 8px);left:0;display:flex;flex-direction:column;overflow:hidden;
  width:min(330px,calc(100vw - 52px));max-height:312px;border:1px solid var(--pop-border);border-radius:16px;
  background:var(--pop-bg);box-shadow:var(--pop-shadow);
  -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
}
.av2-pop-search {
  display:flex;align-items:center;gap:8px;flex:none;height:44px;margin:8px;padding:0 12px;color:var(--text-3);
  border:1px solid var(--field-border);border-radius:10px;background:var(--field-bg);
}
.av2-pop-search:focus-within {border-color:var(--field-focus);box-shadow:0 0 0 3px var(--field-ring)}
.av2-pop-search input {flex:1;min-width:0;height:100%;border:0;outline:0;background:transparent;color:var(--text);font:inherit;font-size:14px;font-weight:550}
.av2-pop-search input::placeholder {color:var(--text-3);font-weight:450}
.av2-pop-list {overflow-y:auto;overscroll-behavior:contain;padding:0 6px 6px;max-height:236px;scrollbar-width:thin;-webkit-overflow-scrolling:touch}
.av2-pop-list::-webkit-scrollbar {width:7px}
.av2-pop-list::-webkit-scrollbar-thumb {background:var(--line);border-radius:8px}
.av2-country {
  display:flex;align-items:center;gap:10px;width:100%;min-height:42px;padding:0 10px;border:0;border-radius:10px;
  background:transparent;color:var(--text-2);font:inherit;font-size:14px;font-weight:550;text-align:left;cursor:pointer;
}
.av2-country:hover {background:var(--pop-active);color:var(--text)}
.av2-country[aria-selected="true"] {background:var(--pop-selected);color:var(--text);font-weight:700}
.av2-country-flag {font-size:18px;line-height:1;flex:none}
.av2-country-name {flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.av2-country-code {flex:none;color:var(--text-3);font-variant-numeric:tabular-nums;font-size:13px}
.av2-country svg {flex:none;color:var(--accent-text)}
.av2-empty {padding:18px 10px;color:var(--text-3);font-size:13px;text-align:center}

/* Security strip */
.av2-sec {
  display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--field-border);
  border-radius:14px;background:var(--field-bg);box-shadow:var(--field-inset);
}
.av2-sec-ico {display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:11px;background:var(--pop-active);color:var(--accent-text)}
.av2-sec[data-status="ready"] .av2-sec-ico {color:var(--success);background:color-mix(in srgb,var(--success) 14%,transparent)}
.av2-sec[data-status="error"] {border-color:color-mix(in srgb,var(--danger) 45%,transparent)}
.av2-sec[data-status="error"] .av2-sec-ico {color:var(--danger);background:color-mix(in srgb,var(--danger) 13%,transparent)}
.av2-sec-text {display:flex;flex-direction:column;gap:2px;min-width:0;flex:1}
.av2-sec-title {font-size:13px;font-weight:750}
.av2-sec-sub {color:var(--text-3);font-size:11.5px;line-height:1.4;overflow-wrap:anywhere}
.av2-sec[data-status="ready"] .av2-sec-sub {color:var(--success);font-weight:650}
.av2-sec[data-status="error"] .av2-sec-sub {color:var(--danger);font-weight:650}
.av2-chip {flex:none;padding:4px 9px;border:1px solid var(--field-border);border-radius:999px;color:var(--text-3);font-size:10px;font-weight:750;white-space:nowrap}
.av2-retry {margin-top:4px;padding:0;border:0;background:none;color:var(--accent-text);font:inherit;font-size:11.5px;font-weight:800;text-decoration:underline;cursor:pointer;text-align:left;width:fit-content}
.av2-recaptcha {min-height:1px}

/* Password */
.av2-meter {display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:11px}
.av2-meter span {position:relative;height:5px;border-radius:5px;background:var(--line);overflow:hidden}
.av2-meter span::after {content:"";position:absolute;inset:0;background:var(--seg);transform:scaleX(0);transform-origin:left;transition:transform .35s ease,background .3s}
.av2-meter span[data-on="true"]::after {transform:scaleX(1)}
.av2-strength {display:flex;align-items:center;justify-content:space-between;margin-top:8px;color:var(--text-3);font-size:11px;font-weight:650}
.av2-strength b {color:var(--text);font-weight:750}
.av2-checks {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 10px;margin-top:10px}
.av2-check {display:flex;align-items:center;gap:7px;min-width:0;color:var(--text-3);font-size:11.5px;font-weight:550;transition:color .2s}
.av2-check[data-met="true"] {color:var(--text);font-weight:650}
.av2-check-dot {display:grid;place-items:center;flex:none;width:17px;height:17px;border-radius:50%;border:1px solid var(--field-border);color:transparent;transition:all .2s}
.av2-check[data-met="true"] .av2-check-dot {border-color:transparent;background:var(--success);color:#fff}
.av2-match {display:flex;align-items:center;gap:6px;margin:8px 2px 0;font-size:12px;font-weight:700}
.av2-match[data-ok="true"] {color:var(--success)}
.av2-match[data-ok="false"] {color:var(--danger)}

/* Google */
.av2-gcard {padding:24px 18px 18px;border:1px solid var(--field-border);border-radius:20px;background:var(--field-bg);box-shadow:var(--field-inset);text-align:center}
.av2-gmark {display:grid;place-items:center;width:64px;height:64px;margin:0 auto 14px;border-radius:20px;background:#fff;box-shadow:0 14px 28px -16px rgba(0,0,0,.45),inset 0 0 0 1px rgba(0,0,0,.06)}
.av2-gtitle {margin:0 0 4px;font-size:17px;font-weight:800;letter-spacing:-.02em}
.av2-gsub {margin:0 0 18px;color:var(--text-2);font-size:12.5px}
.av2-gbtn {
  display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:54px;padding:0 18px;
  border:1px solid rgba(15,23,42,.14);border-radius:16px;background:#fff;color:#1f2937;
  font:inherit;font-size:15px;font-weight:750;cursor:pointer;-webkit-tap-highlight-color:transparent;
  box-shadow:0 12px 24px -16px rgba(0,0,0,.45);transition:transform .2s,box-shadow .2s,background .2s;
}
.av2-gbtn:hover {background:#f8fafc;transform:translateY(-1px)}
.av2-gbtn:disabled {opacity:.6;cursor:not-allowed;transform:none}
.av2-gnote {margin:14px 0 0;color:var(--text-3);font-size:11px;line-height:1.5}

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
.av2-btn[data-loading="true"] {background:${GRADIENT};color:#fff;cursor:progress;box-shadow:var(--btn-shadow)}
.av2-alert {
  display:flex;align-items:flex-start;gap:10px;margin-top:16px;padding:12px 14px;border-radius:14px;
  border:1px solid color-mix(in srgb,var(--danger) 38%,transparent);background:color-mix(in srgb,var(--danger) 9%,transparent);
  color:var(--danger);font-size:12.5px;font-weight:650;line-height:1.5;
}
.av2-alert svg {flex:none;margin-top:1px}
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
.av2-loading {display:flex;flex-direction:column;align-items:center;gap:14px;color:var(--text-2);font-size:14px}

.av2-root button:focus-visible,.av2-root input:focus-visible {outline:2px solid var(--focus-outline);outline-offset:3px}
.av2-root .av2-input:focus-visible,.av2-root .av2-pop-search input:focus-visible {outline:none}

@keyframes av2-spin {to{transform:rotate(360deg)}}
@keyframes av2-shine {to{transform:translateX(120%)}}

@media(min-width:520px) {.av2-card {padding:33px 32px 26px}}
@media(max-width:390px) {
  .av2-shell {padding-left:13px;padding-right:13px}
  .av2-card {padding:24px 17px 20px;border-radius:24px}
  .av2-steps {margin-bottom:20px}
  .av2-step {min-width:60px;gap:8px}
  .av2-dot {width:42px;height:42px}
  .av2-line {margin-top:20px;min-width:12px}
  .av2-step-label {font-size:11.5px}
  .av2-cc {width:108px}
  .av2-cc-code {font-size:14px}
  .av2-field {padding:0 11px;height:54px}
  .av2-cc-btn {height:54px;padding:0 9px}
  .av2-chip {display:none}
  .av2-phone {gap:8px}
}
@media(max-width:340px) {
  .av2-seg-desc {display:none}
  .av2-checks {grid-template-columns:minmax(0,1fr)}
}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))) {
  .av2-card {background:var(--field-bg-solid)}
  .av2-field,.av2-cc-btn,.av2-seg,.av2-pop {background:var(--field-bg-solid)}
}
@media(forced-colors:active) {
  .av2-card,.av2-field,.av2-cc-btn,.av2-pop,.av2-seg,.av2-gcard {border:1px solid CanvasText}
  .av2-seg-btn[aria-selected="true"] {outline:2px solid Highlight}
}
@media(prefers-reduced-motion:reduce) {
  .av2-root *,.av2-root *::before,.av2-root *::after {animation:none!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
}
`;

/* ────────────────────────────────────────────────────────────────────────────
 * Helpers + icons
 * ──────────────────────────────────────────────────────────────────────────── */

function useResolvedTheme() {
  const { theme } = useTheme();
  return theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
}

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
const ChevronIcon = (p) => (
  <Svg {...p}>
    <path d="m6 9.5 6 6 6-6" />
  </Svg>
);
const SearchIcon = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-3.8-3.8" />
  </Svg>
);
const EyeIcon = (p) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);
const EyeOffIcon = (p) => (
  <Svg {...p}>
    <path d="M10.6 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.5 7.2C3.9 9 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.5 0 2.8-.4 4-1" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M3 3l18 18" />
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
const GoogleIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const FieldError = ({ id, message }) => (
  <AnimatePresence initial={false}>
    {message && (
      <motion.p
        id={id}
        key="err"
        className="av2-msg"
        role="alert"
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        style={{ overflow: "hidden" }}
      >
        <AlertIcon size={14} />
        <span>{message}</span>
      </motion.p>
    )}
  </AnimatePresence>
);

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

/* ────────────────────────────────────────────────────────────────────────────
 * Phone input
 * ──────────────────────────────────────────────────────────────────────────── */

const UltimatePhoneInput = React.memo(({
  value,
  onChange,
  error,
  disabled = false,
  onValidationChange = () => {}
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(() => getCountryByIso('US'));
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const countryButtonRef = useRef(null);

  useEffect(() => {
    if (value) {
      const matchedCountry = countryCodes.find(country =>
        value.startsWith(country.code)
      ) || selectedCountry;
      setSelectedCountry(matchedCountry);
      const numberPart = value.slice(matchedCountry.code.length);
      setPhoneNumber(numberPart);
      validatePhoneNumber(`${matchedCountry.code}${numberPart.replace(/\D/g, '')}`);
    } else {
      setPhoneNumber('');
      onValidationChange(false);
    }
  }, [value, selectedCountry]);

  const validatePhoneNumber = (fullNumber) => {
    const cleaned = fullNumber.replace(/\D/g, '');
    const isValid = cleaned.length >= 10 && cleaned.length <= 15;
    onValidationChange(isValid);
    return isValid;
  };

  const handlePhoneChange = (e) => {
    const input = e.target.value;
    const cleaned = input.replace(/[^\d\s\-()]/g, '');
    setPhoneNumber(cleaned);
    const fullNumber = `${selectedCountry.code}${cleaned.replace(/\D/g, '')}`;
    onChange(fullNumber);
    validatePhoneNumber(fullNumber);
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    setShowCountryDropdown(false);
    setSearchQuery('');
    const fullNumber = `${country.code}${phoneNumber.replace(/\D/g, '')}`;
    onChange(fullNumber);
    validatePhoneNumber(fullNumber);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowCountryDropdown(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && showCountryDropdown) {
      event.stopPropagation();
      setShowCountryDropdown(false);
      setSearchQuery('');
      countryButtonRef.current?.focus();
    }
  };

  const filteredCountries = useMemo(() => {
    if (!searchQuery) return countryCodes;
    const query = searchQuery.toLowerCase();
    return countryCodes.filter(country =>
      country.name.toLowerCase().includes(query) ||
      country.code.toLowerCase().includes(query) ||
      country.iso.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <div ref={dropdownRef} onKeyDown={handleKeyDown}>
      <div className="av2-label-row">
        <label
          htmlFor="signup-phone-number"
          className="av2-label"
          data-focus={isFocused || !!value}
          data-invalid={!!error}
        >
          Phone Number <span className="av2-req" aria-hidden="true">*</span>
        </label>
        <span className="av2-hint">SMS verification code</span>
      </div>

      <div className="av2-phone">
        <div className="av2-cc">
          <button
            ref={countryButtonRef}
            type="button"
            onClick={() => !disabled && setShowCountryDropdown(!showCountryDropdown)}
            disabled={disabled}
            className="av2-cc-btn"
            data-open={showCountryDropdown}
            aria-haspopup="listbox"
            aria-expanded={showCountryDropdown}
            aria-label={`Country code ${selectedCountry.code} ${selectedCountry.iso}`}
          >
            <span className="av2-cc-main">
              <span className="av2-cc-code">{selectedCountry.code}</span>
              <span className="av2-cc-iso">{selectedCountry.iso}</span>
            </span>
            <ChevronIcon size={16} className="av2-chev" />
          </button>

          <AnimatePresence>
            {showCountryDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="av2-pop"
                style={{ transformOrigin: "top left" }}
              >
                <label className="av2-pop-search">
                  <SearchIcon size={17} />
                  <input
                    type="text"
                    placeholder="Search country or code"
                    aria-label="Search countries"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoComplete="off"
                    autoFocus
                  />
                </label>
                <div className="av2-pop-list" role="listbox" aria-label="Country codes">
                  {filteredCountries.map((country) => {
                    const isSelected = country.code === selectedCountry.code;
                    return (
                      <button
                        key={`${country.iso}-${country.code}`}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleCountrySelect(country)}
                        className="av2-country"
                      >
                        <span className="av2-country-flag">{country.flag}</span>
                        <span className="av2-country-name">{country.name}</span>
                        <span className="av2-country-code">{country.code}</span>
                        {isSelected && <CheckIcon size={16} stroke={2.6} />}
                      </button>
                    );
                  })}
                  {filteredCountries.length === 0 && (
                    <div className="av2-empty">No countries found</div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="av2-field" data-invalid={!!error} data-disabled={!!disabled}>
          <input
            ref={inputRef}
            id="signup-phone-number"
            name="phone"
            type="tel"
            className="av2-input"
            value={phoneNumber}
            onChange={handlePhoneChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            placeholder="Phone number"
            autoComplete="tel-national"
            inputMode="tel"
            aria-invalid={!!error}
            aria-describedby={error ? "signup-phone-error" : undefined}
          />
        </div>
      </div>

      <FieldError id="signup-phone-error" message={error} />
    </div>
  );
});
UltimatePhoneInput.displayName = 'UltimatePhoneInput';

/* ────────────────────────────────────────────────────────────────────────────
 * Invisible reCAPTCHA
 * ──────────────────────────────────────────────────────────────────────────── */

const InvisibleRecaptcha = React.memo(({ onReady, onError, loading }) => {
  const resolvedTheme = useResolvedTheme();
  const { createRecaptchaVerifier, cleanupRecaptchaVerifier } = useAuth();
  const [status, setStatus] = useState('initializing');
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  }, [onReady, onError]);

  useEffect(() => {
    let mounted = true;
    setStatus('initializing');
    setErrorMessage('');
    const initialize = async () => {
      try {
        cleanupRecaptchaVerifier('signup-recaptcha-container');
        await new Promise(resolve => setTimeout(resolve, 80));
        const verifier = await createRecaptchaVerifier('signup-recaptcha-container', {
          size: 'invisible',
          theme: resolvedTheme === 'dark' ? 'dark' : 'light',
          callback: (response) => console.log('✅ reCAPTCHA solved:', response),
          expiredCallback: () => {
            cleanupRecaptchaVerifier('signup-recaptcha-container');
            if (mounted) {
              setStatus('error');
              setErrorMessage('Security check expired. Tap retry.');
              if (onErrorRef.current) onErrorRef.current('Security check expired');
            }
          }
        });
        if (mounted) {
          setStatus('ready');
          if (onReadyRef.current) onReadyRef.current(verifier);
        }
      } catch (error) {
        const rawMsg = error?.message || error?.toString() || 'Failed to initialize security check';
        const userFriendlyMsg = rawMsg.includes('already rendered')
          ? 'Security check refreshing...'
          : 'Security check issue. Tap retry.';
        if (mounted) {
          setStatus('error');
          setErrorMessage(userFriendlyMsg);
          if (onErrorRef.current) onErrorRef.current(userFriendlyMsg);
        }
      }
    };
    initialize();
    return () => {
      mounted = false;
      cleanupRecaptchaVerifier('signup-recaptcha-container');
    };
  }, [createRecaptchaVerifier, cleanupRecaptchaVerifier, resolvedTheme, retryCount]);

  const handleRetry = useCallback(() => {
    setRetryCount(c => c + 1);
  }, []);

  return (
    <div>
      <div className="av2-sec" data-status={status} aria-live="polite">
        <span className="av2-sec-ico">
          {status === 'ready' ? (
            <ShieldCheckIcon size={20} />
          ) : status === 'error' ? (
            <AlertIcon size={20} />
          ) : (
            <SpinnerIcon size={19} />
          )}
        </span>

        <div className="av2-sec-text">
          <span className="av2-sec-title">Security Verification</span>
          {status === 'initializing' && <span className="av2-sec-sub">Initializing security check...</span>}
          {status === 'ready' && <span className="av2-sec-sub">Security check ready</span>}
          {status === 'error' && (
            <>
              <span className="av2-sec-sub">{errorMessage}</span>
              <button type="button" onClick={handleRetry} className="av2-retry">
                Retry
              </button>
            </>
          )}
        </div>

        <span className="av2-chip">Invisible reCAPTCHA</span>
      </div>
      <div id="signup-recaptcha-container" className="av2-recaptcha" />
    </div>
  );
});
InvisibleRecaptcha.displayName = 'InvisibleRecaptcha';

/* ────────────────────────────────────────────────────────────────────────────
 * Email form
 * ──────────────────────────────────────────────────────────────────────────── */

const UltimateEmailForm = React.memo(({ formData, onChange, errors, loading = false }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const emailRef = useRef(null);

  // Focus the email field only where it won't pop a mobile keyboard unexpectedly.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia?.("(pointer: fine)").matches) return undefined;
    const timer = setTimeout(() => emailRef.current?.focus({ preventScroll: true }), 160);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!formData.password) { setPasswordStrength(0); return; }
    let strength = 0;
    if (formData.password.length >= 8) strength += 25;
    if (/[a-z]/.test(formData.password)) strength += 25;
    if (/[A-Z]/.test(formData.password)) strength += 25;
    if (/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(formData.password)) strength += 25;
    setPasswordStrength(strength);
  }, [formData.password]);

  const getBarColor = () => {
    if (passwordStrength === 100) return '#10B981';
    if (passwordStrength >= 75) return '#22C55E';
    if (passwordStrength >= 50) return '#EAB308';
    if (passwordStrength >= 25) return '#F97316';
    return '#EF4444';
  };

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][passwordStrength / 25] || '';

  const checklistItems = [
    { label: "8+ characters", met: formData.password?.length >= 8 },
    { label: "Lowercase letter", met: /[a-z]/.test(formData.password) },
    { label: "Uppercase letter", met: /[A-Z]/.test(formData.password) },
    { label: "Number or symbol", met: /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(formData.password) },
  ];

  const mismatch = !!(formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword);

  return (
    <div className="av2-panel" style={{ marginTop: 0 }}>
      <div>
        <div className="av2-label-row" style={{ marginBottom: 8 }}>
          <label htmlFor="signup-email" className="av2-label" data-invalid={!!errors.email}>
            Email Address <span className="av2-req" aria-hidden="true">*</span>
          </label>
        </div>
        <div className="av2-field" data-invalid={!!errors.email} data-disabled={!!loading}>
          <span className="av2-field-ico"><MailIcon size={19} /></span>
          <input
            ref={emailRef}
            id="signup-email"
            name="email"
            type="email"
            className="av2-input"
            value={formData.email || ''}
            onChange={(e) => onChange({ ...formData, email: e.target.value })}
            disabled={loading}
            placeholder="name@example.com"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "signup-email-error" : undefined}
          />
        </div>
        <FieldError id="signup-email-error" message={errors.email} />
      </div>

      <div>
        <div className="av2-label-row" style={{ marginBottom: 8 }}>
          <label htmlFor="signup-password" className="av2-label" data-invalid={!!errors.password}>
            Password <span className="av2-req" aria-hidden="true">*</span>
          </label>
        </div>
        <div className="av2-field" data-invalid={!!errors.password} data-disabled={!!loading}>
          <span className="av2-field-ico"><LockIcon size={19} /></span>
          <input
            id="signup-password"
            name="password"
            type={showPassword ? "text" : "password"}
            className="av2-input"
            value={formData.password || ''}
            onChange={(e) => onChange({ ...formData, password: e.target.value })}
            disabled={loading}
            placeholder="Create a strong password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "signup-password-error" : undefined}
          />
          <button
            type="button"
            className="av2-iconbtn"
            onClick={() => setShowPassword(!showPassword)}
            disabled={loading}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOffIcon size={19} /> : <EyeIcon size={19} />}
          </button>
        </div>

        {formData.password && (
          <div aria-live="polite">
            <div className="av2-meter" style={{ "--seg": getBarColor() }} aria-hidden="true">
              {[1, 2, 3, 4].map((segment) => (
                <span key={segment} data-on={passwordStrength / 25 >= segment} />
              ))}
            </div>
            <div className="av2-strength">
              <span>Password strength</span>
              <b style={{ color: getBarColor() }}>{strengthLabel}</b>
            </div>
            <div className="av2-checks">
              {checklistItems.map((item) => (
                <div key={item.label} className="av2-check" data-met={!!item.met}>
                  <span className="av2-check-dot"><CheckIcon size={11} stroke={3.2} /></span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <FieldError id="signup-password-error" message={errors.password} />
      </div>

      <div>
        <div className="av2-label-row" style={{ marginBottom: 8 }}>
          <label
            htmlFor="signup-confirm-password"
            className="av2-label"
            data-invalid={!!errors.confirmPassword || mismatch}
          >
            Confirm Password <span className="av2-req" aria-hidden="true">*</span>
          </label>
        </div>
        <div className="av2-field" data-invalid={mismatch || !!errors.confirmPassword} data-disabled={!!loading}>
          <span className="av2-field-ico"><ShieldCheckIcon size={19} /></span>
          <input
            id="signup-confirm-password"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            className="av2-input"
            value={formData.confirmPassword || ''}
            onChange={(e) => onChange({ ...formData, confirmPassword: e.target.value })}
            disabled={loading}
            placeholder="Re-enter your password"
            autoComplete="new-password"
            aria-invalid={mismatch || !!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? "signup-confirm-error" : undefined}
          />
          <button
            type="button"
            className="av2-iconbtn"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            disabled={loading}
            aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"}
            aria-pressed={showConfirmPassword}
          >
            {showConfirmPassword ? <EyeOffIcon size={19} /> : <EyeIcon size={19} />}
          </button>
        </div>
        {formData.password && formData.confirmPassword && (
          <motion.div
            initial={{ opacity: 0, y: -3 }}
            animate={{ opacity: 1, y: 0 }}
            className="av2-match"
            data-ok={formData.password === formData.confirmPassword}
            role="status"
          >
            {formData.password === formData.confirmPassword ? (
              <><CheckIcon size={14} stroke={2.8} /><span>Passwords match</span></>
            ) : (
              <><AlertIcon size={14} /><span>Passwords don't match</span></>
            )}
          </motion.div>
        )}
        <FieldError id="signup-confirm-error" message={errors.confirmPassword} />
      </div>
    </div>
  );
});
UltimateEmailForm.displayName = 'UltimateEmailForm';

/* ────────────────────────────────────────────────────────────────────────────
 * Google
 * ──────────────────────────────────────────────────────────────────────────── */

const UltimateGoogleAuth = React.memo(({ onSuccess, onError, loading = false }) => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState(null);
  const auth = useAuth();

  const handleGoogleSignIn = async () => {
    if (loading || isAuthenticating) return;
    setIsAuthenticating(true);
    setError(null);
    try {
      const result = await auth.signInWithGoogle();
      if (result?.redirecting) {
        toast.info("Redirecting to Google Sign-In...");
        return;
      }
      if (result?.success) {
        toast.success("Google authentication successful!");
        onSuccess(result);
      } else {
        throw new Error(result.error || "Google authentication failed");
      }
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
        const errorMessage = error.message || "Google authentication failed";
        toast.error(errorMessage);
        setError(errorMessage);
      }
      onError(error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const busy = loading || isAuthenticating;

  return (
    <div className="av2-gcard">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 22, delay: 0.05 }}
        className="av2-gmark"
      >
        <GoogleIcon size={32} />
      </motion.div>

      <h3 className="av2-gtitle">Fast &amp; Secure Signup</h3>
      <p className="av2-gsub">One-click registration • No password needed</p>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="av2-alert"
          style={{ marginTop: 0, marginBottom: 14, textAlign: "left" }}
          role="alert"
        >
          <AlertIcon size={16} />
          <span>{error}</span>
        </motion.div>
      )}

      <motion.button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={busy}
        whileTap={!busy ? { scale: 0.98 } : undefined}
        className="av2-gbtn"
      >
        {busy ? (
          <>
            <SpinnerIcon size={18} />
            <span>Connecting to Google...</span>
          </>
        ) : (
          <>
            <GoogleIcon size={20} />
            <span>Sign up with Google</span>
          </>
        )}
      </motion.button>

      <p className="av2-gnote">Your Google account information will be used to create your profile.</p>
    </div>
  );
});
UltimateGoogleAuth.displayName = 'UltimateGoogleAuth';

/* ────────────────────────────────────────────────────────────────────────────
 * Method switch
 * ──────────────────────────────────────────────────────────────────────────── */

const METHODS = [
  { id: 'phone', label: 'Phone', description: 'SMS', icon: <PhoneIcon size={18} /> },
  { id: 'email', label: 'Email', description: 'Traditional', icon: <MailIcon size={18} /> },
  { id: 'google', label: 'Google', description: 'One-Click', icon: <GoogleIcon size={18} /> },
];

const UltimateMethodToggle = React.memo(({ method, onToggle, disabled = false }) => {
  const handleKeyDown = (event) => {
    if (disabled) return;
    const index = METHODS.findIndex((option) => option.id === method);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = METHODS[(index + 1) % METHODS.length].id;
      onToggle(next);
      document.getElementById(`signup-method-${next}`)?.focus();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const prev = METHODS[(index - 1 + METHODS.length) % METHODS.length].id;
      onToggle(prev);
      document.getElementById(`signup-method-${prev}`)?.focus();
    }
  };

  return (
    <div className="av2-seg" role="tablist" aria-label="Verification method" onKeyDown={handleKeyDown}>
      {METHODS.map((option) => {
        const isActive = method === option.id;
        return (
          <motion.button
            key={option.id}
            id={`signup-method-${option.id}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => !disabled && onToggle(option.id)}
            disabled={disabled}
            whileTap={!disabled ? { scale: 0.97 } : undefined}
            className="av2-seg-btn"
          >
            {isActive && (
              <motion.span
                layoutId="methodBackground"
                className="av2-seg-pill"
                initial={false}
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
              />
            )}
            <span className="av2-seg-ico" data-google={option.id === 'google'}>{option.icon}</span>
            <span className="av2-seg-label">{option.label}</span>
            <span className="av2-seg-desc">{option.description}</span>
          </motion.button>
        );
      })}
    </div>
  );
});
UltimateMethodToggle.displayName = 'UltimateMethodToggle';

/* ────────────────────────────────────────────────────────────────────────────
 * Screen
 * ──────────────────────────────────────────────────────────────────────────── */

export default function SignupStep2VerifyContact() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const resolvedTheme = useResolvedTheme();

  const [method, setMethod] = useState("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailForm, setEmailForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [step1Data, setStep1Data] = useState(null);

  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState(null);
  const [recaptchaError, setRecaptchaError] = useState(null);

  const [isPhoneValid, setIsPhoneValid] = useState(false);
  const [shakeCard, setShakeCard] = useState(false);

  const isMounted = useRef(true);
  const navigationLock = useRef(false);

  useEffect(() => {
    try {
      const savedData = sessionStorage.getItem('signup_step1') || localStorage.getItem('signup_step1');
      if (savedData) {
        setStep1Data(JSON.parse(savedData));
      } else {
        setStep1Data({ firstName: '', lastName: '', username: '' });
      }
    } catch {
      setStep1Data({ firstName: '', lastName: '', username: '' });
    }
    return () => { isMounted.current = false; };
  }, []);

  const triggerShake = useCallback(() => {
    setShakeCard(true);
    setTimeout(() => setShakeCard(false), 600);
  }, []);

  const validateEmail = useCallback((email) => {
    if (!email) return "Email is required";
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email) ? null : "Invalid email format";
  }, []);

  const validatePassword = useCallback((password) => {
    if (!password) return "Password is required";
    const missing = [];
    if (password.length < 8) missing.push("at least 8 characters");
    if (!/[a-z]/.test(password)) missing.push("lowercase letter");
    if (!/[A-Z]/.test(password)) missing.push("uppercase letter");
    if (!/[0-9]/.test(password)) missing.push("number");
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) missing.push("special character");
    return missing.length ? `Missing: ${missing.join(', ')}` : null;
  }, []);

  const validatePhoneNumber = useCallback((phone) => {
    if (!phone) return "Phone number is required";
    if (!phone.startsWith('+')) return "Must start with '+'";
    const digits = phone.slice(1).replace(/\D/g, '');
    if (digits.length < 10) return "At least 10 digits";
    if (digits.length > 15) return "Too long";
    return null;
  }, []);

  const handleGoogleSuccess = useCallback(async (result) => {
    if (navigationLock.current) return;
    navigationLock.current = true;
    setLoading(true);
    try {
      toast.success("✅ Google authentication successful!");
      const targetUid = result?.user?.uid || auth.user?.uid;
      const { markOnboardingRequired } = await import('../utils/profileCompletion.js');
      markOnboardingRequired(targetUid, {
        method: "google",
        isSignup: true,
        step1Data,
      });
      navigate("/setup-profile", {
        replace: true,
        state: {
          method: "google",
          userData: result?.user || auth.user,
          step1Data,
          isNewUser: true,
        },
      });
    } catch (error) {
      toast.error("Failed to process Google authentication");
      setErrors({ general: error.message });
      triggerShake();
    } finally {
      setLoading(false);
      setTimeout(() => { navigationLock.current = false; }, 1000);
    }
  }, [auth.user, navigate, step1Data, triggerShake]);

  const handlePhoneVerification = useCallback(async () => {
    if (navigationLock.current || phoneLoading) return;
    navigationLock.current = true;
    setPhoneLoading(true);
    setErrors({});
    const phoneToUse = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    const phoneError = validatePhoneNumber(phoneToUse);
    if (phoneError) {
      setErrors({ phone: phoneError });
      toast.error(phoneError);
      navigationLock.current = false;
      setPhoneLoading(false);
      triggerShake();
      return;
    }
    let verifier = recaptchaVerifier;
    if (!verifier) {
      try {
        verifier = await auth.createRecaptchaVerifier('signup-recaptcha-container');
        setRecaptchaVerifier(verifier);
        setRecaptchaReady(true);
      } catch (rErr) {
        toast.error("Security check failed. Please tap retry and try again.");
        navigationLock.current = false;
        setPhoneLoading(false);
        triggerShake();
        return;
      }
    }
    try {
      const result = await auth.sendPhoneVerificationCode(phoneToUse, verifier);
      if (!result.success) throw new Error(result.error || "Failed to send code");
      const verificationData = { verificationId: result.verificationId, phoneNumber: result.phoneNumber, method: "phone", isSignup: true, step1Data, timestamp: Date.now() };
      sessionStorage.setItem('phone_verification', JSON.stringify(verificationData));
      localStorage.setItem('phone_verification', JSON.stringify(verificationData));
      const signupData = { ...step1Data, phoneNumber: result.phoneNumber, contactMethod: "phone", verificationId: result.verificationId, authProvider: 'phone', requiresProfileCompletion: true, isNewUser: true };
      sessionStorage.setItem('signup_data', JSON.stringify(signupData));
      localStorage.setItem('signup_data', JSON.stringify(signupData));
      toast.success(`✅ Code sent to ${result.phoneNumber}`);
      navigate("/otp-verification", { state: { verificationId: result.verificationId, phoneNumber: result.phoneNumber, isSignup: true, method: "phone", step1Data }, replace: true });
    } catch (error) {
      let friendlyMsg = "Failed to send verification code";
      if (error?.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes('quota-exceeded')) friendlyMsg = "SMS quota exceeded. Please try email verification or try again in a few minutes.";
        else if (msg.includes('captcha') || msg.includes('recaptcha')) friendlyMsg = "Security check failed. Please tap retry on the security badge.";
        else if (msg.includes('too-many-requests')) friendlyMsg = "Too many attempts. Please wait a moment before trying again.";
        else if (msg.includes('invalid-phone-number')) friendlyMsg = "Invalid phone number. Please include your country code (e.g. +1234567890).";
        else friendlyMsg = error.message || friendlyMsg;
      }
      setErrors({ phone: friendlyMsg });
      toast.error(friendlyMsg);
      triggerShake();
    } finally {
      setPhoneLoading(false);
      setTimeout(() => { navigationLock.current = false; }, 1000);
    }
  }, [phoneNumber, recaptchaVerifier, phoneLoading, auth, step1Data, navigate, validatePhoneNumber, triggerShake]);

  const handleEmailSignup = useCallback(async () => {
    if (navigationLock.current) return;
    navigationLock.current = true;
    setLoading(true);
    setErrors({});
    const emailError = validateEmail(emailForm.email);
    const passwordError = validatePassword(emailForm.password);
    const confirmError = emailForm.password !== emailForm.confirmPassword ? "Passwords don't match" : null;
    if (emailError || passwordError || confirmError) {
      setErrors({ email: emailError, password: passwordError, confirmPassword: confirmError });
      toast.error("Please fix the errors above");
      navigationLock.current = false;
      setLoading(false);
      triggerShake();
      return;
    }
    try {
      const result = await auth.signUpWithEmailPassword(emailForm.email, emailForm.password, {
        displayName: `${step1Data?.firstName || ''} ${step1Data?.lastName || ''}`.trim(),
        email: emailForm.email,
        firstName: step1Data?.firstName || '',
        lastName: step1Data?.lastName || '',
        gender: step1Data?.gender || '',
        dob: step1Data?.dob || {},
        isNewUser: true,
        requiresEmailVerification: true
      });
      if (!result.success) throw new Error(result.message || "Signup failed");
      const uid = result.user?.userId || result.user?.uid || auth.user?.uid;
      const signupData = { ...step1Data, email: emailForm.email, contactMethod: "email", userId: uid, authProvider: 'email', isNewUser: true, requiresEmailVerification: true };
      localStorage.setItem('signup_data', JSON.stringify(signupData));
      sessionStorage.setItem('signup_data', JSON.stringify(signupData));
      toast.success("Account created! Please check your email for the verification link.");
      navigate("/verify-email", { 
        state: { 
          method: "email", 
          userId: uid, 
          userEmail: emailForm.email,
          email: emailForm.email,
          fromSignup: true, 
          step1Data: signupData 
        }, 
        replace: true 
      });
    } catch (error) {
      let msg = "Failed to create account";
      if (error.code?.includes('email-already-in-use')) msg = "Email already registered. Sign in instead.";
      else if (error.code?.includes('weak-password')) msg = "Password too weak.";
      else msg = error.message || msg;
      setErrors({ general: msg });
      toast.error(msg);
      triggerShake();
    } finally {
      setLoading(false);
      setTimeout(() => { navigationLock.current = false; }, 1000);
    }
  }, [emailForm, step1Data, auth, navigate, validateEmail, validatePassword, triggerShake]);

  const handleGoogleError = useCallback((error) => {
    if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
      setErrors({ general: error.message });
      triggerShake();
    }
  }, [triggerShake]);

  const handleRecaptchaReady = useCallback((verifier) => {
    setRecaptchaReady(true);
    setRecaptchaVerifier(verifier);
    setRecaptchaError(null);
  }, []);

  const handleRecaptchaError = useCallback((error) => {
    setRecaptchaError(error);
    setRecaptchaReady(false);
    setRecaptchaVerifier(null);
    triggerShake();
  }, [triggerShake]);

  const isFormValid = useMemo(() => {
    switch (method) {
      case 'phone': return phoneNumber && isPhoneValid && !errors.phone && !phoneLoading;
      case 'email': return emailForm.email && emailForm.password && emailForm.confirmPassword && emailForm.password === emailForm.confirmPassword && !errors.email && !errors.password && !errors.confirmPassword;
      case 'google': return true;
      default: return false;
    }
  }, [method, phoneNumber, isPhoneValid, emailForm, errors, phoneLoading, recaptchaReady]);

  const rootVariables = resolvedTheme === 'dark' ? THEMES.dark : THEMES.light;
  const year = new Date().getFullYear();

  if (!step1Data) {
    return (
      <div className="av2-root" style={rootVariables} data-theme={resolvedTheme}>
        <style>{STYLES}</style>
        <div className="av2-bg" aria-hidden="true">
          <span className="av2-orb av2-orb-a" />
          <span className="av2-orb av2-orb-b" />
          <span className="av2-dots" />
        </div>
        <main className="av2-shell" style={{ alignItems: "center", justifyContent: "center" }}>
          <div className="av2-loading" role="status">
            <SpinnerIcon size={38} stroke={2.2} style={{ color: "#8B1EF3" }} />
            <p style={{ margin: 0 }}>Loading your information...</p>
          </div>
        </main>
      </div>
    );
  }

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

        <main className="av2-shell">
          <motion.div
            className="av2-wrap"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <StepIndicator currentStep={2} />

            <motion.section
              className="av2-card"
              aria-labelledby="signup-step2-title"
              animate={shakeCard ? { x: [0, -10, 10, -10, 10, 0] } : { x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="av2-spec" aria-hidden="true" />
              <span className="av2-rim" aria-hidden="true" />

              <header>
                <h1 id="signup-step2-title" className="av2-h1">Contact Verification</h1>
                <p className="av2-sub">Step 2 of 3 · Choose your secure verification method</p>
              </header>

              <div className="av2-body">
                <div className="av2-divider" aria-hidden="true">Verification method</div>

                <UltimateMethodToggle method={method} onToggle={setMethod} disabled={loading || phoneLoading} />

                <AnimatePresence mode="wait">
                  {method === "phone" && (
                    <motion.div key="phone" role="tabpanel" aria-labelledby="signup-method-phone" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="av2-panel">
                      <UltimatePhoneInput value={phoneNumber} onChange={setPhoneNumber} error={errors.phone} disabled={phoneLoading || auth.loading} onValidationChange={setIsPhoneValid} />
                      <InvisibleRecaptcha onReady={handleRecaptchaReady} onError={handleRecaptchaError} loading={phoneLoading} />
                      <motion.button
                        type="button"
                        whileTap={isFormValid && !phoneLoading ? { scale: 0.98 } : undefined}
                        onClick={handlePhoneVerification}
                        disabled={!isFormValid || phoneLoading}
                        className="av2-btn"
                        data-loading={phoneLoading}
                      >
                        {phoneLoading ? (
                          <>
                            <SpinnerIcon size={19} />
                            <span>Sending Code...</span>
                          </>
                        ) : (
                          <span>Continue with Phone Verification</span>
                        )}
                      </motion.button>
                    </motion.div>
                  )}

                  {method === "email" && (
                    <motion.div key="email" role="tabpanel" aria-labelledby="signup-method-email" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="av2-panel">
                      <UltimateEmailForm formData={emailForm} onChange={setEmailForm} errors={errors} loading={loading} />
                      <motion.button
                        type="button"
                        whileTap={isFormValid && !loading ? { scale: 0.98 } : undefined}
                        onClick={handleEmailSignup}
                        disabled={!isFormValid || loading}
                        className="av2-btn"
                        data-loading={loading}
                      >
                        {loading ? (
                          <>
                            <SpinnerIcon size={19} />
                            <span>Creating Account...</span>
                          </>
                        ) : (
                          <span>Create Account with Email</span>
                        )}
                      </motion.button>
                    </motion.div>
                  )}

                  {method === "google" && (
                    <motion.div key="google" role="tabpanel" aria-labelledby="signup-method-google" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="av2-panel">
                      <UltimateGoogleAuth onSuccess={handleGoogleSuccess} onError={handleGoogleError} loading={loading} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {errors.general && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="av2-alert" role="alert">
                    <AlertIcon size={16} />
                    <span>{errors.general}</span>
                  </motion.div>
                )}

                <div className="av2-back-wrap">
                  <button
                    type="button"
                    className="av2-back"
                    onClick={() => navigate("/signup/step1", { replace: true })}
                    disabled={loading || phoneLoading}
                  >
                    <ArrowLeftIcon size={17} stroke={2.2} />
                    Back to Personal Information
                  </button>
                </div>
              </div>
            </motion.section>

            <footer>
              <p className="av2-foot">© {year} Arvdoul</p>
            </footer>
          </motion.div>
        </main>
      </div>
    </MotionConfig>
  );
}