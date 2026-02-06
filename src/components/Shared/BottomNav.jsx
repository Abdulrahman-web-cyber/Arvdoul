import PropTypes from "prop-types";
import React, { useEffect, useState, useCallback, useRef, memo, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  Home, 
  PlayCircle, 
  MessageCircle, 
  UserPlus, 
  Bell, 
  Plus,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@context/ThemeContext";
import { useSound } from "../../hooks/useSound";
import { useAnalytics } from "../../hooks/useAnalytics";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../store/appStore";
import { FaCoins } from "react-icons/fa";
import QuickAccessPanel from "./QuickAccessPanel";

// Constants for performance
const ANIMATION_CONFIG = {
  spring: { type: "spring", damping: 25, stiffness: 300, mass: 0.8 },
  fastSpring: { type: "spring", damping: 20, stiffness: 400 }
};

// Color schemes
const getThemeColors = (theme) => ({
  navBg: theme === "dark" 
    ? "bg-gradient-to-t from-gray-900/98 via-gray-900/98 to-gray-800/98" 
    : "bg-gradient-to-t from-white/98 via-white/98 to-gray-50/98",
  border: theme === "dark" ? "border-gray-800/50" : "border-gray-300/50",
  text: theme === "dark" ? "text-white" : "text-gray-900",
  plusGradient: theme === "dark" ? "from-purple-500 via-pink-600 to-purple-700" : "from-orange-500 via-red-500 to-orange-600",
  handleGradient: theme === "dark" ? "from-purple-500/80 to-pink-600/80" : "from-orange-500/80 to-red-500/80",
});

// Memoized icon components for performance
const MemoizedIcon = memo(({ Icon, className, ...props }) => (
  <Icon className={className} {...props} />
));

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { playSound } = useSound();
  const { track } = useAnalytics();
  const { unreadCounts = {}, currentUser } = useAppStore();

  // States
  const [activeTab, setActiveTab] = useState(location.pathname);
  const [showNav, setShowNav] = useState(true);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isNavHidden, setIsNavHidden] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  
  // Refs
  const touchTimeoutRef = useRef(null);
  const lastInteractionRef = useRef(Date.now());

  // Theme colors
  const themeColors = useMemo(() => getThemeColors(theme), [theme]);

  // Navigation mapping
  const NAVIGATION_PATHS = {
    home: "/home",
    videos: "/videos", 
    messages: "/messages",
    createPost: "/create-post",
    requests: "/network",
    coins: "/coins",
    notifications: "/notifications",
    createStory: "/create-story",
    storiesCarousel: "/stories"
  };

  // 7 tabs: 3 left, Plus middle, 3 right
  const tabs = useMemo(() => [
    { 
      to: "/home", 
      label: "Home", 
      icon: Home, 
      notification: false, 
      index: 0,
      navigateTo: NAVIGATION_PATHS.home
    },
    { 
      to: "/videos", 
      label: "Videos", 
      icon: PlayCircle, 
      notification: false, 
      index: 1,
      navigateTo: NAVIGATION_PATHS.videos
    },
    { 
      to: "/messages", 
      label: "Chat", 
      icon: MessageCircle, 
      notification: true, 
      index: 2,
      navigateTo: NAVIGATION_PATHS.messages
    },
    { 
      to: "/create-post", 
      label: "Create", 
      icon: Plus, 
      notification: false, 
      index: 3, 
      isPlus: true,
      navigateTo: NAVIGATION_PATHS.createPost
    },
    { 
      to: "/requests", 
      label: "Network", 
      icon: UserPlus, 
      notification: true, 
      index: 4,
      navigateTo: NAVIGATION_PATHS.requests
    },
    { 
      to: "/coins", 
      label: "Coins", 
      icon: FaCoins, 
      notification: false, 
      index: 5,
      custom: (
        <div className="relative flex flex-col items-center justify-center">
          <FaCoins className="w-6 h-6 text-yellow-400 drop-shadow-md" />
          <span className="text-[9px] mt-0.5 font-bold text-yellow-400 drop-shadow-md">
            {currentUser?.coins || 0}
          </span>
        </div>
      ),
      navigateTo: NAVIGATION_PATHS.coins
    },
    { 
      to: "/notifications", 
      label: "Alerts", 
      icon: Bell, 
      notification: true, 
      index: 6,
      navigateTo: NAVIGATION_PATHS.notifications
    },
  ], [currentUser?.coins]);

  // -------------------- Handlers --------------------
  const handleNavigation = useCallback((to, navigateTo) => {
    if (location.pathname === to) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      playSound("nav_click");
      setActiveTab(to);
      navigate(navigateTo || to);
      closePanel();
    }
  }, [location.pathname, navigate, playSound]);

  const navigateToWithLoading = useCallback((path) => {
    playSound("nav_click");
    track("Navigation_With_Loading", { path });
    navigate(path);
    closePanel();
  }, [playSound, track, navigate]);

  const openPanel = useCallback(() => {
    playSound("panel_open");
    setIsPanelOpen(true);
    setIsNavHidden(false);
    track("BottomNav_Panel_Open");
  }, [playSound, track]);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    track("BottomNav_Panel_Close");
  }, [track]);

  // -------------------- Scroll Handler --------------------
  useEffect(() => {
    let ticking = false;
    let lastScroll = 0;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const currentY = window.scrollY;
          const isScrollingUp = currentY < lastScroll;
          const isAtTop = currentY < 50;
          
          if (isAtTop || isScrollingUp) {
            setShowNav(true);
          } else if (currentY > lastScroll + 30) {
            setShowNav(false);
          }
          
          lastScroll = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // -------------------- Touch Handlers --------------------
  const handleTouchStart = useCallback((e) => {
    setTouchStartY(e.touches[0].clientY);
    lastInteractionRef.current = Date.now();
    
    touchTimeoutRef.current = setTimeout(() => {
      openPanel();
    }, 800);
  }, [openPanel]);

  const handleTouchEnd = useCallback(() => {
    if (touchTimeoutRef.current) {
      clearTimeout(touchTimeoutRef.current);
    }
    
    if (Date.now() - lastInteractionRef.current < 300) {
      toggleNavVisibility();
    }
  }, []);

  const toggleNavVisibility = useCallback(() => {
    setIsNavHidden(prev => !prev);
    playSound("nav_click");
    track("BottomNav_Toggle_Visibility", { visible: !isNavHidden });
  }, [playSound, track, isNavHidden]);

  // -------------------- Cleanup --------------------
  useEffect(() => {
    return () => {
      if (touchTimeoutRef.current) {
        clearTimeout(touchTimeoutRef.current);
      }
    };
  }, []);

  // -------------------- Render Functions --------------------
  const renderTabIcon = useCallback((tab, isActive) => {
    if (tab.isPlus) {
      return (
        <div className={cn(
          "w-12 h-12 rounded-full flex items-center justify-center",
          "bg-gradient-to-br",
          themeColors.plusGradient,
          "shadow-2xl shadow-black/30",
          "ring-2 ring-white/20"
        )}>
          <Plus className="w-6 h-6 text-white drop-shadow-lg" />
        </div>
      );
    }
    
    if (tab.custom) {
      return tab.custom;
    }
    
    return (
      <MemoizedIcon 
        Icon={tab.icon} 
        className={cn(
          "w-6 h-6 transition-all duration-200 drop-shadow-md",
          isActive 
            ? theme === "dark"
              ? "text-blue-400"
              : "text-blue-600"
            : theme === "dark"
              ? "text-gray-400"
              : "text-gray-600"
        )} 
      />
    );
  }, [theme, themeColors]);

  return (
    <>
      {/* Professional Drag Handle */}
      <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 touch-none">
        <motion.div
          className={cn(
            "w-20 h-2.5 rounded-full flex items-center justify-center cursor-pointer",
            "bg-gradient-to-r",
            themeColors.handleGradient,
            "shadow-xl backdrop-blur-md border",
            theme === "dark" ? "border-purple-500/30" : "border-orange-500/30"
          )}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleNavVisibility}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          title="Tap to toggle navigation | Hold to open quick menu"
        >
          <div className={cn(
            "w-14 h-1 rounded-full",
            theme === "dark" ? "bg-purple-300/80" : "bg-orange-300/80"
          )} />
        </motion.div>
      </div>

      {/* Professional Bottom Navigation */}
      <AnimatePresence>
        {showNav && !isNavHidden && (
          <motion.nav
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={ANIMATION_CONFIG.spring}
            className={cn(
              "fixed bottom-0 z-40 w-full px-4 shadow-3xl backdrop-blur-xl",
              themeColors.navBg,
              "rounded-3xl mx-auto max-w-2xl mb-4",
              "border",
              themeColors.border
            )}
            style={{
              boxShadow: theme === "dark" 
                ? "0 -25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 0 1px rgba(255, 255, 255, 0.05)"
                : "0 -25px 50px -12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.05)"
            }}
          >
            <div className="grid grid-cols-7 items-center py-3 gap-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.to;
                const unreadCount = unreadCounts[tab.to.replace("/", "")] || 0;

                return (
                  <motion.button
                    key={tab.to}
                    onClick={() => handleNavigation(tab.to, tab.navigateTo)}
                    whileTap={{ scale: 0.92 }}
                    whileHover={{ scale: tab.isPlus ? 1.1 : 1.05 }}
                    className={cn(
                      "flex flex-col items-center justify-center relative focus:outline-none group",
                      tab.isPlus && "z-10"
                    )}
                    aria-label={tab.label}
                    type="button"
                    tabIndex={0}
                  >
                    <div className="relative">
                      {renderTabIcon(tab, isActive)}
                      
                      {/* Enhanced shadow */}
                      <div className={cn(
                        "absolute inset-0 rounded-full blur-lg opacity-40 -z-10",
                        tab.isPlus 
                          ? theme === "dark"
                            ? "bg-gradient-to-br from-purple-500/40 via-pink-500/40 to-purple-500/40"
                            : "bg-gradient-to-br from-orange-500/40 via-red-500/40 to-orange-500/40"
                          : isActive
                            ? theme === "dark"
                              ? "bg-blue-500/20"
                              : "bg-blue-400/20"
                            : "bg-transparent"
                      )} />

                      {/* Notification badge */}
                      {tab.notification && unreadCount > 0 && !tab.isPlus && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={cn(
                            "absolute -top-1 -right-1 flex items-center justify-center rounded-full text-xs font-bold",
                            "bg-gradient-to-br from-red-500 to-pink-600 text-white",
                            "shadow-lg ring-2 ring-white/20",
                            unreadCount > 99
                              ? "w-6 h-6 text-[9px]"
                              : unreadCount > 9
                              ? "w-5 h-5 text-[10px]"
                              : "w-4 h-4",
                          )}
                        >
                          {unreadCount > 99 ? "99+" : unreadCount > 9 ? "9+" : unreadCount}
                        </motion.span>
                      )}
                    </div>

                    {/* Label with gradient for plus */}
                    <span
                      className={cn(
                        "text-[10px] mt-1.5 transition-all duration-200 font-medium truncate max-w-full",
                        tab.isPlus
                          ? "font-bold bg-gradient-to-r bg-clip-text text-transparent"
                          : isActive 
                            ? theme === "dark"
                              ? "text-blue-400 font-semibold"
                              : "text-blue-600 font-semibold"
                            : theme === "dark"
                              ? "text-gray-400"
                              : "text-gray-600"
                      )}
                      style={tab.isPlus ? {
                        backgroundImage: theme === "dark" 
                          ? "linear-gradient(to right, #a855f7, #ec4899)"
                          : "linear-gradient(to right, #f97316, #ef4444)"
                      } : {}}
                    >
                      {tab.label}
                    </span>

                    {/* Active indicator */}
                    {isActive && !tab.isPlus && (
                      <motion.div
                        layoutId="bottomNavActiveIndicator"
                        className={cn(
                          "absolute -bottom-1 left-1/4 right-1/4 h-1 rounded-full",
                          "bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400"
                        )}
                        transition={ANIMATION_CONFIG.fastSpring}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Quick Access Panel */}
      <QuickAccessPanel
        isPanelOpen={isPanelOpen}
        closePanel={closePanel}
        navigateToWithLoading={navigateToWithLoading}
      />
    </>
  );
};

BottomNav.propTypes = {};

export default memo(BottomNav);