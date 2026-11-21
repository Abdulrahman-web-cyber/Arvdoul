// src/components/Shared/TopAppBar.jsx

import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useSound } from "../../hooks/useSound.js";
import { useAnalytics } from "../../hooks/useAnalytics.js";
import { useTheme } from "../../context/ThemeContext";
import { cn } from "../../lib/utils.js";
import { Search, Menu, X, ChevronLeft, SlidersHorizontal, WifiOff, Check, RefreshCw, QrCode, Share2, MoreVertical, Plus, Phone, Video, Gift, Info, CheckCircle2, Camera, Calendar, Settings } from "lucide-react";
import { useAppStore } from "../../store/appStore";
import { useAuth } from "../../context/AuthContext";
import { resolveActorName } from "../../services/profileReadModel.js";
import { backgroundSyncService } from "../../services/BackgroundSyncService.js";
import { ArvdoulEmblem, ArvdoulWordmark } from "./ArvdoulLogo";
import { BRAND_GRADIENT, brandRgba, tokens } from '../../design-system/tokens.js';
import { LazyImage } from '../../components/Shared/LazyImage';

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
      BRAND_GRADIENT,
    brandLine:
      `linear-gradient(90deg, ${tokens.color.brand.pink} 0%, ${tokens.color.brand.violet} 34%, ${tokens.color.brand.indigo} 66%, ${tokens.color.brand.cyan} 100%)`,
    shadow: "0 20px 48px rgba(0, 0, 0, 0.5)",
    iconPrimary: "#FFFFFF",
    iconSecondary: "rgba(255,255,255,0.82)",
    iconActive: "#FFFFFF",
    iconBg: "rgba(255,255,255,0.08)",
    iconBorder: "rgba(255,255,255,0.12)",
    iconRing: brandRgba(0.5),
  },
  light: {
    bg: "#F6F8FC",
    surface: "rgba(255, 255, 255, 0.85)",
    border: "rgba(0, 0, 0, 0.08)",
    textPrimary: "#111827",
    textSecondary: "rgba(0, 0, 0, 0.6)",
    brandGradient:
      BRAND_GRADIENT,
    brandLine:
      `linear-gradient(90deg, ${tokens.color.brand.pink} 0%, ${tokens.color.brand.violet} 34%, ${tokens.color.brand.indigo} 66%, ${tokens.color.brand.cyan} 100%)`,
    shadow: "0 18px 40px rgba(17, 24, 39, 0.09)",
    iconPrimary: "#111827",
    iconSecondary: "rgba(17,24,39,0.78)",
    iconActive: tokens.color.brand.indigo,
    iconBg: "rgba(255,255,255,0.6)",
    iconBorder: "rgba(0,0,0,0.08)",
    iconRing: brandRgba(0.3),
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
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple/50"
        )}
        style={{
          background: active
            ? brandRgba(isDark ? 0.25 : 0.15)
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
  const [inboxHeaderState, setInboxHeaderState] = useState({ totalUnread: 0, activeCount: 0 });
  const [inboxSearchOpen, setInboxSearchOpen] = useState(false);
  const [inboxSearchQuery, setInboxSearchQuery] = useState("");
  const [storiesSearchOpen, setStoriesSearchOpen] = useState(false);
  const [storiesSearchQuery, setStoriesSearchQuery] = useState("");
  const [chatHeaderState, setChatHeaderState] = useState(null);
  const [notificationsHeaderState, setNotificationsHeaderState] = useState({
    unreadCount: 0,
    pendingNetworkCount: 0,
    mainTab: "alerts",
    filterActive: false,
  });
  const [notificationsSearchOpen, setNotificationsSearchOpen] = useState(false);
  const [notificationsSearchQuery, setNotificationsSearchQuery] = useState("");
  const [networkHeaderState, setNetworkHeaderState] = useState(null);
  const [networkSearchOpen, setNetworkSearchOpen] = useState(false);
  const [networkSearchQuery, setNetworkSearchQuery] = useState("");
  const inboxSearchInputRef = useRef(null);
  const storiesSearchInputRef = useRef(null);
  const notificationsSearchInputRef = useRef(null);
  const networkSearchInputRef = useRef(null);

  useEffect(() => {
    const onInboxState = (e) => {
      if (e?.detail && typeof e.detail === "object") {
        setInboxHeaderState({
          totalUnread: Number(e.detail.totalUnread) || 0,
          activeCount: Number(e.detail.activeCount) || 0,
        });
      }
    };
    const onChatState = (e) => {
      if (e?.detail === null) {
        setChatHeaderState(null);
      } else if (e?.detail && typeof e.detail === "object") {
        setChatHeaderState(e.detail);
      }
    };
    const onNotificationsState = (e) => {
      if (e?.detail === null) {
        setNotificationsHeaderState({
          unreadCount: 0,
          pendingNetworkCount: 0,
          mainTab: "alerts",
          filterActive: false,
        });
      } else if (e?.detail && typeof e.detail === "object") {
        setNotificationsHeaderState({
          unreadCount: Number(e.detail.unreadCount) || 0,
          pendingNetworkCount: Number(e.detail.pendingNetworkCount) || 0,
          mainTab: e.detail.mainTab || "alerts",
          filterActive: Boolean(e.detail.filterActive),
        });
      }
    };
    const onNetworkState = (e) => {
      if (e?.detail === null) {
        setNetworkHeaderState(null);
      } else if (e?.detail && typeof e.detail === "object") {
        setNetworkHeaderState(e.detail);
      }
    };
    const onFocusInboxSearch = () => {
      setInboxSearchOpen(true);
      requestAnimationFrame(() => inboxSearchInputRef.current?.focus?.());
    };
    window.addEventListener("arvdoul:inbox_header_state", onInboxState);
    window.addEventListener("arvdoul:chat_header_state", onChatState);
    window.addEventListener("arvdoul:notifications_header_state", onNotificationsState);
    window.addEventListener("arvdoul:network_header_state", onNetworkState);
    window.addEventListener("arvdoul:focus_inbox_search", onFocusInboxSearch);
    return () => {
      window.removeEventListener("arvdoul:inbox_header_state", onInboxState);
      window.removeEventListener("arvdoul:chat_header_state", onChatState);
      window.removeEventListener("arvdoul:notifications_header_state", onNotificationsState);
      window.removeEventListener("arvdoul:network_header_state", onNetworkState);
      window.removeEventListener("arvdoul:focus_inbox_search", onFocusInboxSearch);
    };
  }, []);

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
    const onQueueChanged = (e) => {
      setIsOnline(navigator.onLine);
      if (typeof e?.detail?.count === "number") {
        setPendingCount(e.detail.count);
      } else if (typeof backgroundSyncService?.getPendingCount === "function") {
        setPendingCount(backgroundSyncService.getPendingCount());
      }
    };

    updateConn();
    window.addEventListener("online", updateConn);
    window.addEventListener("offline", updateConn);
    window.addEventListener("arvdoul:sync_queue_changed", onQueueChanged);

    return () => {
      window.removeEventListener("online", updateConn);
      window.removeEventListener("offline", updateConn);
      window.removeEventListener("arvdoul:sync_queue_changed", onQueueChanged);
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

  useAuth();
  useAppStore((state) => state.currentUser);

  // Determine mode
  const currentMode = useMemo(() => {
    if (propMode) return propMode;
    const path = location.pathname;
    if (path === "/" || path === "/home" || path === "") return "brand";
    if (path.startsWith("/search")) return "search";
    if (
      path.startsWith("/stories") ||
      path.startsWith("/vibes") ||
      path.startsWith("/highlight/")
    )
      return "stories";
    if (
      path.startsWith("/create-post") ||
      path.startsWith("/create-story")
    )
      return "composer";
    if (path === "/messages") return "messages_inbox";
    if (path.startsWith("/messages/")) {
      const parts = path.split("/").filter(Boolean);
      if (parts.length === 2 && parts[1].toLowerCase() !== "new") {
        return "messages_chat";
      }
      return "contextual";
    }
    if (path === "/notifications" || path.startsWith("/notifications/") || path.startsWith("/alerts")) {
      return "notifications";
    }
    if (
      path === "/network" ||
      path.startsWith("/network/") ||
      path.includes("/connections") ||
      path.includes("/followers") ||
      path.includes("/following") ||
      path.includes("/friends")
    ) {
      return "network";
    }
    if (path === "/profile" || path === "/profile/me")
      return "profile_me";
    if (path.startsWith("/profile/") || path.startsWith("/user/")) {
      const parts = path.toLowerCase().split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      if (['edit', 'analytics', 'highlights', 'followers', 'following', 'friends', 'connections', 'about', 'preview', 'wallet', 'progress', 'achievements', 'titles', 'passport', 'citizen', 'citizenship'].includes(last)) {
        return "contextual";
      }
      return "profile_visitor";
    }
    return "contextual";
  }, [location.pathname, propMode]);

  useEffect(() => {
    if (currentMode !== "messages_chat") {
      setChatHeaderState(null);
    }
    if (currentMode !== "messages_inbox") {
      setInboxSearchOpen(false);
      setInboxSearchQuery("");
    }
    if (currentMode !== "stories") {
      setStoriesSearchOpen(false);
      setStoriesSearchQuery("");
    }
    if (currentMode !== "notifications") {
      setNotificationsSearchOpen(false);
      setNotificationsSearchQuery("");
    }
    if (currentMode !== "network") {
      setNetworkSearchOpen(false);
      setNetworkSearchQuery("");
      setNetworkHeaderState(null);
    }
  }, [currentMode]);

  // Title
  const contextualTitle = useMemo(() => {
    if (propTitle) return propTitle;
    const path = location.pathname;
    if (path === "/profile" || path === "/profile/me") return "Profile";
    if (path.startsWith("/profile/edit")) return "Edit Profile";
    if (path.startsWith("/profile/analytics")) return "Creator Analytics";
    if (path.startsWith("/profile/highlights")) return "Highlights Studio";
    if (
      path.includes("/connections") ||
      path.includes("/followers") ||
      path.includes("/following") ||
      path.includes("/friends") ||
      path === "/network" ||
      path.startsWith("/network")
    ) {
      return "Citizen Network";
    }
    if (path.startsWith("/passport") || path.startsWith("/citizen") || path.startsWith("/citizenship")) return "Digital Passport";
    if (path.startsWith("/titles")) return "Civic Titles & Provenance";
    if (path.startsWith("/reputation")) return "Reputation & Standing";
    if (path.startsWith("/notifications")) return "Notifications";
    if (path.startsWith("/coins") || path.startsWith("/wallet")) return "Coins & Wallet";
    if (path.startsWith("/saved")) return "Saved Items";
    if (path.startsWith("/collections")) return "Collections";
    if (path.startsWith("/settings/data-usage")) return "Data Usage";
    if (path.startsWith("/settings")) return "Settings";
    if (path.startsWith("/community")) return "Communities";
    if (path.startsWith("/rankings")) return "Rankings";
    if (path.startsWith("/badges")) return "Badges & Rewards";
    if (path.startsWith("/progress")) return "Progression & Perks";
    if (path.startsWith("/achievements")) return "Achievements";
    if (path.startsWith("/creator/onboarding") || path.startsWith("/creator-onboarding")) return "Creator Accreditation";
    if (path.startsWith("/create-post")) return "Create Post";
    if (path.startsWith("/create-story")) return "Create Story";
    if (path.startsWith("/video-editor")) return "Video Studio";
    if (path.startsWith("/audio-editor")) return "Audio Studio";
    if (path.startsWith("/thumbnail-designer")) return "Thumbnail Designer";
    if (path.startsWith("/marketplace") || path.startsWith("/store") || path.startsWith("/shop")) return "Marketplace";
    if (path.startsWith("/spaces")) return "Audio Spaces";
    if (path.startsWith("/sounds")) return "Sounds & Music";
    if (path.startsWith("/help")) return "Help Center";
    if (path.startsWith("/search")) return "Search";
    if (path === "/messages") return "Messages";
    if (path === "/messages/new") return "New Conversation";
    if (path.startsWith("/messages/") && path.endsWith("/info")) return "Group Info";
    if (path.startsWith("/messages/") && path.endsWith("/settings")) return "Conversation Settings";
    if (path.startsWith("/messages/")) return chatHeaderState?.title || "Chat";
    if (path.startsWith("/vibes")) return "Vibes";
    if (path.startsWith("/menu")) return "Menu";
    if (path.startsWith("/admin/users")) return "Admin - Users";
    if (path.startsWith("/admin/content")) return "Admin - Content";
    if (path.startsWith("/admin/moderation")) return "Admin - Moderation";
    if (path.startsWith("/admin/economy")) return "Admin - Economy";
    if (path.startsWith("/admin/audit-logs")) return "Admin - Audit Logs";
    if (path.startsWith("/admin/access")) return "Admin - Access Control";
    if (path.startsWith("/admin")) return "Admin Console";
    if (path.startsWith("/profile/") || path.startsWith("/user/")) {
      return "Profile";
    }
    return "Arvdoul";
  }, [location.pathname, propTitle, chatHeaderState?.title]);

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
        <div
          className={cn(
            "mx-auto flex flex-col items-center gap-1.5 pointer-events-auto",
            currentMode === "messages_inbox" || currentMode === "messages_chat" || currentMode === "stories"
              ? "max-w-6xl"
              : "max-w-4xl"
          )}
        >
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
            {/* Subtle glass edge specular highlight */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-6 top-0 h-px rounded-full"
              style={{
                background: isDark
                  ? "linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)"
                  : "linear-gradient(90deg,transparent,rgba(255,255,255,0.85),transparent)",
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
                      <ArvdoulEmblem
                        size={36}
                        theme={theme}
                        animate={true}
                        showPlate={false}
                        className="group-hover:scale-105 group-active:scale-95 transition-transform"
                      />
                      {!isOnline && (
                        <span
                          className={cn(
                            "absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2",
                            isDark ? "ring-[#03071B]" : "ring-[#F6F8FC]"
                          )}
                        />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <ArvdoulWordmark
                          variant={isDark ? "gradient" : "auto"}
                          size="md"
                        />
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
                      {propSubtitle ? (
                        <span
                          className="text-xs truncate"
                          style={{ color: tokens.textSecondary }}
                        >
                          {propSubtitle}
                        </span>
                      ) : (location.pathname.includes("/connections") || location.pathname.includes("/followers") || location.pathname.includes("/following") || location.pathname.includes("/friends")) ? (
                        <span
                          className="text-[11px] font-mono truncate"
                          style={{ color: tokens.textSecondary }}
                        >
                          {location.pathname.includes("/followers") ? "Followers" : location.pathname.includes("/following") ? "Following" : location.pathname.includes("/friends") ? "Mutual Friends" : "Affiliations & Citizens"}
                        </span>
                      ) : null}
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

              {currentMode === "notifications" && (
                notificationsSearchOpen ? (
                  <div className="flex items-center gap-2">
                    <CircularButton
                      icon={ChevronLeft}
                      label="Close notification search"
                      theme={theme}
                      onClick={() => {
                        setNotificationsSearchOpen(false);
                        setNotificationsSearchQuery("");
                        window.dispatchEvent(new CustomEvent("arvdoul:notifications_search_query", { detail: "" }));
                      }}
                    />
                    <div className="flex-1 relative flex items-center">
                      <Search
                        className="w-4 h-4 absolute left-3 pointer-events-none"
                        style={{ color: tokens.iconSecondary }}
                      />
                      <input
                        ref={notificationsSearchInputRef}
                        aria-label="Search notifications and network"
                        type="text"
                        value={notificationsSearchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNotificationsSearchQuery(val);
                          window.dispatchEvent(new CustomEvent("arvdoul:notifications_search_query", { detail: val }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setNotificationsSearchOpen(false);
                            setNotificationsSearchQuery("");
                            window.dispatchEvent(new CustomEvent("arvdoul:notifications_search_query", { detail: "" }));
                          }
                        }}
                        placeholder="Search notifications, people, gifts..."
                        autoFocus
                        className="w-full h-10 sm:h-11 rounded-full pl-9 pr-9 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                        style={{
                          background: tokens.surface,
                          border: `1px solid ${tokens.border}`,
                          color: tokens.textPrimary,
                        }}
                      />
                      {notificationsSearchQuery && (
                        <button
                          type="button"
                          aria-label="Clear notification search"
                          onClick={() => {
                            setNotificationsSearchQuery("");
                            window.dispatchEvent(new CustomEvent("arvdoul:notifications_search_query", { detail: "" }));
                            notificationsSearchInputRef.current?.focus?.();
                          }}
                          className="absolute right-2.5 p-1 rounded-full opacity-75 hover:opacity-100"
                          style={{ color: tokens.iconSecondary }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <CircularButton
                      icon={SlidersHorizontal}
                      label="Filter notifications"
                      theme={theme}
                      active={notificationsHeaderState.filterActive}
                      onClick={() => window.dispatchEvent(new CustomEvent("arvdoul:notifications_toggle_filter", { detail: { source: "top_app_bar" } }))}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CircularButton
                        icon={ChevronLeft}
                        label="Back"
                        theme={theme}
                        onClick={handleBack}
                      />
                      <div className="flex flex-col min-w-0">
                        <h2
                          className="text-base sm:text-lg font-black truncate leading-tight tracking-tight"
                          style={{ color: tokens.textPrimary }}
                        >
                          Notifications
                        </h2>
                        <span
                          className="text-[11px] font-medium tabular-nums truncate"
                          style={{ color: tokens.textSecondary }}
                        >
                          {notificationsHeaderState.mainTab === "network"
                            ? notificationsHeaderState.pendingNetworkCount > 0
                              ? `${notificationsHeaderState.pendingNetworkCount} pending request${notificationsHeaderState.pendingNetworkCount === 1 ? "" : "s"}`
                              : "Network & Friends"
                            : notificationsHeaderState.unreadCount > 0
                              ? `${notificationsHeaderState.unreadCount} unread`
                              : "All caught up"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                      <CircularButton
                        icon={Search}
                        label="Search notifications"
                        theme={theme}
                        active={Boolean(notificationsSearchQuery)}
                        onClick={() => {
                          setNotificationsSearchOpen(true);
                          requestAnimationFrame(() => notificationsSearchInputRef.current?.focus?.());
                        }}
                      />
                      <CircularButton
                        icon={SlidersHorizontal}
                        label="Filter notifications"
                        theme={theme}
                        active={notificationsHeaderState.filterActive}
                        onClick={() => window.dispatchEvent(new CustomEvent("arvdoul:notifications_toggle_filter", { detail: { source: "top_app_bar" } }))}
                      />
                      <CircularButton
                        icon={CheckCircle2}
                        label="Mark all as read"
                        theme={theme}
                        onClick={() => window.dispatchEvent(new CustomEvent("arvdoul:notifications_mark_all_read", { detail: { source: "top_app_bar" } }))}
                      />
                      <div className="hidden sm:block">
                        <CircularButton
                          icon={Settings}
                          label="Notification settings"
                          theme={theme}
                          onClick={() => navigate("/settings")}
                        />
                      </div>
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
                )
              )}

              {currentMode === "network" && (
                networkSearchOpen ? (
                  <div className="flex items-center gap-2">
                    <CircularButton
                      icon={ChevronLeft}
                      label="Close network search"
                      theme={theme}
                      onClick={() => {
                        setNetworkSearchOpen(false);
                        setNetworkSearchQuery("");
                        window.dispatchEvent(new CustomEvent("arvdoul:network_search_query", { detail: "" }));
                      }}
                    />
                    <div className="flex-1 relative flex items-center">
                      <Search
                        className="w-4 h-4 absolute left-3 pointer-events-none"
                        style={{ color: tokens.iconSecondary }}
                      />
                      <input
                        ref={networkSearchInputRef}
                        aria-label="Search connections by name or handle"
                        type="text"
                        value={networkSearchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNetworkSearchQuery(val);
                          window.dispatchEvent(new CustomEvent("arvdoul:network_search_query", { detail: val }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setNetworkSearchOpen(false);
                            setNetworkSearchQuery("");
                            window.dispatchEvent(new CustomEvent("arvdoul:network_search_query", { detail: "" }));
                          }
                        }}
                        placeholder="Search citizens by name or handle..."
                        autoFocus
                        className="w-full h-10 sm:h-11 rounded-full pl-9 pr-9 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                        style={{
                          background: tokens.surface,
                          border: `1px solid ${tokens.border}`,
                          color: tokens.textPrimary,
                        }}
                      />
                      {networkSearchQuery && (
                        <button
                          type="button"
                          aria-label="Clear network search"
                          onClick={() => {
                            setNetworkSearchQuery("");
                            window.dispatchEvent(new CustomEvent("arvdoul:network_search_query", { detail: "" }));
                            networkSearchInputRef.current?.focus?.();
                          }}
                          className="absolute right-2.5 p-1 rounded-full opacity-75 hover:opacity-100"
                          style={{ color: tokens.iconSecondary }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <CircularButton
                      icon={RefreshCw}
                      label="Refresh network"
                      theme={theme}
                      onClick={() => window.dispatchEvent(new CustomEvent("arvdoul:network_refresh", { detail: { source: "top_app_bar" } }))}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CircularButton
                        icon={ChevronLeft}
                        label="Back"
                        theme={theme}
                        onClick={handleBack}
                      />
                      <div className="flex flex-col min-w-0">
                        <h2
                          className="text-base sm:text-lg font-black truncate leading-tight tracking-tight"
                          style={{ color: tokens.textPrimary }}
                        >
                          {networkHeaderState?.title || "Citizen Network"}
                        </h2>
                        <span
                          className="text-[11px] font-medium tabular-nums truncate"
                          style={{ color: tokens.textSecondary }}
                        >
                          {networkHeaderState?.subtitle || (
                            location.pathname.includes("/followers")
                              ? "Followers"
                              : location.pathname.includes("/following")
                                ? "Following"
                                : location.pathname.includes("/friends")
                                  ? "Mutual Friends"
                                  : "Affiliations & Citizens"
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                      <CircularButton
                        icon={Search}
                        label="Search connections"
                        theme={theme}
                        active={Boolean(networkSearchQuery)}
                        onClick={() => {
                          setNetworkSearchOpen(true);
                          requestAnimationFrame(() => networkSearchInputRef.current?.focus?.());
                        }}
                      />
                      <CircularButton
                        icon={RefreshCw}
                        label="Refresh network"
                        theme={theme}
                        onClick={() => window.dispatchEvent(new CustomEvent("arvdoul:network_refresh", { detail: { source: "top_app_bar" } }))}
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
                )
              )}

              {currentMode === "messages_inbox" && (
                inboxSearchOpen ? (
                  <div className="flex items-center gap-2">
                    <CircularButton
                      icon={ChevronLeft}
                      label="Close message search"
                      theme={theme}
                      onClick={() => {
                        setInboxSearchOpen(false);
                        setInboxSearchQuery("");
                        window.dispatchEvent(new CustomEvent("arvdoul:inbox_search_query", { detail: "" }));
                      }}
                    />
                    <div className="flex-1 relative flex items-center">
                      <Search
                        className="w-4 h-4 absolute left-3 pointer-events-none"
                        style={{ color: tokens.iconSecondary }}
                      />
                      <input
                        ref={inboxSearchInputRef}
                        aria-label="Search conversations"
                        type="text"
                        value={inboxSearchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setInboxSearchQuery(val);
                          window.dispatchEvent(new CustomEvent("arvdoul:inbox_search_query", { detail: val }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setInboxSearchOpen(false);
                            setInboxSearchQuery("");
                            window.dispatchEvent(new CustomEvent("arvdoul:inbox_search_query", { detail: "" }));
                          }
                        }}
                        placeholder="Search conversations, people, groups..."
                        autoFocus
                        className="w-full h-10 sm:h-11 rounded-full pl-9 pr-9 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                        style={{
                          background: tokens.surface,
                          border: `1px solid ${tokens.border}`,
                          color: tokens.textPrimary,
                        }}
                      />
                      {inboxSearchQuery && (
                        <button
                          type="button"
                          aria-label="Clear search"
                          onClick={() => {
                            setInboxSearchQuery("");
                            window.dispatchEvent(new CustomEvent("arvdoul:inbox_search_query", { detail: "" }));
                            inboxSearchInputRef.current?.focus?.();
                          }}
                          className="absolute right-2.5 p-1 rounded-full opacity-75 hover:opacity-100"
                          style={{ color: tokens.iconSecondary }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <CircularButton
                      icon={Plus}
                      label="New conversation"
                      theme={theme}
                      active
                      onClick={() => navigate("/messages/new")}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex flex-col min-w-0">
                        <h2
                          className="text-base sm:text-lg font-black truncate leading-tight tracking-tight"
                          style={{ color: tokens.textPrimary }}
                        >
                          Messages
                        </h2>
                        <span
                          className="text-[11px] font-medium tabular-nums truncate"
                          style={{ color: tokens.textSecondary }}
                        >
                          {inboxHeaderState.totalUnread > 0
                            ? `${inboxHeaderState.totalUnread} unread`
                            : `${inboxHeaderState.activeCount} conversation${inboxHeaderState.activeCount === 1 ? "" : "s"}`}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <CircularButton
                        icon={Search}
                        label="Search messages"
                        theme={theme}
                        onClick={() => {
                          setInboxSearchOpen(true);
                          requestAnimationFrame(() => inboxSearchInputRef.current?.focus?.());
                        }}
                      />
                      <CircularButton
                        icon={Plus}
                        label="New conversation"
                        theme={theme}
                        active
                        onClick={() => navigate("/messages/new")}
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
                )
              )}

              {currentMode === "stories" && (
                storiesSearchOpen ? (
                  <div className="flex items-center gap-2">
                    <CircularButton
                      icon={ChevronLeft}
                      label="Close Vibes search"
                      theme={theme}
                      onClick={() => {
                        setStoriesSearchOpen(false);
                        setStoriesSearchQuery("");
                        window.dispatchEvent(new CustomEvent("arvdoul:vibes_search_query", { detail: "" }));
                      }}
                    />
                    <div className="flex-1 relative flex items-center">
                      <Search
                        className="w-4 h-4 absolute left-3 pointer-events-none"
                        style={{ color: tokens.iconSecondary }}
                      />
                      <input
                        ref={storiesSearchInputRef}
                        aria-label="Search creators, vibes, or moments"
                        type="text"
                        value={storiesSearchQuery}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStoriesSearchQuery(val);
                          window.dispatchEvent(new CustomEvent("arvdoul:vibes_search_query", { detail: val }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setStoriesSearchOpen(false);
                            setStoriesSearchQuery("");
                            window.dispatchEvent(new CustomEvent("arvdoul:vibes_search_query", { detail: "" }));
                          }
                        }}
                        placeholder="Search creators, vibes, or moments..."
                        autoFocus
                        className="w-full h-10 sm:h-11 rounded-full pl-9 pr-9 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                        style={{
                          background: tokens.surface,
                          border: `1px solid ${tokens.border}`,
                          color: tokens.textPrimary,
                        }}
                      />
                      {storiesSearchQuery && (
                        <button
                          type="button"
                          aria-label="Clear Vibes search"
                          onClick={() => {
                            setStoriesSearchQuery("");
                            window.dispatchEvent(new CustomEvent("arvdoul:vibes_search_query", { detail: "" }));
                            storiesSearchInputRef.current?.focus?.();
                          }}
                          className="absolute right-2.5 p-1 rounded-full opacity-75 hover:opacity-100"
                          style={{ color: tokens.iconSecondary }}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <CircularButton
                      icon={Camera}
                      label="Create Vibe"
                      theme={theme}
                      active
                      onClick={() => navigate("/create-story")}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                        window.dispatchEvent(new CustomEvent("arvdoul:vibes_refresh", { detail: { source: "top_app_bar" } }));
                      }}
                      className="flex items-center gap-2.5 min-w-0 text-left focus:outline-none group"
                    >
                      <ArvdoulEmblem
                        size={32}
                        theme={theme}
                        animate={false}
                        showPlate={false}
                        className="group-hover:scale-105 transition-transform shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <h2
                          className="text-base sm:text-lg font-black truncate leading-tight tracking-tight"
                          style={{ color: tokens.textPrimary }}
                        >
                          Vibes
                        </h2>
                        <BrandBaseline visible={!isHidden} gradient={tokens.brandLine} />
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="hidden sm:block">
                        <CircularButton
                          icon={RefreshCw}
                          label="Refresh Vibes"
                          theme={theme}
                          onClick={() => window.dispatchEvent(new CustomEvent("arvdoul:vibes_refresh", { detail: { source: "top_app_bar" } }))}
                        />
                      </div>
                      <CircularButton
                        icon={Search}
                        label="Search Vibes"
                        theme={theme}
                        onClick={() => {
                          setStoriesSearchOpen(true);
                          requestAnimationFrame(() => storiesSearchInputRef.current?.focus?.());
                        }}
                      />
                      <CircularButton
                        icon={Camera}
                        label="Create Vibe"
                        theme={theme}
                        active
                        onClick={() => navigate("/create-story")}
                      />
                      <CircularButton
                        icon={Calendar}
                        label="Vibe memories archive"
                        theme={theme}
                        onClick={() => window.dispatchEvent(new CustomEvent("arvdoul:vibes_open_archive", { detail: { source: "top_app_bar" } }))}
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
                )
              )}

              {currentMode === "messages_chat" && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <CircularButton
                      icon={ChevronLeft}
                      label="Back to messages"
                      theme={theme}
                      onClick={() => navigate("/messages")}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (chatHeaderState?.isDirect && chatHeaderState?.peerId) {
                          navigate(`/profile/${chatHeaderState.peerId}`);
                        } else if (chatHeaderState?.conversationId) {
                          window.dispatchEvent(
                            new CustomEvent("arvdoul:chat_action", {
                              detail: { action: "open_info", conversationId: chatHeaderState.conversationId },
                            })
                          );
                        }
                      }}
                      className="flex items-center gap-2 min-w-0 text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple"
                    >
                      <div className={cn("relative shrink-0 rounded-full", chatHeaderState?.hasVibe && "p-[2px]")} style={chatHeaderState?.hasVibe ? { background: BRAND_GRADIENT } : undefined}>
                        {chatHeaderState?.avatar ? (
                          <LazyImage
                            src={chatHeaderState.avatar}
                            alt={chatHeaderState.title || "Conversation"}
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-white/10"
                          />
                        ) : (
                          <div
                            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ background: BRAND_GRADIENT }}
                          >
                            {(chatHeaderState?.title || "C").charAt(0).toUpperCase()}
                          </div>
                        )}
                        {chatHeaderState?.isOnline && (
                          <span
                            className={cn(
                              "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2",
                              isDark ? "ring-[#03071B]" : "ring-white"
                            )}
                            aria-label="Online"
                          />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                          <span
                            className="text-sm sm:text-base font-bold truncate leading-tight"
                            style={{ color: tokens.textPrimary }}
                          >
                            {resolveActorName([chatHeaderState?.title, contextualTitle], chatHeaderState?.peerId || chatHeaderState?.conversationId)}
                          </span>
                          {chatHeaderState?.verified && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" aria-hidden="true" />
                          )}
                          {chatHeaderState?.level ? (
                            <span className="hidden sm:inline text-[11px] font-semibold text-purple-400 tabular-nums shrink-0">
                              · Lv.{chatHeaderState.level}
                            </span>
                          ) : null}
                        </div>
                        <span
                          className={cn(
                            "text-[11px] truncate leading-tight",
                            chatHeaderState?.isTyping ? "text-purple-400 font-semibold" : ""
                          )}
                          style={chatHeaderState?.isTyping ? undefined : { color: tokens.textSecondary }}
                        >
                          {chatHeaderState?.subtitle || "Active conversation"}
                        </span>
                      </div>
                    </button>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                    {chatHeaderState?.conversationId && (
                      <>
                        <CircularButton
                          icon={Phone}
                          label="Voice call"
                          theme={theme}
                          onClick={() => navigate(`/call/${chatHeaderState.conversationId}?type=audio`)}
                        />
                        <CircularButton
                          icon={Video}
                          label="Video call"
                          theme={theme}
                          onClick={() => navigate(`/call/${chatHeaderState.conversationId}?type=video`)}
                        />
                        {chatHeaderState?.isDirect && chatHeaderState?.peerId && (
                          <CircularButton
                            icon={Gift}
                            label="Send gift"
                            theme={theme}
                            onClick={() => navigate(`/gift/${chatHeaderState.peerId}`)}
                          />
                        )}
                        <CircularButton
                          icon={Info}
                          label="Conversation details"
                          theme={theme}
                          onClick={() => {
                            window.dispatchEvent(
                              new CustomEvent("arvdoul:chat_action", {
                                detail: { action: "open_info", conversationId: chatHeaderState.conversationId },
                              })
                            );
                          }}
                        />
                      </>
                    )}
                    <div className="hidden sm:block">
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
                </div>
              )}

              {currentMode === "profile_me" && (
                <div className="flex items-center justify-between gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (scrollContainerRef?.current) {
                        scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
                      } else {
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                    className="flex items-center gap-2 text-left select-none min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-arvdoul-purple rounded-lg px-1 py-0.5"
                  >
                    <h2
                      className="text-base sm:text-lg font-black truncate leading-tight tracking-tight"
                      style={{ color: tokens.textPrimary }}
                    >
                      Profile
                    </h2>
                  </button>

                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <CircularButton
                      icon={QrCode}
                      label="Identity QR Code"
                      theme={theme}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('arvdoul:open_qr_code'));
                      }}
                    />
                    <CircularButton
                      icon={Share2}
                      label="Share Profile"
                      theme={theme}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('arvdoul:share_profile'));
                      }}
                    />
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

              {currentMode === "profile_visitor" && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CircularButton
                      icon={ChevronLeft}
                      label="Back"
                      theme={theme}
                      onClick={handleBack}
                    />
                    <h2
                      className="text-base sm:text-lg font-black truncate leading-tight tracking-tight"
                      style={{ color: tokens.textPrimary }}
                    >
                      Profile
                    </h2>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <CircularButton
                      icon={QrCode}
                      label="Citizen QR Code"
                      theme={theme}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('arvdoul:open_qr_code'));
                      }}
                    />
                    <CircularButton
                      icon={Share2}
                      label="Share Profile"
                      theme={theme}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('arvdoul:share_profile'));
                      }}
                    />
                    <CircularButton
                      icon={MoreVertical}
                      label="Profile Options"
                      theme={theme}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('arvdoul:open_profile_options'));
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
                    <div className="flex flex-col min-w-0">
                      <span
                        className="text-sm sm:text-base font-bold truncate leading-tight"
                        style={{ color: tokens.textPrimary }}
                      >
                        {contextualTitle}
                      </span>
                      <span
                        className="text-[11px] font-medium truncate"
                        style={{ color: tokens.textSecondary }}
                      >
                        {propSubtitle || "Details"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <CircularButton
                      icon={Share2}
                      label="Share"
                      theme={theme}
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('arvdoul:share_profile'));
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
                    <input aria-label="Search Arvdoul posts, creators, tags..."
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
                        type="button"
                        aria-label="Clear search"
                        onClick={() => {
                          setSearchQuery("");
                          onSearch?.("");
                          window.dispatchEvent(new CustomEvent("arvdoul:search_query", { detail: "" }));
                        }}
                        className="absolute right-2.5 p-1 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
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
                    ? "bg-red-950/85 text-red-200 border-red-500/40 shadow-red-950/40 cursor-pointer hover:bg-red-900/90 active:scale-95 transition-all"
                    : syncSuccess
                    ? "bg-emerald-950/85 text-emerald-200 border-emerald-500/40 shadow-emerald-950/40"
                    : "bg-[#090F2D]/95 text-slate-100 border-white/15 shadow-black/40"
                )}
                onClick={() => {
                  if (!isOnline) {
                    navigate('/offline');
                  }
                }}
              >
                {!isOnline ? (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-red-400" />
                    <span>
                      Offline Mode ·{" "}
                      {pendingCount > 0 ? `${pendingCount} saved` : "Viewing cache"}
                    </span>
                    <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded-full bg-white/10 hover:bg-white/20">Inspect →</span>
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
        className="shrink-0"
        style={{
          height: "calc(72px + env(safe-area-inset-top))",
        }}
      />
    </>
  );
};

export default memo(TopAppBar);