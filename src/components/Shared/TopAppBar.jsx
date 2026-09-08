// src/components/Shared/TopAppBar.jsx - ARVDOUL TOP APP BAR vNEXT
// Global · Contextual · Intelligent (Matching Image 1 & Image 2 Specs)
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSound } from "../../hooks/useSound.js";
import { useAnalytics } from "../../hooks/useAnalytics.js";
import { useTheme } from "../../context/ThemeContext";
import { cn } from "../../lib/utils.js";
import {
  Search,
  Menu,
  X,
  ChevronLeft,
  Sparkles,
  Bell,
  Check,
  MoreVertical,
  WifiOff,
  RefreshCw,
  SlidersHorizontal,
  Share2,
  Trash2,
  Phone,
  Video as VideoIcon,
} from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { ArvdoulEmblem } from "./ArvdoulLogo";
import { backgroundSyncService } from "../../services/BackgroundSyncService.js";

// Animation configurations matching Arvdoul standard
const SPRING = {
  default: { type: "spring", damping: 26, stiffness: 340, mass: 0.8 },
  snappy: { type: "spring", damping: 20, stiffness: 420 },
  subtle: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
};

// Official Design Tokens (Image 1 Specs)
const TOKENS = {
  dark: {
    bg: "#03071B",
    surface: "rgba(255, 255, 255, 0.06)",
    elevated: "rgba(255, 255, 255, 0.09)",
    border: "rgba(255, 255, 255, 0.08)",
    textPrimary: "#FFFFFF",
    textSecondary: "rgba(255, 255, 255, 0.7)",
    brandGradient: "linear-gradient(135deg, #8B1EF3 0%, #4431F7 52%, #055BFB 100%)",
    brandGlow: "rgba(139, 30, 243, 0.35)",
    shadow: "0 20px 48px rgba(0, 0, 0, 0.5)",
    innerRing: "inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -1px 0 rgba(0, 0, 0, 0.3)",
    pillBg: "bg-gray-900/85 backdrop-blur-2xl border border-white/10",
  },
  light: {
    bg: "#F6F8FC",
    surface: "rgba(255, 255, 255, 0.85)",
    elevated: "rgba(255, 255, 255, 0.95)",
    border: "rgba(0, 0, 0, 0.08)",
    textPrimary: "#111827",
    textSecondary: "rgba(0, 0, 0, 0.6)",
    brandGradient: "linear-gradient(135deg, #8B1EF3 0%, #4431F7 52%, #055BFB 100%)",
    brandGlow: "rgba(139, 30, 243, 0.15)",
    shadow: "0 18px 40px rgba(17, 24, 39, 0.09)",
    innerRing: "inset 0 1px 0 rgba(255, 255, 255, 0.95), inset 0 -1px 0 rgba(0, 0, 0, 0.03)",
    pillBg: "bg-white/90 backdrop-blur-2xl border border-gray-200/70",
  },
};

// Exact navigation routes
const ROUTES = {
  home: "/home",
  search: "/search",
  menu: "/menu",
  notifications: "/notifications",
  network: "/network",
  coins: "/coins",
  settings: "/settings",
  profile: "/profile",
  createPost: "/create-post",
};

// Circular Action Icon Button
const CircularButton = memo(
  ({
    icon: Icon,
    onClick,
    isActive = false,
    theme = "dark",
    label,
    badge = 0,
    variant = "default",
    children,
  }) => {
    const isDark = theme === "dark";
    const [isHovered, setIsHovered] = useState(false);
    const { playSound } = useSound();

    const handleClick = useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        playSound?.("ui_click");
        onClick?.(e);
      },
      [onClick, playSound]
    );

    return (
      <motion.button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileTap={{ scale: 0.92 }}
        whileHover={{ scale: 1.06 }}
        transition={SPRING.snappy}
        aria-label={label}
        className={cn(
          "relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center shrink-0",
          "transition-all duration-200 outline-none focus:ring-2",
          isDark
            ? "bg-white/[0.07] hover:bg-white/[0.14] border border-white/[0.1] text-white focus:ring-purple-500/40"
            : "bg-black/[0.04] hover:bg-black/[0.08] border border-black/[0.07] text-gray-800 focus:ring-purple-500/40",
          isActive &&
            (isDark
              ? "bg-purple-600/30 border-purple-500/50 text-purple-300"
              : "bg-purple-100 border-purple-300 text-purple-700")
        )}
      >
        {Icon && <Icon className="w-4 h-4 sm:w-5 sm:h-5 transition-transform" />}
        {children}

        {/* Badge */}
        {badge > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={cn(
              "absolute -top-1 -right-1 flex items-center justify-center rounded-full text-white font-bold",
              "bg-gradient-to-r from-red-500 to-pink-600 shadow-md ring-2",
              isDark ? "ring-[#03071B]" : "ring-white",
              badge > 99
                ? "px-1.5 h-4 text-[9px]"
                : badge > 9
                ? "w-4 h-4 text-[10px]"
                : "w-3.5 h-3.5 text-[9px]"
            )}
          >
            {badge > 99 ? "99+" : badge}
          </motion.span>
        )}
      </motion.button>
    );
  }
);
CircularButton.displayName = "CircularButton";

// Main TopAppBar Component
export const TopAppBar = ({
  mode: propMode,
  title: propTitle,
  subtitle: propSubtitle,
  onBack,
  onAction,
  onSearch,
  showOfflineBanner = true,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { track } = useAnalytics();
  const { unreadCounts = {} } = useAppStore();

  const isDark = theme === "dark";
  const tokens = isDark ? TOKENS.dark : TOKENS.light;

  // Scroll visibility state
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  // Network Connectivity State
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // Search input state
  const [searchQuery, setSearchQuery] = useState("");

  // Sync background status
  useEffect(() => {
    const updateConn = () => {
      setIsOnline(navigator.onLine);
      if (typeof backgroundSyncService?.getPendingCount === "function") {
        setPendingCount(backgroundSyncService.getPendingCount());
      }
    };

    updateConn();
    window.addEventListener("online", updateConn);
    window.addEventListener("offline", updateConn);
    const interval = setInterval(updateConn, 4000);

    return () => {
      window.removeEventListener("online", updateConn);
      window.removeEventListener("offline", updateConn);
      clearInterval(interval);
    };
  }, []);

  // Handle manual sync
  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    setSyncSuccess(false);
    try {
      if (typeof backgroundSyncService?.triggerSync === "function") {
        const result = await backgroundSyncService.triggerSync();
        setPendingCount(backgroundSyncService.getPendingCount());
        if (result?.syncedCount > 0) {
          setSyncSuccess(true);
          setTimeout(() => setSyncSuccess(false), 3500);
        }
      }
    } catch {
      // Handled gracefully
    } finally {
      setIsSyncing(false);
    }
  };

  // Scroll Awareness
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentY = window.scrollY;
          const delta = currentY - lastScrollY.current;

          if (currentY < 40) {
            setIsVisible(true);
          } else if (delta > 12 && currentY > 70) {
            setIsVisible(false);
          } else if (delta < -8) {
            setIsVisible(true);
          }

          lastScrollY.current = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Determine current contextual mode (1 to 8)
  const currentMode = useMemo(() => {
    if (propMode) return propMode;

    const path = location.pathname;
    if (path === "/" || path === "/home" || path === "") {
      return "brand"; // Mode 01: Brand / Home
    }
    if (path.startsWith("/search")) {
      return "search"; // Mode 04: Search
    }
    if (
      path.startsWith("/create-post") ||
      path.startsWith("/create-story") ||
      path.startsWith("/image-editor")
    ) {
      return "composer"; // Mode 05: Composer
    }
    if (path.startsWith("/profile/") || path.startsWith("/user/")) {
      return "detail"; // Mode 03: Detail
    }
    if (
      path.startsWith("/notifications") ||
      path.startsWith("/network") ||
      path.startsWith("/coins") ||
      path.startsWith("/saved") ||
      path.startsWith("/settings") ||
      path.startsWith("/community") ||
      path.startsWith("/rankings") ||
      path.startsWith("/badges")
    ) {
      return "contextual"; // Mode 02: Contextual
    }
    return "contextual";
  }, [location.pathname, propMode]);

  // Contextual Title derivation
  const contextualTitle = useMemo(() => {
    if (propTitle) return propTitle;
    const path = location.pathname;
    if (path.startsWith("/notifications")) return "Notifications";
    if (path.startsWith("/network")) return "Network & Friends";
    if (path.startsWith("/coins")) return "Coins & Wallet";
    if (path.startsWith("/saved")) return "Saved Items";
    if (path.startsWith("/settings")) return "Settings";
    if (path.startsWith("/community")) return "Communities";
    if (path.startsWith("/rankings")) return "Rankings";
    if (path.startsWith("/badges")) return "Badges & Rewards";
    if (path.startsWith("/create-post")) return "Create Post";
    if (path.startsWith("/image-editor")) return "Image Studio";
    return "Arvdoul";
  }, [location.pathname, propTitle]);

  // Back action helper
  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      track?.("top_nav_back_click");
      if (window.history.length > 2) {
        navigate(-1);
      } else {
        navigate(ROUTES.home);
      }
    }
  }, [onBack, navigate, track]);

  const notificationCount = unreadCounts.notifications || 0;

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.header
            id="arvdoul-top-app-bar"
            initial={{ y: -70, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -70, opacity: 0 }}
            transition={SPRING.default}
            className="fixed top-0 left-0 right-0 z-40 px-3 sm:px-6 pt-2 sm:pt-3 pointer-events-none"
          >
            <div className="max-w-4xl mx-auto flex flex-col items-center gap-1.5 pointer-events-auto">
              {/* Floating Glass Pill App Bar */}
              <div
                className={cn(
                  "w-full rounded-[26px] px-3 sm:px-5 py-2.5 sm:py-3",
                  tokens.pillBg,
                  "shadow-2xl transition-all duration-300 relative overflow-hidden"
                )}
                style={{
                  boxShadow: tokens.shadow,
                }}
              >
                {/* Mode 01: Brand / Home */}
                {currentMode === "brand" && (
                  <div className="flex items-center justify-between gap-3">
                    {/* Leading: Logo + Title */}
                    <div
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                        track?.("top_nav_home_click");
                      }}
                      className="flex items-center gap-3 cursor-pointer group select-none"
                    >
                      <div className="relative">
                        <ArvdoulEmblem
                          size={36}
                          className="group-hover:scale-105 group-active:scale-95 transition-transform"
                        />
                        {!isOnline && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-black" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-xl sm:text-2xl font-black tracking-tight"
                            style={{
                              backgroundImage: tokens.brandGradient,
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                            }}
                          >
                            Arvdoul
                          </span>
                          <span
                            className="hidden sm:inline-flex text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider"
                            style={{
                              background: isDark
                                ? "rgba(139, 30, 243, 0.18)"
                                : "rgba(139, 30, 243, 0.1)",
                              color: "#8B1EF3",
                              border: "1px solid rgba(139, 30, 243, 0.25)",
                            }}
                          >
                            PRO
                          </span>
                        </div>
                        <span
                          className="text-[11px] font-medium leading-tight"
                          style={{ color: tokens.textSecondary }}
                        >
                          Connect & Create
                        </span>
                      </div>
                    </div>

                    {/* Actions: Search + Menu */}
                    <div className="flex items-center gap-2">
                      <CircularButton
                        icon={Search}
                        label="Search"
                        theme={theme}
                        onClick={() => navigate(ROUTES.search)}
                      />
                      <CircularButton
                        icon={Menu}
                        label="Menu"
                        theme={theme}
                        badge={notificationCount}
                        onClick={() => navigate(ROUTES.menu)}
                      />
                    </div>
                  </div>
                )}

                {/* Mode 02: Contextual Section */}
                {currentMode === "contextual" && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <CircularButton
                        icon={ChevronLeft}
                        label="Back"
                        theme={theme}
                        onClick={handleBack}
                      />
                      <div className="flex flex-col min-w-0">
                        <h2
                          className="text-base sm:text-lg font-bold truncate leading-tight"
                          style={{ color: tokens.textPrimary }}
                        >
                          {contextualTitle}
                        </h2>
                        {propSubtitle && (
                          <span
                            className="text-xs truncate"
                            style={{ color: tokens.textSecondary }}
                          >
                            {propSubtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <CircularButton
                        icon={Search}
                        label="Search"
                        theme={theme}
                        onClick={() => navigate(ROUTES.search)}
                      />
                      <CircularButton
                        icon={Menu}
                        label="Menu"
                        theme={theme}
                        badge={notificationCount}
                        onClick={() => navigate(ROUTES.menu)}
                      />
                    </div>
                  </div>
                )}

                {/* Mode 03: Detail View */}
                {currentMode === "detail" && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <CircularButton
                        icon={ChevronLeft}
                        label="Back"
                        theme={theme}
                        onClick={handleBack}
                      />
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {contextualTitle.charAt(0)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span
                            className="text-sm font-bold truncate leading-tight"
                            style={{ color: tokens.textPrimary }}
                          >
                            {contextualTitle}
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Active now</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <CircularButton
                        icon={Share2}
                        label="Share"
                        theme={theme}
                        onClick={() => {
                          if (navigator.share) {
                            navigator.share({
                              title: contextualTitle,
                              url: window.location.href,
                            });
                          }
                        }}
                      />
                      <CircularButton
                        icon={MoreVertical}
                        label="Options"
                        theme={theme}
                        onClick={onAction}
                      />
                    </div>
                  </div>
                )}

                {/* Mode 04: Search Mode */}
                {currentMode === "search" && (
                  <div className="flex items-center gap-2">
                    <CircularButton
                      icon={ChevronLeft}
                      label="Back"
                      theme={theme}
                      onClick={handleBack}
                    />
                    <div className="flex-1 relative flex items-center">
                      <Search
                        className="w-4 h-4 absolute left-3 pointer-events-none"
                        style={{ color: tokens.textSecondary }}
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          onSearch?.(e.target.value);
                        }}
                        placeholder="Search Arvdoul posts, creators, tags..."
                        autoFocus
                        className={cn(
                          "w-full pl-9 pr-9 py-1.5 rounded-full text-sm outline-none transition-all",
                          isDark
                            ? "bg-white/[0.08] text-white placeholder-white/40 focus:bg-white/[0.12]"
                            : "bg-black/[0.05] text-gray-900 placeholder-black/40 focus:bg-black/[0.08]"
                        )}
                      />
                      {searchQuery && (
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            onSearch?.("");
                          }}
                          className="absolute right-2.5 p-1 rounded-full text-white/50 hover:text-white"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <CircularButton
                      icon={SlidersHorizontal}
                      label="Filters"
                      theme={theme}
                      onClick={onAction}
                    />
                  </div>
                )}

                {/* Mode 05: Composer / Editor Mode */}
                {currentMode === "composer" && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CircularButton
                        icon={X}
                        label="Close"
                        theme={theme}
                        onClick={handleBack}
                      />
                      <span
                        className="text-base font-bold"
                        style={{ color: tokens.textPrimary }}
                      >
                        {contextualTitle}
                      </span>
                    </div>

                    <button
                      onClick={onAction}
                      className="px-4 py-1.5 rounded-full text-white text-xs font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all"
                      style={{
                        backgroundImage: tokens.brandGradient,
                      }}
                    >
                      Publish
                    </button>
                  </div>
                )}
              </div>

              {/* Integrated Offline / Online Sync Status Pill (Image 1 & 2 Spec) */}
              {showOfflineBanner && (!isOnline || syncSuccess || pendingCount > 0) && (
                <motion.div
                  initial={{ y: -10, opacity: 0, scale: 0.95 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: -10, opacity: 0, scale: 0.95 }}
                  transition={SPRING.snappy}
                  className={cn(
                    "flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-xl shadow-lg border",
                    !isOnline
                      ? "bg-red-950/85 text-red-200 border-red-500/40 shadow-red-950/40"
                      : syncSuccess
                      ? "bg-emerald-950/85 text-emerald-200 border-emerald-500/40 shadow-emerald-950/40"
                      : "bg-purple-950/85 text-purple-200 border-purple-500/40 shadow-purple-950/40"
                  )}
                >
                  {!isOnline ? (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-red-400 animate-pulse" />
                      <span>
                        Offline Mode · {pendingCount > 0 ? `${pendingCount} saved` : "Viewing cache"}
                      </span>
                    </>
                  ) : syncSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Synced with cloud</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw
                        className={cn("w-3.5 h-3.5 text-purple-400", isSyncing && "animate-spin")}
                      />
                      <span>{pendingCount} changes waiting to sync</span>
                      <button
                        onClick={handleManualSync}
                        disabled={isSyncing}
                        className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold transition"
                      >
                        {isSyncing ? "Syncing..." : "Sync"}
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Spacer so page content begins neatly under the floating app bar */}
      <div className="h-16 sm:h-20" />
    </>
  );
};

export default memo(TopAppBar);
