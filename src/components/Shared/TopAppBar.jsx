// src/components/Shared/TopAppBar.jsx - ARVDOUL TOP APP BAR vNEXT
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useSound } from "../../hooks/useSound.js";
import { useAnalytics } from "../../hooks/useAnalytics.js";
import { useTheme } from "../../context/ThemeContext";
import { cn } from "../../lib/utils.js";
import {
  Search,
  Menu,
  X,
  ChevronLeft,
  MoreVertical,
  WifiOff,
  RefreshCw,
  Check,
  SlidersHorizontal,
  Share2,
} from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { backgroundSyncService } from "../../services/BackgroundSyncService.js";

/* ========================================================================== */
/* Animation & Tokens                                                         */
/* ========================================================================== */

const SPRING = {
  default: { type: "spring", damping: 26, stiffness: 340, mass: 0.8 },
  snappy: { type: "spring", damping: 20, stiffness: 420 },
};

const TOKENS = {
  dark: {
    bg: "#03071B",
    surface: "rgba(255, 255, 255, 0.06)",
    border: "rgba(255, 255, 255, 0.08)",
    textPrimary: "#FFFFFF",
    textSecondary: "rgba(255, 255, 255, 0.7)",
    brandGradient:
      "linear-gradient(135deg, #8B1EF3 0%, #4431F7 52%, #055BFB 100%)",
    brandLine:
      "linear-gradient(90deg, #C82BFF 0%, #8B1EF3 34%, #4431F7 66%, #0088FF 100%)",
    shadow: "0 20px 48px rgba(0, 0, 0, 0.5)",
    iconPrimary: "#FFFFFF",
    iconSecondary: "rgba(255,255,255,0.82)",
    iconActive: "#FFFFFF",
    iconBg: "rgba(255,255,255,0.08)",
    iconBorder: "rgba(255,255,255,0.12)",
    iconRing: "rgba(139,30,243,0.5)",
  },
  light: {
    bg: "#F6F8FC",
    surface: "rgba(255, 255, 255, 0.85)",
    border: "rgba(0, 0, 0, 0.08)",
    textPrimary: "#111827",
    textSecondary: "rgba(0, 0, 0, 0.6)",
    brandGradient:
      "linear-gradient(135deg, #8B1EF3 0%, #4431F7 52%, #055BFB 100%)",
    brandLine:
      "linear-gradient(90deg, #C82BFF 0%, #8B1EF3 34%, #4431F7 66%, #0088FF 100%)",
    shadow: "0 18px 40px rgba(17, 24, 39, 0.09)",
    iconPrimary: "#111827",
    iconSecondary: "rgba(17,24,39,0.78)",
    iconActive: "#4431F7",
    iconBg: "rgba(255,255,255,0.6)",
    iconBorder: "rgba(0,0,0,0.08)",
    iconRing: "rgba(139,30,243,0.3)",
  },
};

const ROUTES = {
  home: "/home",
  search: "/search",
  menu: "/menu", // ideally replaced by onOpenMenu prop
};

/* ========================================================================== */
/* Scroll State Hook – works with any scroll container                        */
/* ========================================================================== */

function useScrollState(scrollContainerRef) {
  const [scrollState, setScrollState] = useState("expanded"); // 'expanded' | 'compact' | 'hidden'
  const lastScrollYRef = useRef(0);
  const frameRef = useRef(null);
  const directionRef = useRef(null);
  const accumulatedRef = useRef(0);

  useEffect(() => {
    const container = scrollContainerRef?.current || window;
    if (!container) return;

    const getScrollY = () =>
      container === window ? window.scrollY : container.scrollTop;

    lastScrollYRef.current = getScrollY();

    const handleScroll = () => {
      if (frameRef.current) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const currentY = getScrollY();
        const delta = currentY - lastScrollYRef.current;
        lastScrollYRef.current = currentY;

        if (currentY <= 4) {
          setScrollState("expanded");
          accumulatedRef.current = 0;
          directionRef.current = null;
          return;
        }

        if (Math.abs(delta) < 1) return;
        const newDirection = delta > 0 ? "down" : "up";

        if (directionRef.current !== newDirection) {
          directionRef.current = newDirection;
          accumulatedRef.current = 0;
        }

        accumulatedRef.current += Math.abs(delta);

        if (newDirection === "down") {
          if (accumulatedRef.current > 60) {
            setScrollState("hidden");
            accumulatedRef.current = 0;
          } else if (currentY > 40) {
            setScrollState("compact");
          }
        } else {
          setScrollState("compact");
          if (accumulatedRef.current > 30 || currentY < 80) {
            setScrollState("expanded");
            accumulatedRef.current = 0;
          }
        }
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [scrollContainerRef]);

  return scrollState;
}

/* ========================================================================== */
/* CircularButton – Glass‑Mounted Icon with explicit colors                   */
/* ========================================================================== */

const CircularButton = memo(
  ({ icon: Icon, onClick, label, theme = "dark", active = false, badge = 0 }) => {
    const { playSound } = useSound();
    const reducedMotion = useReducedMotion();
    const isDark = theme === "dark";
    const tokens = isDark ? TOKENS.dark : TOKENS.light;

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
        type="button"
        onClick={handleClick}
        whileTap={reducedMotion ? undefined : { scale: 0.92 }}
        whileHover={reducedMotion ? undefined : { scale: 1.04 }}
        transition={SPRING.snappy}
        aria-label={label}
        className={cn(
          "relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full shrink-0",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1EF3]/50"
        )}
        style={{
          background: active
            ? isDark
              ? "rgba(139,30,243,0.25)"
              : "rgba(139,30,243,0.15)"
            : tokens.iconBg,
          border: `1px solid ${active ? tokens.iconRing : tokens.iconBorder}`,
          boxShadow: isDark
            ? "inset 0 1px 0 rgba(255,255,255,0.1), 0 2px 8px rgba(0,0,0,0.2)"
            : "inset 0 1px 0 rgba(255,255,255,0.8), 0 2px 8px rgba(0,0,0,0.05)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        {Icon && (
          <Icon
            className="w-5 h-5 sm:w-5 sm:h-5"
            color={active ? tokens.iconActive : tokens.iconPrimary}
            strokeWidth={2}
          />
        )}

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

/* ========================================================================== */
/* Brand Baseline                                                             */
/* ========================================================================== */

const BrandBaseline = memo(({ visible, gradient }) => {
  if (!visible) return null;
  return (
    <span
      className="mt-0.5 block h-[2px] w-6 rounded-full"
      style={{ background: gradient }}
    />
  );
});

/* ========================================================================== */
/* Main TopAppBar                                                             */
/* ========================================================================== */

export const TopAppBar = ({
  mode: propMode,
  title: propTitle,
  subtitle: propSubtitle,
  onBack,
  onAction, // generic action for contextual More / Publish / etc.
  onSearch,
  onOpenMenu, // better than hardcoded /menu
  showOfflineBanner = true,
  scrollContainerRef,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme } = useTheme();
  const { track } = useAnalytics();
  const reducedMotion = useReducedMotion();

  const isDark = theme === "dark";
  const tokens = isDark ? TOKENS.dark : TOKENS.light;

  const scrollState = useScrollState(scrollContainerRef);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Sync search query with URL search param and external events
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get("q") || "";
    setSearchQuery(q);

    const handleExternalQuery = (e) => {
      if (typeof e.detail === "string") {
        setSearchQuery(e.detail);
      }
    };
    window.addEventListener("arvdoul:set_search_query", handleExternalQuery);
    return () => {
      window.removeEventListener("arvdoul:set_search_query", handleExternalQuery);
    };
  }, [location.search]);

  // Sync status (event-driven, no polling)
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
      // gracefully handled
    } finally {
      setIsSyncing(false);
    }
  };

  // Determine mode
  const currentMode = useMemo(() => {
    if (propMode) return propMode;
    const path = location.pathname;
    if (path === "/" || path === "/home" || path === "") return "brand";
    if (path.startsWith("/search")) return "search";
    if (
      path.startsWith("/create-post") ||
      path.startsWith("/create-story") ||
      path.startsWith("/image-editor")
    )
      return "composer";
    if (path.startsWith("/profile/") || path.startsWith("/user/"))
      return "detail";
    return "contextual";
  }, [location.pathname, propMode]);

  // Title
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

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      track?.("top_nav_back_click");
      if (window.history.length > 2) navigate(-1);
      else navigate(ROUTES.home);
    }
  }, [onBack, navigate, track]);

  const isHidden = scrollState === "hidden";
  const translateY = isHidden ? -100 : 0;
  const opacity = isHidden ? 0 : 1;

  return (
    <>
      <motion.header
        id="arvdoul-top-app-bar"
        initial={false}
        animate={{ y: translateY, opacity }}
        transition={
          reducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 300, damping: 30 }
        }
        className="fixed top-0 left-0 right-0 z-40 px-3 sm:px-6 pt-2 sm:pt-3 pointer-events-none"
      >
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-1.5 pointer-events-auto">
          {/* Glass pill with optical layers */}
          <div
            className={cn(
              "w-full rounded-[26px] px-3 sm:px-5 py-2.5 sm:py-3",
              isDark
                ? "bg-gray-900/85 backdrop-blur-2xl border border-white/10"
                : "bg-white/90 backdrop-blur-2xl border border-gray-200/70",
              "shadow-2xl transition-all duration-300 relative overflow-hidden"
            )}
            style={{ boxShadow: tokens.shadow }}
          >
            {/* Optical layers */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-4 top-0 h-px rounded-full"
              style={{
                background: isDark
                  ? "linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)"
                  : "linear-gradient(90deg,transparent,rgba(255,255,255,0.8),transparent)",
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-[1px] rounded-[25px] border"
              style={{
                borderColor: isDark
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(0,0,0,0.03)",
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[26px]"
              style={{
                background:
                  "linear-gradient(105deg,transparent 20%,rgba(255,255,255,0.02) 45%,rgba(255,255,255,0.05) 50%,rgba(255,255,255,0.02) 55%,transparent 80%)",
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-[26px]"
              style={{
                background:
                  "repeating-linear-gradient(100deg, transparent, transparent 8px, rgba(255,255,255,0.01) 8px, rgba(255,255,255,0.01) 9px)",
                opacity: 0.4,
              }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-8 bottom-0 h-px rounded-full"
              style={{
                background: isDark
                  ? "linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)"
                  : "linear-gradient(90deg,transparent,rgba(0,0,0,0.05),transparent)",
              }}
            />

            {/* Content */}
            <div className="relative z-10">
              {currentMode === "brand" && (
                <div className="flex items-center justify-between gap-3">
                  <div
                    onClick={() => {
                      // Use scroll container
                      if (scrollContainerRef?.current) {
                        scrollContainerRef.current.scrollTo({
                          top: 0,
                          behavior: "smooth",
                        });
                      } else {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                      track?.("top_nav_home_click");
                    }}
                    className="flex items-center gap-3 cursor-pointer group select-none"
                  >
                    <div className="relative">
                      <img
                        src={isDark ? "/logo/logo-dark.png" : "/logo/logo-light.png"}
                        alt="Arvdoul"
                        className="w-9 h-9 rounded-full object-cover group-hover:scale-105 group-active:scale-95 transition-transform"
                        loading="eager"
                        decoding="async"
                      />
                      {!isOnline && (
                        <span
                          className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500"
                          style={{ ringColor: isDark ? "#03071B" : "#F6F8FC" }}
                        />
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
                      </div>
                      <BrandBaseline visible={!isHidden} gradient={tokens.brandLine} />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <CircularButton
                      icon={Search}
                      label="Search"
                      theme={theme}
                      onClick={() => {
                        if (onSearch) onSearch();
                        else navigate(ROUTES.search);
                      }}
                    />
                    <CircularButton
                      icon={Menu}
                      label="Menu"
                      theme={theme}
                      onClick={() => {
                        if (onOpenMenu) onOpenMenu();
                        else navigate(ROUTES.menu);
                      }}
                    />
                  </div>
                </div>
              )}

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
                      onClick={() => {
                        if (onSearch) onSearch();
                        else navigate(ROUTES.search);
                      }}
                    />
                    <CircularButton
                      icon={Menu}
                      label="Menu"
                      theme={theme}
                      onClick={() => {
                        if (onOpenMenu) onOpenMenu();
                        else navigate(ROUTES.menu);
                      }}
                    />
                  </div>
                </div>
              )}

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
                      onClick={async () => {
                        try {
                          if (navigator.share) {
                            await navigator.share({
                              title: contextualTitle,
                              url: window.location.href,
                            });
                          }
                        } catch (error) {
                          // handle cancellation or fallback
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
                      style={{ color: tokens.iconSecondary }}
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSearchQuery(val);
                        onSearch?.(val);
                        window.dispatchEvent(new CustomEvent("arvdoul:search_query", { detail: val }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          window.dispatchEvent(new CustomEvent("arvdoul:search_submit", { detail: searchQuery }));
                        }
                      }}
                      placeholder="Search Arvdoul posts, creators, tags..."
                      autoFocus={false}
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
                          window.dispatchEvent(new CustomEvent("arvdoul:search_query", { detail: "" }));
                        }}
                        className="absolute right-2.5 p-1 rounded-full"
                        style={{ color: tokens.iconSecondary }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <CircularButton
                    icon={SlidersHorizontal}
                    label="Filters"
                    theme={theme}
                    onClick={() => {
                      if (onAction) onAction();
                      window.dispatchEvent(new CustomEvent("arvdoul:toggle_search_filters"));
                    }}
                  />
                </div>
              )}

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
                    type="button"
                    onClick={onAction}
                    className="px-4 py-1.5 rounded-full text-white text-xs font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all"
                    style={{ backgroundImage: tokens.brandGradient }}
                  >
                    Publish
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Offline / sync status pill */}
          <AnimatePresence>
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
                      Offline Mode ·{" "}
                      {pendingCount > 0 ? `${pendingCount} saved` : "Viewing cache"}
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
                      className={cn(
                        "w-3.5 h-3.5 text-purple-400",
                        isSyncing && "animate-spin"
                      )}
                    />
                    <span>{pendingCount} changes waiting to sync</span>
                    <button
                      type="button"
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
          </AnimatePresence>
        </div>
      </motion.header>

      {/* Spacer */}
      <div
        aria-hidden="true"
        style={{
          height: "calc(64px + env(safe-area-inset-top))",
        }}
      />
    </>
  );
};

export default memo(TopAppBar);