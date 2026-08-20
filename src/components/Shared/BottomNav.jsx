// src/components/Shared/BottomNav.jsx - ARVDOUL FLOATING DOCK NAVIGATION
// Ultra-luxurious glassmorphism navigation island with haptics, spring physics, and quick access drawer

import PropTypes from "prop-types";
import React, { useEffect, useState, useCallback, useRef, memo, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  Home, 
  PlayCircle, 
  MessageCircle, 
  CircleUser, 
  Bell, 
  Plus,
  Users,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../context/ThemeContext";
import { useSound } from "../../hooks/useSound";
import { useAnalytics } from "../../hooks/useAnalytics";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../store/appStore";
import { FaCoins } from "react-icons/fa";
import QuickAccessPanel from "./QuickAccessPanel";

// Animation Spring configurations
const SPRING_TRANSITION = {
  type: "spring",
  stiffness: 380,
  damping: 30,
};

const FAST_SPRING = {
  type: "spring",
  stiffness: 500,
  damping: 35,
};

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, isDark } = useTheme();
  const { playSound } = useSound();
  const { track } = useAnalytics();
  const { unreadCounts = {}, currentUser } = useAppStore();

  // Navigation states
  const [activeTab, setActiveTab] = useState(location.pathname);
  const [showNav, setShowNav] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isNavHidden, setIsNavHidden] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);

  const lastScrollY = useRef(0);
  const touchTimeoutRef = useRef(null);

  // Keep activeTab synced with router
  useEffect(() => {
    setActiveTab(location.pathname);
  }, [location.pathname]);

  // Hide on scroll down, show on scroll up (except on videos feed)
  useEffect(() => {
    if (location.pathname.startsWith("/videos")) {
      setShowNav(true);
      return;
    }

    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 40 || currentY < lastScrollY.current - 10) {
        setShowNav(true);
      } else if (currentY > lastScrollY.current + 25 && currentY > 100) {
        setShowNav(false);
      }
      lastScrollY.current = currentY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [location.pathname]);

  // Handlers
  const handleNavigation = useCallback((to, navigateTo) => {
    if (location.pathname === to) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      playSound("nav_click");
      setActiveTab(to);
      navigate(navigateTo || to);
      setIsPanelOpen(false);
    }
  }, [location.pathname, navigate, playSound]);

  const openPanel = useCallback(() => {
    playSound("panel_open");
    setIsPanelOpen(true);
    track?.("BottomNav_Panel_Open");
  }, [playSound, track]);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    track?.("BottomNav_Panel_Close");
  }, [track]);

  const toggleNavVisibility = useCallback(() => {
    setIsNavHidden(prev => !prev);
    playSound("nav_click");
  }, [playSound]);

  // 7 Tabs: Home, Videos, Chat, Plus (Center), Coins, Alerts, Profile
  const tabs = useMemo(() => [
    {
      to: "/home",
      label: "Home",
      icon: Home,
      navigateTo: "/home",
      badgeKey: "home",
    },
    {
      to: "/videos",
      label: "Videos",
      icon: PlayCircle,
      navigateTo: "/videos",
      badgeKey: "videos",
      isReels: true,
    },
    {
      to: "/messages",
      label: "Chat",
      icon: MessageCircle,
      navigateTo: "/messages",
      badgeKey: "messages",
    },
    {
      to: "/create-post",
      label: "Create",
      icon: Plus,
      navigateTo: "/create-post",
      isPlus: true,
    },
    {
      to: "/coins",
      label: "Coins",
      icon: FaCoins,
      navigateTo: "/coins",
      isCoins: true,
    },
    {
      to: "/notifications",
      label: "Alerts",
      icon: Bell,
      navigateTo: "/notifications",
      badgeKey: "notifications",
    },
    {
      to: "/profile",
      label: "Profile",
      icon: CircleUser,
      navigateTo: currentUser?.uid ? `/profile/${currentUser.uid}` : "/profile",
      isProfile: true,
    },
  ], [currentUser?.uid, currentUser?.coins, currentUser?.photoURL]);

  const userCoins = currentUser?.coins ?? 1250;
  const formattedCoins = userCoins >= 1000 ? `${(userCoins / 1000).toFixed(1)}k` : `${userCoins}`;

  return (
    <>
      {/* Dock Container */}
      <AnimatePresence>
        {showNav && !isNavHidden && (
          <motion.nav
            id="arvdoul-bottom-navigation"
            initial={{ y: 90, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 90, opacity: 0, scale: 0.95 }}
            transition={SPRING_TRANSITION}
            className="fixed bottom-3 left-1/2 transform -translate-x-1/2 z-40 w-[95%] max-w-lg md:max-w-xl select-none"
          >
            {/* Quick Access Top Handle Pill */}
            <div className="flex justify-center -mb-2 relative z-10 pointer-events-auto">
              <motion.button
                whileHover={{ scale: 1.08, y: -2 }}
                whileTap={{ scale: 0.92 }}
                onClick={openPanel}
                className={`px-3 py-1 rounded-full flex items-center gap-1 backdrop-blur-2xl border shadow-lg transition-all ${
                  isDark
                    ? "bg-[#0b1020]/90 border-purple-500/30 text-purple-300"
                    : "bg-white/95 border-purple-300 text-purple-700"
                }`}
                title="Open ARVDOUL Quick Menu"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                <ChevronUp className="w-3.5 h-3.5" />
                <span className="text-[10px] font-black uppercase tracking-wider">Quick Menu</span>
              </motion.button>
            </div>

            {/* Glass Dock Island */}
            <div
              className={`w-full rounded-3xl p-1.5 backdrop-blur-2xl border shadow-2xl transition-colors ${
                isDark
                  ? "bg-[#0b1020]/85 border-white/15 text-white shadow-purple-950/40"
                  : "bg-white/90 border-gray-200/80 text-gray-900 shadow-gray-900/15"
              }`}
              style={{
                boxShadow: isDark
                  ? "0 20px 40px -10px rgba(0, 0, 0, 0.7), 0 0 20px 0 rgba(168, 85, 247, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
                  : "0 20px 40px -10px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
              }}
            >
              <div className="grid grid-cols-7 items-center gap-1">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.to || (tab.to !== "/home" && activeTab.startsWith(tab.to));
                  const unread = tab.badgeKey ? unreadCounts[tab.badgeKey] || 0 : 0;

                  // Center Plus / Create Button
                  if (tab.isPlus) {
                    return (
                      <div key={tab.to} className="flex flex-col items-center justify-center -my-2">
                        <motion.button
                          whileHover={{ scale: 1.12, rotate: 90 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleNavigation(tab.to, tab.navigateTo)}
                          className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-cyan-400 p-0.5 shadow-xl shadow-purple-600/40 flex items-center justify-center relative ring-2 ring-white/20 transition-transform"
                          title="Create Post or Story"
                          aria-label="Create Post"
                        >
                          <div className="w-full h-full rounded-[14px] bg-gradient-to-tr from-purple-700 via-pink-600 to-cyan-500 flex items-center justify-center text-white">
                            <Plus className="w-6 h-6 stroke-[2.5]" />
                          </div>
                        </motion.button>
                      </div>
                    );
                  }

                  // Profile Tab
                  if (tab.isProfile) {
                    const avatar = currentUser?.photoURL || currentUser?.avatar;
                    return (
                      <motion.button
                        key={tab.to}
                        whileTap={{ scale: 0.88 }}
                        onClick={() => handleNavigation(tab.to, tab.navigateTo)}
                        className="flex flex-col items-center justify-center py-1 relative group"
                        aria-label="Profile"
                      >
                        <div className="relative">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt="Profile"
                              className={`w-6 h-6 rounded-full object-cover ring-2 transition-all ${
                                isActive ? "ring-purple-400 scale-105" : "ring-transparent group-hover:ring-white/40"
                              }`}
                            />
                          ) : (
                            <div className={`w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center text-white text-[10px] font-black ring-2 ${
                              isActive ? "ring-purple-400" : "ring-transparent"
                            }`}>
                              {(currentUser?.displayName || currentUser?.username || "U").charAt(0).toUpperCase()}
                            </div>
                          )}

                          {isActive && (
                            <motion.div
                              layoutId="bottomNavDot"
                              className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-400 to-pink-400"
                              transition={FAST_SPRING}
                            />
                          )}
                        </div>
                        <span className={`text-[10px] mt-1 font-semibold truncate ${
                          isActive ? "text-purple-400 font-bold" : isDark ? "text-white/60" : "text-gray-600"
                        }`}>
                          {tab.label}
                        </span>
                      </motion.button>
                    );
                  }

                  // Coins Tab
                  if (tab.isCoins) {
                    return (
                      <motion.button
                        key={tab.to}
                        whileTap={{ scale: 0.88 }}
                        onClick={() => handleNavigation(tab.to, tab.navigateTo)}
                        className="flex flex-col items-center justify-center py-1 relative group"
                        aria-label="Coins"
                      >
                        <div className="relative flex flex-col items-center">
                          <FaCoins className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                            isActive ? "text-amber-400 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.7)]" : "text-amber-400/80"
                          }`} />
                          
                          {isActive && (
                            <motion.div
                              layoutId="bottomNavDot"
                              className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400"
                              transition={FAST_SPRING}
                            />
                          )}
                        </div>
                        <span className="text-[10px] mt-1 font-bold text-amber-400 truncate">
                          {formattedCoins}
                        </span>
                      </motion.button>
                    );
                  }

                  // Standard Icons (Home, Videos, Chat, Notifications)
                  const Icon = tab.icon;
                  return (
                    <motion.button
                      key={tab.to}
                      whileTap={{ scale: 0.88 }}
                      onClick={() => handleNavigation(tab.to, tab.navigateTo)}
                      className="flex flex-col items-center justify-center py-1 relative group"
                      aria-label={tab.label}
                    >
                      <div className="relative">
                        <Icon className={`w-5.5 h-5.5 transition-all ${
                          isActive
                            ? "text-purple-400 scale-110 drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]"
                            : isDark
                            ? "text-white/60 group-hover:text-white"
                            : "text-gray-500 group-hover:text-black"
                        }`} />

                        {/* Unread badge */}
                        {unread > 0 && (
                          <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-3.5 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white text-[9px] font-black flex items-center justify-center ring-2 ring-black">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        )}

                        {/* Active Dot */}
                        {isActive && (
                          <motion.div
                            layoutId="bottomNavDot"
                            className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-gradient-to-r from-purple-400 to-pink-400"
                            transition={FAST_SPRING}
                          />
                        )}
                      </div>

                      <span className={`text-[10px] mt-1 font-semibold truncate ${
                        isActive
                          ? "text-purple-400 font-bold"
                          : isDark
                          ? "text-white/60"
                          : "text-gray-600"
                      }`}>
                        {tab.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Quick Access Slide-Up Panel */}
      <QuickAccessPanel
        isPanelOpen={isPanelOpen}
        closePanel={closePanel}
        navigateToWithLoading={(path) => {
          navigate(path);
          setIsPanelOpen(false);
        }}
      />
    </>
  );
};

BottomNav.propTypes = {};

export default memo(BottomNav);
