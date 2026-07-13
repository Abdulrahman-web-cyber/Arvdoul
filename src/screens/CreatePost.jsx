// src/screens/CreatePost.jsx
// ARVDOUL ULTIMATE POST CREATOR – FINAL PRODUCTION‑READY
// ✅ Exact custom SVG icons (Photo, Events, Question, Poll, Text, Video, Audio, Vibe, Link) – 100% as provided
// ✅ Header with DNA gradient, reduced size
// ✅ Templates & Schedule buttons match header gradient exactly
// ✅ Post‑type cards are floating glass cards with increased height (aspect‑[3/5]), shadows, round edges
// ✅ 3‑column responsive grid
// ✅ All previous features intact (offline, drafts, AI, etc.)

import React, {
  useReducer, useEffect, useCallback, useRef, useState,
  createContext, useContext, useMemo, lazy, Suspense, useId
} from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { useAppStore } from "../store/appStore";
import { openDB } from "idb";
import { v4 as uuidv4 } from "uuid";
import * as Icons from "lucide-react";
import DOMPurify from "dompurify";
import { produce } from "immer";
import LoadingSpinner from "../components/Shared/LoadingSpinner.jsx";
import { ErrorBoundary } from "../components/ErrorBoundary.jsx";
import { getFunctions, httpsCallable } from "firebase/functions";

// Lazy‑loaded editors
const CreateText = lazy(() => import("./CreatePost/CreateText"));
const CreateImage = lazy(() => import("./CreatePost/CreateImage"));
const CreateVideo = lazy(() => import("./CreatePost/CreateVideo"));
const CreatePoll = lazy(() => import("./CreatePost/CreatePoll"));
const CreateQuestion = lazy(() => import("./CreatePost/CreateQuestion"));
const CreateLink = lazy(() => import("./CreatePost/CreateLink"));
const CreateAudio = lazy(() => import("./CreatePost/CreateAudio"));
const CreateEvent = lazy(() => import("./CreatePost/CreateEvent"));

const DateTimePicker = lazy(() => import("react-datepicker"));
import "react-datepicker/dist/react-datepicker.css";

import { Virtuoso } from "react-virtuoso";

// Services
import { getFirestoreService } from "../services/firestoreService";
import { getStorageService } from "../services/storageService";
import { getSearchService } from "../services/searchService";
import { getVideoService } from "../services/videoService";
import { getStoryService } from "../services/storyService";
import { getMonetizationService } from "../services/monetizationService";
import { getNotificationsService } from "../services/notificationsService";
import { getFeedService } from "../services/feedService";
import { getUserService } from "../services/userService";

// ── CONSTANTS & DESIGN TOKENS ──────────────────────────────────────────
const DNA_GRADIENT_STYLE =
  "linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)";
const DRAFT_DB_NAME = "arvdoul_create_post_v6";
const OFFLINE_QUEUE_STORE = "offline_queue";
const MEDIA_BLOB_STORE = "media_blobs";
const BLOB_HASH_STORE = "blob_hashes";
const VERSIONS_STORE = "draft_versions";
const TEMPLATES_STORE = "templates";

const INPUT_CLASS =
  "w-full p-2.5 rounded-xl border text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-purple-500 focus:outline-none";

// ── EXACT CUSTOM SVG ICONS (100 % as provided, unique IDs) ─────────────
const makeIconComponent = (renderSvg) => {
  const Comp = () => {
    const uid = useId().replace(/:/g, "");
    return renderSvg(uid);
  };
  return Comp;
};

const PhotoIcon = makeIconComponent((uid) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className="w-16 h-16">
    <defs>
      <linearGradient id={`g-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#B416DB"/>
        <stop offset="35%" stopColor="#872FE2"/>
        <stop offset="70%" stopColor="#4B6BFF"/>
        <stop offset="100%" stopColor="#0EA3E6"/>
      </linearGradient>
      <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.40"/>
        <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.10"/>
        <stop offset="100%" stopColor="#000000" stopOpacity="0.35"/>
      </linearGradient>
      <radialGradient id={`lens-${uid}`}>
        <stop offset="0%" stopColor="#EAFBFF"/>
        <stop offset="25%" stopColor="#7FE7FF"/>
        <stop offset="55%" stopColor="#1B8CFF"/>
        <stop offset="100%" stopColor="#050816"/>
      </radialGradient>
      <radialGradient id={`core-${uid}`}>
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1"/>
        <stop offset="30%" stopColor="#9BE9FF" stopOpacity="0.55"/>
        <stop offset="70%" stopColor="#0EA3E6" stopOpacity="0.12"/>
        <stop offset="100%" stopColor="#0EA3E6" stopOpacity="0"/>
      </radialGradient>
      <filter id={`shadow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#000000" floodOpacity="0.55"/>
      </filter>
      <filter id={`glow-${uid}`}>
        <feGaussianBlur stdDeviation="5" result="b"/>
        <feMerge>
          <feMergeNode in="b"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id={`inner-${uid}`}>
        <feOffset dx="0" dy="2"/>
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feComposite in="SourceGraphic" in2="b" operator="arithmetic" k2="-1" k3="1"/>
      </filter>
    </defs>
    <rect x="10" y="20" width="100" height="80" rx="28" fill={`url(#g-${uid})`} filter={`url(#shadow-${uid})`}/>
    <rect x="10" y="20" width="100" height="80" rx="28" fill={`url(#glass-${uid})`}/>
    <rect x="12" y="22" width="96" height="76" rx="26" fill="none" stroke="#FFFFFF" strokeOpacity="0.16"/>
    <rect x="18" y="28" width="84" height="10" rx="5" fill="#FFFFFF" opacity="0.16"/>
    <rect x="22" y="30" width="42" height="6" rx="3" fill="#FFFFFF" opacity="0.10"/>
    <circle cx="92" cy="33" r="2" fill="#7FE7FF" opacity="0.75"/>
    <circle cx="60" cy="62" r="38" fill="none" stroke="#0EA3E6" strokeOpacity="0.18" strokeWidth="2" filter={`url(#glow-${uid})`}/>
    <circle cx="60" cy="62" r="34" fill="none" stroke="#4B6BFF" strokeOpacity="0.10" strokeWidth="2"/>
    <circle cx="60" cy="62" r="33" fill="#050A14" filter={`url(#inner-${uid})`}/>
    <circle cx="60" cy="62" r="26" fill={`url(#lens-${uid})`}/>
    <circle cx="60" cy="62" r="21" fill="none" stroke="#BFEFFF" strokeOpacity="0.22" strokeWidth="2"/>
    <circle cx="60" cy="62" r="17" fill="none" stroke="#0EA3E6" strokeOpacity="0.14" strokeWidth="1.5"/>
    <circle cx="60" cy="62" r="13" fill="#061022"/>
    <circle cx="60" cy="62" r="11" fill={`url(#core-${uid})`}/>
    <circle cx="53" cy="55" r="5" fill="#FFFFFF" opacity="0.25"/>
    <circle cx="66" cy="50" r="2.5" fill="#FFFFFF" opacity="0.18"/>
    <circle cx="63" cy="67" r="2" fill="#7FE7FF" opacity="0.3"/>
    <rect x="48" y="58" width="24" height="1" fill="#7FE7FF" opacity="0.10"/>
    <rect x="50" y="64" width="20" height="1" fill="#7FE7FF" opacity="0.08"/>
    <rect x="44" y="18" width="32" height="6" rx="3" fill="#FFFFFF" opacity="0.12"/>
  </svg>
));

const EventIcon = makeIconComponent((uid) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className="w-16 h-16">
    <defs>
      <linearGradient id={`g-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#B416DB"/>
        <stop offset="35%" stopColor="#872FE2"/>
        <stop offset="70%" stopColor="#4B6BFF"/>
        <stop offset="100%" stopColor="#0EA3E6"/>
      </linearGradient>
      <linearGradient id={`glass-${uid}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.28"/>
        <stop offset="55%" stopColor="#FFFFFF" stopOpacity="0.08"/>
        <stop offset="100%" stopColor="#000000" stopOpacity="0.40"/>
      </linearGradient>
      <radialGradient id={`corePulse-${uid}`}>
        <stop offset="0%" stopColor="#7FE7FF" stopOpacity="0.95"/>
        <stop offset="40%" stopColor="#4B6BFF" stopOpacity="0.25"/>
        <stop offset="100%" stopColor="#0EA3E6" stopOpacity="0"/>
      </radialGradient>
      <filter id={`shadow-${uid}`} x="-60%" y="-60%" width="220%" height="220%">
        <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#000000" floodOpacity="0.55"/>
      </filter>
      <filter id={`glow-${uid}`}>
        <feGaussianBlur stdDeviation="4" result="b"/>
        <feMerge>
          <feMergeNode in="b"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <filter id={`inner-${uid}`}>
        <feOffset dx="0" dy="2"/>
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feComposite in="SourceGraphic" in2="b" operator="arithmetic" k2="-1" k3="1"/>
      </filter>
    </defs>
    <rect x="14" y="16" width="92" height="88" rx="26" fill={`url(#g-${uid})`} filter={`url(#shadow-${uid})`}/>
    <rect x="14" y="16" width="92" height="88" rx="26" fill={`url(#glass-${uid})`}/>
    <rect x="22" y="24" width="76" height="14" rx="7" fill="#FFFFFF" opacity="0.14"/>
    <circle cx="32" cy="31" r="3" fill="#7FE7FF" opacity="0.9"/>
    <circle cx="88" cy="31" r="3" fill="#FF4FD8" opacity="0.8"/>
    <rect x="24" y="42" width="72" height="56" rx="18" fill="#08101A" opacity="0.65" filter={`url(#inner-${uid})`}/>
    <rect x="24" y="60" width="72" height="1" fill="#FFFFFF" opacity="0.06"/>
    <rect x="40" y="42" width="1" height="56" fill="#FFFFFF" opacity="0.06"/>
    <rect x="64" y="42" width="1" height="56" fill="#FFFFFF" opacity="0.06"/>
    <circle cx="60" cy="66" r="16" fill={`url(#corePulse-${uid})`} filter={`url(#glow-${uid})`}/>
    <circle cx="60" cy="66" r="9" fill="#7FE7FF"/>
    <circle cx="60" cy="66" r="3.5" fill="#FFFFFF"/>
    <circle cx="38" cy="52" r="3.2" fill="#B416DB" filter={`url(#glow-${uid})`}/>
    <circle cx="82" cy="52" r="3.2" fill="#4B6BFF" filter={`url(#glow-${uid})`}/>
    <circle cx="38" cy="78" r="3.2" fill="#0EA3E6" filter={`url(#glow-${uid})`}/>
    <circle cx="82" cy="78" r="3.2" fill="#7FE7FF" filter={`url(#glow-${uid})`}/>
    <rect x="38" y="52" width="44" height="1" fill="#7FE7FF" opacity="0.08"/>
    <rect x="38" y="78" width="44" height="1" fill="#4B6BFF" opacity="0.06"/>
    <circle cx="60" cy="52" r="2" fill="#FFFFFF" opacity="0.35"/>
    <circle cx="60" cy="78" r="2" fill="#FFFFFF" opacity="0.25"/>
    <rect x="36" y="100" width="48" height="4" rx="2" fill="#FFFFFF" opacity="0.12"/>
  </svg>
));

const QuestionIcon = makeIconComponent((uid) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className="w-16 h-16">
    <defs>
      <linearGradient id={`arvdoul-gradient-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#B416DB"/>
        <stop offset="35%" stopColor="#872FE2"/>
        <stop offset="70%" stopColor="#4B6BFF"/>
        <stop offset="100%" stopColor="#0EA3E6"/>
      </linearGradient>
      <radialGradient id={`core-bg-${uid}`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#0F1A33"/>
        <stop offset="70%" stopColor="#070D1F"/>
        <stop offset="100%" stopColor="#03060D"/>
      </radialGradient>
      <radialGradient id={`dot-glow-${uid}`} cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#7FE7FF" stopOpacity="1"/>
        <stop offset="45%" stopColor="#4B6BFF" stopOpacity="0.35"/>
        <stop offset="100%" stopColor="#0EA3E6" stopOpacity="0"/>
      </radialGradient>
      <filter id={`shadow-${uid}`} x="-25%" y="-15%" width="150%" height="150%">
        <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000000" floodOpacity="0.6"/>
      </filter>
      <filter id={`glow-${uid}`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="2.2" result="b"/>
        <feMerge>
          <feMergeNode in="b"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <circle cx="60" cy="60" r="52" fill={`url(#arvdoul-gradient-${uid})`} filter={`url(#shadow-${uid})`}/>
    <circle cx="60" cy="60" r="43.5" fill={`url(#core-bg-${uid})`}/>
    <path d="M 46 44 C 46 33 57 27 66 30 C 74 33 76 42 71 48 C 65 55 60 59 60 68" fill="none" stroke={`url(#arvdoul-gradient-${uid})`} strokeWidth="9.2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M 46 44 C 46 33 57 27 66 30 C 74 33 76 42 71 48 C 65 55 60 59 60 68" fill="none" stroke="#7FE7FF" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.28"/>
    <circle cx="60" cy="86" r="9" fill={`url(#dot-glow-${uid})`} filter={`url(#glow-${uid})`}/>
    <circle cx="60" cy="86" r="4.6" fill="#7FE7FF"/>
    <circle cx="60" cy="86" r="2" fill="#FFFFFF"/>
  </svg>
));

const PollIcon = makeIconComponent((uid) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className="w-16 h-16">
    <defs>
      <linearGradient id={`arvdoul-gradient-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#B416DB"/>
        <stop offset="35%" stopColor="#872FE2"/>
        <stop offset="70%" stopColor="#4B6BFF"/>
        <stop offset="100%" stopColor="#0EA3E6"/>
      </linearGradient>
      <linearGradient id={`glass-highlight-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.24"/>
        <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.10"/>
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"/>
      </linearGradient>
      <filter id={`depth-${uid}`} x="-25%" y="-20%" width="150%" height="160%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000000" floodOpacity="0.22"/>
      </filter>
    </defs>
    <rect x="18" y="62" width="20" height="38" rx="10" fill={`url(#arvdoul-gradient-${uid})`} filter={`url(#depth-${uid})`}/>
    <rect x="21" y="65" width="4.5" height="30" rx="2.25" fill={`url(#glass-highlight-${uid})`}/>
    <rect x="50" y="24" width="20" height="76" rx="10" fill={`url(#arvdoul-gradient-${uid})`} filter={`url(#depth-${uid})`}/>
    <rect x="53" y="27" width="4.5" height="66" rx="2.25" fill={`url(#glass-highlight-${uid})`}/>
    <rect x="82" y="42" width="20" height="58" rx="10" fill={`url(#arvdoul-gradient-${uid})`} filter={`url(#depth-${uid})`}/>
    <rect x="85" y="45" width="4.5" height="48" rx="2.25" fill={`url(#glass-highlight-${uid})`}/>
  </svg>
));

const TextIcon = makeIconComponent((uid) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className="w-16 h-16">
    <defs>
      <linearGradient id={`g-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#B416DB"/>
        <stop offset="35%" stopColor="#872FE2"/>
        <stop offset="70%" stopColor="#4B6BFF"/>
        <stop offset="100%" stopColor="#0EA3E6"/>
      </linearGradient>
      <linearGradient id={`glass-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.24"/>
        <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0.08"/>
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"/>
      </linearGradient>
      <filter id={`depth-${uid}`} x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000000" floodOpacity="0.22"/>
      </filter>
    </defs>
    <rect x="14" y="14" width="92" height="92" rx="24" fill={`url(#g-${uid})`} filter={`url(#depth-${uid})`}/>
    <rect x="18" y="18" width="84" height="13" rx="6.5" fill={`url(#glass-${uid})`}/>
    <rect x="28" y="37" width="64" height="10" rx="5" fill="#07101A" opacity="0.50"/>
    <rect x="28" y="55" width="48" height="10" rx="5" fill="#07101A" opacity="0.50"/>
    <rect x="28" y="73" width="58" height="10" rx="5" fill="#07101A" opacity="0.50"/>
  </svg>
));

const VideoIcon = makeIconComponent((uid) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className="w-16 h-16">
    <defs>
      <linearGradient id={`g-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#B416DB"/>
        <stop offset="35%" stopColor="#872FE2"/>
        <stop offset="70%" stopColor="#4B6BFF"/>
        <stop offset="100%" stopColor="#0EA3E6"/>
      </linearGradient>
      <radialGradient id={`glass-${uid}`} cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35"/>
        <stop offset="35%" stopColor="#7FE7FF" stopOpacity="0.18"/>
        <stop offset="100%" stopColor="#050914" stopOpacity="0"/>
      </radialGradient>
      <radialGradient id={`core-${uid}`} cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#121C36"/>
        <stop offset="70%" stopColor="#070D1F"/>
        <stop offset="100%" stopColor="#050914"/>
      </radialGradient>
      <linearGradient id={`edge-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18"/>
        <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0"/>
      </linearGradient>
      <filter id={`shadow-${uid}`} x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000000" floodOpacity="0.45"/>
      </filter>
      <filter id={`soft-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1.6" result="b"/>
        <feMerge>
          <feMergeNode in="b"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <circle cx="60" cy="60" r="52" fill={`url(#g-${uid})`} filter={`url(#shadow-${uid})`}/>
    <circle cx="60" cy="60" r="44" fill={`url(#glass-${uid})`}/>
    <circle cx="60" cy="60" r="41.5" fill={`url(#core-${uid})`}/>
    <circle cx="60" cy="60" r="30" fill="none" stroke={`url(#edge-${uid})`} strokeWidth="2" opacity="0.6"/>
    <path d="M54 44 L84 60 L54 76 Z" fill={`url(#g-${uid})`}/>
    <path d="M57 50 L74 60 L57 70 Z" fill="#FFFFFF" opacity="0.12" filter={`url(#soft-${uid})`}/>
    <circle cx="50" cy="40" r="18" fill="#7FE7FF" opacity="0.08"/>
  </svg>
));

const AudioIcon = makeIconComponent((uid) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className="w-16 h-16">
    <defs>
      <linearGradient id={`g-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#B416DB"/>
        <stop offset="35%" stopColor="#872FE2"/>
        <stop offset="70%" stopColor="#4B6BFF"/>
        <stop offset="100%" stopColor="#0EA3E6"/>
      </linearGradient>
      <radialGradient id={`glass-${uid}`} cx="42%" cy="32%" r="70%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.30"/>
        <stop offset="45%" stopColor="#7FE7FF" stopOpacity="0.12"/>
        <stop offset="100%" stopColor="#050914" stopOpacity="0"/>
      </radialGradient>
      <radialGradient id={`core-${uid}`} cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#121C36"/>
        <stop offset="70%" stopColor="#070D1F"/>
        <stop offset="100%" stopColor="#050914"/>
      </radialGradient>
      <filter id={`shadow-${uid}`} x="-20%" y="-20%" width="140%" height="150%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000000" floodOpacity="0.28"/>
      </filter>
      <filter id={`soft-${uid}`} x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur stdDeviation="1.15" result="b"/>
        <feMerge>
          <feMergeNode in="b"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <circle cx="60" cy="60" r="52" fill={`url(#g-${uid})`} filter={`url(#shadow-${uid})`}/>
    <circle cx="60" cy="60" r="44" fill={`url(#glass-${uid})`}/>
    <circle cx="60" cy="60" r="41.5" fill={`url(#core-${uid})`}/>
    <rect x="26" y="60" width="10" height="22" rx="5" fill={`url(#g-${uid})`}/>
    <rect x="28" y="62" width="3" height="16" rx="1.5" fill="#FFFFFF" opacity="0.18"/>
    <rect x="42" y="44" width="10" height="54" rx="5" fill={`url(#g-${uid})`}/>
    <rect x="44" y="46" width="3" height="46" rx="1.5" fill="#FFFFFF" opacity="0.18"/>
    <rect x="55" y="30" width="10" height="70" rx="5" fill={`url(#g-${uid})`}/>
    <rect x="57" y="32" width="3" height="62" rx="1.5" fill="#FFFFFF" opacity="0.18"/>
    <rect x="68" y="44" width="10" height="54" rx="5" fill={`url(#g-${uid})`}/>
    <rect x="70" y="46" width="3" height="46" rx="1.5" fill="#FFFFFF" opacity="0.18"/>
    <rect x="84" y="60" width="10" height="22" rx="5" fill={`url(#g-${uid})`}/>
    <rect x="86" y="62" width="3" height="16" rx="1.5" fill="#FFFFFF" opacity="0.18"/>
    <ellipse cx="60" cy="40" rx="18" ry="14" fill="#7FE7FF" opacity="0.06" filter={`url(#soft-${uid})`}/>
  </svg>
));

const VibeIcon = makeIconComponent((uid) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className="w-16 h-16">
    <defs>
      <linearGradient id={`g-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#B416DB"/>
        <stop offset="35%" stopColor="#872FE2"/>
        <stop offset="70%" stopColor="#4B6BFF"/>
        <stop offset="100%" stopColor="#0EA3E6"/>
      </linearGradient>
      <radialGradient id={`glass-${uid}`} cx="40%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.30"/>
        <stop offset="50%" stopColor="#7FE7FF" stopOpacity="0.10"/>
        <stop offset="100%" stopColor="#050914" stopOpacity="0"/>
      </radialGradient>
      <radialGradient id={`core-${uid}`} cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#0F1A33"/>
        <stop offset="75%" stopColor="#070D1F"/>
        <stop offset="100%" stopColor="#050914"/>
      </radialGradient>
      <filter id={`shadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000000" floodOpacity="0.35"/>
      </filter>
      <filter id={`soft-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="1.2"/>
      </filter>
    </defs>
    <circle cx="60" cy="60" r="52" fill={`url(#g-${uid})`} filter={`url(#shadow-${uid})`}/>
    <circle cx="60" cy="60" r="46" fill="none" stroke={`url(#g-${uid})`} strokeWidth="7" strokeLinecap="round" strokeDasharray="18 10 22 10 26 10 22 10 18" opacity="0.95"/>
    <circle cx="60" cy="60" r="41" fill={`url(#glass-${uid})`}/>
    <circle cx="60" cy="60" r="37" fill={`url(#core-${uid})`}/>
    <circle cx="60" cy="60" r="18" fill="none" stroke={`url(#g-${uid})`} strokeWidth="6" opacity="0.9"/>
    <circle cx="60" cy="60" r="7" fill="#7FE7FF"/>
    <ellipse cx="50" cy="42" rx="18" ry="14" fill="#7FE7FF" opacity="0.07" filter={`url(#soft-${uid})`}/>
  </svg>
));

const LinkIcon = makeIconComponent((uid) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" className="w-16 h-16">
    <defs>
      <linearGradient id={`g-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#B416DB"/>
        <stop offset="35%" stopColor="#872FE2"/>
        <stop offset="70%" stopColor="#4B6BFF"/>
        <stop offset="100%" stopColor="#0EA3E6"/>
      </linearGradient>
      <radialGradient id={`glass-${uid}`} cx="40%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25"/>
        <stop offset="55%" stopColor="#7FE7FF" stopOpacity="0.10"/>
        <stop offset="100%" stopColor="#050914" stopOpacity="0"/>
      </radialGradient>
      <filter id={`shadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000000" floodOpacity="0.35"/>
      </filter>
    </defs>
    <circle cx="60" cy="60" r="52" fill={`url(#g-${uid})`} filter={`url(#shadow-${uid})`}/>
    <circle cx="60" cy="60" r="44" fill={`url(#glass-${uid})`}/>
    <circle cx="60" cy="60" r="40" fill="#070D1F"/>
    <rect x="26" y="48" width="36" height="24" rx="12" fill="none" stroke={`url(#g-${uid})`} strokeWidth="8"/>
    <rect x="58" y="48" width="36" height="24" rx="12" fill="none" stroke={`url(#g-${uid})`} strokeWidth="8"/>
    <rect x="52" y="56" width="16" height="8" rx="4" fill={`url(#g-${uid})`}/>
    <rect x="54" y="58" width="12" height="4" rx="2" fill="#7FE7FF" opacity="0.6"/>
  </svg>
));

const POST_TYPES = [
  { id: "text", label: "Text", icon: TextIcon, subtitle: "Write your thoughts" },
  { id: "image", label: "Photo", icon: PhotoIcon, subtitle: "Share moments" },
  { id: "video", label: "Video", icon: VideoIcon, subtitle: "Record & share" },
  { id: "vibe", label: "Vibe", icon: VibeIcon, isStory: true, subtitle: "Capture the moment" },
  { id: "poll", label: "Poll", icon: PollIcon, subtitle: "Get opinions" },
  { id: "question", label: "Questions", icon: QuestionIcon, subtitle: "Ask anything" },
  { id: "link", label: "Links", icon: LinkIcon, subtitle: "Share resources" },
  { id: "audio", label: "Audio", icon: AudioIcon, subtitle: "Sound & voice" },
  { id: "event", label: "Events", icon: EventIcon, subtitle: "Plan together" },
];

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "followers", label: "Followers" },
  { value: "friends", label: "Friends" },
  { value: "close_friends", label: "Close Friends" },
  { value: "subscribers", label: "Subscribers" },
  { value: "only_me", label: "Only Me" },
  { value: "custom_list", label: "Custom List" },
];

const MONETIZATION_TYPES = [
  { value: "none", label: "No Monetization" },
  { value: "subscription", label: "Subscriber Only" },
  { value: "ppv", label: "Pay‑Per‑View" },
  { value: "tip_jar", label: "Tip Jar" },
  { value: "boost", label: "Boost" },
];

const BOOST_TIERS = [
  { value: "none", label: "No Boost", budget: 0, duration: 1 },
  { value: "low", label: "Low Boost", budget: 50, duration: 1 },
  { value: "medium", label: "Medium Boost", budget: 100, duration: 2 },
  { value: "high", label: "High Boost", budget: 200, duration: 3 },
];

const CROSS_PLATFORMS = [
  { id: "twitter", label: "Twitter", icon: Icons.Twitter },
  { id: "linkedin", label: "LinkedIn", icon: Icons.Linkedin },
  { id: "youtube", label: "YouTube", icon: Icons.Youtube },
  { id: "instagram", label: "Instagram", icon: Icons.Instagram },
];

const MEDIA_LIMITS = {
  maxImages: 10,
  maxVideos: 1,
  maxVideoDurationSec: 600,
  maxFileSizeMB: 100,
  maxTotalMediaCount: 10,
};

// ── UTIL: SHA‑256 ──────────────────────────────────────────────────────
async function sha256(blob) {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── REDUCER (identical, stable) ────────────────────────────────────────
const initialState = {
  postType: null,
  content: "",
  contentJSON: null,
  mediaItems: [],
  visibility: "public",
  customList: [],
  location: null,
  taggedPeople: [],
  taggedBrands: [],
  taggedProducts: [],
  topics: [],
  hashtags: [],
  feeling: null,
  activity: null,
  monetization: { type: "none" },
  boost: { type: "none", budget: 0, duration: 1 },
  subscriptionTier: null,
  ppvPrice: null,
  tipJarAmounts: [5, 10, 25],
  scheduledTime: null,
  expiresAt: null,
  recurrence: "none",
  coAuthors: [],
  collaborationInvites: [],
  crossPlatform: [],
  settings: {
    enableComments: true,
    enableGifts: true,
    enableSharing: true,
    isNSFW: false,
  },
  typeData: {
    poll: { options: [], allowMultiple: false },
    event: { date: null, location: "" },
    link: { url: "", title: "" },
    audio: { file: null },
    video: { file: null },
  },
  step: 1,
  loading: false,
  progress: 0,
  error: null,
  draftId: null,
  isDraftLoaded: false,
  isDirty: false,
  insights: null,
  moderationStatus: null,
  aiCaption: null,
  aiHashtags: null,
  isContentReady: false,
  _past: [],
  _future: [],
};

function reducer(state, action) {
  if (action.type === "UNDO") {
    if (state._past.length === 0) return state;
    const previous = state._past[state._past.length - 1];
    const newPast = state._past.slice(0, -1);
    return { ...previous, _past: newPast, _future: [state, ...state._future] };
  }
  if (action.type === "REDO") {
    if (state._future.length === 0) return state;
    const next = state._future[0];
    const newFuture = state._future.slice(1);
    return { ...next, _past: [...state._past, state], _future: newFuture };
  }

  const newState = produce(state, (draft) => {
    let pushHistory = false;
    switch (action.type) {
      case "SET_POST_TYPE": draft.postType = action.payload; draft.step = 1; draft.isDraftLoaded = false; pushHistory = true; break;
      case "SET_CONTENT": draft.content = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_CONTENT_JSON": draft.contentJSON = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_MEDIA_ITEMS": draft.mediaItems = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "ADD_MEDIA_ITEMS": {
        const newItems = action.payload.filter(m => {
          if (m.type === "image" && draft.mediaItems.filter(i => i.type === "image").length >= MEDIA_LIMITS.maxImages) { toast.error(`Max ${MEDIA_LIMITS.maxImages} images`); return false; }
          if (m.type === "video" && draft.mediaItems.filter(i => i.type === "video").length >= MEDIA_LIMITS.maxVideos) { toast.error(`Max ${MEDIA_LIMITS.maxVideos} video`); return false; }
          return true;
        });
        if (draft.mediaItems.length + newItems.length > MEDIA_LIMITS.maxTotalMediaCount) { toast.error(`Maximum ${MEDIA_LIMITS.maxTotalMediaCount} media items`); return; }
        draft.mediaItems.push(...newItems); draft.isDirty = true; pushHistory = true; break;
      }
      case "UPDATE_MEDIA_ITEM": { const idx = draft.mediaItems.findIndex(m => m.id === action.payload.id); if (idx !== -1) { draft.mediaItems[idx] = { ...draft.mediaItems[idx], ...action.payload.updates }; pushHistory = true; } break; }
      case "REMOVE_MEDIA_ITEM": draft.mediaItems.splice(action.payload, 1); draft.isDirty = true; pushHistory = true; break;
      case "REORDER_MEDIA": { const [removed] = draft.mediaItems.splice(action.payload.from, 1); draft.mediaItems.splice(action.payload.to, 0, removed); draft.isDirty = true; pushHistory = true; break; }
      case "SET_VISIBILITY": draft.visibility = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_CUSTOM_LIST": draft.customList = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_LOCATION": draft.location = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "ADD_TAGGED_PERSON": if (!draft.taggedPeople.some(p => p.id === action.payload.id)) { draft.taggedPeople.push(action.payload); draft.isDirty = true; pushHistory = true; } break;
      case "REMOVE_TAGGED_PERSON": draft.taggedPeople = draft.taggedPeople.filter(p => p.id !== action.payload); draft.isDirty = true; pushHistory = true; break;
      case "ADD_TAGGED_BRAND": if (!draft.taggedBrands.some(b => b.id === action.payload.id)) { draft.taggedBrands.push(action.payload); draft.isDirty = true; pushHistory = true; } break;
      case "REMOVE_TAGGED_BRAND": draft.taggedBrands = draft.taggedBrands.filter(b => b.id !== action.payload); draft.isDirty = true; pushHistory = true; break;
      case "ADD_TAGGED_PRODUCT": if (!draft.taggedProducts.some(p => p.id === action.payload.id)) { draft.taggedProducts.push(action.payload); draft.isDirty = true; pushHistory = true; } break;
      case "REMOVE_TAGGED_PRODUCT": draft.taggedProducts = draft.taggedProducts.filter(p => p.id !== action.payload); draft.isDirty = true; pushHistory = true; break;
      case "SET_TOPICS": draft.topics = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_HASHTAGS": draft.hashtags = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_FEELING": draft.feeling = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_ACTIVITY": draft.activity = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_MONETIZATION": draft.monetization = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_BOOST": draft.boost = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_SUBSCRIPTION_TIER": draft.subscriptionTier = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_PPV_PRICE": draft.ppvPrice = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_TIP_JAR_AMOUNTS": draft.tipJarAmounts = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_SCHEDULED_TIME": draft.scheduledTime = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_EXPIRES_AT": draft.expiresAt = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_RECURRENCE": draft.recurrence = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "ADD_CO_AUTHOR": {
        if (!draft.coAuthors.some(c => c.id === action.payload.id)) {
          draft.coAuthors.push({ id: action.payload.id, name: action.payload.name, percentage: action.payload.percentage || 0 });
          draft.isDirty = true; pushHistory = true;
        }
        break;
      }
      case "REMOVE_CO_AUTHOR": draft.coAuthors = draft.coAuthors.filter(u => u.id !== action.payload); draft.isDirty = true; pushHistory = true; break;
      case "SET_CO_AUTHOR_PERCENTAGE": {
        const co = draft.coAuthors.find(c => c.id === action.payload.id);
        if (co) { co.percentage = action.payload.percentage; draft.isDirty = true; pushHistory = true; }
        break;
      }
      case "ADD_COLLABORATION_INVITE": draft.collaborationInvites.push(action.payload); draft.isDirty = true; pushHistory = true; break;
      case "REMOVE_COLLABORATION_INVITE": draft.collaborationInvites = draft.collaborationInvites.filter(i => i.id !== action.payload); draft.isDirty = true; pushHistory = true; break;
      case "TOGGLE_CROSS_PLATFORM": { const p = action.payload; const idx = draft.crossPlatform.indexOf(p); if (idx !== -1) draft.crossPlatform.splice(idx, 1); else draft.crossPlatform.push(p); draft.isDirty = true; pushHistory = true; break; }
      case "UPDATE_SETTINGS": draft.settings = { ...draft.settings, ...action.payload }; draft.isDirty = true; pushHistory = true; break;
      case "SET_POLL_OPTIONS": draft.typeData.poll.options = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_ALLOW_MULTIPLE": draft.typeData.poll.allowMultiple = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_EVENT_DATE": draft.typeData.event.date = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_EVENT_LOCATION": draft.typeData.event.location = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_LINK_URL": draft.typeData.link.url = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_LINK_TITLE": draft.typeData.link.title = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_AUDIO_FILE": draft.typeData.audio.file = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_VIDEO_FILE": draft.typeData.video.file = action.payload; draft.isDirty = true; pushHistory = true; break;
      case "SET_STEP": draft.step = action.payload; break;
      case "SET_LOADING": draft.loading = action.payload; break;
      case "SET_PROGRESS": draft.progress = action.payload; break;
      case "SET_ERROR": draft.error = action.payload; break;
      case "SET_DRAFT_ID": draft.draftId = action.payload; break;
      case "SET_IS_DRAFT_LOADED": draft.isDraftLoaded = action.payload; break;
      case "SET_IS_DIRTY": draft.isDirty = action.payload; break;
      case "SET_INSIGHTS": draft.insights = action.payload; break;
      case "SET_MODERATION_STATUS": draft.moderationStatus = action.payload; break;
      case "SET_AI_CAPTION": draft.aiCaption = action.payload; break;
      case "SET_AI_HASHTAGS": draft.aiHashtags = action.payload; break;
      case "SET_CONTENT_READY": draft.isContentReady = action.payload; break;
      case "LOAD_DRAFT": {
        const { _past, _future, ...cleanState } = structuredClone(state);
        Object.assign(draft, action.payload);
        draft.isDraftLoaded = true;
        draft.draftId = action.payload.draftId || null;
        draft.isDirty = false;
        draft._past = [cleanState];
        draft._future = [];
        draft.isContentReady = !!(draft.content || draft.mediaItems.length);
        break;
      }
      case "RESET": return { ...initialState, postType: draft.postType };
      case "CLEAR_ERROR": draft.error = null; break;
      default: break;
    }
    if (pushHistory) {
      const { _past, _future, ...rest } = state;
      draft._past = [...state._past, rest];
      if (draft._past.length > 50) draft._past.shift();
      draft._future = [];
    }
  });
  return newState;
}

// ── CONTEXTS ────────────────────────────────────────────────────────────
const ServicesContext = createContext();
const StateContext = createContext();

export const useCreatePostServices = () => {
  const ctx = useContext(ServicesContext);
  if (!ctx) throw new Error("useCreatePostServices must be used within CreatePostProvider");
  return ctx;
};

export const useCreatePostState = () => {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error("useCreatePostState must be used within CreatePostProvider");
  return ctx;
};

// ── PROVIDER (ALL LOGIC, FULLY INTEGRATED) ─────────────────────────────
function CreatePostProvider({ children }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { coins: userCoins, setCurrentUser } = useAppStore();
  const isDark = theme === "dark";
  const prefersReducedMotion = useReducedMotion();

  const [state, dispatch] = useReducer(reducer, initialState);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [draftsList, setDraftsList] = useState([]);
  const [offlineQueueItems, setOfflineQueueItems] = useState([]);
  const [servicesReady, setServicesReady] = useState(false);
  const [serviceError, setServiceError] = useState(null);
  const mountedRef = useRef(true);
  const dbRef = useRef(null);
  const processingOfflineRef = useRef(false);
  const publishLockRef = useRef(false);
  const completedRef = useRef(0);
  const mediaPreviewUrlsRef = useRef([]);

  const initLockRef = useRef(false);
  const initPromiseRef = useRef(null);

  const stateRef = useRef(state);
  const isOfflineRef = useRef(isOffline);
  const draftsListRef = useRef(draftsList);
  const userRef = useRef(user);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { isOfflineRef.current = isOffline; }, [isOffline]);
  useEffect(() => { draftsListRef.current = draftsList; }, [draftsList]);
  useEffect(() => { userRef.current = user; }, [user]);

  const services = useRef({
    firestore: null, storage: null, search: null, video: null, story: null,
    monetization: null, notifications: null, feed: null, user: null,
    ai: null, moderation: null, analytics: null,
  });

  useEffect(() => {
    return () => {
      mediaPreviewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  const refreshDraftsList = useCallback(async () => {
    if (!dbRef.current) return;
    const all = await dbRef.current.getAll("drafts");
    all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    setDraftsList(all);
  }, []);

  const refreshOfflineQueue = useCallback(async () => {
    if (!dbRef.current) return;
    const all = await dbRef.current.getAll(OFFLINE_QUEUE_STORE);
    setOfflineQueueItems(all);
  }, []);

  const initServices = useCallback(async () => {
    if (initLockRef.current) return initPromiseRef.current;
    initLockRef.current = true;

    const timedPromise = (promise, timeoutMs, label) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs))
      ]);
    };

    const initTask = (async () => {
      try {
        const servicePromises = [
          getFirestoreService(), getStorageService(), getSearchService(),
          getVideoService(), getStoryService(), getMonetizationService(),
          getNotificationsService(), getFeedService(), getUserService(),
        ];
        const [fs, st, se, vs, ss, ms, ns, fd, us] = await timedPromise(
          Promise.all(servicePromises), 15000, "Service initialization"
        );

        services.current = {
          firestore: fs, storage: st, search: se, video: vs, story: ss,
          monetization: ms, notifications: ns, feed: fd, user: us,
          ai: {
            generateCaption: httpsCallable(getFunctions(), "generateAICaption"),
            generateHashtags: httpsCallable(getFunctions(), "generateAIHashtags"),
          },
          moderation: { check: httpsCallable(getFunctions(), "moderatePost") },
          analytics: { predict: httpsCallable(getFunctions(), "predictPostPerformance") },
        };

        dbRef.current = await timedPromise(
          openDB(DRAFT_DB_NAME, 4, {
            allowDowngrade: true,
            upgrade(db) {
              if (!db.objectStoreNames.contains("drafts")) {
                const draftStore = db.createObjectStore("drafts", { keyPath: "id" });
                draftStore.createIndex("postType", "postType");
                draftStore.createIndex("updatedAt", "updatedAt");
              }
              if (!db.objectStoreNames.contains(OFFLINE_QUEUE_STORE)) {
                const queueStore = db.createObjectStore(OFFLINE_QUEUE_STORE, { keyPath: "id" });
                queueStore.createIndex("postType", "postType");
                queueStore.createIndex("createdAt", "createdAt");
              }
              if (!db.objectStoreNames.contains(MEDIA_BLOB_STORE)) db.createObjectStore(MEDIA_BLOB_STORE, { keyPath: "id" });
              if (!db.objectStoreNames.contains(BLOB_HASH_STORE)) db.createObjectStore(BLOB_HASH_STORE, { keyPath: "hash" });
              if (!db.objectStoreNames.contains(VERSIONS_STORE)) {
                const versionsStore = db.createObjectStore(VERSIONS_STORE, { keyPath: "id" });
                versionsStore.createIndex("draftId", "draftId");
              }
              if (!db.objectStoreNames.contains(TEMPLATES_STORE)) {
                const templatesStore = db.createObjectStore(TEMPLATES_STORE, { keyPath: "id" });
                templatesStore.createIndex("name", "name");
              }
            },
          }),
          10000, "IndexedDB open"
        );

        await refreshDraftsList();
        await refreshOfflineQueue();
        setServicesReady(true);
        setServiceError(null);
      } catch (err) {
        console.error("Init error:", err);
        setServiceError(err.message || "Initialization failed");
      } finally {
        initLockRef.current = false;
        initPromiseRef.current = null;
      }
    })();

    initPromiseRef.current = initTask;
    return initTask;
  }, [refreshDraftsList, refreshOfflineQueue]);

  useEffect(() => {
    initServices();

    const failSafeTimer = setTimeout(() => {
      if (!servicesReady && !serviceError) {
        console.error("Fail-safe kicked in: Init took too long.");
        setServiceError("Creator Studio took too long to respond. Please refresh.");
      }
    }, 18000);

    return () => {
      mountedRef.current = false;
      clearTimeout(failSafeTimer);
    };
  }, [initServices, servicesReady, serviceError]);

  useEffect(() => {
    const online = () => { setIsOffline(false); processOfflineQueue(); };
    const offline = () => setIsOffline(true);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);

  const storeBlobWithDedup = useCallback(async (file, type) => {
    if (!dbRef.current) return null;
    const hash = await sha256(file);
    const hashStore = dbRef.current.transaction(BLOB_HASH_STORE, "readonly").objectStore(BLOB_HASH_STORE);
    const existing = await hashStore.get(hash);
    if (existing) return existing.blobId;
    const blobId = uuidv4();
    await dbRef.current.put(MEDIA_BLOB_STORE, { id: blobId, blob: file, type });
    await dbRef.current.put(BLOB_HASH_STORE, { hash, blobId, type });
    return blobId;
  }, []);

  const saveDraft = useCallback(async () => {
    if (!dbRef.current || !stateRef.current.postType) return;
    const data = stateRef.current;
    const mediaToStore = [];
    for (const m of data.mediaItems) {
      if (m.file) {
        const blobId = await storeBlobWithDedup(m.file, m.type);
        mediaToStore.push({ ...m, file: null, preview: null, blobId });
      } else { mediaToStore.push(m); }
    }
    const draft = {
      id: data.draftId || `draft_${data.postType}_${Date.now()}`,
      postType: data.postType,
      data: { ...data, mediaItems: mediaToStore, draftId: undefined },
      updatedAt: Date.now(),
    };
    await dbRef.current.put("drafts", draft);
    if (!data.draftId) dispatch({ type: "SET_DRAFT_ID", payload: draft.id });
    dispatch({ type: "SET_IS_DIRTY", payload: false });
    await dbRef.current.put(VERSIONS_STORE, { id: uuidv4(), draftId: draft.id, data: draft.data, timestamp: Date.now() });
    await refreshDraftsList();
    if (!isOfflineRef.current && services.current.firestore) {
      try {
        if (typeof services.current.firestore.saveDraft === 'function') {
          await services.current.firestore.saveDraft(userRef.current.uid, draft);
          toast.success("Draft saved & synced");
        } else {
          toast.success("Draft saved locally (cloud sync unavailable)");
        }
      } catch { toast.success("Draft saved locally"); }
    } else { toast.success("Draft saved locally"); }
  }, [storeBlobWithDedup, refreshDraftsList]);

  const loadDraft = useCallback(async (draftId) => {
    if (!dbRef.current) return;
    let draft = await dbRef.current.get("drafts", draftId);
    if (!draft && !isOfflineRef.current && services.current.firestore) {
      try {
        if (typeof services.current.firestore.getDraft === 'function') {
          draft = await services.current.firestore.getDraft(userRef.current.uid, draftId);
        }
      } catch {}
    }
    if (!draft) { toast.error("Draft not found"); return; }
    const restoredMedia = [];
    for (const m of draft.data.mediaItems) {
      if (m.blobId) {
        const blobRecord = await dbRef.current.get(MEDIA_BLOB_STORE, m.blobId);
        if (blobRecord) {
          const file = new File([blobRecord.blob], m.name, { type: blobRecord.type });
          const preview = URL.createObjectURL(file);
          mediaPreviewUrlsRef.current.push(preview);
          restoredMedia.push({ ...m, file, preview, blobId: null });
        } else { restoredMedia.push({ ...m, error: "File missing" }); }
      } else { restoredMedia.push(m); }
    }
    dispatch({ type: "LOAD_DRAFT", payload: { ...draft.data, mediaItems: restoredMedia, draftId: draft.id, postType: draft.postType } });
    toast.success("Draft loaded");
  }, []);

  const deleteDraft = useCallback(async (draftId) => {
    if (!dbRef.current) return;
    await dbRef.current.delete("drafts", draftId);
    await refreshDraftsList();
    if (!isOfflineRef.current && services.current.firestore) {
      try {
        if (typeof services.current.firestore.deleteDraft === 'function') {
          await services.current.firestore.deleteDraft(userRef.current.uid, draftId);
        }
      } catch {}
    }
    toast.success("Draft deleted");
  }, [refreshDraftsList]);

  const resumeLatestDraft = useCallback(async () => {
    if (draftsListRef.current.length === 0) return;
    const latest = draftsListRef.current[0];
    await loadDraft(latest.id);
    dispatch({ type: "SET_POST_TYPE", payload: latest.postType });
    dispatch({ type: "SET_STEP", payload: 2 });
  }, [loadDraft]);

  const saveAsTemplate = useCallback(async () => {
    if (!dbRef.current || !stateRef.current.postType) return;
    const name = prompt("Enter template name:");
    if (!name) return;
    const template = { id: uuidv4(), name, postType: stateRef.current.postType, data: stateRef.current, createdAt: Date.now() };
    await dbRef.current.put(TEMPLATES_STORE, template);
    toast.success("Template saved");
  }, []);

  const loadTemplate = useCallback(async (templateId) => {
    if (!dbRef.current) return;
    const tpl = await dbRef.current.get(TEMPLATES_STORE, templateId);
    if (!tpl) { toast.error("Template not found"); return; }
    dispatch({ type: "LOAD_DRAFT", payload: { ...tpl.data, draftId: null, postType: tpl.postType } });
    dispatch({ type: "SET_POST_TYPE", payload: tpl.postType });
    dispatch({ type: "SET_STEP", payload: 2 });
    toast.success("Template loaded");
  }, []);

  const getDraftVersions = useCallback(async (draftId) => {
    if (!dbRef.current) return [];
    const versions = await dbRef.current.getAllFromIndex(VERSIONS_STORE, "draftId", draftId);
    return versions.sort((a, b) => b.timestamp - a.timestamp);
  }, []);

  const addToOfflineQueue = useCallback(async (postData) => {
    if (!dbRef.current) return;
    const id = uuidv4();
    const mediaToStore = [];
    for (const m of postData.mediaItems) {
      if (m.file) {
        const blobId = await storeBlobWithDedup(m.file, m.type);
        mediaToStore.push({ ...m, file: null, preview: null, blobId });
      } else { mediaToStore.push(m); }
    }
    await dbRef.current.put(OFFLINE_QUEUE_STORE, {
      id, postType: stateRef.current.postType, data: { ...postData, mediaItems: mediaToStore },
      createdAt: Date.now(), retries: 0,
    });
    await refreshOfflineQueue();
    toast.success("Post queued for offline");
  }, [storeBlobWithDedup, refreshOfflineQueue]);

  const processOfflineQueue = useCallback(async () => {
    if (!dbRef.current || isOfflineRef.current || processingOfflineRef.current) return;
    processingOfflineRef.current = true;
    const items = await dbRef.current.getAll(OFFLINE_QUEUE_STORE);
    if (items.length === 0) { processingOfflineRef.current = false; return; }
    toast.info(`Publishing ${items.length} queued posts...`);
    for (const item of items) {
      if (item.retries > 0) {
        const delay = Math.min(2 ** item.retries * 1000, 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      try {
        const restoredMedia = [];
        for (const m of item.data.mediaItems) {
          if (m.blobId) {
            const blobRecord = await dbRef.current.get(MEDIA_BLOB_STORE, m.blobId);
            if (blobRecord) {
              const file = new File([blobRecord.blob], m.name, { type: blobRecord.type });
              restoredMedia.push({ ...m, file, preview: URL.createObjectURL(file), blobId: null });
            } else { restoredMedia.push({ ...m, error: "File missing" }); }
          } else { restoredMedia.push(m); }
        }
        const restoredData = { ...item.data, mediaItems: restoredMedia };
        await publishPost(restoredData, true);
        for (const m of restoredMedia) if (m.preview) URL.revokeObjectURL(m.preview);
        await dbRef.current.delete(OFFLINE_QUEUE_STORE, item.id);
      } catch (err) {
        console.warn("Offline publish failed:", err);
        await dbRef.current.put(OFFLINE_QUEUE_STORE, { ...item, retries: (item.retries || 0) + 1 });
      }
    }
    await refreshOfflineQueue();
    processingOfflineRef.current = false;
  }, [refreshOfflineQueue]);

  const retryOfflineItem = useCallback(async (itemId) => {
    if (!dbRef.current) return;
    const item = await dbRef.current.get(OFFLINE_QUEUE_STORE, itemId);
    if (!item) return;
    try {
      const restoredMedia = [];
      for (const m of item.data.mediaItems) {
        if (m.blobId) {
          const blobRecord = await dbRef.current.get(MEDIA_BLOB_STORE, m.blobId);
          if (blobRecord) {
            const file = new File([blobRecord.blob], m.name, { type: blobRecord.type });
            restoredMedia.push({ ...m, file, preview: URL.createObjectURL(file), blobId: null });
          } else { restoredMedia.push({ ...m, error: "File missing" }); }
        } else { restoredMedia.push(m); }
      }
      const restoredData = { ...item.data, mediaItems: restoredMedia };
      await publishPost(restoredData, true);
      for (const m of restoredMedia) if (m.preview) URL.revokeObjectURL(m.preview);
      await dbRef.current.delete(OFFLINE_QUEUE_STORE, item.id);
      await refreshOfflineQueue();
      toast.success("Published queued post");
    } catch (err) { toast.error("Failed to publish queued post"); }
  }, [refreshOfflineQueue]);

  const deleteOfflineItem = useCallback(async (itemId) => {
    if (!dbRef.current) return;
    await dbRef.current.delete(OFFLINE_QUEUE_STORE, itemId);
    await refreshOfflineQueue();
    toast.success("Removed queued post");
  }, [refreshOfflineQueue]);

  const uploadMedia = useCallback(async (mediaItems) => {
    if (isOfflineRef.current) { toast.error("Cannot upload offline"); return []; }
    if (!services.current.storage) throw new Error("Storage service unavailable");
    const results = [];
    const total = mediaItems.filter(m => m.file && !m.error).length;
    completedRef.current = 0;
    const queue = mediaItems.filter(m => m.file && !m.error);
    const process = async (item) => {
      try {
        let thumbnail = null;
        if (item.type === "image") thumbnail = await generateImageThumbnail(item.file);
        else if (item.type === "video") thumbnail = await generateVideoThumbnail(item.file);
        const result = await services.current.storage.uploadFileWithProgress(
          item.file, `posts/${userRef.current.uid}/${Date.now()}_${item.file.name}`,
          { userId: userRef.current.uid, onProgress: (p) => dispatch({ type: "UPDATE_MEDIA_ITEM", payload: { id: item.id, updates: { progress: p.progress || 0 } } }) }
        );
        results.push({ url: result.downloadURL, thumbnail: thumbnail || null, type: item.type, name: item.name, alt: item.alt || "" });
        completedRef.current++;
        dispatch({ type: "SET_PROGRESS", payload: (completedRef.current / total) * 100 });
      } catch (err) {
        dispatch({ type: "UPDATE_MEDIA_ITEM", payload: { id: item.id, updates: { error: err.message } } });
        toast.error(`Failed to upload ${item.name}`);
      }
    };
    for (let i = 0; i < queue.length; i += 3) {
      await Promise.all(queue.slice(i, i + 3).map(process));
    }
    return results;
  }, []);

  const generateImageThumbnail = (file) => new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxDim = 512; let w = img.width, h = img.height;
      if (w > h) { h = (h * maxDim) / w; w = maxDim; } else { w = (w * maxDim) / h; h = maxDim; }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (blob) {
          const thumbUrl = URL.createObjectURL(blob);
          mediaPreviewUrlsRef.current.push(thumbUrl);
          resolve(thumbUrl);
        } else {
          resolve(null);
        }
      }, "image/jpeg", 0.8);
      img.onload = null; img.onerror = null;
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });

  const generateVideoThumbnail = (file) => new Promise((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.preload = "metadata";
    video.onloadedmetadata = () => { video.currentTime = Math.min(1, video.duration / 2); };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 512; canvas.height = (512 / video.videoWidth) * video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(objectUrl);
        if (blob) {
          const thumbUrl = URL.createObjectURL(blob);
          mediaPreviewUrlsRef.current.push(thumbUrl);
          resolve(thumbUrl);
        } else {
          resolve(null);
        }
      }, "image/jpeg", 0.8);
      video.onloadedmetadata = null; video.onseeked = null; video.onerror = null;
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    video.src = objectUrl;
  });

  const [aiLoading, setAiLoading] = useState(false);

  const generateAICaption = useCallback(async (style = "casual") => {
    if (!services.current.ai) return;
    setAiLoading(true);
    try {
      const result = await services.current.ai.generateCaption({ content: stateRef.current.content, mediaDescriptions: stateRef.current.mediaItems.map(m => m.name || ""), style });
      dispatch({ type: "SET_AI_CAPTION", payload: result.data.caption });
      toast.success("AI caption generated");
    } catch { toast.error("AI caption failed"); }
    finally { setAiLoading(false); }
  }, []);

  const generateAIHashtags = useCallback(async () => {
    if (!services.current.ai) return;
    setAiLoading(true);
    try {
      const result = await services.current.ai.generateHashtags({ content: stateRef.current.content, mediaTypes: stateRef.current.mediaItems.map(m => m.type) });
      dispatch({ type: "SET_AI_HASHTAGS", payload: result.data.hashtags });
      toast.success("AI hashtags generated");
    } catch { toast.error("AI hashtags failed"); }
    finally { setAiLoading(false); }
  }, []);

  const moderateContent = useCallback(async (content, mediaUrls) => {
    if (!services.current.moderation) return null;
    try {
      const result = await services.current.moderation.check({ content, mediaUrls });
      dispatch({ type: "SET_MODERATION_STATUS", payload: result.data });
      return result.data;
    } catch {
      dispatch({ type: "SET_MODERATION_STATUS", payload: { approved: true, flags: [], fallback: true } });
      return null;
    }
  }, []);

  const getPredictions = useCallback(async () => {
    if (!services.current.analytics) return;
    try {
      const result = await services.current.analytics.predict({
        postType: stateRef.current.postType, content: stateRef.current.content,
        mediaCount: stateRef.current.mediaItems.length, scheduledTime: stateRef.current.scheduledTime,
        visibility: stateRef.current.visibility, boost: stateRef.current.boost,
      });
      dispatch({ type: "SET_INSIGHTS", payload: result.data });
    } catch { /* silent */ }
  }, []);

  const debounceTimerRef = useRef(null);
  const lastContentRef = useRef(null);
  const lastMediaRef = useRef(null);

  useEffect(() => {
    const contentChanged = state.content !== lastContentRef.current;
    const mediaChanged = state.mediaItems.length !== lastMediaRef.current || state.mediaItems.some((m, i) => m.url !== lastMediaRef.current?.[i]?.url);
    if (!contentChanged && !mediaChanged) return;
    lastContentRef.current = state.content;
    lastMediaRef.current = state.mediaItems;

    clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (state.content || state.mediaItems.length > 0) {
        getPredictions();
        if (state.content.trim()) {
          moderateContent(state.content, state.mediaItems.map(m => m.url || m.preview));
        }
      }
    }, 800);
    return () => clearTimeout(debounceTimerRef.current);
  }, [state.content, state.mediaItems, getPredictions, moderateContent]);

  const searchUsers = useCallback(async (query) => {
    if (!services.current.search) return [];
    try { const res = await services.current.search.searchUsers(query, { limit: 10 }); return res.success ? res.users : []; } catch { return []; }
  }, []);

  const publishPost = useCallback(async (overrideState = null, isOfflineReplay = false) => {
    if (publishLockRef.current) return;
    publishLockRef.current = true;
    const current = overrideState || stateRef.current;
    const userNow = userRef.current;

    try {
      if (!userNow) throw new Error("Authentication required");
      if (!current.postType) throw new Error("No post type selected");

      const sanitizedContent = DOMPurify.sanitize(current.content, { ALLOWED_TAGS: [] });
      const sanitizedJSON = current.contentJSON ? DOMPurify.sanitize(current.contentJSON, { ALLOWED_TAGS: ['p','br','strong','em','u','s','blockquote','ul','ol','li','a','h1','h2','h3','h4','h5','h6'] }) : null;

      if (current.postType === "text" && !sanitizedContent.trim()) throw new Error("Add some text");
      if (current.postType === "image" && current.mediaItems.length === 0) throw new Error("Add at least one image");
      if (current.postType === "video" && current.mediaItems.length === 0) throw new Error("Add a video");
      if (current.postType === "poll" && current.typeData.poll.options.filter(o => o.trim()).length < 2) throw new Error("Add at least 2 poll options");
      if (current.postType === "event" && (!current.typeData.event.date || new Date(current.typeData.event.date) <= new Date())) throw new Error("Event date must be in the future");
      if (current.postType === "link" && (!current.typeData.link.url || !current.typeData.link.url.startsWith("http"))) throw new Error("Enter a valid URL");

      if (isOfflineRef.current && !isOfflineReplay) { await addToOfflineQueue(current); return; }

      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });
      dispatch({ type: "SET_PROGRESS", payload: 0 });

      const moderation = await moderateContent(sanitizedContent, current.mediaItems.map(m => m.url || m.preview));
      if (moderation && !moderation.approved) throw new Error("Content flagged by moderation");

      let uploadedMedia = [];
      if (current.mediaItems.length > 0) {
        if (isOfflineReplay && current.mediaItems.every(m => m.url)) {
          uploadedMedia = current.mediaItems.map(m => ({ url: m.url, type: m.type, name: m.name, alt: m.alt || "" }));
        } else {
          uploadedMedia = await uploadMedia(current.mediaItems);
          if (uploadedMedia.length === 0 && current.mediaItems.length > 0) throw new Error("No media could be uploaded");
        }
      }

      const postData = {
        type: current.postType, content: sanitizedContent, contentJSON: sanitizedJSON, media: uploadedMedia,
        authorId: userNow.uid, authorName: userNow.displayName, authorUsername: userNow.username, authorPhoto: userNow.photoURL,
        visibility: current.visibility, customList: current.customList, location: current.location,
        taggedPeople: current.taggedPeople, taggedBrands: current.taggedBrands, taggedProducts: current.taggedProducts,
        topics: current.topics, hashtags: current.hashtags, feeling: current.feeling, activity: current.activity,
        monetization: current.monetization.type !== "none" ? current.monetization : null,
        boost: current.boost.type !== "none" ? current.boost : null,
        subscriptionTier: current.subscriptionTier, ppvPrice: current.ppvPrice, tipJarAmounts: current.tipJarAmounts,
        scheduledTime: current.scheduledTime, expiresAt: current.expiresAt, recurrence: current.recurrence,
        settings: current.settings, coAuthors: current.coAuthors, crossPlatform: current.crossPlatform,
        poll: current.postType === "poll" ? { question: sanitizedContent, options: current.typeData.poll.options.filter(o => o.trim()), allowMultiple: current.typeData.poll.allowMultiple } : null,
        event: current.postType === "event" ? { title: sanitizedContent, date: current.typeData.event.date, location: current.typeData.event.location } : null,
        link: current.postType === "link" ? { url: current.typeData.link.url, title: current.typeData.link.title || sanitizedContent } : null,
        question: current.postType === "question" ? sanitizedContent : null,
        audio: current.postType === "audio" ? { file: current.typeData.audio.file } : null,
        video: current.postType === "video" ? { file: current.typeData.video.file } : null,
      };

      const result = await services.current.firestore.createPost(postData);
      if (!result.success) throw new Error(result.error);

      if (current.boost.type !== "none" && current.boost.budget > 0) {
        try {
          const spend = await services.current.monetization.spendCoins(userNow.uid, current.boost.budget, "post_boost");
          if (spend.success) setCurrentUser({ ...userNow, coins: spend.newBalance });
        } catch { toast.error("Boost activation failed, but your post is published."); }
      }

      if (current.coAuthors.length > 0) {
        for (const author of current.coAuthors) {
          services.current.notifications.sendNotification({
            type: "coauthor", recipientId: author.id, senderId: userNow.uid,
            title: "Co‑author invite", message: `${userNow.displayName} invited you`, metadata: { postId: result.postId },
          }).catch(() => {});
        }
      }

      services.current.feed.clearUserCache(userNow.uid);
      if (current.draftId) await deleteDraft(current.draftId);

      if (current.crossPlatform.length > 0) {
        for (const platform of current.crossPlatform) {
          try {
            if (typeof services.current.firestore.publishToPlatform === 'function') {
              await services.current.firestore.publishToPlatform(result.postId, platform);
              toast.success(`Published to ${platform}`);
            } else {
              toast.error(`Cross-platform publishing to ${platform} is not available.`);
            }
          } catch { toast.error(`Failed to publish to ${platform}`); }
        }
      }

      toast.success("Post published!");
      navigate("/home");
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err.message });
      toast.error(err.message);
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
      publishLockRef.current = false;
    }
  }, [addToOfflineQueue, deleteDraft, navigate, setCurrentUser, uploadMedia, moderateContent]);

  const [showDraftModal, setShowDraftModal] = useState(false);
  const [pendingType, setPendingType] = useState(null);
  const [draftToResume, setDraftToResume] = useState(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [unsavedAction, setUnsavedAction] = useState(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState([]);
  const [selectedDraftId, setSelectedDraftId] = useState(null);

  const selectPostType = useCallback((typeId) => {
    if (typeId === "vibe") { navigate("/create-story"); return; }
    if (stateRef.current.isDirty && stateRef.current.postType) {
      setUnsavedAction("switch-type"); setPendingType(typeId); setShowUnsavedModal(true); return;
    }
    const existingDraft = draftsListRef.current.find(d => d.postType === typeId);
    if (existingDraft) {
      setPendingType(typeId); setDraftToResume(existingDraft); setShowDraftModal(true); return;
    }
    dispatch({ type: "RESET" }); dispatch({ type: "SET_POST_TYPE", payload: typeId }); dispatch({ type: "SET_STEP", payload: 2 });
  }, [navigate]);

  const confirmDiscard = useCallback(() => {
    setShowUnsavedModal(false);
    if (unsavedAction === "back") {
      dispatch({ type: "RESET" }); dispatch({ type: "SET_POST_TYPE", payload: null }); dispatch({ type: "SET_STEP", payload: 1 });
    } else if (unsavedAction === "switch-type" && pendingType) {
      const existingDraft = draftsListRef.current.find(d => d.postType === pendingType);
      if (existingDraft) { setDraftToResume(existingDraft); setShowDraftModal(true); }
      else { dispatch({ type: "RESET" }); dispatch({ type: "SET_POST_TYPE", payload: pendingType }); dispatch({ type: "SET_STEP", payload: 2 }); }
    }
    setUnsavedAction(null); setPendingType(null);
  }, [unsavedAction, pendingType]);

  const cancelDiscard = useCallback(() => { setShowUnsavedModal(false); setUnsavedAction(null); setPendingType(null); }, []);

  const handleResumeDraft = useCallback(() => {
    if (draftToResume) { loadDraft(draftToResume.id); dispatch({ type: "SET_POST_TYPE", payload: pendingType }); dispatch({ type: "SET_STEP", payload: 2 }); }
    setShowDraftModal(false); setDraftToResume(null); setPendingType(null);
  }, [draftToResume, pendingType, loadDraft]);

  const handleStartFresh = useCallback(() => {
    dispatch({ type: "RESET" }); dispatch({ type: "SET_POST_TYPE", payload: pendingType }); dispatch({ type: "SET_STEP", payload: 2 });
    setShowDraftModal(false); setDraftToResume(null); setPendingType(null);
  }, [pendingType]);

  const goBackToLauncher = useCallback(() => {
    if (stateRef.current.isDirty) { setUnsavedAction("back"); setShowUnsavedModal(true); return; }
    dispatch({ type: "RESET" }); dispatch({ type: "SET_POST_TYPE", payload: null }); dispatch({ type: "SET_STEP", payload: 1 });
  }, []);

  const loadTemplates = useCallback(async () => {
    if (!dbRef.current) return;
    const all = await dbRef.current.getAll(TEMPLATES_STORE);
    setTemplates(all);
    setShowTemplates(true);
  }, []);

  const loadVersions = useCallback(async (draftId) => {
    if (!dbRef.current) return;
    setSelectedDraftId(draftId);
    const vers = await getDraftVersions(draftId);
    setVersions(vers);
    setShowVersions(true);
  }, [getDraftVersions]);

  const restoreVersion = useCallback(async (version) => {
    dispatch({ type: "LOAD_DRAFT", payload: { ...version.data, draftId: selectedDraftId, postType: stateRef.current.postType } });
    dispatch({ type: "SET_STEP", payload: 2 });
    setShowVersions(false);
    toast.success("Version restored");
  }, [selectedDraftId]);

  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); if (stateRef.current.postType) saveDraft(); else toast.info("Select a post type first"); }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); if (stateRef.current.postType && stateRef.current.step === 3) publishPost(); else toast.info("Complete all steps first"); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); dispatch({ type: "UNDO" }); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); dispatch({ type: "REDO" }); }
      if ((e.ctrlKey || e.metaKey) && e.key >= "1" && e.key <= "9") {
        const idx = parseInt(e.key) - 1;
        const type = POST_TYPES[idx];
        if (type && !type.isStory) { e.preventDefault(); selectPostType(type.id); }
      }
      if (e.key === "Escape" && stateRef.current.postType) { e.preventDefault(); goBackToLauncher(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveDraft, publishPost, selectPostType, goBackToLauncher]);

  useEffect(() => {
    const handler = (e) => { if (stateRef.current.isDirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const servicesValue = useMemo(() => ({
    services: services.current, isOffline, offlineQueueItems, userCoins, isDark, prefersReducedMotion,
    saveDraft, loadDraft, deleteDraft, publishPost, uploadMedia, selectPostType, resumeLatestDraft, goBackToLauncher,
    generateAICaption, generateAIHashtags, getPredictions, moderateContent,
    retryOfflineItem, deleteOfflineItem, searchUsers,
    saveAsTemplate, loadTemplate, loadTemplates, getDraftVersions, loadVersions, restoreVersion,
    showTemplates, setShowTemplates, templates, showVersions, setShowVersions, versions,
    aiLoading,
  }), [
    isOffline, offlineQueueItems, userCoins, isDark, prefersReducedMotion,
    saveDraft, loadDraft, deleteDraft, publishPost, uploadMedia, selectPostType, resumeLatestDraft, goBackToLauncher,
    generateAICaption, generateAIHashtags, getPredictions, moderateContent,
    retryOfflineItem, deleteOfflineItem, searchUsers,
    saveAsTemplate, loadTemplate, loadTemplates, getDraftVersions, loadVersions, restoreVersion,
    showTemplates, setShowTemplates, templates, showVersions, setShowVersions, versions,
    aiLoading,
  ]);

  const stateValue = useMemo(() => ({ state, dispatch, draftsList }), [state, draftsList]);

  if (!servicesReady) {
    if (serviceError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <p className="text-red-500 text-sm mb-4">Failed to initialize: {serviceError}</p>
            <button onClick={initServices} className="px-4 py-2 rounded-xl bg-purple-600 text-white font-medium shadow-lg hover:bg-purple-700 transition">Retry</button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center"><LoadingSpinner size="lg" /><p className="mt-4 text-gray-600 dark:text-gray-400">Loading creator studio...</p></div>
      </div>
    );
  }

  return (
    <ServicesContext.Provider value={servicesValue}>
      <StateContext.Provider value={stateValue}>
        {children}
        <AnimatePresence>
          {showDraftModal && <Modal onClose={() => setShowDraftModal(false)}>
            <h3 className="text-lg font-bold mb-2">Draft found</h3>
            <p className="text-sm mb-4">You have a saved draft for {pendingType}. Resume it or start fresh?</p>
            <div className="flex gap-3">
              <button onClick={handleResumeDraft} className="flex-1 py-2 rounded-xl bg-gradient-to-r from-[#B416DB] via-[#872FE2] to-[#0EA3E6] text-white font-medium">Resume</button>
              <button onClick={handleStartFresh} className="flex-1 py-2 rounded-xl border dark:border-gray-600">New</button>
            </div>
          </Modal>}
          {showUnsavedModal && <Modal onClose={cancelDiscard}>
            <h3 className="text-lg font-bold mb-2">Unsaved changes</h3>
            <p className="text-sm mb-4">You have unsaved changes. Leave anyway?</p>
            <div className="flex gap-3">
              <button onClick={confirmDiscard} className="flex-1 py-2 rounded-xl bg-red-600 text-white font-medium">Discard</button>
              <button onClick={cancelDiscard} className="flex-1 py-2 rounded-xl border dark:border-gray-600">Continue Editing</button>
            </div>
          </Modal>}
          {showTemplates && <Modal onClose={() => setShowTemplates(false)}>
            <h3 className="text-lg font-bold mb-3">Templates</h3>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {templates.length === 0 && <p className="text-sm text-gray-500">No templates saved</p>}
              {templates.map(tpl => (
                <div key={tpl.id} className="flex items-center justify-between p-2 rounded-xl bg-white/10 dark:bg-black/20 border border-white/10 dark:border-gray-700/30">
                  <div><p className="text-sm font-medium">{tpl.name}</p><p className="text-xs text-gray-400">{tpl.postType}</p></div>
                  <button onClick={() => { loadTemplate(tpl.id); setShowTemplates(false); }} className="px-3 py-1 text-xs bg-purple-500 text-white rounded-full">Load</button>
                </div>
              ))}
            </div>
          </Modal>}
          {showVersions && <Modal onClose={() => setShowVersions(false)}>
            <h3 className="text-lg font-bold mb-3">Version History</h3>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {versions.length === 0 && <p className="text-sm text-gray-500">No previous versions</p>}
              {versions.map(ver => (
                <div key={ver.id} className="flex items-center justify-between p-2 rounded-xl bg-white/10 dark:bg-black/20 border border-white/10 dark:border-gray-700/30">
                  <div><p className="text-xs text-gray-400">{new Date(ver.timestamp).toLocaleString()}</p><p className="text-sm">{ver.data.content?.slice(0, 40) || "Untitled"}</p></div>
                  <button onClick={() => restoreVersion(ver)} className="px-3 py-1 text-xs bg-purple-500 text-white rounded-full">Restore</button>
                </div>
              ))}
            </div>
          </Modal>}
        </AnimatePresence>
      </StateContext.Provider>
    </ServicesContext.Provider>
  );
}

// ── MODAL & SHARED PANELS ──────────────────────────────────────────────
function Modal({ children, onClose }) {
  const ref = useRef();
  const { prefersReducedMotion } = useCreatePostServices();

  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    if (ref.current) ref.current.focus();
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    const modal = ref.current;
    if (!modal) return;
    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const trap = (e) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    modal.addEventListener("keydown", trap);
    return () => modal.removeEventListener("keydown", trap);
  }, []);

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-md" onClick={onClose}>
      <motion.div initial={prefersReducedMotion ? {} : { scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={prefersReducedMotion ? {} : { scale: 0.9, opacity: 0 }}
        className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-2xl max-w-md w-full p-6 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)] border border-purple-500/30 focus:outline-none"
        tabIndex={-1} ref={ref} onClick={e => e.stopPropagation()}>
        {children}
      </motion.div>
    </div>
  );
}

function Panel({ icon: Icon, title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const { isDark, prefersReducedMotion } = useCreatePostServices();
  return (
    <details className={`rounded-2xl backdrop-blur-sm border shadow-2xl overflow-hidden ${
      isDark ? 'bg-black/20 border-gray-700/30' : 'bg-white/90 border-gray-200/50 shadow-gray-200/20'
    }`} open={isOpen} onToggle={(e) => setIsOpen(e.target.open)}>
      <summary className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 dark:hover:bg-black/5 transition">
        <Icon className="w-6 h-6 text-purple-400" />
        <span className="font-semibold text-sm text-gray-800 dark:text-white uppercase tracking-wide">{title}</span>
        <Icons.ChevronDown className="ml-auto w-4 h-4 text-gray-400 transition-transform" />
      </summary>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={prefersReducedMotion ? {} : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={prefersReducedMotion ? {} : { height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="p-4 pt-0 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </details>
  );
}

// ── PANELS (exported for Step 3) – all inputs/selects use INPUT_CLASS ─
export function VisibilityPanel({ defaultOpen = false }) {
  const { state, dispatch } = useCreatePostState();
  return (
    <Panel icon={Icons.Eye} title="Visibility" defaultOpen={defaultOpen}>
      <select value={state.visibility} onChange={e => dispatch({ type: "SET_VISIBILITY", payload: e.target.value })}
        className={INPUT_CLASS}>
        {VISIBILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Panel>
  );
}

export function LocationPanel({ defaultOpen = false }) {
  const { state, dispatch } = useCreatePostState();
  const [query, setQuery] = useState(state.location || "");
  const [suggestions, setSuggestions] = useState([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!query.trim()) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`, { headers: { "User-Agent": "ArvdoulApp/1.0" } });
        const data = await res.json();
        setSuggestions(data.map(d => d.display_name));
        setShow(true);
      } catch { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Panel icon={Icons.MapPin} title="Location" defaultOpen={defaultOpen}>
      <input type="text" placeholder="Add location..." value={query} onChange={e => setQuery(e.target.value)}
        onFocus={() => setShow(true)} onBlur={() => setTimeout(() => setShow(false), 200)}
        className={INPUT_CLASS} />
      {show && suggestions.length > 0 && (
        <div className="mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg max-h-40 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button key={i} onMouseDown={() => { dispatch({ type: "SET_LOCATION", payload: s }); setQuery(s); setShow(false); }} className="w-full text-left p-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600">{s}</button>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function TaggingPanel({ defaultOpen = false }) {
  const { state, dispatch } = useCreatePostState();
  const { searchUsers } = useCreatePostServices();
  const [showModal, setShowModal] = useState(false);
  const [tagType, setTagType] = useState("person");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const doSearch = async (q) => { setQuery(q); if (q.length < 2) { setResults([]); return; } const users = await searchUsers(q); setResults(users); };
  const addTag = () => { if (results.length === 0) return; const entity = results[0]; dispatch({ type: `ADD_TAGGED_${tagType.toUpperCase()}`, payload: { id: entity.id, name: entity.displayName || entity.username } }); setShowModal(false); setQuery(""); setResults([]); };

  return (
    <Panel icon={Icons.AtSign} title="Tagging" defaultOpen={defaultOpen}>
      <div className="flex flex-wrap gap-2 mb-3">
        {state.taggedPeople.map(p => <span key={p.id} className="inline-flex items-center gap-1 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-full text-xs">{p.name}<button onClick={() => dispatch({ type: "REMOVE_TAGGED_PERSON", payload: p.id })} className="text-red-400"><Icons.X className="w-3 h-3" /></button></span>)}
        {state.taggedBrands.map(b => <span key={b.id} className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full text-xs">{b.name}<button onClick={() => dispatch({ type: "REMOVE_TAGGED_BRAND", payload: b.id })} className="text-red-400"><Icons.X className="w-3 h-3" /></button></span>)}
        {state.taggedProducts.map(p => <span key={p.id} className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full text-xs">{p.name}<button onClick={() => dispatch({ type: "REMOVE_TAGGED_PRODUCT", payload: p.id })} className="text-red-400"><Icons.X className="w-3 h-3" /></button></span>)}
      </div>
      <div className="flex gap-2">
        {["person", "brand", "product"].map(type => (
          <button key={type} onClick={() => { setTagType(type); setShowModal(true); }} className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-full capitalize">{type}</button>
        ))}
      </div>
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h4 className="font-bold mb-2">Tag {tagType}</h4>
          <input type="text" placeholder="Search..." value={query} onChange={e => doSearch(e.target.value)} className={`${INPUT_CLASS} mb-2`} autoFocus />
          <div className="max-h-40 overflow-y-auto">
            {results.map(u => (
              <button key={u.id} onClick={() => { setResults([u]); addTag(); }} className="w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">{u.displayName || u.username}</button>
            ))}
            {query && results.length === 0 && <p className="text-sm text-gray-500">No results</p>}
          </div>
          <button onClick={() => setShowModal(false)} className="mt-3 w-full py-2 rounded-xl bg-gray-200 dark:bg-gray-700">Cancel</button>
        </Modal>
      )}
    </Panel>
  );
}

export function MonetizationPanel({ defaultOpen = false }) {
  const { state, dispatch } = useCreatePostState();
  const { userCoins } = useCreatePostServices();
  const insufficient = state.monetization.type === "boost" && state.boost.budget > userCoins;
  return (
    <Panel icon={Icons.DollarSign} title="Monetization" defaultOpen={defaultOpen}>
      <select value={state.monetization.type} onChange={e => dispatch({ type: "SET_MONETIZATION", payload: { ...state.monetization, type: e.target.value } })}
        className={INPUT_CLASS}>
        {MONETIZATION_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {state.monetization.type === "boost" && (
        <div className="space-y-2 mt-2">
          <select value={state.boost.type} onChange={e => { const tier = BOOST_TIERS.find(t => t.value === e.target.value); dispatch({ type: "SET_BOOST", payload: tier || BOOST_TIERS[0] }); }}
            className={INPUT_CLASS}>
            {BOOST_TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input type="number" placeholder="Budget" value={state.boost.budget}
            onChange={e => dispatch({ type: "SET_BOOST", payload: { ...state.boost, budget: parseInt(e.target.value) || 0 } })}
            className={INPUT_CLASS} />
          {insufficient && <p className="text-xs text-red-500">Insufficient coins (you have {userCoins})</p>}
        </div>
      )}
      {state.monetization.type === "subscription" && <input type="text" placeholder="Tier name" value={state.subscriptionTier || ""} onChange={e => dispatch({ type: "SET_SUBSCRIPTION_TIER", payload: e.target.value })} className={`${INPUT_CLASS} mt-2`} />}
      {state.monetization.type === "ppv" && <input type="number" placeholder="Price in coins" value={state.ppvPrice || ""} onChange={e => dispatch({ type: "SET_PPV_PRICE", payload: parseInt(e.target.value) || 0 })} className={`${INPUT_CLASS} mt-2`} />}
      {state.monetization.type === "tip_jar" && <input type="text" placeholder="5, 10, 25" value={state.tipJarAmounts.join(", ")} onChange={e => { const amounts = e.target.value.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n)); dispatch({ type: "SET_TIP_JAR_AMOUNTS", payload: amounts }); }} className={`${INPUT_CLASS} mt-2`} />}
    </Panel>
  );
}

export function SchedulingPanel({ defaultOpen = false }) {
  const { state, dispatch } = useCreatePostState();
  const [showPicker, setShowPicker] = useState(false);

  const recurrenceDates = useMemo(() => {
    if (!state.scheduledTime || state.recurrence === "none") return [];
    const base = new Date(state.scheduledTime);
    const dates = [base];
    for (let i = 1; i <= 5; i++) {
      const next = new Date(base);
      if (state.recurrence === "daily") next.setDate(base.getDate() + i);
      else if (state.recurrence === "weekly") next.setDate(base.getDate() + i * 7);
      else if (state.recurrence === "monthly") next.setMonth(base.getMonth() + i);
      if (next > new Date()) dates.push(next);
    }
    return dates;
  }, [state.scheduledTime, state.recurrence]);

  return (
    <Panel icon={Icons.Clock} title="Scheduling" defaultOpen={defaultOpen}>
      <div className="flex items-center gap-4 mb-3">
        <label className="text-sm">Recurrence:</label>
        <select value={state.recurrence} onChange={e => dispatch({ type: "SET_RECURRENCE", payload: e.target.value })}
          className={`${INPUT_CLASS} w-auto`}>
          <option value="none">None</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <button onClick={() => setShowPicker(!showPicker)} className="text-sm text-purple-500 hover:underline">
        {showPicker ? "Hide picker" : "Set specific date/time"}
      </button>
      {showPicker && (
        <Suspense fallback={<div className="h-10 animate-pulse bg-gray-200 dark:bg-gray-700 rounded" />}>
          <DateTimePicker
            selected={state.scheduledTime ? new Date(state.scheduledTime) : null}
            onChange={date => dispatch({ type: "SET_SCHEDULED_TIME", payload: date ? date.toISOString() : null })}
            showTimeSelect dateFormat="Pp" placeholderText="Select date and time"
            className={INPUT_CLASS} />
        </Suspense>
      )}
      {recurrenceDates.length > 1 && (
        <div className="mt-3 p-3 bg-purple-100/10 dark:bg-purple-900/10 rounded-xl border border-purple-500/20">
          <p className="text-xs font-semibold text-purple-400 mb-2">Upcoming posts:</p>
          <div className="flex flex-wrap gap-2">
            {recurrenceDates.map((d, i) => (
              <span key={i} className="bg-purple-500/10 text-purple-400 text-xs px-2 py-1 rounded-full">
                {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

export function CrossPlatformPanel({ defaultOpen = false }) {
  const { state, dispatch } = useCreatePostState();
  return (
    <Panel icon={Icons.Share2} title="Cross‑Platform" defaultOpen={defaultOpen}>
      <div className="flex flex-wrap gap-2">
        {CROSS_PLATFORMS.map(p => {
          const Icon = p.icon; const selected = state.crossPlatform.includes(p.id);
          return (
            <button key={p.id} onClick={() => dispatch({ type: "TOGGLE_CROSS_PLATFORM", payload: p.id })}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition ${selected ? "bg-purple-500 text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"}`}>
              <Icon className="w-3 h-3" /> {p.label}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

export function CoAuthorPanel({ defaultOpen = false }) {
  const { state, dispatch } = useCreatePostState();
  const { searchUsers } = useCreatePostServices();
  const [showModal, setShowModal] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  const doSearch = async (q) => { setQuery(q); if (q.length < 2) { setResults([]); return; } const users = await searchUsers(q); setResults(users); };
  const addCoAuthor = (user) => { dispatch({ type: "ADD_CO_AUTHOR", payload: { id: user.id, name: user.displayName || user.username, percentage: 0 } }); setShowModal(false); setQuery(""); setResults([]); };

  return (
    <Panel icon={Icons.Users} title="Co‑Authors" defaultOpen={defaultOpen}>
      <div className="flex flex-wrap gap-2 mb-3">
        {state.coAuthors.map(c => (
          <div key={c.id} className="flex items-center gap-2 bg-purple-100 dark:bg-purple-900/30 px-3 py-1.5 rounded-full text-xs">
            <span>{c.name}</span>
            <input
              type="number"
              min="0"
              max="100"
              value={c.percentage}
              onChange={e => dispatch({ type: "SET_CO_AUTHOR_PERCENTAGE", payload: { id: c.id, percentage: parseInt(e.target.value) || 0 } })}
              className="w-12 bg-white/20 rounded px-1 text-xs text-center"
              placeholder="%"
            />
            <button onClick={() => dispatch({ type: "REMOVE_CO_AUTHOR", payload: c.id })} className="text-red-400"><Icons.X className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
      <button onClick={() => setShowModal(true)} className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-full">+ Add</button>
      {showModal && (
        <Modal onClose={() => setShowModal(false)}>
          <h4 className="font-bold mb-2">Add Co‑author</h4>
          <input type="text" placeholder="Search..." value={query} onChange={e => doSearch(e.target.value)} className={`${INPUT_CLASS} mb-2`} autoFocus />
          <div className="max-h-40 overflow-y-auto">
            {results.map(u => (
              <button key={u.id} onClick={() => addCoAuthor(u)} className="w-full text-left p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2">
                <img src={u.photoURL || "/assets/default-profile.png"} className="w-6 h-6 rounded-full" alt="" /> <span>{u.displayName || u.username}</span>
              </button>
            ))}
            {query && results.length === 0 && <p className="text-sm text-gray-500">No users found</p>}
          </div>
          <button onClick={() => setShowModal(false)} className="mt-3 w-full py-2 rounded-xl bg-gray-200 dark:bg-gray-700">Cancel</button>
        </Modal>
      )}
    </Panel>
  );
}

export function AIPanel({ defaultOpen = false }) {
  const { state, dispatch } = useCreatePostState();
  const { generateAICaption, generateAIHashtags, aiLoading } = useCreatePostServices();
  return (
    <Panel icon={Icons.Sparkles} title="AI Tools" defaultOpen={defaultOpen}>
      <div className="flex flex-wrap gap-2 mb-2">
        <button onClick={() => generateAICaption("casual")} disabled={aiLoading} className="px-3 py-1 text-xs bg-purple-500 text-white rounded-full disabled:opacity-50">
          {aiLoading ? <LoadingSpinner size="xs" /> : "AI Caption (Casual)"}
        </button>
        <button onClick={() => generateAICaption("professional")} disabled={aiLoading} className="px-3 py-1 text-xs bg-purple-500 text-white rounded-full disabled:opacity-50">
          {aiLoading ? <LoadingSpinner size="xs" /> : "AI Caption (Pro)"}
        </button>
        <button onClick={() => generateAICaption("viral")} disabled={aiLoading} className="px-3 py-1 text-xs bg-purple-500 text-white rounded-full disabled:opacity-50">
          {aiLoading ? <LoadingSpinner size="xs" /> : "AI Caption (Viral)"}
        </button>
        <button onClick={generateAIHashtags} disabled={aiLoading} className="px-3 py-1 text-xs bg-pink-500 text-white rounded-full disabled:opacity-50">
          {aiLoading ? <LoadingSpinner size="xs" /> : "# AI Hashtags"}
        </button>
      </div>
      {state.aiCaption && (
        <div className="p-3 bg-white/5 dark:bg-black/20 rounded-xl border border-purple-500/20">
          <p className="text-sm">{state.aiCaption}</p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => { dispatch({ type: "SET_CONTENT", payload: state.aiCaption }); dispatch({ type: "SET_AI_CAPTION", payload: null }); }} className="text-xs text-green-500">Apply</button>
            <button onClick={() => dispatch({ type: "SET_AI_CAPTION", payload: null })} className="text-xs text-red-400">Dismiss</button>
          </div>
        </div>
      )}
      {state.aiHashtags && (
        <div className="p-3 bg-white/5 dark:bg-black/20 rounded-xl border border-purple-500/20 mt-2">
          <p className="text-sm">{state.aiHashtags.join(" ")}</p>
          <div className="flex gap-2 mt-2">
            <button onClick={() => { dispatch({ type: "SET_HASHTAGS", payload: state.aiHashtags }); dispatch({ type: "SET_AI_HASHTAGS", payload: null }); }} className="text-xs text-green-500">Apply</button>
            <button onClick={() => dispatch({ type: "SET_AI_HASHTAGS", payload: null })} className="text-xs text-red-400">Dismiss</button>
          </div>
        </div>
      )}
    </Panel>
  );
}

export function InsightsPanel({ defaultOpen = false }) {
  const { state } = useCreatePostState();
  const { getPredictions } = useCreatePostServices();
  const content = !state.insights ? (
    <button onClick={getPredictions} className="px-4 py-2 text-sm bg-blue-500 text-white rounded-full hover:bg-blue-600">📊 Get Predictions</button>
  ) : (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div><span className="text-gray-500">Reach:</span> {state.insights.reach}</div>
      <div><span className="text-gray-500">Engagement:</span> {state.insights.engagement}%</div>
      <div><span className="text-gray-500">Earnings:</span> {state.insights.earnings} coins</div>
      <div><span className="text-gray-500">Viral Score:</span> {state.insights.viralScore}%</div>
      <div className="col-span-2"><span className="text-gray-500">Best time:</span> {state.insights.bestTime}</div>
    </div>
  );
  return (
    <Panel icon={Icons.TrendingUp} title="Post Predictions" defaultOpen={defaultOpen}>
      {content}
    </Panel>
  );
}

export function ModerationStatus({ defaultOpen = false }) {
  const { state } = useCreatePostState();
  return (
    <Panel icon={Icons.Shield} title="Content Moderation" defaultOpen={defaultOpen}>
      {state.moderationStatus ? (
        <div className={`p-2 rounded-lg text-xs ${state.moderationStatus.approved ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300" : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"}`}>
          {state.moderationStatus.approved ? "✅ Content passed moderation" : `⚠️ Content flagged: ${(state.moderationStatus.flags || []).join(", ")}`}
          {state.moderationStatus.fallback && <span className="ml-1 text-gray-400">(offline check)</span>}
        </div>
      ) : (
        <p className="text-xs text-gray-500">Typing will auto‑check content.</p>
      )}
    </Panel>
  );
}

// ── POST PREVIEW (live mock‑up) ────────────────────────────────────────
function PostPreview() {
  const { state } = useCreatePostState();
  const isDark = useTheme().theme === "dark";

  const mediaPreviews = useMemo(() => {
    if (!state.mediaItems.length) return null;
    const previews = state.mediaItems.slice(0, 3).map(m => m.preview || m.url);
    return (
      <div className="flex gap-2 mt-2">
        {previews.map((src, i) => (
          <img key={i} src={src} alt="" className="w-16 h-16 object-cover rounded-lg" />
        ))}
        {state.mediaItems.length > 3 && <span className="text-xs self-center">+{state.mediaItems.length - 3}</span>}
      </div>
    );
  }, [state.mediaItems]);

  return (
    <div className={`rounded-2xl border p-4 space-y-2 ${isDark ? 'bg-gray-800/60 border-gray-700/30' : 'bg-white border-gray-200/50'} shadow-lg`}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-xs">
          {state.coAuthors[0]?.name?.[0] || "Y"}
        </div>
        <div>
          <p className="text-sm font-semibold">{state.coAuthors[0]?.name || "You"}</p>
          <p className="text-xs text-gray-400">{state.location || "Earth"}</p>
        </div>
      </div>
      <p className="text-sm">{state.content || "Your post content..."}</p>
      {mediaPreviews}
      <div className="flex gap-2 flex-wrap mt-2">
        {state.hashtags.slice(0, 3).map(tag => (
          <span key={tag} className="text-xs text-purple-500 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded-full">#{tag}</span>
        ))}
      </div>
    </div>
  );
}

export function ReviewSummary({ defaultOpen = false }) {
  const { state } = useCreatePostState();
  const { publishPost, saveDraft, saveAsTemplate } = useCreatePostServices();
  return (
    <div className="rounded-2xl p-6 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.5)] border border-white/10" style={{ background: DNA_GRADIENT_STYLE }}>
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white"><Icons.CheckCircle className="w-5 h-5" /> Review & Publish</h3>
      <PostPreview />
      <div className="space-y-2 text-sm mt-4 text-white/90">
        <div><span className="font-medium">Type:</span> {state.postType}</div>
        <div><span className="font-medium">Media:</span> {state.mediaItems.length} items</div>
        <div><span className="font-medium">Visibility:</span> {VISIBILITY_OPTIONS.find(o => o.value === state.visibility)?.label}</div>
        {state.scheduledTime && <div><span className="font-medium">Scheduled:</span> {new Date(state.scheduledTime).toLocaleString()}</div>}
        <div><span className="font-medium">Recurrence:</span> {state.recurrence}</div>
        <div><span className="font-medium">Monetization:</span> {MONETIZATION_TYPES.find(m => m.value === state.monetization.type)?.label}</div>
        <div><span className="font-medium">Co‑authors:</span> {state.coAuthors.map(c => `${c.name} (${c.percentage}%)`).join(", ") || "None"}</div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={saveDraft} className="flex-1 py-3 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium backdrop-blur-sm">💾 Save Draft</button>
        <button onClick={saveAsTemplate} className="flex-1 py-3 rounded-xl bg-white/20 hover:bg-white/30 text-white font-medium backdrop-blur-sm">📋 Save as Template</button>
      </div>
      <button onClick={() => publishPost()} disabled={state.loading}
        className="w-full py-3 rounded-xl mt-2 bg-white/20 hover:bg-white/30 text-white font-medium backdrop-blur-sm disabled:opacity-50">
        {state.loading ? <LoadingSpinner size="sm" /> : "🚀 Publish"}
      </button>
      {state.error && <p className="text-red-200 text-sm mt-2">{state.error}</p>}
    </div>
  );
}

// ── STEP INDICATOR ─────────────────────────────────────────────────────
function StepIndicator() {
  const { state, dispatch } = useCreatePostState();
  const steps = [{ num: 1, label: "Type" }, { num: 2, label: "Create" }, { num: 3, label: "Publish" }];
  return (
    <div className="sticky top-0 z-20 bg-gray-50/80 dark:bg-[#030712]/80 backdrop-blur-xl py-4 px-4 border-b border-gray-200/50 dark:border-gray-700/30">
      <div className="relative flex items-center justify-center max-w-xs mx-auto">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full" />
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 h-1 rounded-full shadow-lg transition-all duration-500"
          style={{ background: DNA_GRADIENT_STYLE, width: `${((state.step - 1) / 2) * 100}%`, maxWidth: "100%", left: "0", transform: "translateY(-50%)" }} />
        <div className="relative flex justify-between w-full z-10">
          {steps.map((step) => {
            const isActive = state.step >= step.num;
            const isCurrent = state.step === step.num;
            return (
              <button key={step.num} onClick={() => { if (step.num <= state.step) dispatch({ type: "SET_STEP", payload: step.num }); }} disabled={step.num > state.step}
                className="flex flex-col items-center space-y-1" aria-label={`Step ${step.num}: ${step.label}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  isCurrent
                    ? 'text-white shadow-[0_0_30px_rgba(147,51,234,0.5)] ring-2 ring-purple-400/50 ring-offset-2 ring-offset-gray-50 dark:ring-offset-[#030712]'
                    : isActive
                    ? 'text-white backdrop-blur-sm border border-purple-500/30'
                    : 'bg-gray-200/50 dark:bg-gray-700/50 text-gray-400 backdrop-blur-sm'
                }`}
                style={isCurrent ? { background: DNA_GRADIENT_STYLE } : {}}
                >
                  {step.num}
                </div>
                <span className={`text-[10px] sm:text-xs font-medium ${isActive ? "text-purple-500 font-semibold" : "text-gray-400"}`}>{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── LAUNCHER GRID ──────────────────────────────────────────────────────
const LauncherGrid = React.memo(() => {
  const navigate = useNavigate();
  const { selectPostType, resumeLatestDraft, offlineQueueItems, isDark, retryOfflineItem, deleteOfflineItem, loadTemplates, loadVersions, loadDraft } = useCreatePostServices();
  const { state: appState, dispatch, draftsList } = useCreatePostState();
  const draftCounts = useMemo(() => { const counts = {}; draftsList.forEach(d => { counts[d.postType] = (counts[d.postType] || 0) + 1; }); return counts; }, [draftsList]);
  const hasDrafts = draftsList.length > 0;
  const offlineCount = offlineQueueItems.length;
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [showScheduled, setShowScheduled] = useState(false);

  const scheduledDrafts = useMemo(() => draftsList.filter(d => d.data?.scheduledTime).sort((a, b) => new Date(a.data.scheduledTime) - new Date(b.data.scheduledTime)), [draftsList]);
  const memoizedDraftsList = useMemo(() => draftsList, [draftsList]);

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#030712]" : "bg-gray-50"} p-4`}>
      {/* HEADER */}
      <div className="mb-6 max-w-lg mx-auto">
        <div className="rounded-3xl p-4 text-center shadow-[0_20px_40px_-12px_rgba(0,0,0,0.3)]" style={{ background: DNA_GRADIENT_STYLE }}>
          <h1 className="text-xl md:text-2xl font-bold text-white mb-1">
            Welcome to Arvdoul Creators Studio
          </h1>
          <p className="text-xs text-white/80">
            Your canvas, your rules. Create without limits.
          </p>
        </div>
      </div>

      {/* TEMPLATES & SCHEDULE */}
      <div className="max-w-lg mx-auto mb-6 flex gap-3">
        <button
          onClick={loadTemplates}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition hover:scale-105 active:scale-95"
          style={{ background: DNA_GRADIENT_STYLE }}
        >
          <Icons.LayoutTemplate className="w-5 h-5" />
          Templates
        </button>
        <button
          onClick={() => setShowScheduled(!showScheduled)}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl text-white text-sm font-semibold shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition hover:scale-105 active:scale-95"
          style={{ background: DNA_GRADIENT_STYLE }}
        >
          <Icons.Calendar className="w-5 h-5" />
          Schedule
        </button>
      </div>

      {/* Scheduled Posts panel */}
      {showScheduled && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto mb-6">
          <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-white">📅 Scheduled Posts</h3>
              <button onClick={() => setShowScheduled(false)} className="text-xs text-gray-500">Close</button>
            </div>
            {scheduledDrafts.length === 0 ? (
              <p className="text-xs text-gray-500">No scheduled posts yet.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {scheduledDrafts.map(draft => (
                  <div key={draft.id} className="flex items-center justify-between p-2 rounded-xl bg-gray-50 dark:bg-gray-700/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-purple-600">{draft.postType}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 truncate">{draft.data.content?.slice(0, 40) || "Untitled"}</p>
                      <p className="text-xs text-gray-400">{new Date(draft.data.scheduledTime).toLocaleString()}</p>
                    </div>
                    <button onClick={() => { loadDraft(draft.id); dispatch({ type: "SET_POST_TYPE", payload: draft.postType }); dispatch({ type: "SET_STEP", payload: 2 }); }} className="text-xs px-3 py-1 bg-purple-500 text-white rounded-full">Edit</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Continue Draft */}
      {hasDrafts && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto mb-6">
          <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-lg p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icons.RotateCcw className="w-5 h-5 text-purple-500" />
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-white">Continue Draft</p>
                <p className="text-xs text-gray-500">{draftsList[0].postType} • {new Date(draftsList[0].updatedAt).toLocaleDateString()}</p>
              </div>
            </div>
            <button onClick={resumeLatestDraft} className="px-5 py-2 rounded-full text-white text-sm font-medium shadow hover:opacity-90 transition" style={{ background: DNA_GRADIENT_STYLE }}>
              Continue
            </button>
          </div>
        </motion.div>
      )}

      {/* Drafts */}
      {hasDrafts && (
        <div className="max-w-lg mx-auto mb-4">
          <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-lg p-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setDraftsOpen(!draftsOpen)}>
              <span className="text-sm font-medium text-gray-800 dark:text-white">📄 My Drafts ({draftsList.length})</span>
              <Icons.ChevronDown className={`w-4 h-4 transition-transform ${draftsOpen ? 'rotate-180' : ''}`} />
            </div>
            <AnimatePresence>
              {draftsOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 h-60 w-full">
                    <Virtuoso
                      data={memoizedDraftsList}
                      itemContent={(index, draft) => (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/20 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-600">{draft.postType}</span>
                              <span className="text-xs text-gray-400">{new Date(draft.updatedAt).toLocaleDateString()}</span>
                            </div>
                            <p className="text-sm text-gray-800 dark:text-white truncate">{draft.data.content?.slice(0, 60) || 'Untitled'}</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => loadVersions(draft.id)} className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 rounded">Versions</button>
                            <button onClick={() => selectPostType(draft.postType)} className="px-3 py-1.5 rounded-full bg-purple-500 text-white text-xs font-medium">Open</button>
                          </div>
                        </div>
                      )}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {offlineCount > 0 && (
        <div className="max-w-lg mx-auto mb-4">
          <div className="rounded-2xl bg-white dark:bg-gray-800 shadow-lg p-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setQueueOpen(!queueOpen)}>
              <span className="text-sm font-medium text-yellow-600">📤 Offline Queue ({offlineCount})</span>
              <Icons.ChevronDown className={`w-4 h-4 transition-transform ${queueOpen ? 'rotate-180' : ''}`} />
            </div>
            <AnimatePresence>
              {queueOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                    {offlineQueueItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-yellow-50 dark:bg-yellow-500/10">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-yellow-600">Queued</span>
                            <span className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-gray-800 dark:text-white truncate">{item.postType}</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => retryOfflineItem(item.id)} className="px-2 py-1 text-xs bg-blue-500 text-white rounded">Retry</button>
                          <button onClick={() => deleteOfflineItem(item.id)} className="px-2 py-1 text-xs bg-red-500 text-white rounded">Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* POST TYPE GRID – FLOATING GLASS CARDS, INCREASED HEIGHT */}
      <div className="grid grid-cols-3 xs:grid-cols-2 gap-4 w-full max-w-lg mx-auto">
        {POST_TYPES.map(type => {
          const draftCount = draftCounts[type.id] || 0;
          return (
            <button
              key={type.id}
              onClick={() => selectPostType(type.id)}
              className="group relative flex flex-col items-center justify-center w-full aspect-[3/5] rounded-2xl bg-white dark:bg-gray-800 shadow-[0_12px_35px_rgba(0,0,0,0.15)] dark:shadow-[0_12px_35px_rgba(0,0,0,0.4)] hover:scale-[1.02] active:scale-95 transition-all backdrop-blur-sm"
              aria-label={`Create ${type.label}`}
            >
              <div className="mb-3">
                <type.icon />
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white tracking-wide">{type.label}</span>
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mt-1">{type.subtitle}</span>
              {draftCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                  {draftCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});

// ── CREATOR SHELL ──────────────────────────────────────────────────────
function CreatorShell({ children }) {
  const { goBackToLauncher } = useCreatePostServices();
  return (
    <div className="flex flex-col min-h-screen">
      <div className="h-14 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/30 flex items-center px-4">
        <Icons.ArrowLeft className="w-5 h-5 cursor-pointer" onClick={() => goBackToLauncher()} />
        <span className="ml-3 font-semibold text-gray-800 dark:text-white">Create Post</span>
      </div>
      {children}
    </div>
  );
}

// ── MAIN CONTENT ROUTER ────────────────────────────────────────────────
function CreatePostContent() {
  const { state } = useCreatePostState();
  const step2Content = useMemo(() => {
    if (!state.postType) return null;
    switch (state.postType) {
      case "text": return <CreateText />;
      case "image": return <CreateImage />;
      case "video": return <CreateVideo />;
      case "poll": return <CreatePoll />;
      case "question": return <CreateQuestion />;
      case "link": return <CreateLink />;
      case "audio": return <CreateAudio />;
      case "event": return <CreateEvent />;
      default: return null;
    }
  }, [state.postType]);

  if (state.step === 1 || !state.postType) {
    return (
      <ErrorBoundary fallback={<div className="p-4 text-red-500">Launcher error</div>}>
        <LauncherGrid />
      </ErrorBoundary>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>}>
      <ErrorBoundary fallback={<div className="p-4 text-red-500">Failed to load editor.</div>}>
        <CreatorShell>
          <CreatePostShell>
            {state.step === 2 ? step2Content : (
              <div className="space-y-6 py-4">
                <VisibilityPanel defaultOpen={true} />
                <LocationPanel defaultOpen={false} />
                <TaggingPanel defaultOpen={false} />
                <MonetizationPanel defaultOpen={false} />
                <SchedulingPanel defaultOpen={false} />
                <CrossPlatformPanel defaultOpen={false} />
                <CoAuthorPanel defaultOpen={false} />
                <AIPanel defaultOpen={false} />
                <InsightsPanel defaultOpen={false} />
                <ModerationStatus defaultOpen={false} />
                <ReviewSummary />
              </div>
            )}
          </CreatePostShell>
        </CreatorShell>
      </ErrorBoundary>
    </Suspense>
  );
}

function CreatePostShell({ children }) {
  const { state, dispatch } = useCreatePostState();
  const { goBackToLauncher } = useCreatePostServices();

  const canProceed = useCallback(() => {
    if (state.isContentReady) return true;
    if (state.step === 1) return !!state.postType;
    if (state.step === 2) {
      switch (state.postType) {
        case "text": case "question": return state.content.trim().length > 0;
        case "image": case "video": return state.mediaItems.length > 0;
        case "audio": return state.typeData.audio.file !== null;
        case "poll": return state.content.trim().length > 0 && state.typeData.poll.options.filter(o => o.trim()).length >= 2;
        case "event": return state.content.trim().length > 0 && state.typeData.event.date !== null && new Date(state.typeData.event.date) > new Date();
        case "link": return state.typeData.link.url.trim().length > 0;
        default: return true;
      }
    }
    return true;
  }, [state.isContentReady, state.step, state.postType, state.content, state.mediaItems, state.typeData]);

  return (
    <div className="flex flex-col h-full">
      {state.step > 1 && <StepIndicator />}
      <div className="flex-1 overflow-y-auto px-4 min-h-[60vh]">
        <AnimatePresence mode="wait">
          <motion.div key={state.step} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex justify-between items-center px-4 py-3">
        <button onClick={() => { if (state.step === 1) goBackToLauncher(); else dispatch({ type: "SET_STEP", payload: state.step - 1 }); }} className="px-4 py-2 rounded-full bg-gray-200 dark:bg-gray-700 shadow-md hover:shadow-lg transition" aria-label="Back">Back</button>
        {state.step < 3 && (
          <button onClick={() => dispatch({ type: "SET_STEP", payload: state.step + 1 })} disabled={!canProceed()}
            className={`px-8 py-3 rounded-full font-bold text-white transition-all duration-300 flex items-center gap-2 ${
              canProceed()
                ? 'shadow-[0_0_30px_rgba(147,51,234,0.4)] hover:shadow-[0_0_40px_rgba(147,51,234,0.6)] hover:scale-105 active:scale-95'
                : 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed opacity-60'
            }`}
            style={canProceed() ? { background: DNA_GRADIENT_STYLE } : {}}
          >
            Next <Icons.ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── DEFAULT EXPORT ─────────────────────────────────────────────────────
export default function CreatePostEntry() {
  return (
    <CreatePostProvider>
      <CreatePostContent />
    </CreatePostProvider>
  );
}