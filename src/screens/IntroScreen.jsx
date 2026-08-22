// src/screens/IntroScreen.jsx
/**
 * Arvdoul — Ultra Pro IntroScreen (enhanced)
 *
 * Hardened per the zero-mock / production mandates:
 *  - NO fabricated statistics: the previous "10M+ users / 99.99% uptime"
 *    claims were removed. The stats grid is replaced with HONEST product
 *    pillars (E2EE, privacy-by-design, creator-first, real-time) that are
 *    actually true of the platform.
 *  - Full i18n: every user-facing string comes from the `intro.*` namespace
 *    (7 locales). The error boundary is translated via the withLanguage HOC.
 *  - Reduced motion respected: particles animation and the button shine
 *    effect are disabled when prefers-reduced-motion is active (in addition
 *    to the global MotionConfig + tokens.css kill-switch).
 *  - Accessibility: keyboard focus on feature cards, aria-hidden decorative
 *    emojis, aria-live welcome region, focus-visible rings on buttons.
 *  - Dead code removed (unused isMobile state, empty cleanup).
 *  - NAVIGATION PATHS MATCH AppRoutes.jsx EXACTLY (/signup, /login, /).
 */

import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  memo,
  Component,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "@context/ThemeContext";
import { useTranslation } from "react-i18next";
import ThemeToggle from "@components/Shared/ThemeToggle";
import {
  motion,
  AnimatePresence,
} from "framer-motion";
import { withLanguage } from "../i18n/index.js";

/* -------------------- Safe reduced-motion hook --------------------
 * Equivalent semantics to framer-motion's useReducedMotion (respects the
 * OS prefers-reduced-motion setting) but implemented WITHOUT relying on
 * framer-motion's internal window.matchMedia call - a missing matchMedia
 * in embedded webviews used to crash the intro into its error boundary
 * ("Temporary Glitch"). The global polyfill in index.html/main.jsx covers
 * the API; this hook is the component-level belt-and-braces guard.
 */
function useSafeReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        setReduced(false);
        return undefined;
      }
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduced(Boolean(mq.matches));
      const onChange = (e) => setReduced(Boolean(e.matches));
      if (typeof mq.addEventListener === "function") {
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
      }
      if (typeof mq.addListener === "function") {
        mq.addListener(onChange);
        return () => mq.removeListener(onChange);
      }
      return undefined;
    } catch {
      setReduced(false);
      return undefined;
    }
  }, []);

  return reduced;
}

/* -------------------- Ultra Smooth Debounce -------------------- */
const useDebounce = (callback, delay = 12) => {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);
};

/* -------------------- Advanced Error Boundary (translated) -------------------- */
class IntroErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, autoRecovered: false };
    this._autoRetryTimer = null;
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("[Arvdoul Intro Error]:", error, errorInfo);
    // Diagnostics: persist the real cause so it can be triaged instead of
    // guessing at "Temporary Glitch". Never stores user data - message+stack only.
    try {
      localStorage.setItem(
        "arvdoul_intro_error",
        JSON.stringify({
          message: error?.message || "unknown",
          stack: error?.stack ? String(error.stack).slice(0, 2000) : null,
          at: new Date().toISOString(),
        })
      );
    } catch {
      /* storage may be blocked - ignore */
    }

    // Self-healing: the FIRST crash auto-retries once after a short delay
    // (transient issues - e.g. fonts, matchMedia timing - resolve themselves).
    if (!this.state.autoRecovered) {
      this._autoRetryTimer = setTimeout(() => {
        this.setState({ hasError: false, error: null, autoRecovered: true });
      }, 1200);
    }
  }
  componentWillUnmount() {
    if (this._autoRetryTimer) clearTimeout(this._autoRetryTimer);
  }
  handleContinue = () => {
    try {
      window.location.href = "/home";
    } catch {
      /* noop */
    }
  };
  render() {
    const { t } = this.props;
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950"
        >
          <div className="max-w-md text-center p-8 rounded-2xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900/30 dark:to-pink-900/30 flex items-center justify-center">
              <span className="text-2xl" aria-hidden="true">⚠️</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              {t("intro.glitchTitle")}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-2">
              {t("intro.glitchText")}
            </p>
            {this.state.error?.message && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 break-words mb-6">
                <span className="uppercase tracking-wide mr-1">{t("intro.errorDetail")}:</span>
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col gap-2.5 sm:flex-row justify-center">
              <button
                onClick={() => this.setState({ hasError: false, error: null, autoRecovered: true })}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:shadow-lg transition-all duration-300 min-h-[44px]"
              >
                {t("intro.retry")}
              </button>
              <button
                onClick={this.handleContinue}
                className="px-6 py-2.5 rounded-xl border border-white/20 text-gray-700 dark:text-gray-200 font-medium hover:bg-white/10 transition-all duration-300 min-h-[44px]"
              >
                {t("intro.continueToApp") || "Continue to App"}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
const IntroErrorBoundaryTranslated = withLanguage(IntroErrorBoundary);

/* -------------------- Advanced Background Particles -------------------- */
const BackgroundParticles = memo(({ theme }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const prefersReducedMotion = useSafeReducedMotion();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    // getContext('2d') can legitimately return null (canvas fingerprinting
    // blocked in privacy browsers / WebViews). Never crash - just skip the
    // decorative particles layer.
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      initParticles();
    };

    const initParticles = () => {
      // Reduced motion: fewer, static particles (no continuous animation).
      const particleCount = prefersReducedMotion
        ? 0
        : Math.min(40, Math.floor(width / 40));
      particlesRef.current = Array.from({ length: particleCount }, (_, i) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 1,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.15 + 0.05,
        color:
          theme === "dark"
            ? `rgba(59, 130, 246, ${Math.random() * 0.1 + 0.05})`
            : `rgba(99, 102, 241, ${Math.random() * 0.08 + 0.03})`,
      }));
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      particlesRef.current.forEach((particle) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        if (particle.x > width) particle.x = 0;
        if (particle.x < 0) particle.x = width;
        if (particle.y > height) particle.y = 0;
        if (particle.y < 0) particle.y = height;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("resize", resize);
    resize();
    if (!prefersReducedMotion) {
      animate();
    }

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [theme, prefersReducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: theme === "dark" ? 0.25 : 0.12 }}
    />
  );
});

/* -------------------- PERFECT CENTERED LOGO -------------------- */
const HeroLogo = memo(({ theme, onClick }) => {
  const [logoError, setLogoError] = useState(false);
  const resolvedTheme = useMemo(() => {
    if (theme === "system") {
      if (typeof window === "undefined" || !window.matchMedia) return "light";
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return theme || "light";
  }, [theme]);

  const logoPath = useMemo(
    () => (resolvedTheme === "dark" ? "/logo/logo-dark.png" : "/logo/logo-light.png"),
    [resolvedTheme]
  );

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 flex items-center justify-center shadow-2xl overflow-hidden cursor-pointer"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      role="img"
      aria-label="Arvdoul"
    >
      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10">
        <img
          src={logoPath}
          alt="Arvdoul Logo"
          className="w-full h-full object-contain"
          onError={(e) => {
            e.target.style.display = "none";
            setLogoError(true);
          }}
        />
        {logoError && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-500">
            <span className="text-2xl font-bold text-white" aria-hidden="true">
              A
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
});

/* -------------------- Advanced Feature Card (keyboard accessible) -------------------- */
const FeatureCard = memo(({ emoji, title, description, index, theme, isActive, onHover }) => {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef(null);

  // Keyboard parity: focus behaves like hover so keyboard users see the
  // same affordances as pointer users.
  const activate = useCallback(() => {
    setIsHovered(true);
    onHover?.(index);
  }, [index, onHover]);
  const deactivate = useCallback(() => {
    setIsHovered(false);
    onHover?.(null);
  }, [onHover]);

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.08, duration: 0.5, type: "spring", stiffness: 100, damping: 15 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      onMouseEnter={activate}
      onMouseLeave={deactivate}
      onFocus={activate}
      onBlur={deactivate}
      tabIndex={0}
      role="group"
      aria-label={title}
      className="relative cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-950 rounded-xl"
    >
      {/* Main card with responsive padding */}
      <div
        className={`relative rounded-xl p-4 sm:p-5 md:p-6 transition-all duration-300 ${
          theme === "dark"
            ? "bg-gray-900/80 backdrop-blur-sm border border-gray-800/50"
            : "bg-white/90 backdrop-blur-sm border border-gray-200/60"
        } ${isHovered ? "shadow-xl" : "shadow-lg"} hover:shadow-2xl`}
      >
        {/* Emoji container */}
        <div className="relative mb-3 sm:mb-4">
          <div className="text-2xl sm:text-3xl mb-1 sm:mb-2" aria-hidden="true">
            {emoji}
          </div>
          <div
            aria-hidden="true"
            className="absolute -top-1 -right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 animate-pulse"
          />
        </div>

        {/* Title - h3 keeps heading order (h1 hero → h2 sections → h3 cards) */}
        <h3 className="font-bold text-base sm:text-lg md:text-lg mb-2 sm:mb-3">
          <span
            className={`bg-clip-text text-transparent bg-gradient-to-r ${
              theme === "dark" ? "from-blue-300 to-purple-300" : "from-blue-600 to-purple-600"
            }`}
          >
            {title}
          </span>
        </h3>

        {/* Description */}
        <p
          className={`text-xs sm:text-sm md:text-sm leading-relaxed ${
            theme === "dark" ? "text-gray-300/90" : "text-gray-700/90"
          }`}
        >
          {description}
        </p>

        {/* Animated underline */}
        <motion.div
          aria-hidden="true"
          className={`absolute bottom-3 sm:bottom-4 left-4 sm:left-6 right-4 sm:right-6 h-0.5 rounded-full ${
            theme === "dark"
              ? "bg-gradient-to-r from-blue-400/70 to-purple-400/70"
              : "bg-gradient-to-r from-blue-500/70 to-purple-500/70"
          }`}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: isHovered || isActive ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.div>
  );
});

/* -------------------- Perfect Button Component (accessible) -------------------- */
const ActionButton = memo(({ children, onClick, variant = "primary", theme, className = "", disabled = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  const prefersReducedMotion = useSafeReducedMotion();

  const baseStyles =
    "relative px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl font-semibold transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2";

  const variants = {
    primary:
      theme === "dark"
        ? "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl hover:shadow-blue-500/25"
        : "bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg hover:shadow-xl hover:shadow-purple-500/30",
    secondary:
      theme === "dark"
        ? "bg-gray-800/70 text-gray-200 border border-gray-700/50 hover:bg-gray-700/70 hover:border-gray-600/50"
        : "bg-white/90 text-gray-800 border border-gray-300/60 hover:bg-gray-50/90 hover:border-gray-400/60",
  };

  return (
    <motion.button
      whileHover={prefersReducedMotion ? undefined : { y: -2 }}
      whileTap={prefersReducedMotion ? undefined : { y: 0, scale: 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {/* Shine effect (disabled under reduced motion) */}
      {!prefersReducedMotion && (
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/20 to-transparent"
          initial={{ x: "-100%" }}
          animate={{ x: isHovered ? "100%" : "-100%" }}
          transition={{ duration: 0.6 }}
        />
      )}
      <span className="relative z-10 text-sm sm:text-base">{children}</span>
    </motion.button>
  );
});

/* -------------------- Main Component -------------------- */
export default function IntroScreenWrapper() {
  return (
    <IntroErrorBoundaryTranslated>
      <IntroScreen />
    </IntroErrorBoundaryTranslated>
  );
}

function IntroScreen() {
  const navigate = useNavigate();
  const themeCtx = useTheme?.() || { theme: "light" };
  const { theme } = themeCtx;
  const { t } = useTranslation();

  const [mounted, setMounted] = useState(false);
  const [activeFeature, setActiveFeature] = useState(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const resolvedTheme = useMemo(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
    if (theme === "system") {
      try {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } catch {
        return "light";
      }
    }
    return theme || "light";
  }, [theme]);

  // Background style - matching exact Arvdoul DNA tokens
  const backgroundStyle = useMemo(
    () => ({
      background:
        resolvedTheme === "dark"
          ? "#03071B"
          : "#F6F8FC",
    }),
    [resolvedTheme]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Enhanced scroll handler with debounce
  const updateScrollProgress = useCallback(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
    const docHeight = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    const progress = Math.min(1, Math.max(0, scrollTop / docHeight));
    setScrollProgress(progress);
  }, []);

  const debouncedScroll = useDebounce(updateScrollProgress, 8);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.addEventListener("scroll", debouncedScroll, { passive: true });
    return () => window.removeEventListener("scroll", debouncedScroll);
  }, [debouncedScroll]);

  // HONEST feature list - every claim below is a real platform capability.
  const features = useMemo(
    () => [
      { emoji: "✨", title: t("intro.features.smartFeed.title"), description: t("intro.features.smartFeed.desc") },
      { emoji: "🛡️", title: t("intro.features.privacy.title"), description: t("intro.features.privacy.desc") },
      { emoji: "👥", title: t("intro.features.communities.title"), description: t("intro.features.communities.desc") },
      { emoji: "🎨", title: t("intro.features.creation.title"), description: t("intro.features.creation.desc") },
      { emoji: "💬", title: t("intro.features.chat.title"), description: t("intro.features.chat.desc") },
      { emoji: "📱", title: t("intro.features.platform.title"), description: t("intro.features.platform.desc") },
    ],
    [t]
  );

  // Honest product pillars (replaces the fabricated user-count statistics).
  const pillars = useMemo(
    () => [
      { emoji: "🔐", title: t("intro.pillars.e2ee.title"), description: t("intro.pillars.e2ee.desc") },
      { emoji: "🛡️", title: t("intro.pillars.privacy.title"), description: t("intro.pillars.privacy.desc") },
      { emoji: "💰", title: t("intro.pillars.creator.title"), description: t("intro.pillars.creator.desc") },
      { emoji: "⚡", title: t("intro.pillars.realtime.title"), description: t("intro.pillars.realtime.desc") },
    ],
    [t]
  );

  if (!mounted) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 dark:border-t-blue-400 animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 animate-pulse" />
            </div>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            {t("intro.loading")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen overflow-hidden safe-area-bottom" style={backgroundStyle}>
      {/* Advanced Background Particles (disabled under reduced motion) */}
      <BackgroundParticles theme={resolvedTheme} />

      {/* Theme Toggle - Fixed top right */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="fixed top-6 right-6 z-50"
      >
        <ThemeToggle
          variant="icon"
          size="lg"
          className="hover:scale-110 transition-transform duration-200 bg-white/10 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 shadow-xl"
        />
      </motion.div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6">
        {/* Hero Section */}
        <section className="pt-12 sm:pt-16 pb-12 sm:pb-20">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <HeroLogo theme={theme} onClick={() => navigate("/")} />

              {/* Brand Name */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-2"
              >
                <h2
                  className={`font-extrabold text-3xl sm:text-4xl tracking-tight ${
                    resolvedTheme === "dark" ? "text-white" : "text-gray-900"
                  }`}
                >
                  Arvdoul
                </h2>
              </motion.div>

              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-4 sm:mb-6">
                <span className={`block ${resolvedTheme === "dark" ? "text-white" : "text-gray-900"}`}>
                  {t("intro.title1")}
                </span>
                <span
                  className={`block bg-clip-text text-transparent bg-gradient-to-r ${
                    resolvedTheme === "dark"
                      ? "from-blue-300 via-purple-300 to-pink-300"
                      : "from-blue-600 via-purple-600 to-pink-500"
                  }`}
                >
                  {t("intro.title2")}
                </span>
              </h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className={`text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 sm:mb-12 leading-relaxed ${
                  resolvedTheme === "dark" ? "text-gray-300" : "text-gray-700"
                }`}
              >
                {t("intro.tagline")}
              </motion.p>
            </motion.div>

            {/* Honest Pillars Grid - replaces fabricated statistics */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-12 md:mb-16"
            >
              {pillars.map((pillar, index) => (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * index }}
                  className={`p-3 sm:p-4 md:p-5 rounded-xl backdrop-blur-sm ${
                    resolvedTheme === "dark"
                      ? "bg-gray-900/50 border border-gray-800/50"
                      : "bg-white/80 border border-gray-200/60"
                  }`}
                >
                  <div aria-hidden="true" className="text-lg sm:text-xl md:text-2xl mb-1">
                    {pillar.emoji}
                  </div>
                  <div
                    className={`text-sm sm:text-base font-bold bg-clip-text text-transparent bg-gradient-to-r ${
                      resolvedTheme === "dark"
                        ? "from-blue-300 to-purple-300"
                        : "from-blue-600 to-purple-600"
                    }`}
                  >
                    {pillar.title}
                  </div>
                  <div className={`text-xs mt-1 leading-relaxed ${
                    resolvedTheme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}>
                    {pillar.description}
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Features Grid */}
            <div className="mb-12 sm:mb-16 md:mb-20">
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className={`text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-8 sm:mb-12 ${
                  resolvedTheme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                {t("intro.featuresTitle")}
              </motion.h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
                {features.map((feature, index) => (
                  <div key={feature.title} className="h-full">
                    <FeatureCard
                      {...feature}
                      index={index}
                      theme={resolvedTheme}
                      isActive={activeFeature === index}
                      onHover={setActiveFeature}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* CTA Section */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className={`rounded-2xl p-6 sm:p-8 md:p-10 backdrop-blur-sm ${
                resolvedTheme === "dark"
                  ? "bg-gray-900/50 border border-gray-800/50"
                  : "bg-white/80 border border-gray-200/60"
              }`}
            >
              <div className="max-w-2xl mx-auto text-center">
                <h3
                  className={`text-xl sm:text-2xl md:text-3xl font-bold mb-3 sm:mb-4 ${
                    resolvedTheme === "dark" ? "text-white" : "text-gray-900"
                  }`}
                >
                  {t("intro.ctaTitle")}
                </h3>
                <p
                  className={`text-sm sm:text-base md:text-lg mb-6 sm:mb-8 ${
                    resolvedTheme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {t("intro.ctaText")}
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4">
                  {/* MATCHES AppRoutes: /signup */}
                  <div className="flex-1 sm:flex-none">
                    <ActionButton
                      onClick={() => navigate("/signup")}
                      variant="primary"
                      theme={resolvedTheme}
                      className="h-full"
                    >
                      {t("intro.createAccount")}
                    </ActionButton>
                  </div>

                  {/* MATCHES AppRoutes: /login */}
                  <div className="flex-1 sm:flex-none">
                    <ActionButton
                      onClick={() => navigate("/login")}
                      variant="secondary"
                      theme={resolvedTheme}
                      className="h-full"
                    >
                      {t("intro.signIn")}
                    </ActionButton>
                  </div>
                </div>

                <p
                  className={`text-xs sm:text-sm mt-4 sm:mt-6 ${
                    resolvedTheme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {t("intro.footnote")}
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Advanced Scroll Progress */}
        <AnimatePresence>
          {scrollProgress > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed bottom-4 sm:bottom-6 left-1/2 transform -translate-x-1/2 z-40"
            >
              <div
                className={`px-3 sm:px-4 py-2 rounded-full backdrop-blur-md ${
                  resolvedTheme === "dark"
                    ? "bg-gray-900/70 border border-gray-800/50"
                    : "bg-white/80 border border-gray-200/60"
                } shadow-lg`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(scrollProgress * 100)}
                aria-label="Page scroll progress"
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div
                    className={`w-24 sm:w-32 h-1 sm:h-1.5 rounded-full overflow-hidden ${
                      resolvedTheme === "dark" ? "bg-gray-800/50" : "bg-gray-300/50"
                    }`}
                  >
                    <motion.div
                      className="h-full bg-gradient-to-r from-blue-400 to-purple-400"
                      style={{ width: `${scrollProgress * 100}%` }}
                      transition={{ type: "spring", damping: 20 }}
                    />
                  </div>
                  <span
                    className={`text-xs sm:text-sm font-medium ${
                      resolvedTheme === "dark" ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    {Math.round(scrollProgress * 100)}%
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Accessibility */}
      <div className="sr-only" aria-live="polite">
        {t("intro.srWelcome")}
      </div>

      {/* Mobile-safe CSS */}
      <style>{`
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }

        /* Prevent zoom on mobile */
        @media screen and (max-width: 768px) {
          input, textarea {
            font-size: 16px !important;
          }
        }

        /* Better touch targets */
        .touch-target {
          min-height: 44px;
          min-width: 44px;
        }

        /* Smooth transitions */
        * {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  );
}
