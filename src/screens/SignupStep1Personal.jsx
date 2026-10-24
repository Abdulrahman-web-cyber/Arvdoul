// src/screens/SignupStep1Personal.jsx

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "@context/ThemeContext";

const STORAGE_KEY = "signup_step1";
const NEXT_ROUTE = "/signup/step2";
const LOGIN_ROUTE = "/login";
const MIN_AGE = 14;
const MAX_AGE = 120;
const NAME_MAX = 50;
const TOAST_ID = "signup-step1-feedback";

const IDS = {
  firstName: "signup-first-name",
  lastName: "signup-last-name",
  genderMale: "signup-gender-male",
  genderFemale: "signup-gender-female",
  dobDay: "signup-dob-day",
  dobMonth: "signup-dob-month",
  dobYear: "signup-dob-year",
};

const STEPS = [
  { number: 1, label: "Personal" },
  { number: 2, label: "Verify" },
  { number: 3, label: "Complete" },
];

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, index) => ({
  value: index + 1,
  label,
  display: label.slice(0, 3),
}));

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  gender: "",
  dob: { day: "", month: "", year: "" },
};

const GRADIENT =
  "linear-gradient(125deg, #8B1EF3 0%, #4431F7 52%, #055BFB 100%)";

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
    "--sel-bg": "rgba(17,26,69,0.66)",
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
    "--gender-male": "#30CFFF",
    "--gender-female": "#D58BFF",
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
    "--sel-bg": "rgba(255,255,255,0.50)",
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
    "--gender-male": "#008AC5",
    "--gender-female": "#A51BDD",
  },
};

const STYLES = `
.av1-root {
  position:relative;
  min-height:100vh;
  min-height:100dvh;
  overflow-x:clip;
  background:var(--bg);
  color:var(--text);
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  transition:background .3s ease,color .3s ease;
}
.av1-root *,.av1-root *::before,.av1-root *::after {box-sizing:border-box}
.av1-bg {position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.av1-orb {position:absolute;border-radius:50%;will-change:transform}
.av1-orb-a {
  width:75vmax;height:75vmax;top:-43vmax;left:-34vmax;
  background:radial-gradient(circle,var(--glow-a),transparent 65%);
}
.av1-orb-b {
  width:78vmax;height:78vmax;right:-42vmax;bottom:-46vmax;
  background:radial-gradient(circle,var(--glow-b),transparent 66%);
}
.av1-orb-c {
  width:48vmax;height:48vmax;top:28%;left:30%;
  background:radial-gradient(circle,var(--glow-c),transparent 66%);
}
.av1-dots {
  position:absolute;inset:0;
  background-image:radial-gradient(var(--dot) .8px,transparent 1px);
  background-size:28px 28px;
  -webkit-mask-image:radial-gradient(ellipse at 50% 30%,#000,transparent 76%);
  mask-image:radial-gradient(ellipse at 50% 30%,#000,transparent 76%);
}
.av1-shell {
  position:relative;z-index:1;
  display:flex;flex-direction:column;
  min-height:100vh;min-height:100dvh;
  padding:max(18px,env(safe-area-inset-top))
    max(16px,env(safe-area-inset-right))
    max(22px,env(safe-area-inset-bottom))
    max(16px,env(safe-area-inset-left));
}
.av1-wrap {width:100%;max-width:540px;margin:auto}
.av1-wrap:focus {outline:none}

/* Progress */
.av1-steps {
  display:flex;align-items:flex-start;justify-content:center;
  width:100%;max-width:380px;margin:0 auto 24px;padding:0;
  list-style:none;
}
.av1-step {display:flex;flex-direction:column;align-items:center;gap:9px;min-width:68px}
.av1-dot {
  display:grid;place-items:center;width:46px;height:46px;border-radius:50%;
  border:1px solid var(--card-border);
  background:var(--card-bg);color:var(--text-3);
  font-size:15px;font-weight:750;
  -webkit-backdrop-filter:blur(18px) saturate(150%);
  backdrop-filter:blur(18px) saturate(150%);
  box-shadow:var(--card-inset);
  transition:background .3s,color .3s,border-color .3s,box-shadow .3s;
}
.av1-dot[data-state="active"] {
  color:#fff;border-color:rgba(255,255,255,.25);
  background:${GRADIENT};
  box-shadow:0 0 0 4px var(--field-ring),0 9px 22px -10px rgba(68,49,247,.72),
    inset 0 1px 0 rgba(255,255,255,.42);
}
.av1-dot[data-state="done"] {background:${GRADIENT};color:#fff;border-color:transparent}
.av1-step-label {font-size:12.5px;font-weight:650;letter-spacing:.01em;color:var(--text-3)}
.av1-step-label[data-state="active"] {color:var(--accent-text)}
.av1-line {
  position:relative;flex:1;height:2px;min-width:16px;margin-top:22px;
  overflow:hidden;border-radius:5px;background:var(--line);
}
.av1-line>span {display:block;width:0;height:100%;background:${GRADIENT};transition:width .35s}
.av1-line[data-done="true"]>span {width:100%}

/* Floating glass card */
.av1-card {
  position:relative;isolation:isolate;
  padding:28px 23px 23px;border:1px solid var(--card-border);border-radius:28px;
  background:var(--card-bg);
  box-shadow:var(--card-shadow),var(--card-inset);
  -webkit-backdrop-filter:blur(34px) saturate(175%);
  backdrop-filter:blur(34px) saturate(175%);
  transition:background .3s,border-color .3s;
}
.av1-card::before {
  content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;
  background:linear-gradient(142deg,rgba(255,255,255,.10),transparent 34%,transparent 74%,rgba(100,130,255,.045));
  pointer-events:none;
}
.av1-rim {
  position:absolute;inset:0;padding:1px;border-radius:inherit;pointer-events:none;
  background:linear-gradient(145deg,var(--rim-1),transparent 30%,transparent 69%,var(--rim-2));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;mask-composite:exclude;
}
.av1-spec {
  position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:-1;
  background:radial-gradient(105% 42% at 12% 0%,var(--spec),transparent 63%);
}
.av1-card>header,.av1-card>form {position:relative;z-index:1}
.av1-h1 {margin:0;font-size:clamp(23px,5vw,28px);line-height:1.17;font-weight:800;letter-spacing:-.035em}
.av1-sub {margin:9px 0 0;color:var(--text-2);font-size:13.5px;line-height:1.55}
.av1-divider {
  display:flex;align-items:center;gap:12px;margin:23px 0 19px;
  color:var(--text-3);font-size:10.5px;font-weight:750;letter-spacing:.15em;text-transform:uppercase;
}
.av1-divider::before,.av1-divider::after {
  content:"";flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--line));
}
.av1-divider::after {background:linear-gradient(270deg,transparent,var(--line))}
.av1-stack {display:flex;flex-direction:column;gap:21px}

/* Identity fields — rectangular glass inputs */
.av1-names {
  display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start;
  transition:grid-template-columns .32s cubic-bezier(.22,1,.36,1);
}
.av1-names[data-focus="first"] {grid-template-columns:minmax(0,1.65fr) minmax(0,1fr)}
.av1-names[data-focus="last"] {grid-template-columns:minmax(0,1fr) minmax(0,1.65fr)}
.av1-names>* {min-width:0}
.av1-nf {display:flex;flex-direction:column;min-width:0}
.av1-nf-label {
  display:flex;align-items:center;gap:3px;margin:0 0 8px 2px;
  color:var(--text-2);font-size:13px;font-weight:700;transition:color .2s;
}
.av1-nf:focus-within .av1-nf-label {color:var(--accent-text)}
.av1-nf[data-invalid="true"] .av1-nf-label {color:var(--danger)}
.av1-nf-box {
  position:relative;display:flex;align-items:center;gap:9px;min-width:0;height:56px;padding:0 13px;
  border:1px solid var(--field-border);border-radius:12px;
  background:var(--field-bg);color:var(--text-3);box-shadow:var(--field-inset);
  -webkit-backdrop-filter:blur(16px) saturate(145%);backdrop-filter:blur(16px) saturate(145%);
  transition:border-color .22s,background .22s,box-shadow .22s,color .22s;
}
.av1-nf-box::after {
  content:"";position:absolute;left:10px;right:10px;bottom:-1px;height:2px;border-radius:2px;
  background:${GRADIENT};transform:scaleX(0);transform-origin:left center;
  transition:transform .32s cubic-bezier(.22,1,.36,1);pointer-events:none;
}
.av1-nf-box:hover {border-color:var(--field-border-hover)}
.av1-nf-box:focus-within {
  border-color:var(--field-focus);background:var(--field-bg-focus);color:var(--accent-text);
  box-shadow:var(--field-inset),0 0 0 3px var(--field-ring);
}
.av1-nf-box:focus-within::after {transform:scaleX(1)}
.av1-nf[data-invalid="true"] .av1-nf-box {
  border-color:var(--danger);color:var(--danger);
  box-shadow:var(--field-inset),0 0 0 3px var(--danger-ring);
}
.av1-nf[data-invalid="true"] .av1-nf-box::after {background:var(--danger);transform:scaleX(1)}
.av1-nf-box[data-disabled="true"] {opacity:.55;cursor:not-allowed}
.av1-nf-ico {display:grid;place-items:center;flex:none}
.av1-nf-input {
  flex:1;min-width:0;height:100%;padding:0;border:0;outline:0;background:transparent;
  color:var(--text);font:inherit;font-size:16px;font-weight:600;letter-spacing:-.01em;
  text-overflow:ellipsis;appearance:none;-webkit-appearance:none;
}
.av1-nf-input::placeholder {color:var(--text-3);font-size:15px;font-weight:450;letter-spacing:0}
.av1-nf-input:-webkit-autofill,.av1-nf-input:-webkit-autofill:focus {
  -webkit-text-fill-color:var(--text);caret-color:var(--text);
  -webkit-box-shadow:0 0 0 1000px var(--field-bg-solid) inset;
}
.av1-nf-check {display:grid;place-items:center;flex:none;color:var(--success)}
.av1-nf-foot {
  display:flex;align-items:flex-start;gap:5px;min-width:0;min-height:16px;margin:7px 2px 0;
  color:var(--text-3);font-size:11px;line-height:1.4;
}
.av1-nf-foot[data-error="true"] {color:var(--danger);font-weight:650}
.av1-nf-foot svg {flex:none;margin-top:1px}
.av1-nf-foot span {overflow-wrap:anywhere}
.av1-nf-full {color:var(--text);font-weight:650}
.av1-nf-count {margin-left:auto;flex:none;font-variant-numeric:tabular-nums}

/* Field feedback */
.av1-label {
  display:flex;align-items:center;gap:4px;margin:0 0 9px 2px;
  color:var(--text-2);font-size:13px;font-weight:700;transition:color .2s;
}
.av1-label[data-filled="true"] {color:var(--text)}
.av1-label[data-invalid="true"] {color:var(--danger)}
.av1-msg {
  display:flex;align-items:flex-start;gap:6px;margin:7px 2px 0;
  color:var(--text-3);font-size:11.5px;line-height:1.45;
}
.av1-msg[data-error="true"] {color:var(--danger);font-weight:650}
.av1-msg svg {flex:none;margin-top:1px}

/* Gender */
.av1-genders {display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.av1-gender {
  position:relative;display:flex;align-items:center;gap:10px;min-width:0;min-height:64px;
  padding:0 13px;border:1px solid var(--field-border);border-radius:17px;
  background:var(--field-bg);color:var(--text-2);
  box-shadow:var(--field-inset);font:inherit;font-size:14.5px;font-weight:700;text-align:left;
  cursor:pointer;-webkit-tap-highlight-color:transparent;
  -webkit-backdrop-filter:blur(16px) saturate(150%);
  backdrop-filter:blur(16px) saturate(150%);
  transition:border-color .2s,background .2s,box-shadow .2s,color .2s,transform .16s;
}
.av1-gender:hover {border-color:var(--field-border-hover);color:var(--text)}
.av1-gender:active {transform:scale(.985)}
.av1-gender[data-invalid="true"] {border-color:var(--danger)}
.av1-gender[aria-checked="true"] {
  border-color:transparent;color:var(--text);
  background:linear-gradient(var(--sel-bg),var(--sel-bg)) padding-box,${GRADIENT} border-box;
  box-shadow:0 10px 28px -14px var(--sel-glow),inset 0 1px 0 rgba(255,255,255,.14);
}
.av1-gender-ico {
  display:grid;place-items:center;flex:none;width:35px;height:35px;border-radius:11px;
  background:var(--pop-active);color:var(--accent-text);
}
.av1-gender[aria-checked="true"] .av1-gender-ico {background:${GRADIENT};color:#fff}
.av1-gender-check {
  display:grid;place-items:center;flex:none;width:19px;height:19px;margin-left:auto;
  border-radius:50%;background:${GRADIENT};color:#fff;
}
.av1-gender-text {overflow-wrap:anywhere}

/* Date of birth */
.av1-dob-head {
  display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;
}
.av1-dob-head .av1-label {margin:0 0 0 2px}
.av1-dob {display:grid;grid-template-columns:.88fr 1.2fr 1fr;gap:9px}
.av1-sel-wrap {position:relative;min-width:0}
.av1-sellabel {
  display:block;margin:0 0 7px 3px;color:var(--text-3);
  font-size:11.5px;font-weight:700;
}
.av1-trigger {
  display:flex;align-items:center;justify-content:space-between;gap:5px;
  width:100%;min-width:0;min-height:51px;padding:0 10px;border-radius:14px;
  border:1px solid var(--field-border);background:var(--field-bg);color:var(--text);
  box-shadow:var(--field-inset);font:inherit;font-size:14px;font-weight:600;text-align:left;
  cursor:pointer;-webkit-tap-highlight-color:transparent;
  -webkit-backdrop-filter:blur(15px);backdrop-filter:blur(15px);
  transition:border-color .2s,box-shadow .2s,background .2s;
}
.av1-trigger:hover {border-color:var(--field-border-hover)}
.av1-trigger[data-open="true"],.av1-trigger:focus-visible {
  border-color:var(--field-focus);box-shadow:0 0 0 3px var(--field-ring);
  background:var(--field-bg-focus);outline:none;
}
.av1-trigger[data-invalid="true"] {border-color:var(--danger);box-shadow:0 0 0 3px var(--danger-ring)}
.av1-trigger:disabled {opacity:.55;cursor:not-allowed}
.av1-trigger-text {overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.av1-trigger-text[data-empty="true"] {color:var(--text-3);font-weight:500}
.av1-chev {flex:none;color:var(--text-3);transition:transform .2s,color .2s}
.av1-trigger[data-open="true"] .av1-chev {transform:rotate(180deg);color:var(--field-focus)}
.av1-list {
  position:absolute;z-index:70;margin:0;padding:6px;list-style:none;
  overflow-y:auto;overscroll-behavior:contain;outline:none;min-width:132px;
  border:1px solid var(--pop-border);border-radius:15px;
  background:var(--pop-bg);box-shadow:var(--pop-shadow);
  -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
  -webkit-overflow-scrolling:touch;scrollbar-width:thin;
}
.av1-opt {
  display:flex;align-items:center;justify-content:space-between;gap:9px;
  min-height:40px;padding:0 10px;border-radius:10px;cursor:pointer;
  color:var(--text-2);font-size:14px;font-weight:550;user-select:none;
}
.av1-opt[data-active="true"] {background:var(--pop-active);color:var(--text)}
.av1-opt[aria-selected="true"] {background:var(--pop-selected);color:var(--text);font-weight:750}
.av1-opt svg {flex:none;color:var(--accent-text)}
.av1-age {
  display:inline-flex;align-items:center;gap:5px;flex:none;
  padding:4px 9px;border:1px solid transparent;border-radius:999px;
  font-size:11px;font-weight:750;white-space:nowrap;
}
.av1-age[data-ok="true"] {color:var(--success);background:color-mix(in srgb,var(--success) 12%,transparent);border-color:color-mix(in srgb,var(--success) 25%,transparent)}
.av1-age[data-ok="false"] {color:var(--danger);background:color-mix(in srgb,var(--danger) 10%,transparent);border-color:color-mix(in srgb,var(--danger) 25%,transparent)}

/* Actions */
.av1-cta-wrap {margin-top:25px;padding-top:19px;border-top:1px solid var(--line)}
.av1-btn {
  position:relative;isolation:isolate;overflow:hidden;
  display:flex;align-items:center;justify-content:center;gap:11px;
  width:100%;min-height:56px;padding:0 20px;border:1px solid rgba(255,255,255,.18);
  border-radius:17px;background:${GRADIENT};color:#fff;
  box-shadow:var(--btn-shadow);font:inherit;font-size:16px;font-weight:800;letter-spacing:.005em;
  cursor:pointer;-webkit-tap-highlight-color:transparent;
  transition:transform .2s,filter .2s,box-shadow .2s;
}
.av1-btn:hover {filter:brightness(1.06);transform:translateY(-1px)}
.av1-btn:active {transform:scale(.99)}
.av1-btn::after {
  content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;
  background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.24) 50%,transparent 70%);
  transform:translateX(-120%);
}
.av1-btn:hover::after {animation:av1-shine .85s ease}
.av1-btn[aria-disabled="true"] {
  border-color:var(--field-border);background:var(--btn-off-bg);color:var(--btn-off-text);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08);cursor:not-allowed;filter:none;transform:none;
}
.av1-btn[aria-disabled="true"]::after {display:none}
.av1-btn[data-loading="true"] {background:${GRADIENT};color:#fff;cursor:progress;filter:none}
.av1-signin {margin:19px 0 0;text-align:center;color:var(--text-2);font-size:13.5px;line-height:1.65}
.av1-link {
  display:inline-block;padding:2px 4px;margin:0 -1px;border:0;border-radius:7px;
  background:transparent;color:var(--accent-text);font:inherit;font-weight:800;cursor:pointer;
  -webkit-tap-highlight-color:transparent;transition:background .2s,filter .2s;
}
.av1-link:hover {background:var(--pop-active);filter:brightness(1.13)}
.av1-foot {margin:17px 0 0;text-align:center;color:var(--text-3);font-size:12px}
.av1-spin {animation:av1-spin .8s linear infinite;transform-origin:center}

.av1-root button:focus-visible,.av1-root input:focus-visible {
  outline:2px solid var(--focus-outline);outline-offset:3px;
}
.av1-root .av1-nf-input:focus-visible {outline:none}
.av1-list::-webkit-scrollbar {width:7px}
.av1-list::-webkit-scrollbar-thumb {background:var(--line);border-radius:8px}

@keyframes av1-spin {to{transform:rotate(360deg)}}
@keyframes av1-shine {to{transform:translateX(120%)}}

@media(min-width:520px) {
  .av1-card {padding:33px 32px 26px}
  .av1-names {gap:14px}
}
@media(max-width:390px) {
  .av1-shell {padding-left:13px;padding-right:13px}
  .av1-card {padding:24px 17px 20px;border-radius:24px}
  .av1-steps {margin-bottom:20px}
  .av1-step {min-width:60px;gap:8px}
  .av1-dot {width:42px;height:42px}
  .av1-line {margin-top:20px;min-width:12px}
  .av1-step-label {font-size:11.5px}
  .av1-names {gap:10px}
  .av1-nf-box {height:54px;padding:0 11px;gap:7px}
  .av1-nf-label {font-size:12.5px}
  .av1-nf-ico {display:none}
  .av1-genders {gap:9px}
  .av1-gender {gap:8px;padding:0 10px;font-size:13.5px}
  .av1-gender-ico {width:31px;height:31px}
  .av1-trigger {padding:0 8px;font-size:13px}
  .av1-dob {gap:7px}
}
@media(max-width:359px) {
  .av1-nf-box {padding:0 9px}
  .av1-nf-input {font-size:16px}
  .av1-nf-input::placeholder {font-size:14px}
  .av1-dob {grid-template-columns:repeat(2,minmax(0,1fr))}
  .av1-dob>.av1-sel-wrap:last-child {grid-column:1/-1}
  .av1-gender-check {display:none}
  .av1-age {font-size:10px;padding:3px 6px}
}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))) {
  .av1-card {background:var(--field-bg-solid)}
  .av1-nf-box,.av1-gender,.av1-trigger,.av1-list {background:var(--field-bg-solid)}
}
@media(forced-colors:active) {
  .av1-card,.av1-nf-box,.av1-gender,.av1-trigger,.av1-list {border:1px solid CanvasText}
  .av1-gender[aria-checked="true"] {border-color:Highlight}
}
@media(prefers-reduced-motion:reduce) {
  .av1-root *,.av1-root *::before,.av1-root *::after {
    animation:none!important;transition-duration:.01ms!important;scroll-behavior:auto!important;
  }
}
`;

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}\s'’-]*$/u;

function daysInMonth(year, month) {
  return new Date(Number(year), Number(month), 0).getDate();
}

function getAge(day, month, year, now = new Date()) {
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);

  if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(y)) {
    return null;
  }
  if (d < 1 || m < 1 || m > 12 || y < 1) return null;

  const birth = new Date(y, m - 1, d);

  if (
    birth.getFullYear() !== y ||
    birth.getMonth() !== m - 1 ||
    birth.getDate() !== d
  ) {
    return null;
  }

  let age = now.getFullYear() - y;
  const monthDelta = now.getMonth() - (m - 1);

  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < d)) {
    age -= 1;
  }

  return age;
}

function validateName(raw, label) {
  const value = String(raw || "").replace(/\s+/g, " ").trim();
  const letterCount = (value.match(/\p{L}/gu) || []).length;

  if (!value) return `${label} is required`;
  if (value.length < 2 || letterCount < 2) return "Enter at least 2 letters";
  if (value.length > NAME_MAX) return `Maximum ${NAME_MAX} characters`;
  if (!NAME_PATTERN.test(value)) {
    return "Use letters, spaces, hyphens or apostrophes only";
  }

  return "";
}

function validateDob(dob, now = new Date()) {
  const { day, month, year } = dob || {};

  if (!day || !month || !year) return "Complete all fields";

  const age = getAge(day, month, year, now);

  if (age === null) return "That date doesn't exist. Check the day and month.";

  const birth = new Date(Number(year), Number(month) - 1, Number(day));

  if (birth.getTime() > now.getTime()) return "Birth date can't be in the future";
  if (age < MIN_AGE) return `You must be at least ${MIN_AGE} years old to register.`;
  if (age > MAX_AGE) return "Invalid birth year.";

  return "";
}

function validateForm(data) {
  const errors = {};
  const firstNameError = validateName(data.firstName, "First name");
  const lastNameError = validateName(data.lastName, "Last name");

  if (firstNameError) errors.firstName = firstNameError;
  if (lastNameError) errors.lastName = lastNameError;

  if (data.gender !== "Male" && data.gender !== "Female") {
    errors.gender = "Please select an option";
  }

  const dobError = validateDob(data.dob);
  if (dobError) errors.dob = dobError;

  return errors;
}

function normalizeName(raw) {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, separator, letter) => {
      return separator + letter.toLocaleUpperCase();
    });
}

function readSavedForm() {
  try {
    if (typeof window === "undefined") return null;

    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const readNumber = (value) => {
      const number = Number(value);
      return Number.isFinite(number) && number > 0 ? number : "";
    };

    return {
      firstName: typeof parsed.firstName === "string" ? parsed.firstName : "",
      lastName: typeof parsed.lastName === "string" ? parsed.lastName : "",
      gender:
        parsed.gender === "Male" || parsed.gender === "Female"
          ? parsed.gender
          : "",
      dob: {
        day: readNumber(parsed.dob?.day),
        month: readNumber(parsed.dob?.month),
        year: readNumber(parsed.dob?.year),
      },
    };
  } catch {
    return null;
  }
}

const Svg = ({
  size = 20,
  stroke = 1.9,
  children,
  ...rest
}) => (
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

const UserIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5c.6-3.7 3.7-5.8 7.5-5.8s6.9 2.1 7.5 5.8" />
  </Svg>
);

const CheckIcon = (props) => (
  <Svg {...props}>
    <path d="m5 12.5 4.6 4.6L19 7.6" />
  </Svg>
);

const AlertIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.8v5M12 16.4h.01" />
  </Svg>
);

const ChevronIcon = (props) => (
  <Svg {...props}>
    <path d="m6 9.5 6 6 6-6" />
  </Svg>
);

const ArrowIcon = (props) => (
  <Svg {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

const MaleIcon = (props) => (
  <Svg {...props}>
    <circle cx="10" cy="14" r="5" />
    <path d="m14 10 6-6M15 4h5v5" />
  </Svg>
);

const FemaleIcon = (props) => (
  <Svg {...props}>
    <circle cx="12" cy="9" r="5" />
    <path d="M12 14v7M9 18h6" />
  </Svg>
);

const SpinnerIcon = (props) => (
  <Svg {...props} className="av1-spin">
    <circle cx="12" cy="12" r="9" opacity=".25" />
    <path d="M21 12a9 9 0 0 0-9-9" />
  </Svg>
);

const FieldMessage = React.memo(function FieldMessage({
  id,
  error,
  hint,
  reduce,
}) {
  const transition = reduce
    ? { duration: 0 }
    : { duration: 0.16, ease: "easeOut" };

  return (
    <div id={id} aria-live="polite">
      <AnimatePresence initial={false} mode="wait">
        {error ? (
          <motion.p
            key="error"
            className="av1-msg"
            data-error="true"
            role="alert"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={transition}
            style={{ overflow: "hidden" }}
          >
            <AlertIcon size={14} />
            <span>{error}</span>
          </motion.p>
        ) : hint ? (
          <motion.p
            key="hint"
            className="av1-msg"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            {hint}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
});

const StepIndicator = React.memo(function StepIndicator({ currentStep }) {
  return (
    <nav aria-label="Sign up progress">
      <ol className="av1-steps">
        {STEPS.map((step, index) => {
          const state =
            step.number === currentStep
              ? "active"
              : step.number < currentStep
                ? "done"
                : "todo";

          return (
            <React.Fragment key={step.number}>
              <li
                className="av1-step"
                aria-current={state === "active" ? "step" : undefined}
              >
                <span className="av1-dot" data-state={state}>
                  {state === "done" ? (
                    <CheckIcon size={20} stroke={2.5} />
                  ) : (
                    step.number
                  )}
                </span>
                <span className="av1-step-label" data-state={state}>
                  {step.label}
                  <span
                    style={{
                      position: "absolute",
                      width: 1,
                      height: 1,
                      overflow: "hidden",
                      clip: "rect(0 0 0 0)",
                    }}
                  >
                    {state === "active"
                      ? " (current step)"
                      : state === "done"
                        ? " (completed)"
                        : ""}
                  </span>
                </span>
              </li>

              {index < STEPS.length - 1 && (
                <li
                  className="av1-line"
                  data-done={step.number < currentStep}
                  aria-hidden="true"
                >
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

const GlassInput = React.memo(function GlassInput({
  id,
  name,
  label,
  value,
  onChange,
  onBlur,
  error,
  hint,
  valid,
  placeholder,
  autoComplete,
  disabled,
  reduce,
}) {
  const messageId = `${id}-msg`;
  const inputRef = useRef(null);
  const focusTimerRef = useRef(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    return () => {
      if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);
    };
  }, []);

  // Detect when the typed text is wider than the box so the full name can be shown below.
  useEffect(() => {
    const element = inputRef.current;
    if (!element) return undefined;

    const check = () => setOverflow(element.scrollWidth > element.clientWidth + 1);
    check();

    if (typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(check);
    observer.observe(element);

    return () => observer.disconnect();
  }, [value]);

  const handleFocus = useCallback(
    (event) => {
      if (
        typeof window === "undefined" ||
        !window.matchMedia?.("(pointer: coarse)").matches
      ) {
        return;
      }

      const element = event.currentTarget;

      if (focusTimerRef.current) window.clearTimeout(focusTimerRef.current);

      focusTimerRef.current = window.setTimeout(() => {
        if (!element.isConnected) return;

        element.scrollIntoView?.({
          behavior: reduce ? "auto" : "smooth",
          block: "center",
        });
      }, 280);
    },
    [reduce],
  );

  const fullText = value.replace(/\s+/g, " ").trim();
  const showFull = overflow && !!fullText;
  const showCount = !error && value.length >= NAME_MAX - 14;

  return (
    <div className="av1-nf" data-invalid={!!error}>
      <label htmlFor={id} className="av1-nf-label">
        {label}
        <span className="av1-req" aria-hidden="true">
          *
        </span>
      </label>

      <div className="av1-nf-box" data-disabled={!!disabled}>
        <span className="av1-nf-ico" aria-hidden="true">
          <UserIcon size={19} />
        </span>

        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          className="av1-nf-input"
          value={value}
          title={value}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          maxLength={NAME_MAX + 10}
          disabled={disabled}
          required
          aria-required="true"
          aria-invalid={!!error}
          aria-describedby={messageId}
        />

        <AnimatePresence>
          {valid && !error && (
            <motion.span
              key="valid"
              className="av1-nf-check"
              initial={reduce ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 27 }}
              aria-hidden="true"
            >
              <CheckIcon size={18} stroke={2.5} />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div
        className="av1-nf-foot"
        data-error={!!error}
        id={messageId}
        aria-live="polite"
      >
        {error ? (
          <>
            <AlertIcon size={13} />
            <span>{error}</span>
          </>
        ) : showFull ? (
          <span className="av1-nf-full">{fullText}</span>
        ) : hint ? (
          <span>{hint}</span>
        ) : (
          <span>&nbsp;</span>
        )}

        {showCount && (
          <span className="av1-nf-count">
            {value.length}/{NAME_MAX}
          </span>
        )}
      </div>
    </div>
  );
});

const GENDER_OPTIONS = [
  { value: "Male", label: "Male", id: IDS.genderMale, Icon: MaleIcon },
  { value: "Female", label: "Female", id: IDS.genderFemale, Icon: FemaleIcon },
];

const GenderCards = React.memo(function GenderCards({
  value,
  onChange,
  error,
}) {
  const refs = useRef([]);
  const messageId = "signup-gender-msg";
  const selectedIndex = GENDER_OPTIONS.findIndex((option) => option.value === value);

  const move = useCallback(
    (index, delta) => {
      const next = (index + delta + GENDER_OPTIONS.length) % GENDER_OPTIONS.length;
      onChange(GENDER_OPTIONS[next].value);
      refs.current[next]?.focus();
    },
    [onChange],
  );

  const handleKeyDown = (event, index) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      move(index, -1);
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(GENDER_OPTIONS[0].value);
      refs.current[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(GENDER_OPTIONS[GENDER_OPTIONS.length - 1].value);
      refs.current[GENDER_OPTIONS.length - 1]?.focus();
    }
  };

  return (
    <div>
      <span
        id="signup-gender-label"
        className="av1-label"
        data-filled={!!value}
        data-invalid={!!error}
      >
        Gender
        <span className="av1-req" aria-hidden="true">
          *
        </span>
      </span>

      <div
        className="av1-genders"
        role="radiogroup"
        aria-labelledby="signup-gender-label"
        aria-required="true"
        aria-invalid={!!error}
        aria-describedby={messageId}
      >
        {GENDER_OPTIONS.map((option, index) => {
          const selected = value === option.value;
          const Icon = option.Icon;

          return (
            <button
              key={option.value}
              ref={(element) => {
                refs.current[index] = element;
              }}
              id={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={
                selectedIndex < 0
                  ? index === 0
                    ? 0
                    : -1
                  : selected
                    ? 0
                    : -1
              }
              className="av1-gender"
              data-invalid={!!error && !value}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <span className="av1-gender-ico">
                <Icon size={21} />
              </span>
              <span className="av1-gender-text">{option.label}</span>

              <AnimatePresence>
                {selected && (
                  <motion.span
                    className="av1-gender-check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={{ type: "spring", stiffness: 520, damping: 25 }}
                    aria-hidden="true"
                  >
                    <CheckIcon size={13} stroke={2.8} />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>

      <FieldMessage id={messageId} error={error} />
    </div>
  );
});

const GlassSelect = React.memo(function GlassSelect({
  id,
  label,
  placeholder,
  value,
  onChange,
  options,
  invalid,
  describedBy,
  align = "left",
  reduce,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [placement, setPlacement] = useState({ direction: "down", maxHeight: 240 });

  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const typeRef = useRef({ buffer: "", timer: null });

  const listId = `${id}-list`;
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;

  const selectedIndex = useMemo(
    () => options.findIndex((option) => String(option.value) === String(value)),
    [options, value],
  );

  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const close = useCallback((refocus = false) => {
    setOpen(false);

    if (refocus) {
      buttonRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const openList = useCallback(() => {
    if (disabled) return;

    const rect = buttonRef.current?.getBoundingClientRect();

    if (rect && typeof window !== "undefined") {
      const viewportHeight =
        window.visualViewport?.height ?? window.innerHeight;

      const viewportOffset = window.visualViewport?.offsetTop ?? 0;
      const below = viewportHeight + viewportOffset - rect.bottom - 14;
      const above = rect.top - viewportOffset - 14;
      const direction = below < 210 && above > below ? "up" : "down";
      const available = direction === "up" ? above : below;

      setPlacement({
        direction,
        maxHeight: Math.max(96, Math.min(264, available)),
      });
    }

    setActive(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [disabled, selectedIndex]);

  useEffect(() => {
    if (!open) return;

    const list = listRef.current;
    if (!list) return;

    list.focus({ preventScroll: true });

    const index = selectedIndex >= 0 ? selectedIndex : 0;
    const option = list.children[index];

    if (option) {
      list.scrollTop = Math.max(
        0,
        option.offsetTop - list.clientHeight / 2 + option.offsetHeight / 2,
      );
    }
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open) return;

    const list = listRef.current;
    const option = list?.children[active];
    if (!list || !option) return;

    const top = option.offsetTop;
    const bottom = top + option.offsetHeight;

    if (top < list.scrollTop) list.scrollTop = top - 6;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight + 6;
    }
  }, [open, active]);

  useEffect(() => {
    if (!open) return undefined;

    const handleOutsidePointer = (event) => {
      if (!wrapRef.current?.contains(event.target)) {
        close(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointer);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
    };
  }, [open, close]);

  useEffect(() => {
    return () => {
      if (typeRef.current.timer) {
        window.clearTimeout(typeRef.current.timer);
      }
    };
  }, []);

  const choose = useCallback(
    (index) => {
      const option = options[index];

      if (option) onChange(option.value);
      close(true);
    },
    [options, onChange, close],
  );

  const handleTriggerKeyDown = (event) => {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      if (!open) openList();
    }
  };

  const handleListKeyDown = (event) => {
    const last = options.length - 1;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActive((index) => Math.min(index + 1, last));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActive((index) => Math.max(index - 1, 0));
        return;
      case "PageDown":
        event.preventDefault();
        setActive((index) => Math.min(index + 7, last));
        return;
      case "PageUp":
        event.preventDefault();
        setActive((index) => Math.max(index - 7, 0));
        return;
      case "Home":
        event.preventDefault();
        setActive(0);
        return;
      case "End":
        event.preventDefault();
        setActive(last);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(active);
        return;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        close(true);
        return;
      case "Tab":
        close(false);
        return;
      default:
        break;
    }

    if (
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const typeState = typeRef.current;

      if (typeState.timer) window.clearTimeout(typeState.timer);

      typeState.buffer += event.key.toLocaleLowerCase();
      typeState.timer = window.setTimeout(() => {
        typeState.buffer = "";
        typeState.timer = null;
      }, 650);

      const index = options.findIndex((option) =>
        String(option.label).toLocaleLowerCase().startsWith(typeState.buffer),
      );

      if (index >= 0) setActive(index);
    }
  };

  const popupStyle = {
    maxHeight: `${placement.maxHeight}px`,
    [placement.direction === "up" ? "bottom" : "top"]: "calc(100% + 8px)",
    [align === "right" ? "right" : "left"]: 0,
    width: "max(100%, 132px)",
    transformOrigin: placement.direction === "up" ? "bottom" : "top",
  };

  return (
    <div
      ref={wrapRef}
      className="av1-sel-wrap"
      style={{ zIndex: open ? 50 : 1 }}
    >
      <span id={labelId} className="av1-sellabel">
        {label}
      </span>

      <button
        ref={buttonRef}
        id={id}
        type="button"
        className="av1-trigger"
        data-open={open}
        data-invalid={!!invalid}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${valueId}`}
        aria-describedby={describedBy}
        aria-invalid={!!invalid}
        disabled={disabled}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span
          id={valueId}
          className="av1-trigger-text"
          data-empty={!selected}
        >
          {selected ? selected.display ?? selected.label : placeholder}
        </span>
        <ChevronIcon size={16} className="av1-chev" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={labelId}
            aria-activedescendant={`${id}-opt-${active}`}
            className="av1-list"
            style={popupStyle}
            initial={
              reduce
                ? false
                : {
                    opacity: 0,
                    y: placement.direction === "up" ? 6 : -6,
                    scale: 0.98,
                  }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{
              opacity: 0,
              scale: 0.98,
              transition: { duration: reduce ? 0 : 0.1 },
            }}
            transition={{ duration: reduce ? 0 : 0.15, ease: "easeOut" }}
            onKeyDown={handleListKeyDown}
          >
            {options.map((option, index) => {
              const isSelected = index === selectedIndex;

              return (
                <li
                  key={option.value}
                  id={`${id}-opt-${index}`}
                  role="option"
                  aria-selected={isSelected}
                  className="av1-opt"
                  data-active={index === active}
                  onMouseMove={() => {
                    if (index !== active) setActive(index);
                  }}
                  onClick={() => choose(index)}
                >
                  <span>{option.label}</span>
                  {isSelected && <CheckIcon size={16} stroke={2.5} />}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
});

const DateOfBirthSelector = React.memo(function DateOfBirthSelector({
  value,
  onPartChange,
  error,
  reduce,
  disabled,
}) {
  const messageId = "signup-dob-msg";
  const currentYear = new Date().getFullYear();

  const years = useMemo(
    () =>
      Array.from({ length: MAX_AGE + 1 }, (_, index) => {
        const year = currentYear - index;
        return { value: year, label: String(year) };
      }),
    [currentYear],
  );

  const dayCount = value.month
    ? daysInMonth(value.year || 2000, value.month)
    : 31;

  const days = useMemo(
    () =>
      Array.from({ length: dayCount }, (_, index) => ({
        value: index + 1,
        label: String(index + 1),
      })),
    [dayCount],
  );

  const age = getAge(value.day, value.month, value.year);
  const anyFilled = !!(value.day || value.month || value.year);

  return (
    <div
      role="group"
      aria-labelledby="signup-dob-label"
      aria-describedby={messageId}
    >
      <div className="av1-dob-head">
        <span
          id="signup-dob-label"
          className="av1-label"
          data-filled={anyFilled}
          data-invalid={!!error}
        >
          Date of Birth
          <span className="av1-req" aria-hidden="true">
            *
          </span>
        </span>

        <AnimatePresence>
          {age !== null && age >= 0 && (
            <motion.span
              key="age"
              className="av1-age"
              data-ok={age >= MIN_AGE && age <= MAX_AGE}
              initial={reduce ? false : { opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: reduce ? 0 : 0.16 }}
              role="status"
            >
              {age} {age === 1 ? "year" : "years"}
              {age < MIN_AGE ? ` · min ${MIN_AGE}` : ""}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="av1-dob">
        <GlassSelect
          id={IDS.dobDay}
          label="Day"
          placeholder="DD"
          value={value.day}
          options={days}
          onChange={(nextValue) => onPartChange("day", nextValue)}
          invalid={!!error && !value.day}
          describedBy={messageId}
          reduce={reduce}
          disabled={disabled}
        />

        <GlassSelect
          id={IDS.dobMonth}
          label="Month"
          placeholder="Month"
          value={value.month}
          options={MONTHS}
          onChange={(nextValue) => onPartChange("month", nextValue)}
          invalid={!!error && !value.month}
          describedBy={messageId}
          reduce={reduce}
          disabled={disabled}
        />

        <GlassSelect
          id={IDS.dobYear}
          label="Year"
          placeholder="YYYY"
          value={value.year}
          options={years}
          onChange={(nextValue) => onPartChange("year", nextValue)}
          invalid={!!error && !value.year}
          describedBy={messageId}
          align="right"
          reduce={reduce}
          disabled={disabled}
        />
      </div>

      <FieldMessage id={messageId} error={error} reduce={reduce} />
    </div>
  );
});

export default function SignupStep1Personal() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const reduce = !!useReducedMotion();
  const isDark = theme === "dark";

  const [formData, setFormData] = useState(
    () => readSavedForm() ?? EMPTY_FORM,
  );
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(0);
  const [nameFocus, setNameFocus] = useState("");

  const submittingRef = useRef(false);
  const mountedRef = useRef(true);
  const submitTimerRef = useRef(null);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (submitTimerRef.current) {
        window.clearTimeout(submitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !window.matchMedia?.("(pointer: fine)").matches
    ) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      document.getElementById(IDS.firstName)?.focus({ preventScroll: true });
    }, 160);

    return () => window.clearTimeout(timer);
  }, []);

  const errors = useMemo(() => validateForm(formData), [formData]);
  const isFormValid = Object.keys(errors).length === 0;

  const dobAllFilled = !!(
    formData.dob.day &&
    formData.dob.month &&
    formData.dob.year
  );

  const showError = useCallback(
    (key) => attempted || !!touched[key],
    [attempted, touched],
  );

  const visibleErrors = {
    firstName: showError("firstName") ? errors.firstName : "",
    lastName: showError("lastName") ? errors.lastName : "",
    gender: showError("gender") ? errors.gender : "",
    dob:
      attempted || (touched.dob && dobAllFilled)
        ? errors.dob
        : "",
  };

  const touch = useCallback((key) => {
    setTouched((previous) =>
      previous[key] ? previous : { ...previous, [key]: true },
    );
  }, []);

  const setName = useCallback(
    (key) => (event) => {
      const value = event.target.value;
      setFormData((previous) => ({ ...previous, [key]: value }));
    },
    [],
  );

  const setGender = useCallback(
    (gender) => {
      setFormData((previous) => ({ ...previous, gender }));
      touch("gender");
    },
    [touch],
  );

  const setDobPart = useCallback(
    (part, value) => {
      setFormData((previous) => {
        const dob = { ...previous.dob, [part]: value };

        if (
          dob.day &&
          dob.month &&
          Number(dob.day) > daysInMonth(dob.year || 2000, dob.month)
        ) {
          dob.day = "";
        }

        return { ...previous, dob };
      });

      touch("dob");
    },
    [touch],
  );

  const focusField = useCallback(
    (key) => {
      const { dob, gender } = formData;

      const target =
        key === "firstName"
          ? IDS.firstName
          : key === "lastName"
            ? IDS.lastName
            : key === "gender"
              ? gender === "Female"
                ? IDS.genderFemale
                : IDS.genderMale
              : !dob.day
                ? IDS.dobDay
                : !dob.month
                  ? IDS.dobMonth
                  : !dob.year
                    ? IDS.dobYear
                    : IDS.dobDay;

      window.requestAnimationFrame(() => {
        document.getElementById(target)?.focus({ preventScroll: false });
      });
    },
    [formData],
  );

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();

      if (submittingRef.current) return;

      setAttempted(true);

      const result = validateForm(formData);
      const firstInvalid = [
        "firstName",
        "lastName",
        "gender",
        "dob",
      ].find((key) => result[key]);

      if (firstInvalid) {
        toast.error(
          firstInvalid === "dob" && result.dob !== "Complete all fields"
            ? result.dob
            : "Please complete the highlighted fields to continue.",
          { id: TOAST_ID },
        );

        focusField(firstInvalid);

        if (!reduce) setShake((previous) => previous + 1);
        return;
      }

      submittingRef.current = true;
      setLoading(true);

      const processedData = {
        ...formData,
        firstName: normalizeName(formData.firstName),
        lastName: normalizeName(formData.lastName),
      };

      try {
        window.sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(processedData),
        );
      } catch (storageError) {
        console.warn("Could not persist signup step 1:", storageError);
      }

      try {
        navigate(NEXT_ROUTE, {
          state: {
            step1Data: processedData,
            timestamp: Date.now(),
          },
          replace: true,
        });

        submitTimerRef.current = window.setTimeout(() => {
          if (!mountedRef.current) return;

          submittingRef.current = false;
          setLoading(false);
        }, 2500);
      } catch (error) {
        console.error("Signup step 1 error:", error);
        toast.error("Something went wrong. Please try again.", {
          id: TOAST_ID,
        });

        submittingRef.current = false;
        setLoading(false);
      }
    },
    [formData, focusField, navigate, reduce],
  );

  const buttonDisabled = !isFormValid || loading;
  const rootVariables = isDark ? THEMES.dark : THEMES.light;
  const year = new Date().getFullYear();

  return (
    <div
      className="av1-root"
      style={rootVariables}
      data-theme={isDark ? "dark" : "light"}
    >
      <style>{STYLES}</style>

      <div className="av1-bg" aria-hidden="true">
        <span className="av1-orb av1-orb-a" />
        <span className="av1-orb av1-orb-b" />
        <span className="av1-orb av1-orb-c" />
        <span className="av1-dots" />
      </div>

      <main className="av1-shell">
        <motion.div
          className="av1-wrap"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.42,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <StepIndicator currentStep={1} />

          <motion.section
            className="av1-card"
            aria-labelledby="signup-title"
            initial={reduce ? false : { opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: reduce ? 0 : 0.06,
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <span className="av1-spec" aria-hidden="true" />
            <span className="av1-rim" aria-hidden="true" />

            <header>
              <h1 id="signup-title" className="av1-h1">
                Personal Information
              </h1>
              <p className="av1-sub">
                Step 1 of 3 · Create your account
              </p>
            </header>

            <form
              onSubmit={handleSubmit}
              noValidate
              aria-busy={loading}
            >
              <div className="av1-divider" aria-hidden="true">
                Your details
              </div>

              <div className="av1-stack">
                <div
                  className="av1-names"
                  data-focus={nameFocus}
                  onFocus={(event) =>
                    setNameFocus(
                      event.target.id === IDS.firstName
                        ? "first"
                        : event.target.id === IDS.lastName
                          ? "last"
                          : "",
                    )
                  }
                  onBlur={() => setNameFocus("")}
                >
                  <GlassInput
                    id={IDS.firstName}
                    name="firstName"
                    label="First name"
                    placeholder="Given name"
                    autoComplete="given-name"
                    value={formData.firstName}
                    onChange={setName("firstName")}
                    onBlur={() => touch("firstName")}
                    error={visibleErrors.firstName}
                    valid={
                      !validateName(formData.firstName, "First name")
                    }
                    hint="As on your ID"
                    disabled={loading}
                    reduce={reduce}
                  />

                  <GlassInput
                    id={IDS.lastName}
                    name="lastName"
                    label="Last name"
                    placeholder="Family name"
                    autoComplete="family-name"
                    value={formData.lastName}
                    onChange={setName("lastName")}
                    onBlur={() => touch("lastName")}
                    error={visibleErrors.lastName}
                    valid={
                      !validateName(formData.lastName, "Last name")
                    }
                    hint="Full family name"
                    disabled={loading}
                    reduce={reduce}
                  />
                </div>

                <GenderCards
                  value={formData.gender}
                  onChange={setGender}
                  error={visibleErrors.gender}
                />

                <DateOfBirthSelector
                  value={formData.dob}
                  onPartChange={setDobPart}
                  error={visibleErrors.dob}
                  reduce={reduce}
                  disabled={loading}
                />
              </div>

              <div className="av1-cta-wrap">
                <motion.button
                  type="submit"
                  className="av1-btn"
                  aria-disabled={buttonDisabled}
                  data-loading={loading}
                  whileTap={
                    !buttonDisabled && !reduce
                      ? { scale: 0.985 }
                      : undefined
                  }
                  animate={shake ? { x: [0, -7, 7, -4, 4, 0] } : { x: 0 }}
                  transition={{ duration: 0.35 }}
                  key={`cta-${shake}`}
                >
                  {loading ? (
                    <>
                      <SpinnerIcon size={19} />
                      <span>Processing…</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowIcon size={19} stroke={2.3} />
                    </>
                  )}
                </motion.button>
              </div>

              <p className="av1-signin">
                Already have an account?{" "}
                <button
                  type="button"
                  className="av1-link"
                  onClick={() => navigate(LOGIN_ROUTE)}
                  disabled={loading}
                >
                  Sign in
                </button>
              </p>
            </form>
          </motion.section>

          <footer>
            <p className="av1-foot">© {year} Arvdoul</p>
          </footer>
        </motion.div>
      </main>
    </div>
  );
}