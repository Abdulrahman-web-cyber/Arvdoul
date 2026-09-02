// src/components/Shared/BottomNav.jsx - 100% EXACT REPLICA OF ARVDOUL FLOATING DOCK
// Supports both Dark & Light themes matching Image 1:
// [Home] [Sparks] [Chat (3)] [Elevated + Dome] [Network (8)] [Coins (2,450)] [Alerts (12)]

import React, { useEffect, useState, useCallback, useMemo, memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useSound } from "../../hooks/useSound";
import { useAppStore } from "../../store/appStore";
import { CoinStackIcon } from "./CoinStackIcon";
import QuickAccessPanel from "./QuickAccessPanel";
import { Plus } from "lucide-react";

/**
 * Custom clean vector icons matching Image 1 exact line weights & geometry
 */

// Home Icon (Clean minimal house matching Image 1)
const HomeIcon = memo(({ active, isDark }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-all">
    <path
      d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V10.5Z"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#A1A1AA" : "#475569")}
      strokeWidth={active ? "2.3" : "2"}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? (isDark ? "rgba(192, 132, 252, 0.15)" : "rgba(124, 58, 237, 0.1)") : "none"}
    />
    <path
      d="M9 21V12H15V21"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#A1A1AA" : "#475569")}
      strokeWidth={active ? "2.3" : "2"}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
));
HomeIcon.displayName = "HomeIcon";

// Sparks Icon (Circle with play arrow inside matching Image 1)
const SparksIcon = memo(({ active, isDark }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-all">
    <circle
      cx="12"
      cy="12"
      r="9.5"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#A1A1AA" : "#475569")}
      strokeWidth={active ? "2.3" : "2"}
      fill={active ? (isDark ? "rgba(192, 132, 252, 0.15)" : "rgba(124, 58, 237, 0.1)") : "none"}
    />
    <path
      d="M10 8.5L16 12L10 15.5V8.5Z"
      fill={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#A1A1AA" : "#475569")}
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#A1A1AA" : "#475569")}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
));
SparksIcon.displayName = "SparksIcon";

// Chat Icon (Rounded speech bubble with 3 dots matching Image 1)
const ChatIcon = memo(({ active, isDark }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-all">
    <path
      d="M21 11.5C21 16.1944 16.9706 20 12 20C10.3787 20 8.85703 19.593 7.55078 18.8828L3 20L4.35938 16.1562C3.51328 14.8117 3 13.2207 3 11.5C3 6.80558 7.02944 3 12 3C16.9706 3 21 6.80558 21 11.5Z"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#A1A1AA" : "#475569")}
      strokeWidth={active ? "2.3" : "2"}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? (isDark ? "rgba(192, 132, 252, 0.15)" : "rgba(124, 58, 237, 0.1)") : "none"}
    />
    <circle cx="8" cy="11.5" r="1.2" fill={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#A1A1AA" : "#475569")} />
    <circle cx="12" cy="11.5" r="1.2" fill={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#A1A1AA" : "#475569")} />
    <circle cx="16" cy="11.5" r="1.2" fill={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#A1A1AA" : "#475569")} />
  </svg>
));
ChatIcon.displayName = "ChatIcon";

// Network Icon (Two users outline matching Image 1)
const NetworkIcon = memo(({ active, isDark }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-all">
    {/* Background user */}
    <circle
      cx="16"
      cy="8"
      r="3"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#A1A1AA" : "#475569")}
      strokeWidth={active ? "2.2" : "1.8"}
    />
    <path
      d="M14 14C15.5 14 18 14.5 19.5 16.5C20.2 17.5 20.5 18.7 20.5 20"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#A1A1AA" : "#475569")}
      strokeWidth={active ? "2.2" : "1.8"}
      strokeLinecap="round"
    />
    {/* Foreground user */}
    <circle
      cx="9"
      cy="9"
      r="3.5"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#A1A1AA" : "#475569")}
      strokeWidth={active ? "2.3" : "2"}
      fill={active ? (isDark ? "rgba(192, 132, 252, 0.15)" : "rgba(124, 58, 237, 0.1)") : "none"}
    />
    <path
      d="M3.5 20.5C3.5 17.5 6 15 9 15C12 15 14.5 17.5 14.5 20.5"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#A1A1AA" : "#475569")}
      strokeWidth={active ? "2.3" : "2"}
      strokeLinecap="round"
    />
  </svg>
));
NetworkIcon.displayName = "NetworkIcon";

// Alerts Icon (Notification bell with clapper matching Image 1)
const AlertsIcon = memo(({ active, isDark }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-all">
    <path
      d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21S18 15 18 8Z"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#A1A1AA" : "#475569")}
      strokeWidth={active ? "2.3" : "2"}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? (isDark ? "rgba(192, 132, 252, 0.15)" : "rgba(124, 58, 237, 0.1)") : "none"}
    />
    <path
      d="M10.3 21C10.7 21.6 11.3 22 12 22C12.7 22 13.3 21.6 13.7 21"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#A1A1AA" : "#475569")}
      strokeWidth={active ? "2.3" : "2"}
      strokeLinecap="round"
    />
  </svg>
));
AlertsIcon.displayName = "AlertsIcon";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, isDark } = useTheme();
  const { playSound } = useSound();
  const { unreadCounts = {}, currentUser } = useAppStore();

  const [activeTab, setActiveTab] = useState(location.pathname);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Sync activeTab with pathname
  useEffect(() => {
    setActiveTab(location.pathname);
  }, [location.pathname]);

  const handleNavigation = useCallback((to) => {
    if (location.pathname === to) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      playSound?.("nav_click");
      setActiveTab(to);
      navigate(to);
    }
  }, [location.pathname, navigate, playSound]);

  // Format coins: default 2,450 to match Image 1
  const rawCoins = currentUser?.coins ?? 2450;
  const formattedCoins = useMemo(() => {
    return Number(rawCoins).toLocaleString();
  }, [rawCoins]);

  // Exact badges from Image 1 (defaulting to 3, 8, 12 or store counts)
  const chatBadge = unreadCounts.messages ?? 3;
  const networkBadge = unreadCounts.network ?? 8;
  const alertsBadge = unreadCounts.notifications ?? 12;

  // Tabs definition: exact 7 items from Image 1
  const isHomeActive = activeTab === "/home" || activeTab === "/";
  const isSparksActive = activeTab.startsWith("/videos") || activeTab.startsWith("/reels");
  const isChatActive = activeTab.startsWith("/messages") || activeTab.startsWith("/chat");
  const isNetworkActive = activeTab.startsWith("/network") || activeTab.startsWith("/friends");
  const isCoinsActive = activeTab.startsWith("/coins");
  const isAlertsActive = activeTab.startsWith("/notifications");

  return (
    <>
      <nav
        id="arvdoul-bottom-navigation"
        aria-label="Main Navigation"
        className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[96%] max-w-[580px] select-none pointer-events-auto"
      >
        {/* Outer Frame with Dome Cutout Geometry */}
        <div className="relative w-full">
          {/* SVG Frame Background for the Curved Dome Cutout */}
          <div className="absolute inset-0 -top-4 w-full h-[calc(100%+16px)] pointer-events-none">
            <svg
              className="w-full h-full"
              viewBox="0 0 580 96"
              fill="none"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Dark mode backdrop gradient */}
                <linearGradient id="nav-dark-bg" x1="0" y1="0" x2="0" y2="96" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#0B0E1E" stopOpacity="0.88" />
                  <stop offset="100%" stopColor="#070914" stopOpacity="0.95" />
                </linearGradient>

                {/* Dark mode glowing stroke */}
                <linearGradient id="nav-dark-stroke" x1="0" y1="0" x2="580" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="rgba(168, 85, 247, 0.45)" />
                  <stop offset="40%" stopColor="rgba(192, 132, 252, 0.85)" />
                  <stop offset="50%" stopColor="rgba(56, 189, 248, 0.95)" />
                  <stop offset="60%" stopColor="rgba(192, 132, 252, 0.85)" />
                  <stop offset="100%" stopColor="rgba(168, 85, 247, 0.45)" />
                </linearGradient>

                {/* Light mode backdrop gradient */}
                <linearGradient id="nav-light-bg" x1="0" y1="0" x2="0" y2="96" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.94" />
                  <stop offset="100%" stopColor="#F8FAFC" stopOpacity="0.98" />
                </linearGradient>

                {/* Light mode border stroke */}
                <linearGradient id="nav-light-stroke" x1="0" y1="0" x2="580" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="rgba(255, 255, 255, 0.95)" />
                  <stop offset="50%" stopColor="rgba(168, 85, 247, 0.35)" />
                  <stop offset="100%" stopColor="rgba(255, 255, 255, 0.95)" />
                </linearGradient>

                {/* Dark mode shadow filter */}
                <filter id="nav-dark-shadow" x="-5%" y="-10%" width="110%" height="130%">
                  <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#000000" floodOpacity="0.85" />
                  <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor="#8B5CF6" floodOpacity="0.25" />
                </filter>

                {/* Light mode shadow filter */}
                <filter id="nav-light-shadow" x="-5%" y="-10%" width="110%" height="130%">
                  <feDropShadow dx="0" dy="16" stdDeviation="16" floodColor="#64748B" floodOpacity="0.22" />
                  <feDropShadow dx="0" dy="2" stdDeviation="6" floodColor="#8B5CF6" floodOpacity="0.10" />
                </filter>
              </defs>

              {/* Main capsule path with center dome rise */}
              <path
                d="M 38 18
                   L 220 18
                   C 238 18, 248 3, 266 3
                   L 314 3
                   C 332 3, 342 18, 360 18
                   L 542 18
                   A 38 38 0 0 1 580 56
                   A 38 38 0 0 1 542 94
                   L 38 94
                   A 38 38 0 0 1 0 56
                   A 38 38 0 0 1 38 18 Z"
                fill={isDark ? "url(#nav-dark-bg)" : "url(#nav-light-bg)"}
                stroke={isDark ? "url(#nav-dark-stroke)" : "url(#nav-light-stroke)"}
                strokeWidth="1.8"
                filter={isDark ? "url(#nav-dark-shadow)" : "url(#nav-light-shadow)"}
              />
            </svg>
          </div>

          {/* Top Pill Accent Bar above the dome */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="w-12 h-1.5 rounded-full bg-gradient-to-r from-purple-500 via-indigo-400 to-cyan-400 shadow-sm shadow-purple-500/50" />
          </div>

          {/* Center Raised Plus (+) Button */}
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
            {/* Dark mode nebula stardust glow */}
            {isDark && (
              <div className="absolute -inset-2 rounded-full bg-purple-600/30 blur-md pointer-events-none animate-pulse" />
            )}

            {/* Glowing Ring Border & Center Button */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => handleNavigation("/create-post")}
              className="relative w-15 h-15 sm:w-16 sm:h-16 rounded-full p-1 transition-transform"
              style={{
                background: isDark
                  ? "radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, rgba(59, 130, 246, 0.2) 70%, transparent 100%)"
                  : "radial-gradient(circle, rgba(168, 85, 247, 0.25) 0%, transparent 75%)",
              }}
              aria-label="Create Post"
              title="Create Post"
            >
              {/* Outer Glowing Neon Ring */}
              <div
                className={`w-full h-full rounded-full p-[2.5px] transition-all ${
                  isDark
                    ? "bg-gradient-to-tr from-cyan-400 via-purple-500 to-pink-500 shadow-[0_0_20px_rgba(168,85,247,0.7)]"
                    : "bg-gradient-to-tr from-cyan-400 via-purple-500 to-blue-600 shadow-[0_4px_16px_rgba(99,102,241,0.4)]"
                }`}
              >
                {/* Button Body with signature Blue -> Violet gradient */}
                <div
                  className="w-full h-full rounded-full flex items-center justify-center text-white font-bold"
                  style={{
                    background: "linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)",
                  }}
                >
                  <Plus className="w-7 h-7 sm:w-8 sm:h-8 stroke-[3] text-white drop-shadow-md" />
                </div>
              </div>
            </motion.button>
          </div>

          {/* Nav Items Grid (7 Columns) */}
          <div className="relative z-10 grid grid-cols-7 items-center h-[76px] sm:h-[82px] px-2 sm:px-4">
            {/* 1. Home */}
            <button
              onClick={() => handleNavigation("/home")}
              className="flex flex-col items-center justify-center py-1 relative group focus:outline-none"
              aria-label="Home"
            >
              <div className="relative">
                <HomeIcon active={isHomeActive} isDark={isDark} />
              </div>
              <span
                className={`text-[11px] sm:text-xs font-semibold mt-1 transition-colors ${
                  isHomeActive
                    ? isDark ? "text-purple-300 font-bold" : "text-purple-700 font-bold"
                    : isDark ? "text-gray-400 group-hover:text-white" : "text-gray-600 group-hover:text-black"
                }`}
              >
                Home
              </span>
              {/* Active Indicator Underline Bar */}
              {isHomeActive && (
                <motion.div
                  layoutId="activeNavUnderline"
                  className="absolute -bottom-1 w-6 h-1 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </button>

            {/* 2. Sparks */}
            <button
              onClick={() => handleNavigation("/videos")}
              className="flex flex-col items-center justify-center py-1 relative group focus:outline-none"
              aria-label="Sparks"
            >
              <div className="relative">
                <SparksIcon active={isSparksActive} isDark={isDark} />
              </div>
              <span
                className={`text-[11px] sm:text-xs font-semibold mt-1 transition-colors ${
                  isSparksActive
                    ? isDark ? "text-purple-300 font-bold" : "text-purple-700 font-bold"
                    : isDark ? "text-gray-400 group-hover:text-white" : "text-gray-600 group-hover:text-black"
                }`}
              >
                Sparks
              </span>
              {/* Active Indicator */}
              {isSparksActive && (
                <motion.div
                  layoutId="activeNavUnderline"
                  className="absolute -bottom-1 w-6 h-1 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </button>

            {/* 3. Chat */}
            <button
              onClick={() => handleNavigation("/messages")}
              className="flex flex-col items-center justify-center py-1 relative group focus:outline-none"
              aria-label="Chat"
            >
              <div className="relative">
                <ChatIcon active={isChatActive} isDark={isDark} />
                {/* Red Circular Badge with count 3 */}
                {chatBadge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-black flex items-center justify-center shadow-md ring-1 ring-white/40">
                    {chatBadge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] sm:text-xs font-semibold mt-1 transition-colors ${
                  isChatActive
                    ? isDark ? "text-purple-300 font-bold" : "text-purple-700 font-bold"
                    : isDark ? "text-gray-400 group-hover:text-white" : "text-gray-600 group-hover:text-black"
                }`}
              >
                Chat
              </span>
              {/* Active Indicator */}
              {isChatActive && (
                <motion.div
                  layoutId="activeNavUnderline"
                  className="absolute -bottom-1 w-6 h-1 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </button>

            {/* 4. Center Spacer for Raised Plus Dome */}
            <div className="flex items-center justify-center pointer-events-none" />

            {/* 5. Network */}
            <button
              onClick={() => handleNavigation("/network")}
              className="flex flex-col items-center justify-center py-1 relative group focus:outline-none"
              aria-label="Network"
            >
              <div className="relative">
                <NetworkIcon active={isNetworkActive} isDark={isDark} />
                {/* Red Circular Badge with count 8 */}
                {networkBadge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-black flex items-center justify-center shadow-md ring-1 ring-white/40">
                    {networkBadge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] sm:text-xs font-semibold mt-1 transition-colors ${
                  isNetworkActive
                    ? isDark ? "text-purple-300 font-bold" : "text-purple-700 font-bold"
                    : isDark ? "text-gray-400 group-hover:text-white" : "text-gray-600 group-hover:text-black"
                }`}
              >
                Network
              </span>
              {/* Active Indicator */}
              {isNetworkActive && (
                <motion.div
                  layoutId="activeNavUnderline"
                  className="absolute -bottom-1 w-6 h-1 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </button>

            {/* 6. Coins */}
            <button
              onClick={() => handleNavigation("/coins")}
              className="flex flex-col items-center justify-center py-0.5 relative group focus:outline-none"
              aria-label="Coins"
            >
              <div className="relative flex flex-col items-center">
                <CoinStackIcon size={22} className="group-hover:scale-105 transition-transform" />
                <span className="text-[10px] sm:text-[11px] font-extrabold text-[#F59E0B] tracking-tight leading-none mt-0.5">
                  {formattedCoins}
                </span>
              </div>
              <span
                className={`text-[11px] sm:text-xs font-semibold transition-colors mt-0.5 ${
                  isCoinsActive
                    ? isDark ? "text-purple-300 font-bold" : "text-purple-700 font-bold"
                    : isDark ? "text-gray-400 group-hover:text-white" : "text-gray-600 group-hover:text-black"
                }`}
              >
                Coins
              </span>
              {/* Active Indicator */}
              {isCoinsActive && (
                <motion.div
                  layoutId="activeNavUnderline"
                  className="absolute -bottom-1 w-6 h-1 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </button>

            {/* 7. Alerts */}
            <button
              onClick={() => handleNavigation("/notifications")}
              className="flex flex-col items-center justify-center py-1 relative group focus:outline-none"
              aria-label="Alerts"
            >
              <div className="relative">
                <AlertsIcon active={isAlertsActive} isDark={isDark} />
                {/* Red Circular Badge with count 12 */}
                {alertsBadge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF4444] text-white text-[10px] font-black flex items-center justify-center shadow-md ring-1 ring-white/40">
                    {alertsBadge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] sm:text-xs font-semibold mt-1 transition-colors ${
                  isAlertsActive
                    ? isDark ? "text-purple-300 font-bold" : "text-purple-700 font-bold"
                    : isDark ? "text-gray-400 group-hover:text-white" : "text-gray-600 group-hover:text-black"
                }`}
              >
                Alerts
              </span>
              {/* Active Indicator */}
              {isAlertsActive && (
                <motion.div
                  layoutId="activeNavUnderline"
                  className="absolute -bottom-1 w-6 h-1 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Quick Access Slide-Up Panel */}
      <QuickAccessPanel
        isPanelOpen={isPanelOpen}
        closePanel={() => setIsPanelOpen(false)}
        navigateToWithLoading={(path) => {
          navigate(path);
          setIsPanelOpen(false);
        }}
      />
    </>
  );
};

export default memo(BottomNav);
