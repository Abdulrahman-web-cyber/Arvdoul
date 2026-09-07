import React, {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, Home, MessageCircle, PlayCircle, UserPlus } from "lucide-react";
import { useTheme } from "@context/ThemeContext";
import { useSound } from "../../hooks/useSound";
import { useAnalytics } from "../../hooks/useAnalytics";
import { useAppStore } from "../../store/appStore";
import QuickAccessPanel from "./QuickAccessPanel";

/* ==========================================================================
   ARVDOUL BOTTOM NAVIGATION
   ========================================================================== */

const BRAND_GRADIENT =
  "linear-gradient(135deg,#8B1EF3 0%,#4431F7 52%,#055BFB 100%)";
const BRAND_LINE =
  "linear-gradient(90deg,#C82BFF 0%,#8B1EF3 34%,#4431F7 66%,#0088FF 100%)";
const MAX_WIDTH = 1320;
const NAV_HEIGHT = 82;
const HANDLE_LONG_PRESS_MS = 560;
const HANDLE_MOVE_THRESHOLD = 9;
const NAVIGATION_LOCK_MS = 180;

const SCROLL_HIDE_THRESHOLD = 30;
const SCROLL_SHOW_THRESHOLD = 15;
const SCROLL_TOP_REVEAL_OFFSET = 40;

const MOTION = Object.freeze({
  membrane: { type: "spring", stiffness: 390, damping: 32, mass: 0.72 },
  keyboard: { type: "spring", stiffness: 430, damping: 36, mass: 0.72 },
  indicator: { type: "spring", stiffness: 560, damping: 30, mass: 0.48 },
  press: { type: "spring", stiffness: 520, damping: 30, mass: 0.45 },
});

const NAVIGATION_PATHS = Object.freeze({
  home: "/home",
  videos: "/videos",
  messages: "/messages",
  createPost: "/create-post",
  requests: "/network",
  coins: "/coins",
  notifications: "/notifications",
});

const NAV_ITEMS = Object.freeze([
  {
    id: "home",
    label: "Home",
    path: NAVIGATION_PATHS.home,
    icon: "home",
    matchPaths: ["/", "/home/*"],
  },
  {
    id: "sparks",
    label: "Sparks",
    path: NAVIGATION_PATHS.videos,
    icon: "sparks",
    matchPaths: ["/videos/*", "/sparks/*"],
  },
  {
    id: "chat",
    label: "Chat",
    path: NAVIGATION_PATHS.messages,
    icon: "chat",
    matchPaths: ["/messages/*", "/chat/*"],
    badgeKey: "messages",
  },
  {
    id: "create",
    label: "Create",
    path: NAVIGATION_PATHS.createPost,
    isCreate: true,
  },
  {
    id: "network",
    label: "Network",
    path: NAVIGATION_PATHS.requests,
    icon: "network",
    matchPaths: ["/network/*", "/requests/*"],
    badgeKey: "network",
  },
  {
    id: "coins",
    label: "Coins",
    path: NAVIGATION_PATHS.coins,
    icon: "coins",
    matchPaths: ["/coins/*"],
  },
  {
    id: "alerts",
    label: "Alerts",
    path: NAVIGATION_PATHS.notifications,
    icon: "alerts",
    matchPaths: ["/notifications/*", "/alerts/*"],
    badgeKey: "notifications",
  },
]);

/* ==========================================================================
   HELPERS
   ========================================================================== */

const isDarkTheme = (theme) =>
  theme === "dark" ||
  theme?.mode === "dark" ||
  theme?.isDark === true;

const normalizeCount = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.floor(number);
};

const formatBadge = (value) => {
  const count = normalizeCount(value);
  return count > 99 ? "99+" : String(count);
};

const formatCoins = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "0";
  if (amount < 1000) return Math.floor(amount).toLocaleString();
  if (amount < 1_000_000)
    return `${(amount / 1000).toFixed(amount >= 10_000 ? 0 : 1)}K`;
  if (amount < 1_000_000_000)
    return `${(amount / 1_000_000).toFixed(amount >= 10_000_000 ? 0 : 1)}M`;
  return `${(amount / 1_000_000_000).toFixed(1)}B`;
};

const pathMatches = (pathname, patterns = []) =>
  patterns.some((pattern) => {
    if (pattern === "/") return pathname === "/";
    const normalizedPattern = pattern.replace("/*", "");
    return (
      pathname === normalizedPattern ||
      pathname.startsWith(`${normalizedPattern}/`)
    );
  });

/* ==========================================================================
   BADGE
   ========================================================================== */

const NavBadge = memo(function NavBadge({ count, dark, reducedMotion }) {
  if (!count || count <= 0) return null;

  return (
    <motion.span
      initial={reducedMotion ? false : { opacity: 0, scale: 0.72 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 28, mass: 0.45 }}
      className="
        absolute -right-[6px] -top-[6px] z-30 flex min-h-[20px] min-w-[20px]
        items-center justify-center rounded-full px-[5px] text-[9px] font-bold
        leading-none text-white border
      "
      style={{
        background: "linear-gradient(135deg,#FF375F 0%,#F43F5E 55%,#E11D48 100%)",
        borderColor: dark ? "rgba(255,255,255,.24)" : "rgba(255,255,255,.9)",
        boxShadow: dark
          ? "0 4px 10px rgba(0,0,0,.28),inset 0 1px 1px rgba(255,255,255,.28)"
          : "0 3px 8px rgba(15,23,42,.14),inset 0 1px 1px rgba(255,255,255,.48)",
      }}
      aria-label={`${formatBadge(count)} unread`}
    >
      {formatBadge(count)}
    </motion.span>
  );
});

NavBadge.propTypes = {
  count: PropTypes.number,
  dark: PropTypes.bool.isRequired,
  reducedMotion: PropTypes.bool.isRequired,
};

/* ==========================================================================
   ICONS
   ========================================================================== */

const HomeIcon = memo(function HomeIcon({ active }) {
  const id = useId().replace(/:/g, "");
  const gradientId = `arvdoul-home-gradient-${id}`;

  return (
    <svg viewBox="0 0 32 32" width="26" height="26" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="7" y1="4" x2="26" y2="29" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C82BFF" />
          <stop offset=".48" stopColor="#8B1EF3" />
          <stop offset="1" stopColor="#055BFB" />
        </linearGradient>
      </defs>
      <path
        d="M4.8 14.1 16 4.5l11.2 9.6v12.2c0 .94-.76 1.7-1.7 1.7h-7.1v-8.2h-4.8V28H6.5a1.7 1.7 0 0 1-1.7-1.7V14.1Z"
        fill={active ? `url(#${gradientId})` : "none"}
        stroke={active ? `url(#${gradientId})` : "currentColor"}
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <path
        d="M4.8 14.1 16 4.5l11.2 9.6"
        stroke={active ? `url(#${gradientId})` : "currentColor"}
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {!active && (
        <path d="M12.1 28v-8.2h7.8V28" stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round" />
      )}
    </svg>
  );
});
HomeIcon.propTypes = { active: PropTypes.bool.isRequired };

const SparksIcon = memo(function SparksIcon() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" fill="none" aria-hidden="true">
      <path
        d="M18.2 3.5 7.5 17.8h6.2l-1.9 10.7L22.5 13.9h-6.2l1.9-10.4Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
});

const ChatIcon = memo(function ChatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
      className="w-[26px] h-[26px]"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
      />
    </svg>
  );
});

const NetworkIcon = memo(function NetworkIcon() {
  return (
    <svg viewBox="0 0 36 32" width="27" height="26" fill="none" aria-hidden="true">
      <circle cx="13" cy="10" r="5.3" stroke="currentColor" strokeWidth="1.65" />
      <path d="M3.8 26.6c.7-5.3 4.15-8.15 9.2-8.15s8.5 2.85 9.2 8.15" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" />
      <circle cx="26.1" cy="11.45" r="4.25" stroke="currentColor" strokeWidth="1.45" strokeOpacity=".86" />
      <path d="M22.8 19.6c4.45-.15 7.65 2.15 8.9 6.3" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" strokeOpacity=".86" />
    </svg>
  );
});

const AlertsIcon = memo(function AlertsIcon() {
  return (
    <svg viewBox="0 0 32 32" width="26" height="26" fill="none" aria-hidden="true">
      <path
        d="M7.15 22.9h17.7c-1.55-1.85-2.3-4.05-2.3-6.95v-2.3a6.55 6.55 0 0 0-13.1 0v2.3c0 2.9-.75 5.1-2.3 6.95Z"
        stroke="currentColor" strokeWidth="1.65" strokeLinejoin="round"
      />
      <path d="M13.15 26.15c.65.95 1.6 1.4 2.85 1.4s2.2-.45 2.85-1.4" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" />
      <path d="M16 5.1V3.55" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeOpacity=".68" />
    </svg>
  );
});

/* ==========================================================================
   COINS ICON – Enhanced Gold Version (using provided SVG with gradients)
   ========================================================================== */

const CoinsIcon = memo(function CoinsIcon() {
  const id = useId().replace(/:/g, "");
  const goldGradient = `arvdoul-gold-${id}`;
  const darkGoldGradient = `arvdoul-dark-gold-${id}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="w-[27px] h-[27px]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={goldGradient} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFF9C4" />
          <stop offset="30%" stopColor="#FFD700" />
          <stop offset="70%" stopColor="#F5A623" />
          <stop offset="100%" stopColor="#D4AF37" />
        </linearGradient>
        <linearGradient id={darkGoldGradient} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#B8860B" />
          <stop offset="50%" stopColor="#DAA520" />
          <stop offset="100%" stopColor="#8B6914" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${goldGradient})`}
        d="M21 6.375c0 2.692-4.03 4.875-9 4.875S3 9.067 3 6.375 7.03 1.5 12 1.5s9 2.183 9 4.875Z"
      />
      <path
        fill={`url(#${goldGradient})`}
        d="M12 12.75c2.685 0 5.19-.586 7.078-1.609a8.283 8.283 0 0 0 1.897-1.384c.016.121.025.244.025.368C21 12.817 16.97 15 12 15s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.285 8.285 0 0 0 1.897 1.384C6.809 12.164 9.315 12.75 12 12.75Z"
      />
      <path
        fill={`url(#${darkGoldGradient})`}
        d="M12 16.5c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 0 0 1.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 0 0 1.897 1.384C6.809 15.914 9.315 16.5 12 16.5Z"
      />
      <path
        fill={`url(#${goldGradient})`}
        d="M12 20.25c2.685 0 5.19-.586 7.078-1.609a8.282 8.282 0 0 0 1.897-1.384c.016.121.025.244.025.368 0 2.692-4.03 4.875-9 4.875s-9-2.183-9-4.875c0-.124.009-.247.025-.368a8.284 8.284 0 0 0 1.897 1.384C6.809 19.664 9.315 20.25 12 20.25Z"
      />
    </svg>
  );
});

const NavigationIcon = memo(function NavigationIcon({ type, active, dark }) {
  const iconClass = active
    ? dark ? "text-[#B978FF]" : "text-[#6D22D9]"
    : dark ? "text-white/[0.86]" : "text-[#111827]/[0.82]";

  if (type === "home") return <span className={iconClass}><HomeIcon active={active} /></span>;
  if (type === "sparks") return <span className={iconClass}><SparksIcon /></span>;
  if (type === "chat") return <span className={iconClass}><ChatIcon /></span>;
  if (type === "network") return <span className={iconClass}><NetworkIcon /></span>;
  if (type === "coins") return <CoinsIcon />; // gold always
  if (type === "alerts") return <span className={iconClass}><AlertsIcon /></span>;
  return null;
});

NavigationIcon.propTypes = {
  type: PropTypes.string.isRequired,
  active: PropTypes.bool.isRequired,
  dark: PropTypes.bool.isRequired,
};

/* ==========================================================================
   NAVIGATION ITEM
   ========================================================================== */

const NavigationItem = memo(function NavigationItem({
  item,
  active,
  badgeCount,
  coinBalance,
  dark,
  reducedMotion,
  onNavigate,
}) {
  const handleClick = useCallback(() => {
    onNavigate(item.path, item.id);
  }, [item.id, item.path, onNavigate]);

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      whileTap={reducedMotion ? undefined : { scale: 0.975 }}
      transition={MOTION.press}
      className="
        relative flex h-[82px] min-w-0 flex-1 touch-manipulation flex-col items-center
        justify-start overflow-visible rounded-[20px] px-0 pt-[9px] outline-none
        focus-visible:ring-2 focus-visible:ring-[#8B1EF3]/70
      "
    >
      {active && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[13px] h-[38px] w-[62px] -translate-x-1/2 rounded-full"
          style={{
            background: dark
              ? "radial-gradient(circle,rgba(139,30,243,.08),transparent 72%)"
              : "radial-gradient(circle,rgba(139,30,243,.065),transparent 72%)",
          }}
        />
      )}

      <span className="relative z-10 flex h-[34px] w-[48px] shrink-0 items-center justify-center">
        <NavigationIcon type={item.icon} active={active} dark={dark} />
        <NavBadge count={badgeCount} dark={dark} reducedMotion={Boolean(reducedMotion)} />
      </span>

      {item.id === "coins" && (
        <span
          className={[
            "relative z-10 -mt-[1px] h-[10px] whitespace-nowrap text-[9px] font-bold leading-[10px]",
            dark ? "text-[#FFD34E]" : "text-[#D88900]",
          ].join(" ")}
          aria-hidden="true"
        >
          {formatCoins(coinBalance)}
        </span>
      )}

      <span
        className={[
          "relative z-10 flex h-[17px] shrink-0 items-start justify-center whitespace-nowrap px-[2px] text-[11px] leading-[17px]",
          item.id === "coins" ? "mt-[5px]" : "mt-[8px]",
          active ? "font-semibold" : "font-medium",
          active
            ? dark ? "text-white" : "text-[#111827]"
            : dark ? "text-white/[0.72]" : "text-[#111827]/[0.72]",
        ].join(" ")}
      >
        {item.label}
      </span>

      <span className="relative z-10 mt-[2px] flex h-[3px] w-full shrink-0 items-center justify-center">
        {active && (
          <motion.span
            transition={MOTION.indicator}
            aria-hidden="true"
            className="block h-[3px] w-[30px] rounded-full"
            style={{ background: BRAND_GRADIENT }}
          />
        )}
      </span>
    </motion.button>
  );
});

NavigationItem.propTypes = {
  item: PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    path: PropTypes.string.isRequired,
    icon: PropTypes.string,
  }).isRequired,
  active: PropTypes.bool.isRequired,
  badgeCount: PropTypes.number,
  coinBalance: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  dark: PropTypes.bool.isRequired,
  reducedMotion: PropTypes.bool.isRequired,
  onNavigate: PropTypes.func.isRequired,
};

/* ==========================================================================
   CREATE CONTROL – perfectly centered, three layers, no movement
   ========================================================================== */

const CreateControl = memo(function CreateControl({ dark, reducedMotion, onCreate }) {
  const buttonTop = 12;
  const buttonSize = 58;
  const ring1Size = 68;
  const ring1Top = buttonTop - (ring1Size - buttonSize) / 2; // 7px
  const ring2Size = 78;
  const ring2Top = buttonTop - (ring2Size - buttonSize) / 2; // 2px

  return (
    <div className="relative flex h-[82px] w-full items-start justify-center">
      {/* Outer ring (layer 1) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 z-[2] -translate-x-1/2 rounded-full border"
        style={{
          width: `${ring2Size}px`,
          height: `${ring2Size}px`,
          top: `${ring2Top}px`,
          borderColor: dark ? "rgba(255,255,255,.28)" : "rgba(255,255,255,1)",
          boxShadow: dark
            ? "0 0 0 1px rgba(255,255,255,.08), inset 0 1px 0 rgba(255,255,255,.2), inset 0 -1px 0 rgba(0,0,0,.2)"
            : "0 0 0 1px rgba(255,255,255,.6), inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(0,0,0,.05)",
        }}
      />

      {/* Inner ring (layer 2) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 z-[3] -translate-x-1/2 rounded-full border"
        style={{
          width: `${ring1Size}px`,
          height: `${ring1Size}px`,
          top: `${ring1Top}px`,
          borderColor: dark ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.95)",
          boxShadow: dark
            ? "inset 0 1px 0 rgba(255,255,255,.15)"
            : "inset 0 1px 0 rgba(255,255,255,.9)",
        }}
      />

      {/* Plus button (layer 3) – no movement */}
      <button
        type="button"
        aria-label="Create post"
        onClick={onCreate}
        className="absolute left-1/2 z-30 flex -translate-x-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/90 origin-center"
        style={{
          width: `${buttonSize}px`,
          height: `${buttonSize}px`,
          top: `${buttonTop}px`,
          background: BRAND_GRADIENT,
          border: dark ? "1px solid rgba(255,255,255,.5)" : "1px solid rgba(255,255,255,1)",
          boxShadow: dark
            ? "0 12px 28px rgba(0,0,0,.35), inset 0 1px 1px rgba(255,255,255,.6), inset 0 -5px 10px rgba(0,0,0,.15)"
            : "0 12px 28px rgba(17,24,39,.18), inset 0 1px 1px rgba(255,255,255,.9), inset 0 -5px 10px rgba(0,0,0,.08)",
        }}
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[2px] rounded-full"
          style={{
            background: "linear-gradient(145deg,rgba(255,255,255,.3) 0%,transparent 40%,rgba(0,0,0,.1) 100%)",
          }}
        />
        <svg viewBox="0 0 32 32" width="32" height="32" fill="none" aria-hidden="true" className="relative z-10">
          <path d="M16 6v20M6 16h20" stroke="white" strokeWidth="2.25" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
});

CreateControl.propTypes = {
  dark: PropTypes.bool.isRequired,
  reducedMotion: PropTypes.bool.isRequired,
  onCreate: PropTypes.func.isRequired,
};

/* ==========================================================================
   PERSISTENT HANDLE – simple line, reliable click area
   ========================================================================== */

const NavigationHandle = memo(function NavigationHandle({
  dark,
  reducedMotion,
  navigationVisible,
  onToggleNavigation,
  onOpenQuickAccess,
}) {
  const handleRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const pointerRef = useRef({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    moved: false,
    longPressed: false,
  });
  const suppressClickRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const resetPointer = useCallback(() => {
    clearTimer();
    pointerRef.current = {
      active: false,
      pointerId: null,
      startX: 0,
      startY: 0,
      moved: false,
      longPressed: false,
    };
  }, [clearTimer]);

  const handlePointerDown = useCallback(
    (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      clearTimer();
      const state = pointerRef.current;
      state.active = true;
      state.pointerId = event.pointerId;
      state.startX = event.clientX;
      state.startY = event.clientY;
      state.moved = false;
      state.longPressed = false;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {}
      longPressTimerRef.current = window.setTimeout(() => {
        const current = pointerRef.current;
        if (!current.active || current.moved) return;
        current.longPressed = true;
        suppressClickRef.current = true;
        onOpenQuickAccess();
      }, HANDLE_LONG_PRESS_MS);
    },
    [clearTimer, onOpenQuickAccess]
  );

  const handlePointerMove = useCallback(
    (event) => {
      const state = pointerRef.current;
      if (!state.active || state.pointerId !== event.pointerId) return;
      const dx = event.clientX - state.startX;
      const dy = event.clientY - state.startY;
      if (Math.hypot(dx, dy) >= HANDLE_MOVE_THRESHOLD) {
        state.moved = true;
        clearTimer();
      }
    },
    [clearTimer]
  );

  const handlePointerUp = useCallback(
    (event) => {
      const state = pointerRef.current;
      if (!state.active || state.pointerId !== event.pointerId) return;
      const wasLongPressed = state.longPressed;
      clearTimer();
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {}
      resetPointer();
      if (wasLongPressed) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        return;
      }
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      onToggleNavigation();
    },
    [clearTimer, onToggleNavigation, resetPointer]
  );

  const handlePointerCancel = useCallback(() => {
    resetPointer();
  }, [resetPointer]);

  const handleClick = useCallback(
    (event) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      onToggleNavigation();
    },
    [onToggleNavigation]
  );

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  return (
    <button
      ref={handleRef}
      type="button"
      aria-label={
        navigationVisible
          ? "Hide bottom navigation. Long press for quick access."
          : "Show bottom navigation. Long press for quick access."
      }
      aria-expanded={navigationVisible}
      aria-controls="arvdoul-bottom-navigation"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      className="
        absolute left-1/2 top-[-25px] z-[100] flex h-[30px] w-[72px] -translate-x-1/2
        touch-none items-center justify-center rounded-full outline-none
        focus-visible:ring-2 focus-visible:ring-[#8B1EF3]/80 pointer-events-auto
        bg-transparent border-0 p-0
      "
    >
      <span
        aria-hidden="true"
        className="h-[4px] w-[39px] rounded-full"
        style={{ background: BRAND_LINE }}
      />
    </button>
  );
});

NavigationHandle.propTypes = {
  dark: PropTypes.bool.isRequired,
  reducedMotion: PropTypes.bool.isRequired,
  navigationVisible: PropTypes.bool.isRequired,
  onToggleNavigation: PropTypes.func.isRequired,
  onOpenQuickAccess: PropTypes.func.isRequired,
};

/* ==========================================================================
   BOTTOM NAV
   ========================================================================== */

function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme: themeMode } = useTheme();
  const { playSound } = useSound();
  const { trackEvent } = useAnalytics();

  const currentUser = useAppStore((state) => state.currentUser);
  const unreadCounts = useAppStore((state) => state.unreadCounts);

  const reducedMotion = useReducedMotion();
  const dark = isDarkTheme(themeMode);

  const [visible, setVisible] = useState(true);
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const ignoreScrollRef = useRef(false);
  const navigationLockRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const accumulatedScrollRef = useRef(0);
  const directionRef = useRef(null);
  const scrollFrameRef = useRef(null);

  /* ------------------------------------------------------------------------
     Scroll-aware visibility (state machine)
     ------------------------------------------------------------------------ */

  useEffect(() => {
    lastScrollYRef.current = window.scrollY || 0;
    accumulatedScrollRef.current = 0;
    directionRef.current = null;

    const handleScroll = () => {
      if (scrollFrameRef.current !== null) return;
      if (ignoreScrollRef.current) return;

      scrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollFrameRef.current = null;
        const currentY = Math.max(window.scrollY || 0, 0);
        const delta = currentY - lastScrollYRef.current;
        lastScrollYRef.current = currentY;

        if (quickAccessOpen) {
          accumulatedScrollRef.current = 0;
          directionRef.current = null;
          setVisible(false);
          return;
        }

        if (currentY <= SCROLL_TOP_REVEAL_OFFSET) {
          accumulatedScrollRef.current = 0;
          directionRef.current = null;
          setVisible(true);
          return;
        }

        if (Math.abs(delta) < 1) return;
        const newDirection = delta > 0 ? "down" : "up";

        if (directionRef.current !== newDirection) {
          directionRef.current = newDirection;
          accumulatedScrollRef.current = 0;
        }

        accumulatedScrollRef.current += Math.abs(delta);

        if (newDirection === "down" && accumulatedScrollRef.current >= SCROLL_HIDE_THRESHOLD) {
          accumulatedScrollRef.current = 0;
          setVisible(false);
        } else if (newDirection === "up" && accumulatedScrollRef.current >= SCROLL_SHOW_THRESHOLD) {
          accumulatedScrollRef.current = 0;
          setVisible(true);
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [quickAccessOpen]);

  /* ------------------------------------------------------------------------
     Toggle navigation (manual, ignores scroll for 300ms)
     ------------------------------------------------------------------------ */

  const toggleNavigation = useCallback(() => {
    setVisible((prev) => !prev);
    ignoreScrollRef.current = true;
    window.setTimeout(() => {
      ignoreScrollRef.current = false;
    }, 300);
  }, []);

  /* ------------------------------------------------------------------------
     Quick Access handlers
     ------------------------------------------------------------------------ */

  const closeQuickAccess = useCallback(() => {
    setQuickAccessOpen(false);
    // After closing, show nav if near top, otherwise let scroll decide
    window.setTimeout(() => {
      if ((window.scrollY || 0) <= SCROLL_TOP_REVEAL_OFFSET) {
        setVisible(true);
      }
    }, 0);
  }, []);

  const openQuickAccess = useCallback(() => {
    setQuickAccessOpen(true);
    // Nav will hide automatically due to effect
    try { playSound?.("navigation"); } catch {}
    try { trackEvent?.("quick_access_open", { source: "bottom_navigation_handle", interaction: "long_press" }); } catch {}
  }, [playSound, trackEvent]);

  /* ------------------------------------------------------------------------
     Navigation handlers
     ------------------------------------------------------------------------ */

  const openCreate = useCallback(() => {
    if (navigationLockRef.current) return;
    navigationLockRef.current = true;
    window.setTimeout(() => {
      navigationLockRef.current = false;
    }, NAVIGATION_LOCK_MS);

    try { playSound?.("create"); } catch {}
    try { trackEvent?.("bottom_nav_create_open", { destination: NAVIGATION_PATHS.createPost, source: "bottom_navigation" }); } catch {}

    closeQuickAccess();
    navigate(NAVIGATION_PATHS.createPost);
  }, [closeQuickAccess, navigate, playSound, trackEvent]);

  const navigateTo = useCallback(
    (path, destination) => {
      if (navigationLockRef.current) return;
      navigationLockRef.current = true;
      window.setTimeout(() => {
        navigationLockRef.current = false;
      }, NAVIGATION_LOCK_MS);

      try { playSound?.("navigation"); } catch {}
      try { trackEvent?.("bottom_nav_navigation", { destination, path, source: "bottom_navigation" }); } catch {}

      closeQuickAccess();

      if (destination === "home" && location.pathname === path) {
        window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
        return;
      }
      navigate(path);
    },
    [closeQuickAccess, location.pathname, navigate, playSound, reducedMotion, trackEvent]
  );

  const navigateToWithLoading = useCallback(
    (path) => {
      try { playSound?.("navigation"); } catch {}
      try { trackEvent?.("Navigation_With_Loading", { path, source: "bottom_navigation_quick_access" }); } catch {}

      closeQuickAccess();
      navigate(path);
    },
    [closeQuickAccess, navigate, playSound, trackEvent]
  );

  /* ------------------------------------------------------------------------
     Keyboard / visual viewport
     ------------------------------------------------------------------------ */

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return undefined;

    const updateKeyboardOffset = () => {
      const difference = window.innerHeight - viewport.height;
      const nextOffset = difference > 120 ? Math.min(difference, 420) : 0;
      setKeyboardOffset(nextOffset);
    };

    updateKeyboardOffset();
    viewport.addEventListener("resize", updateKeyboardOffset);
    viewport.addEventListener("scroll", updateKeyboardOffset);

    return () => {
      viewport.removeEventListener("resize", updateKeyboardOffset);
      viewport.removeEventListener("scroll", updateKeyboardOffset);
    };
  }, []);

  /* ------------------------------------------------------------------------
     Escape closes Quick Access
     ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!quickAccessOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        closeQuickAccess();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeQuickAccess, quickAccessOpen]);

  /* ------------------------------------------------------------------------
     Dynamic badges and balance
     ------------------------------------------------------------------------ */

  const badges = useMemo(() => {
    const counts = unreadCounts || {};
    return {
      messages: normalizeCount(
        counts.messages ?? counts.message ?? counts.chat ?? counts.messagesUnread
      ),
      network: normalizeCount(
        counts.network ?? counts.requests ?? counts.friendRequests ?? counts.networkRequests
      ),
      notifications: normalizeCount(
        counts.notifications ?? counts.notification ?? counts.alerts ?? counts.notificationsUnread
      ),
    };
  }, [unreadCounts]);

  const coinBalance = currentUser?.coins ?? 0;

  const activeId = useMemo(() => {
    const pathname = location.pathname;
    const activeItem = NAV_ITEMS.find(
      (item) => !item.isCreate && pathMatches(pathname, item.matchPaths)
    );
    return activeItem?.id ?? null;
  }, [location.pathname]);

  /* ------------------------------------------------------------------------
     Render
     ------------------------------------------------------------------------ */

  return (
    <>
      <motion.nav
        aria-label="Primary navigation"
        initial={false}
        animate={{ y: -keyboardOffset }}
        transition={reducedMotion ? { duration: 0 } : MOTION.keyboard}
        className="
          pointer-events-none fixed inset-x-0 bottom-0 z-[100] px-2 sm:px-3
        "
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        <div className="relative mx-auto h-[82px] w-full" style={{ maxWidth: MAX_WIDTH }}>
          <NavigationHandle
            dark={dark}
            reducedMotion={Boolean(reducedMotion)}
            navigationVisible={visible}
            onToggleNavigation={toggleNavigation}
            onOpenQuickAccess={openQuickAccess}
          />

          <AnimatePresence initial={false}>
            {visible && (
              <motion.div
                key="arvdoul-bottom-navigation"
                id="arvdoul-bottom-navigation"
                initial={reducedMotion ? false : { y: 96, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { y: 96, opacity: 0 }}
                transition={reducedMotion ? { duration: 0 } : MOTION.membrane}
                className="
                  pointer-events-auto absolute inset-x-0 bottom-0 h-[82px] overflow-hidden
                  rounded-[30px]
                "
                style={{
                  isolation: "isolate",
                  background: dark
                    ? [
                        "linear-gradient(180deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.02) 34%,rgba(255,255,255,.01) 100%)",
                        "linear-gradient(108deg,rgba(200,43,255,.02) 0%,transparent 27%,rgba(68,49,247,.02) 55%,rgba(5,91,251,.018) 100%)",
                        "rgba(3,7,27,.65)",
                      ].join(",")
                    : [
                        "linear-gradient(180deg,rgba(255,255,255,.65) 0%,rgba(255,255,255,.45) 38%,rgba(255,255,255,.35) 100%)",
                        "linear-gradient(108deg,rgba(200,43,255,.02) 0%,transparent 27%,rgba(68,49,247,.02) 55%,rgba(5,91,251,.015) 100%)",
                      ].join(","),
                  border: dark
                    ? "1px solid rgba(255,255,255,.1)"
                    : "1px solid rgba(255,255,255,.8)",
                  boxShadow: dark
                    ? "0 24px 58px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.1),inset 0 -1px 0 rgba(0,0,0,.15)"
                    : "0 22px 52px rgba(17,24,39,.1),inset 0 1px 0 rgba(255,255,255,.9),inset 0 -1px 0 rgba(0,0,0,.03)",
                  backdropFilter: "blur(35px) saturate(180%)",
                  WebkitBackdropFilter: "blur(35px) saturate(180%)",
                }}
              >
                {/* Layer 1: Inner rim */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[2px] rounded-[28px] border"
                  style={{
                    borderColor: dark ? "rgba(255,255,255,.06)" : "rgba(17,24,39,.05)",
                  }}
                />

                {/* Layer 2: Top bevel */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-[34px] top-[1px] h-px rounded-full"
                  style={{
                    background: dark
                      ? "linear-gradient(90deg,transparent,rgba(255,255,255,.25) 27%,rgba(255,255,255,.3) 50%,rgba(255,255,255,.2) 73%,transparent)"
                      : "linear-gradient(90deg,transparent,rgba(255,255,255,.8) 27%,rgba(255,255,255,1) 50%,rgba(255,255,255,.8) 73%,transparent)",
                  }}
                />

                {/* Layer 3: Diagonal refraction */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[30px]"
                  style={{
                    background:
                      "linear-gradient(106deg,transparent 9%,rgba(255,255,255,.015) 33%,rgba(255,255,255,.05) 49%,rgba(255,255,255,.015) 64%,transparent 91%)",
                  }}
                />

                {/* Layer 4: Outer glass reflection */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-[30px]"
                  style={{
                    background: dark
                      ? "linear-gradient(145deg,rgba(255,255,255,.04) 0%,transparent 40%,rgba(255,255,255,.03) 100%)"
                      : "linear-gradient(145deg,rgba(255,255,255,.1) 0%,transparent 40%,rgba(255,255,255,.08) 100%)",
                  }}
                />

                {/* Layer 5: Left wall */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-[10px] left-[2px] top-[12px] w-px"
                  style={{
                    background: dark
                      ? "linear-gradient(180deg,transparent,rgba(200,43,255,.15) 46%,rgba(255,255,255,.1),transparent)"
                      : "linear-gradient(180deg,transparent,rgba(139,30,243,.08) 46%,rgba(255,255,255,.7),transparent)",
                  }}
                />

                {/* Layer 6: Right wall */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-[10px] right-[2px] top-[12px] w-px"
                  style={{
                    background: dark
                      ? "linear-gradient(180deg,transparent,rgba(5,91,251,.15) 46%,rgba(255,255,255,.09),transparent)"
                      : "linear-gradient(180deg,transparent,rgba(5,91,251,.07) 46%,rgba(255,255,255,.65),transparent)",
                  }}
                />

                {/* Layer 7: Center dome bridge */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-[-13px] z-[4] h-[42px] w-[126px] -translate-x-1/2 rounded-t-[70px] border-t"
                  style={{
                    background: dark
                      ? "radial-gradient(ellipse at 50% 100%,rgba(255,255,255,.05),transparent 69%)"
                      : "radial-gradient(ellipse at 50% 100%,rgba(255,255,255,.6),transparent 69%)",
                    borderTopColor: dark
                      ? "rgba(255,255,255,.1)"
                      : "rgba(255,255,255,.9)",
                  }}
                />

                {/* Layer 8: Lower optical edge */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-[34px] bottom-[3px] h-px rounded-full"
                  style={{
                    background: dark
                      ? "linear-gradient(90deg,transparent,rgba(255,255,255,.06) 25%,rgba(255,255,255,.12) 50%,rgba(255,255,255,.06) 75%,transparent)"
                      : "linear-gradient(90deg,transparent,rgba(255,255,255,.5) 25%,rgba(255,255,255,.8) 50%,rgba(255,255,255,.5) 75%,transparent)",
                  }}
                />

                {/* Layer 9: Bottom reflection */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-[100px] bottom-0 h-[10px] rounded-full"
                  style={{
                    background: dark
                      ? "linear-gradient(180deg,transparent,rgba(255,255,255,.02))"
                      : "linear-gradient(180deg,transparent,rgba(255,255,255,.2))",
                  }}
                />

                {/* Content grid */}
                <div className="relative z-20 grid h-[82px] w-full grid-cols-[repeat(3,minmax(0,1fr))_72px_repeat(3,minmax(0,1fr))] items-start gap-0 px-[2px]">
                  <NavigationItem
                    item={NAV_ITEMS[0]}
                    active={activeId === "home"}
                    badgeCount={0}
                    coinBalance={coinBalance}
                    dark={dark}
                    reducedMotion={Boolean(reducedMotion)}
                    onNavigate={navigateTo}
                  />
                  <NavigationItem
                    item={NAV_ITEMS[1]}
                    active={activeId === "sparks"}
                    badgeCount={0}
                    coinBalance={coinBalance}
                    dark={dark}
                    reducedMotion={Boolean(reducedMotion)}
                    onNavigate={navigateTo}
                  />
                  <NavigationItem
                    item={NAV_ITEMS[2]}
                    active={activeId === "chat"}
                    badgeCount={badges.messages}
                    coinBalance={coinBalance}
                    dark={dark}
                    reducedMotion={Boolean(reducedMotion)}
                    onNavigate={navigateTo}
                  />
                  <CreateControl
                    dark={dark}
                    reducedMotion={Boolean(reducedMotion)}
                    onCreate={openCreate}
                  />
                  <NavigationItem
                    item={NAV_ITEMS[4]}
                    active={activeId === "network"}
                    badgeCount={badges.network}
                    coinBalance={coinBalance}
                    dark={dark}
                    reducedMotion={Boolean(reducedMotion)}
                    onNavigate={navigateTo}
                  />
                  <NavigationItem
                    item={NAV_ITEMS[5]}
                    active={activeId === "coins"}
                    badgeCount={0}
                    coinBalance={coinBalance}
                    dark={dark}
                    reducedMotion={Boolean(reducedMotion)}
                    onNavigate={navigateTo}
                  />
                  <NavigationItem
                    item={NAV_ITEMS[6]}
                    active={activeId === "alerts"}
                    badgeCount={badges.notifications}
                    coinBalance={coinBalance}
                    dark={dark}
                    reducedMotion={Boolean(reducedMotion)}
                    onNavigate={navigateTo}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.nav>

      <QuickAccessPanel
        isPanelOpen={quickAccessOpen}
        closePanel={closeQuickAccess}
        navigateToWithLoading={navigateToWithLoading}
      />
    </>
  );
}

BottomNav.propTypes = {};

export default memo(BottomNav);