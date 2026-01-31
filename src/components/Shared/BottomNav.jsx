import PropTypes from "prop-types";
import React, { useEffect, useState, useCallback, useRef, memo, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  Home, 
  PlayCircle, 
  MessageCircle, 
  UserPlus, 
  Bell, 
  X,
  Plus,
  Search,
  User,
  Settings,
  Share2,
  Grid3X3,
  Heart,
  Zap,
  Globe,
  Moon,
  Sun,
  UserCheck,
  Image,
  Video,
  Bookmark,
  Shield,
  Palette,
  Clock,
  TrendingUp,
  Star,
  Award,
  Camera,
  Users,
  Sparkles,
  BookOpen,
  Music,
  Gamepad2,
  Newspaper,
  Gift,
  ChevronUp,
  ChevronDown,
  UserCircle,
  PenSquare,
  Image as ImageIcon
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@context/ThemeContext";
import { useSound } from "../../hooks/useSound";
import { useAnalytics } from "../../hooks/useAnalytics";
import { cn } from "../../lib/utils";
import { useAppStore } from "../../store/appStore";
import ThemeToggle from "./ThemeToggle";
import LoadingSpinner from "./LoadingSpinner";
import { FaCoins } from "react-icons/fa";

// Constants for performance
const ANIMATION_CONFIG = {
  spring: { type: "spring", damping: 25, stiffness: 300, mass: 0.8 },
  panelSpring: { type: "spring", damping: 35, stiffness: 400, mass: 0.9 },
  fastSpring: { type: "spring", damping: 20, stiffness: 400 }
};

// Color schemes
const getThemeColors = (theme) => ({
  navBg: theme === "dark" 
    ? "bg-gradient-to-t from-gray-900/98 via-gray-900/98 to-gray-800/98" 
    : "bg-gradient-to-t from-white/98 via-white/98 to-gray-50/98",
  border: theme === "dark" ? "border-gray-800/50" : "border-gray-300/50",
  text: theme === "dark" ? "text-white" : "text-gray-900",
  subtext: theme === "dark" ? "text-gray-300" : "text-gray-600",
  plusGradient: theme === "dark" ? "from-purple-500 via-pink-600 to-purple-700" : "from-orange-500 via-red-500 to-orange-600",
  handleGradient: theme === "dark" ? "from-purple-500/80 to-pink-600/80" : "from-orange-500/80 to-red-500/80",
  panelBg: theme === "dark" 
    ? "bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800" 
    : "bg-gradient-to-b from-white via-gray-50 to-gray-100",
  cardBg: theme === "dark" ? "bg-gray-800/40" : "bg-white/60",
  cardBorder: theme === "dark" ? "border-gray-700/50" : "border-gray-300/50",
});

// Memoized icon components for performance
const MemoizedIcon = memo(({ Icon, className, ...props }) => (
  <Icon className={className} {...props} />
));

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { playSound } = useSound();
  const { track } = useAnalytics();
  const { unreadCounts = {}, currentUser } = useAppStore();

  // Theme colors
  const themeColors = useMemo(() => getThemeColors(theme), [theme]);

  // States
  const [activeTab, setActiveTab] = useState(location.pathname);
  const [showNav, setShowNav] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isNavHidden, setIsNavHidden] = useState(false);
  const [panelHeight, setPanelHeight] = useState("50vh");
  const [isLoading, setIsLoading] = useState(false);
  const [showProfileOptions, setShowProfileOptions] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  
  // Refs
  const panelRef = useRef(null);
  const navRef = useRef(null);
  const contentRef = useRef(null);
  const touchTimeoutRef = useRef(null);
  const lastInteractionRef = useRef(Date.now());

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

  // Enhanced user stats
  const userStats = useMemo(() => [
    { 
      label: "Posts", 
      value: currentUser?.postCount || 0, 
      icon: Grid3X3, 
      color: "from-blue-500 to-cyan-500",
      navigateTo: "/posts"
    },
    { 
      label: "Videos", 
      value: currentUser?.videoCount || 0, 
      icon: Video, 
      color: "from-purple-500 to-pink-500",
      navigateTo: "/videos"
    },
    { 
      label: "Saved", 
      value: currentUser?.savedCount || 0, 
      icon: Bookmark, 
      color: "from-amber-500 to-orange-500",
      navigateTo: "/saved"
    },
    { 
      label: "Followers", 
      value: currentUser?.followerCount || 0, 
      icon: Users, 
      color: "from-emerald-500 to-green-500",
      navigateTo: "/followers"
    },
  ], [currentUser]);

  // Premium quick actions
  const quickActions = useMemo(() => [
    { 
      label: "Create Post", 
      icon: PenSquare, 
      action: () => navigateToWithLoading(NAVIGATION_PATHS.createPost),
      color: "bg-gradient-to-br from-rose-500 to-pink-600",
      description: "Share your thoughts"
    },
    { 
      label: "Create Story", 
      icon: Camera, 
      action: () => navigateToWithLoading(NAVIGATION_PATHS.createStory),
      color: "bg-gradient-to-br from-purple-500 to-pink-600",
      description: "24-hour content",
      sparkling: true
    },
    { 
      label: "View Stories", 
      icon: Sparkles, 
      action: () => navigateToWithLoading(NAVIGATION_PATHS.storiesCarousel),
      color: "bg-gradient-to-br from-blue-500 to-cyan-500",
      description: "Friends' updates"
    },
    { 
      label: "Profile", 
      icon: UserCircle, 
      action: () => navigate("/profile"),
      color: "bg-gradient-to-br from-violet-500 to-purple-600",
      description: "Your account"
    },
    { 
      label: "Settings", 
      icon: Settings, 
      action: () => navigate("/settings"),
      color: "bg-gradient-to-br from-gray-600 to-gray-700",
      description: "Preferences"
    },
    { 
      label: "Collections", 
      icon: BookOpen, 
      action: () => navigate("/collections"),
      color: "bg-gradient-to-br from-amber-500 to-orange-500",
      description: "Saved items"
    },
  ], []);

  // Profile options
  const profileOptions = useMemo(() => [
    { label: "Create Story", icon: Camera, action: () => navigateToWithLoading(NAVIGATION_PATHS.createStory) },
    { label: "Change Profile Picture", icon: ImageIcon, action: () => track("Profile_Picture_Change") },
    { label: "Edit Profile", icon: PenSquare, action: () => navigate("/edit-profile") },
    { label: "View Profile", icon: User, action: () => navigate("/profile") },
  ], []);

  // -------------------- Optimized Handlers --------------------
  const navigateToWithLoading = useCallback((path) => {
    setIsLoading(true);
    playSound("nav_click");
    track("Navigation_With_Loading", { path });
    
    // Simulate loading with timeout (in production, this would be actual navigation)
    setTimeout(() => {
      navigate(path);
      setIsLoading(false);
      closePanel();
    }, 300);
  }, [playSound, track, navigate]);

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

  // -------------------- Panel Drag Handlers --------------------
  const handlePanelDragEnd = useCallback((event, info) => {
    const velocity = info.velocity.y;
    const offset = info.offset.y;
    const direction = velocity > 0 ? 1 : -1;
    const screenHeight = window.innerHeight;

    if (Math.abs(velocity) > 500) {
      if (direction > 0) {
        // Dragging down fast - close
        closePanel();
      } else {
        // Dragging up fast - full screen
        setPanelHeight(`${screenHeight}px`);
      }
    } else {
      const currentHeight = panelRef.current?.getBoundingClientRect().height || 0;
      
      if (currentHeight < screenHeight * 0.4) {
        closePanel();
      } else if (currentHeight < screenHeight * 0.75) {
        // Half screen
        setPanelHeight("50vh");
      } else {
        // Full screen
        setPanelHeight(`${screenHeight}px`);
      }
    }
  }, []);

  const togglePanelHeight = useCallback(() => {
    if (panelHeight === "50vh") {
      setPanelHeight("100vh");
    } else {
      setPanelHeight("50vh");
    }
  }, [panelHeight]);

  // -------------------- Panel Control --------------------
  const openPanel = useCallback(() => {
    playSound("panel_open");
    setIsPanelOpen(true);
    setIsNavHidden(false);
    setPanelHeight("50vh");
    track("BottomNav_Panel_Open");
  }, [playSound, track]);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    setShowProfileOptions(false);
    setPanelHeight("50vh");
    track("BottomNav_Panel_Close");
  }, [track]);

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

  // Render loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

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
            ref={navRef}
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

      {/* Ultra Pro Max Professional Panel */}
      <AnimatePresence>
        {isPanelOpen && (
          <>
            {/* Premium Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xl"
              onClick={closePanel}
            />

            {/* Premium Panel */}
            <motion.div
              ref={panelRef}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={ANIMATION_CONFIG.panelSpring}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.1}
              onDragEnd={handlePanelDragEnd}
              className={cn(
                "fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden",
                themeColors.panelBg,
                "border-t shadow-4xl",
                themeColors.cardBorder
              )}
              style={{
                height: panelHeight,
                maxHeight: "100vh",
                touchAction: "none"
              }}
            >
              {/* Panel Header */}
              <div className="pt-5 pb-3 px-6">
                <div className="flex justify-center items-center mb-3">
                  <div className={cn(
                    "w-16 h-1.5 rounded-full",
                    "bg-gradient-to-r",
                    themeColors.handleGradient
                  )} />
                </div>
                
                <div className="flex justify-between items-center">
                  <h3 className={cn(
                    "text-xl font-bold",
                    themeColors.text
                  )}>
                    Quick Access
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePanelHeight}
                      className={cn(
                        "p-2 rounded-full transition-all duration-200 hover:scale-110",
                        theme === "dark"
                          ? "hover:bg-gray-800/80 text-gray-400 hover:text-white"
                          : "hover:bg-gray-200/80 text-gray-600 hover:text-gray-900"
                      )}
                      aria-label="Toggle panel size"
                      type="button"
                    >
                      {panelHeight === "50vh" ? 
                        <ChevronUp className="w-5 h-5" /> : 
                        <ChevronDown className="w-5 h-5" />
                      }
                    </button>
                    <button
                      onClick={closePanel}
                      className={cn(
                        "p-2 rounded-full transition-all duration-200 hover:scale-110",
                        theme === "dark"
                          ? "hover:bg-gray-800/80 text-gray-400 hover:text-white"
                          : "hover:bg-gray-200/80 text-gray-600 hover:text-gray-900"
                      )}
                      aria-label="Close Panel"
                      type="button"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Panel Content - Ultra Advanced */}
              <div 
                ref={contentRef}
                className="px-6 pb-8 overflow-y-auto"
                style={{ height: "calc(100% - 80px)" }}
              >
                {/* Premium User Profile Section */}
                <motion.div 
                  className="relative mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className={cn(
                    "p-5 rounded-3xl",
                    themeColors.cardBg,
                    "border backdrop-blur-sm",
                    themeColors.cardBorder
                  )}>
                    <div className="flex items-center">
                      {/* Profile Picture with Options */}
                      <div className="relative mr-4">
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setShowProfileOptions(!showProfileOptions)}
                          className="relative cursor-pointer"
                        >
                          <div className="relative w-20 h-20">
                            {/* Gradient ring */}
                            <div className={cn(
                              "absolute inset-0 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-full",
                              "animate-spin-slow"
                            )} style={{ animationDuration: '3s' }} />
                            
                            {/* Profile image */}
                            <img
                              src={currentUser?.photoURL || "/assets/default-profile.png"}
                              alt={currentUser?.displayName || "Profile"}
                              className="w-20 h-20 rounded-full border-4 object-cover relative z-10"
                              style={{
                                borderColor: theme === "dark" 
                                  ? "rgba(255, 255, 255, 0.2)" 
                                  : "rgba(255, 255, 255, 0.3)"
                              }}
                            />
                            
                            {/* Online indicator */}
                            {currentUser?.isOnline && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute bottom-1 right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white z-20 shadow-lg"
                              >
                                <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75" />
                              </motion.div>
                            )}
                          </div>
                          
                          {/* Add story indicator */}
                          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full border-2 border-white flex items-center justify-center z-30 shadow-lg">
                            <Plus className="w-3 h-3 text-white" />
                          </div>
                        </motion.div>

                        {/* Profile Options Dropdown */}
                        <AnimatePresence>
                          {showProfileOptions && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8, y: -20 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.8, y: -20 }}
                              className={cn(
                                "absolute left-0 top-full mt-2 w-48 rounded-xl shadow-2xl z-40",
                                theme === "dark" 
                                  ? "bg-gray-800 border border-gray-700"
                                  : "bg-white border border-gray-200"
                              )}
                            >
                              {profileOptions.map((option, index) => (
                                <motion.button
                                  key={option.label}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: index * 0.05 }}
                                  onClick={() => {
                                    option.action();
                                    setShowProfileOptions(false);
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 text-sm",
                                    "transition-colors duration-200",
                                    theme === "dark"
                                      ? "hover:bg-gray-700 text-gray-300"
                                      : "hover:bg-gray-100 text-gray-700"
                                  )}
                                  type="button"
                                >
                                  <option.icon className="w-4 h-4" />
                                  {option.label}
                                </motion.button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      
                      {/* User Info */}
                      <div className="flex-1">
                        <motion.h3
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                          className={cn(
                            "text-xl font-bold mb-1 truncate",
                            themeColors.text
                          )}
                        >
                          {currentUser?.displayName || "Welcome User"}
                        </motion.h3>
                        
                        <motion.p
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.25 }}
                          className={cn(
                            "text-sm mb-3",
                            themeColors.subtext
                          )}
                        >
                          @{currentUser?.username || "username"}
                        </motion.p>
                        
                        {/* User Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1",
                            "bg-gradient-to-r from-amber-500 to-yellow-500 text-white",
                            "shadow-md"
                          )}>
                            <FaCoins className="w-3 h-3" />
                            {currentUser?.coins || 0} Coins
                          </span>
                          <span className={cn(
                            "text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1",
                            theme === "dark"
                              ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
                              : "bg-gradient-to-r from-blue-500 to-cyan-500 text-white",
                            "shadow-md"
                          )}>
                            <Star className="w-3 h-3" />
                            Level {currentUser?.level || 1}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Premium Stats Grid */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mb-6"
                >
                  <h4 className={cn(
                    "text-lg font-bold mb-4",
                    themeColors.text
                  )}>
                    Your Stats
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {userStats.map((stat, index) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.35 + index * 0.05 }}
                        whileHover={{ scale: 1.03, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          navigate(stat.navigateTo);
                          closePanel();
                        }}
                        className={cn(
                          "p-4 rounded-2xl transition-all duration-200 cursor-pointer",
                          "border backdrop-blur-sm",
                          themeColors.cardBg,
                          themeColors.cardBorder
                        )}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className={cn(
                            "p-2 rounded-xl bg-gradient-to-br",
                            stat.color,
                            "shadow-md"
                          )}>
                            <stat.icon className="w-5 h-5 text-white" />
                          </div>
                          <span className={cn(
                            "text-2xl font-bold",
                            themeColors.text
                          )}>
                            {stat.value}
                          </span>
                        </div>
                        <div className={cn(
                          "text-sm font-semibold",
                          themeColors.text
                        )}>
                          {stat.label}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Theme Toggle & Settings */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mb-6"
                >
                  <div className={cn(
                    "p-4 rounded-2xl",
                    themeColors.cardBg,
                    "border backdrop-blur-sm",
                    themeColors.cardBorder
                  )}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className={cn(
                          "text-base font-bold mb-1",
                          themeColors.text
                        )}>
                          Appearance
                        </h4>
                        <p className={cn(
                          "text-xs",
                          themeColors.subtext
                        )}>
                          Customize your theme
                        </p>
                      </div>
                      <ThemeToggle variant="icon" />
                    </div>
                    
                    {/* Theme preview */}
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={() => toggleTheme()}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                          "flex items-center justify-center gap-2",
                          theme === "dark"
                            ? "bg-gradient-to-r from-gray-700 to-gray-800 text-gray-300"
                            : "bg-gradient-to-r from-gray-200 to-gray-300 text-gray-700"
                        )}
                        type="button"
                      >
                        {theme === "dark" ? (
                          <>
                            <Moon className="w-4 h-4" />
                            Dark Mode
                          </>
                        ) : (
                          <>
                            <Sun className="w-4 h-4" />
                            Light Mode
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Premium Quick Actions */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mb-6"
                >
                  <h4 className={cn(
                    "text-lg font-bold mb-4",
                    themeColors.text
                  )}>
                    Quick Actions
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {quickActions.map((action, index) => (
                      <motion.button
                        key={action.label}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.65 + index * 0.05 }}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={action.action}
                        className={cn(
                          "flex flex-col items-center justify-center p-4 rounded-2xl transition-all duration-200 shadow-lg",
                          "text-white font-medium relative overflow-hidden group",
                          action.color
                        )}
                        type="button"
                      >
                        {/* Sparkling effect for story action */}
                        {action.sparkling && (
                          <div className="absolute inset-0 overflow-hidden">
                            <div className={cn(
                              "absolute w-4 h-4 rounded-full bg-white/40 animate-ping",
                              "top-2 left-2"
                            )} />
                            <div className={cn(
                              "absolute w-3 h-3 rounded-full bg-white/30 animate-ping",
                              "top-3 right-3",
                              "animation-delay-300"
                            )} />
                          </div>
                        )}
                        
                        <div className="relative z-10">
                          <action.icon className="w-6 h-6 mb-2 text-white" />
                          <span className="text-xs text-center block">{action.label}</span>
                          <span className="text-[10px] opacity-80 text-center block mt-1">
                            {action.description}
                          </span>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>

                {/* Stories Carousel Placeholder (Full Screen Mode) */}
                {panelHeight !== "50vh" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mb-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className={cn(
                        "text-lg font-bold",
                        themeColors.text
                      )}>
                        Stories
                      </h4>
                      <button
                        onClick={() => navigateToWithLoading(NAVIGATION_PATHS.storiesCarousel)}
                        className={cn(
                          "text-sm font-medium flex items-center gap-1",
                          theme === "dark" ? "text-purple-400" : "text-orange-500"
                        )}
                        type="button"
                      >
                        <Sparkles className="w-4 h-4" />
                        View All
                      </button>
                    </div>
                    
                    {/* Stories placeholder */}
                    <div className={cn(
                      "p-8 rounded-2xl text-center",
                      themeColors.cardBg,
                      "border backdrop-blur-sm",
                      themeColors.cardBorder
                    )}>
                      <Sparkles className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className={cn(
                        "text-sm mb-4",
                        themeColors.subtext
                      )}>
                        Stories carousel will appear here
                      </p>
                      <button
                        onClick={() => navigateToWithLoading(NAVIGATION_PATHS.storiesCarousel)}
                        className={cn(
                          "px-4 py-2 rounded-lg font-medium",
                          "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
                          "shadow-md hover:shadow-lg transition-shadow"
                        )}
                        type="button"
                      >
                        View Stories
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Premium Footer */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="pt-4 border-t"
                  style={{ borderColor: theme === "dark" ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className={themeColors.subtext}>
                      Arvdoul v1.0.0
                    </span>
                    <span className={themeColors.subtext}>
                      {new Date().getFullYear()} © All rights reserved
                    </span>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

BottomNav.propTypes = {};

export default memo(BottomNav);