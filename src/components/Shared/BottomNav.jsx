// src/components/Shared/BottomNav.jsx - ARVDOUL FLOATING DOCK
// Supports both Dark & Light themes with rock-solid responsive layout:
// [Home] [Sparks] [Chat (3)] [Elevated Stories Dome + Quick Post] [Network (8)] [Coins (2,450)] [Alerts (12)]

import React, { useEffect, useState, useCallback, useMemo, memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useSound } from "../../hooks/useSound";
import { useAppStore } from "../../store/appStore";
import { CoinStackIcon } from "./CoinStackIcon";
import QuickAccessPanel from "./QuickAccessPanel";
import { Plus, Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Custom clean vector icons matching Arvdoul exact geometry and line weights
 */

// 1. Home Icon
const HomeIcon = memo(({ active, isDark }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-all">
    <path
      d="M3 10.5L12 3L21 10.5V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V10.5Z"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#94A3B8" : "#64748B")}
      strokeWidth={active ? "2.3" : "2"}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? (isDark ? "rgba(192, 132, 252, 0.15)" : "rgba(124, 58, 237, 0.1)") : "none"}
    />
    <path
      d="M9 21V12H15V21"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#94A3B8" : "#64748B")}
      strokeWidth={active ? "2.3" : "2"}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
));
HomeIcon.displayName = "HomeIcon";

// 2. Sparks Icon (Reels/Videos)
const SparksIcon = memo(({ active, isDark }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-all">
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#94A3B8" : "#64748B")}
      strokeWidth={active ? "2.3" : "2"}
      fill={active ? (isDark ? "rgba(192, 132, 252, 0.15)" : "rgba(124, 58, 237, 0.1)") : "none"}
    />
    <path
      d="M10 8.5L16 12L10 15.5V8.5Z"
      fill={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#94A3B8" : "#64748B")}
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#94A3B8" : "#64748B")}
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>
));
SparksIcon.displayName = "SparksIcon";

// 3. Chat Icon
const ChatIcon = memo(({ active, isDark }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-all">
    <path
      d="M21 11.5C21 16.1944 16.9706 20 12 20C10.3787 20 8.85703 19.593 7.55078 18.8828L3 20L4.35938 16.1562C3.51328 14.8117 3 13.2207 3 11.5C3 6.80558 7.02944 3 12 3C16.9706 3 21 6.80558 21 11.5Z"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#94A3B8" : "#64748B")}
      strokeWidth={active ? "2.3" : "2"}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? (isDark ? "rgba(192, 132, 252, 0.15)" : "rgba(124, 58, 237, 0.1)") : "none"}
    />
    <circle cx="8" cy="11.5" r="1.1" fill={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#94A3B8" : "#64748B")} />
    <circle cx="12" cy="11.5" r="1.1" fill={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#94A3B8" : "#64748B")} />
    <circle cx="16" cy="11.5" r="1.1" fill={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#94A3B8" : "#64748B")} />
  </svg>
));
ChatIcon.displayName = "ChatIcon";

// 4. Center Stories Aperture Icon
const StoriesIrisIcon = memo(({ active }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2.2" />
    <circle cx="12" cy="12" r="4" fill="white" fillOpacity={active ? "1" : "0.9"} />
    <circle cx="12" cy="12" r="1.5" fill="#7C3AED" />
  </svg>
));
StoriesIrisIcon.displayName = "StoriesIrisIcon";

// 5. Network Icon
const NetworkIcon = memo(({ active, isDark }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-all">
    <circle
      cx="16"
      cy="8"
      r="3"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#94A3B8" : "#64748B")}
      strokeWidth={active ? "2.2" : "1.8"}
    />
    <path
      d="M14 14C15.5 14 18 14.5 19.5 16.5C20.2 17.5 20.5 18.7 20.5 20"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#94A3B8" : "#64748B")}
      strokeWidth={active ? "2.2" : "1.8"}
      strokeLinecap="round"
    />
    <circle
      cx="9"
      cy="9"
      r="3.5"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#94A3B8" : "#64748B")}
      strokeWidth={active ? "2.3" : "2"}
      fill={active ? (isDark ? "rgba(192, 132, 252, 0.15)" : "rgba(124, 58, 237, 0.1)") : "none"}
    />
    <path
      d="M3.5 20.5C3.5 17.5 6 15 9 15C12 15 14.5 17.5 14.5 20.5"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#94A3B8" : "#64748B")}
      strokeWidth={active ? "2.3" : "2"}
      strokeLinecap="round"
    />
  </svg>
));
NetworkIcon.displayName = "NetworkIcon";

// 6. Alerts Icon
const AlertsIcon = memo(({ active, isDark }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="transition-all">
    <path
      d="M18 8A6 6 0 0 0 6 8C6 15 3 17 3 17H21S18 15 18 8Z"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#94A3B8" : "#64748B")}
      strokeWidth={active ? "2.3" : "2"}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={active ? (isDark ? "rgba(192, 132, 252, 0.15)" : "rgba(124, 58, 237, 0.1)") : "none"}
    />
    <path
      d="M10.3 21C10.7 21.6 11.3 22 12 22C12.7 22 13.3 21.6 13.7 21"
      stroke={active ? (isDark ? "#C084FC" : "#7C3AED") : (isDark ? "#94A3B8" : "#64748B")}
      strokeWidth={active ? "2.3" : "2"}
      strokeLinecap="round"
    />
  </svg>
));
AlertsIcon.displayName = "AlertsIcon";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark } = useTheme();
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

  // Format coins: default 2,450
  const rawCoins = currentUser?.coins ?? 2450;
  const formattedCoins = useMemo(() => {
    return Number(rawCoins).toLocaleString();
  }, [rawCoins]);

  // Badges: default or store values
  const chatBadge = unreadCounts.messages ?? 3;
  const networkBadge = unreadCounts.network ?? 8;
  const alertsBadge = unreadCounts.notifications ?? 12;

  // Active checks
  const isHomeActive = activeTab === "/home" || activeTab === "/";
  const isSparksActive = activeTab.startsWith("/videos") || activeTab.startsWith("/reels");
  const isChatActive = activeTab.startsWith("/messages") || activeTab.startsWith("/chat");
  const isStoriesActive = activeTab.startsWith("/stories") || activeTab.startsWith("/vibes");
  const isNetworkActive = activeTab.startsWith("/network") || activeTab.startsWith("/friends");
  const isCoinsActive = activeTab.startsWith("/coins");
  const isAlertsActive = activeTab.startsWith("/notifications");

  return (
    <>
      <nav
        id="arvdoul-bottom-navigation"
        aria-label="Main Navigation"
        className="fixed bottom-2.5 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 w-[96%] max-w-[560px] select-none pointer-events-auto"
      >
        {/* Dock Container */}
        <div
          className={`relative w-full rounded-full backdrop-blur-2xl transition-all duration-300 ${
            isDark
              ? "bg-[#0b0f1e]/90 border border-purple-500/30 shadow-[0_12px_36px_rgba(0,0,0,0.8),0_0_20px_rgba(168,85,247,0.25)]"
              : "bg-white/95 border border-slate-200/90 shadow-[0_12px_36px_rgba(100,116,139,0.25),0_2px_8px_rgba(168,85,247,0.12)]"
          }`}
        >
          {/* Quick Post Button floating above Stories Dome */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNavigation("/create-post");
              }}
              className="px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase text-white bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 shadow-md shadow-purple-600/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-1 cursor-pointer ring-2 ring-white dark:ring-[#0b0f1e]"
              aria-label="Create Post"
              title="Create Post"
            >
              <Plus className="w-2.5 h-2.5 stroke-[3]" />
              <span>Post</span>
            </button>
          </div>

          {/* Center Elevated Stories Dome Button */}
          <div className="absolute -top-4 sm:-top-5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
            {/* Ambient stardust glow when active or in dark mode */}
            {isDark && (
              <div className={`absolute -inset-2 rounded-full blur-md pointer-events-none transition-opacity ${
                isStoriesActive ? "bg-pink-500/40 opacity-100 animate-pulse" : "bg-purple-600/25 opacity-70"
              }`} />
            )}

            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => handleNavigation("/stories")}
              onContextMenu={(e) => {
                e.preventDefault();
                setIsPanelOpen(true);
              }}
              className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-full p-[2.5px] transition-transform cursor-pointer"
              aria-label="Stories & Vibes"
              title="Stories & Vibes (Tap to view stories, right-click for quick actions)"
            >
              {/* Outer Vibrant Story Gradient Ring */}
              <div
                className={`w-full h-full rounded-full p-[2px] transition-all ${
                  isStoriesActive
                    ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 shadow-[0_0_18px_rgba(236,72,153,0.8)] animate-pulse"
                    : "bg-gradient-to-tr from-cyan-400 via-purple-500 to-pink-500 shadow-[0_4px_16px_rgba(168,85,247,0.4)]"
                }`}
              >
                {/* Inner Button Canvas */}
                <div
                  className="w-full h-full rounded-full flex items-center justify-center text-white ring-2 ring-white dark:ring-[#0b0f1e]"
                  style={{
                    background: "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)",
                  }}
                >
                  <StoriesIrisIcon active={isStoriesActive} />
                </div>
              </div>
            </motion.button>
          </div>

          {/* Nav Items Grid (7 Columns) */}
          <div className="relative z-10 grid grid-cols-7 items-center h-[66px] sm:h-[72px] px-1 sm:px-3">
            {/* 1. Home */}
            <button
              onClick={() => handleNavigation("/home")}
              className="flex flex-col items-center justify-center py-1 relative group focus:outline-none cursor-pointer"
              aria-label="Home"
            >
              <div className="relative">
                <HomeIcon active={isHomeActive} isDark={isDark} />
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-semibold mt-0.5 transition-colors ${
                  isHomeActive
                    ? isDark ? "text-purple-300 font-bold" : "text-purple-700 font-bold"
                    : isDark ? "text-gray-400 group-hover:text-white" : "text-gray-600 group-hover:text-black"
                }`}
              >
                Home
              </span>
              {isHomeActive && (
                <motion.div
                  layoutId="activeNavUnderline"
                  className="absolute -bottom-1 w-5 h-1 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </button>

            {/* 2. Sparks */}
            <button
              onClick={() => handleNavigation("/videos")}
              className="flex flex-col items-center justify-center py-1 relative group focus:outline-none cursor-pointer"
              aria-label="Sparks"
            >
              <div className="relative">
                <SparksIcon active={isSparksActive} isDark={isDark} />
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-semibold mt-0.5 transition-colors ${
                  isSparksActive
                    ? isDark ? "text-purple-300 font-bold" : "text-purple-700 font-bold"
                    : isDark ? "text-gray-400 group-hover:text-white" : "text-gray-600 group-hover:text-black"
                }`}
              >
                Sparks
              </span>
              {isSparksActive && (
                <motion.div
                  layoutId="activeNavUnderline"
                  className="absolute -bottom-1 w-5 h-1 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </button>

            {/* 3. Chat */}
            <button
              onClick={() => handleNavigation("/messages")}
              className="flex flex-col items-center justify-center py-1 relative group focus:outline-none cursor-pointer"
              aria-label="Chat"
            >
              <div className="relative">
                <ChatIcon active={isChatActive} isDark={isDark} />
                {chatBadge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#EF4444] text-white text-[9px] font-black flex items-center justify-center shadow-md ring-1 ring-white/50">
                    {chatBadge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-semibold mt-0.5 transition-colors ${
                  isChatActive
                    ? isDark ? "text-purple-300 font-bold" : "text-purple-700 font-bold"
                    : isDark ? "text-gray-400 group-hover:text-white" : "text-gray-600 group-hover:text-black"
                }`}
              >
                Chat
              </span>
              {isChatActive && (
                <motion.div
                  layoutId="activeNavUnderline"
                  className="absolute -bottom-1 w-5 h-1 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </button>

            {/* 4. Center Column: Stories Label Under Dome */}
            <button
              onClick={() => handleNavigation("/stories")}
              className="flex flex-col items-center justify-end h-full pb-1 relative group focus:outline-none cursor-pointer pt-6"
              aria-label="Stories"
            >
              <span
                className={`text-[10px] sm:text-[11px] font-bold transition-colors ${
                  isStoriesActive
                    ? isDark ? "text-pink-400" : "text-pink-600"
                    : isDark ? "text-purple-300/80 group-hover:text-white" : "text-purple-700/80 group-hover:text-black"
                }`}
              >
                Stories
              </span>
              {isStoriesActive && (
                <motion.div
                  layoutId="activeNavUnderline"
                  className="absolute -bottom-1 w-5 h-1 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 shadow-sm shadow-pink-500/50"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </button>

            {/* 5. Network */}
            <button
              onClick={() => handleNavigation("/network")}
              className="flex flex-col items-center justify-center py-1 relative group focus:outline-none cursor-pointer"
              aria-label="Network"
            >
              <div className="relative">
                <NetworkIcon active={isNetworkActive} isDark={isDark} />
                {networkBadge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#EF4444] text-white text-[9px] font-black flex items-center justify-center shadow-md ring-1 ring-white/50">
                    {networkBadge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-semibold mt-0.5 transition-colors ${
                  isNetworkActive
                    ? isDark ? "text-purple-300 font-bold" : "text-purple-700 font-bold"
                    : isDark ? "text-gray-400 group-hover:text-white" : "text-gray-600 group-hover:text-black"
                }`}
              >
                Network
              </span>
              {isNetworkActive && (
                <motion.div
                  layoutId="activeNavUnderline"
                  className="absolute -bottom-1 w-5 h-1 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </button>

            {/* 6. Coins */}
            <button
              onClick={() => handleNavigation("/coins")}
              className="flex flex-col items-center justify-center py-0.5 relative group focus:outline-none cursor-pointer"
              aria-label="Coins"
            >
              <div className="relative flex flex-col items-center">
                <CoinStackIcon size={20} className="group-hover:scale-105 transition-transform" />
                <span className="text-[9px] sm:text-[10px] font-extrabold text-[#F59E0B] tracking-tight leading-none mt-0.5">
                  {formattedCoins}
                </span>
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-semibold transition-colors ${
                  isCoinsActive
                    ? isDark ? "text-purple-300 font-bold" : "text-purple-700 font-bold"
                    : isDark ? "text-gray-400 group-hover:text-white" : "text-gray-600 group-hover:text-black"
                }`}
              >
                Coins
              </span>
              {isCoinsActive && (
                <motion.div
                  layoutId="activeNavUnderline"
                  className="absolute -bottom-1 w-5 h-1 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </button>

            {/* 7. Alerts */}
            <button
              onClick={() => handleNavigation("/notifications")}
              className="flex flex-col items-center justify-center py-1 relative group focus:outline-none cursor-pointer"
              aria-label="Alerts"
            >
              <div className="relative">
                <AlertsIcon active={isAlertsActive} isDark={isDark} />
                {alertsBadge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-[#EF4444] text-white text-[9px] font-black flex items-center justify-center shadow-md ring-1 ring-white/50">
                    {alertsBadge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] sm:text-[11px] font-semibold mt-0.5 transition-colors ${
                  isAlertsActive
                    ? isDark ? "text-purple-300 font-bold" : "text-purple-700 font-bold"
                    : isDark ? "text-gray-400 group-hover:text-white" : "text-gray-600 group-hover:text-black"
                }`}
              >
                Alerts
              </span>
              {isAlertsActive && (
                <motion.div
                  layoutId="activeNavUnderline"
                  className="absolute -bottom-1 w-5 h-1 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50"
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
