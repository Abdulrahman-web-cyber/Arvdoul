// src/screens/IntroScreen.jsx
/**
 * Arvdoul — Ultra Pro IntroScreen (enhanced)
 *
 * Hardened per the zero-mock / production mandates:
 *  - NO fabricated statistics: the stats grid displays HONEST product
 *    pillars (E2EE, privacy-by-design, creator-first, real-time) that are
 *    actually true of the platform.
 *  - Full i18n: every user-facing string comes from the `intro.*` namespace
 *    (7 locales). The error boundary is translated via the withLanguage HOC.
 *  - Reduced motion respected: particles animation, background mesh orbs, and button shine
 *    effect are disabled when prefers-reduced-motion is active (in addition
 *    to the global MotionConfig + tokens.css kill-switch).
 *  - Accessibility: keyboard focus on feature cards, aria-hidden decorative
 *    emojis, aria-live welcome region, focus-visible rings on buttons.
 *  - Glassmorphic DNA: luxurious neon glow rings, background ambient multi-mesh gradient,
 *    and smooth animations.
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

/* -------------------- Cryptographically Secure PRNG for SonarCloud Compliance -------------------- */
function secureRandom() {
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.getRandomValues === "function") {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] / 4294967296;
  }
  return 0.5;
}

/* -------------------- Safe reduced-motion hook -------------------- */
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
    try {
      localStorage.setItem(
        "arvdoul_intro_error",
        JSON.stringify({
          message: error?.message || "unknown",
          stack: error?.stack ? String(error.stack).slice(0, 2000) : null,
          at: new Date().toISOString(),
        })
      );
    } catch {}

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
    } catch {}
  };
  render() {
    const { t } = this.props;
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-[#03071B] dark:to-[#080F2E]"
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
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#8B1EF3] via-[#4431F7] to-[#055BFB] text-white font-medium hover:shadow-lg transition-all duration-300 min-h-[44px]"
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

/* -------------------- Animated Mesh Gradient Background -------------------- */
const AnimatedMeshBackground = memo(() => {
  const prefersReducedMotion = useSafeReducedMotion();

  if (prefersReducedMotion) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
      {/* Top Left Neon Purple Orb */}
      <motion.div
        animate={{
          x: [0, 40, -20, 0],
          y: [0, -50, 20, 0],
          scale: [1, 1.2, 0.95, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
        className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[120px] opacity-40 dark:opacity-35 bg-gradient-to-br from-[#8B1EF3] to-[#4431F7]"
      />

      {/* Bottom Right Neon Blue/Cyan Orb */}
      <motion.div
        animate={{
          x: [0, -40, 30, 0],
          y: [0, 40, -30, 0],
          scale: [1, 1.25, 0.9, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
        className="absolute -bottom-32 -right-32 w-[30rem] h-[30rem] rounded-full blur-[140px] opacity-35 dark:opacity-30 bg-gradient-to-tr from-[#055BFB] to-[#0088FF]"
      />

      {/* Center Glow Fuchsia Accent Orb */}
      <motion.div
        animate={{
          x: [-20, 20, -20],
          y: [20, -20, 20],
          scale: [0.9, 1.1, 0.9],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          repeatType: "mirror",
          ease: "easeInOut",
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[24rem] h-[24rem] rounded-full blur-[150px] opacity-25 dark:opacity-20 bg-gradient-to-r from-[#C82BFF] to-[#8B1EF3]"
      />
    </div>
  );
});

/* -------------------- Background Particles -------------------- */
const BackgroundParticles = memo(({ theme }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);
  const prefersReducedMotion = useSafeReducedMotion();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
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
      const particleCount = prefersReducedMotion
        ? 0
        : Math.min(45, Math.floor(width / 35));
      particlesRef.current = Array.from({ length: particleCount }, () => ({
        x: secureRandom() * width,
        y: secureRandom() * height,
        size: secureRandom() * 2.5 + 1,
        speedX: (secureRandom() - 0.5) * 0.35,
        speedY: (secureRandom() - 0.5) * 0.35,
        opacity: secureRandom() * 0.18 + 0.05,
        color:
          theme === "dark"
            ? `rgba(139, 30, 243, ${secureRandom() * 0.12 + 0.05})`
            : `rgba(68, 49, 247, ${secureRandom() * 0.09 + 0.03})`,
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
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
      style={{ opacity: theme === "dark" ? 0.3 : 0.15 }}
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
      className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 flex items-center justify-center shadow-md overflow-hidden cursor-pointer"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      role="img"
      aria-label="Arvdoul"
    >
      <div className="w-20 h-20 rounded-full overflow-hidden border border-gray-200/50 dark:border-white/10 flex items-center justify-center p-1 bg-white dark:bg-[#03071B]">
        <img
          src={logoPath}
          alt="Arvdoul Logo"
          className="w-full h-full object-contain rounded-full"
          onError={(e) => {
            e.target.style.display = "none";
            setLogoError(true);
          }}
        />
        {logoError && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-500 rounded-full">
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
      className="relative cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#03071B] rounded-2xl h-full"
    >
      <div
        className={`relative rounded-2xl p-5 sm:p-6 transition-all duration-300 h-full flex flex-col justify-between ${
          theme === "dark"
            ? "bg-[#080F2E]/70 backdrop-blur-xl border border-white/10"
            : "bg-white/80 backdrop-blur-xl border border-black/5"
        } ${isHovered ? "shadow-2xl shadow-purple-500/10 border-purple-500/30" : "shadow-lg"}`}
      >
        <div>
          <div className="relative mb-3 flex items-center justify-between">
            <div className="text-3xl sm:text-4xl" aria-hidden="true">
              {emoji}
            </div>
            <div
              aria-hidden="true"
              className="w-2 h-2 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 animate-pulse"
            />
          </div>

          <h3 className="font-bold text-base sm:text-lg mb-2">
            <span
              className={`bg-clip-text text-transparent bg-gradient-to-r ${
                theme === "dark" ? "from-white via-purple-200 to-blue-200" : "from-gray-900 via-purple-900 to-blue-900"
              }`}
            >
              {title}
            </span>
          </h3>

          <p
            className={`text-xs sm:text-sm leading-relaxed ${
              theme === "dark" ? "text-gray-300/90" : "text-gray-600/90"
            }`}
          >
            {description}
          </p>
        </div>

        <motion.div
          aria-hidden="true"
          className="mt-4 h-0.5 rounded-full bg-gradient-to-r from-[#8B1EF3] via-[#4431F7] to-[#055BFB]"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: isHovered || isActive ? 1 : 0 }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.div>
  );
});

/* -------------------- Action Button Component (accessible) -------------------- */
const ActionButton = memo(({ children, onClick, variant = "primary", theme, className = "", disabled = false }) => {
  const [isHovered, setIsHovered] = useState(false);
  const prefersReducedMotion = useSafeReducedMotion();

  const baseStyles =
    "relative px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl font-bold transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto min-h-[48px] flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 overflow-hidden shadow-md";

  const variants = {
    primary:
      "bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30",
    secondary:
      theme === "dark"
        ? "bg-[#080F2E]/80 text-white border border-white/15 hover:bg-white/10 hover:border-white/30"
        : "bg-white/90 text-gray-900 border border-black/10 hover:bg-gray-100 hover:border-black/20",
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
      {!prefersReducedMotion && variant === "primary" && (
        <motion.div
          aria-hidden="true"
          className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/25 to-transparent"
          initial={{ x: "-100%" }}
          animate={{ x: isHovered ? "100%" : "-100%" }}
          transition={{ duration: 0.6 }}
        />
      )}
      <span className="relative z-10 text-sm sm:text-base tracking-wide">{children}</span>
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
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-[#03071B] dark:to-[#080F2E]">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-gray-200 dark:border-gray-800 border-t-[#8B1EF3] dark:border-t-[#8B1EF3] animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#8B1EF3] to-[#055BFB] animate-pulse" />
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
      <AnimatedMeshBackground />
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
          className="hover:scale-110 transition-transform duration-200 bg-white/10 dark:bg-white/10 backdrop-blur-md border border-white/20 dark:border-white/15 shadow-2xl"
        />
      </motion.div>

      {/* Main Content Container */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6">
        <section className="pt-12 sm:pt-16 pb-16 sm:pb-24">
          <div className="max-w-6xl mx-auto">
            {/* Hero Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center"
            >
              <HeroLogo theme={theme} onClick={() => navigate("/")} />

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-3"
              >
                <h2
                  className={`font-black text-3xl sm:text-4xl md:text-5xl tracking-tight ${
                    resolvedTheme === "dark" ? "text-white" : "text-gray-900"
                  }`}
                >
                  Arvdoul
                </h2>
              </motion.div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
                <span className={`block ${resolvedTheme === "dark" ? "text-white" : "text-gray-900"}`}>
                  {t("intro.title1")}
                </span>
                <span
                  className="block bg-clip-text text-transparent bg-gradient-to-r from-[#8B1EF3] via-[#C82BFF] to-[#055BFB]"
                >
                  {t("intro.title2")}
                </span>
              </h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className={`text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed ${
                  resolvedTheme === "dark" ? "text-gray-300" : "text-gray-700"
                }`}
              >
                {t("intro.tagline")}
              </motion.p>
            </motion.div>

            {/* Honest Pillars Grid */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12 sm:mb-16"
            >
              {pillars.map((pillar, index) => (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 * index }}
                  className={`p-4 sm:p-5 rounded-2xl backdrop-blur-xl ${
                    resolvedTheme === "dark"
                      ? "bg-[#080F2E]/60 border border-white/10 shadow-xl"
                      : "bg-white/80 border border-black/5 shadow-lg"
                  }`}
                >
                  <div aria-hidden="true" className="text-2xl sm:text-3xl mb-2">
                    {pillar.emoji}
                  </div>
                  <div
                    className="text-sm sm:text-base font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#8B1EF3] to-[#055BFB]"
                  >
                    {pillar.title}
                  </div>
                  <div className={`text-xs mt-1 leading-relaxed ${
                    resolvedTheme === "dark" ? "text-gray-400" : "text-gray-600"
                  }`}>
                    {pillar.description}
                  </div>
                </motion.div>
              ))}
            </motion.div>

            {/* Features Grid */}
            <div className="mb-16 sm:mb-20">
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className={`text-2xl sm:text-3xl md:text-4xl font-extrabold text-center mb-10 ${
                  resolvedTheme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                {t("intro.featuresTitle")}
              </motion.h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
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
              className={`rounded-3xl p-8 sm:p-12 backdrop-blur-2xl relative overflow-hidden ${
                resolvedTheme === "dark"
                  ? "bg-[#080F2E]/80 border border-white/15 shadow-2xl shadow-purple-500/10"
                  : "bg-white/90 border border-black/10 shadow-2xl"
              }`}
            >
              <div className="max-w-2xl mx-auto text-center relative z-10">
                <h3
                  className={`text-2xl sm:text-3xl md:text-4xl font-extrabold mb-4 ${
                    resolvedTheme === "dark" ? "text-white" : "text-gray-900"
                  }`}
                >
                  {t("intro.ctaTitle")}
                </h3>
                <p
                  className={`text-base sm:text-lg mb-8 ${
                    resolvedTheme === "dark" ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {t("intro.ctaText")}
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 max-w-md mx-auto">
                  <div className="flex-1">
                    <ActionButton
                      onClick={() => navigate("/signup")}
                      variant="primary"
                      theme={resolvedTheme}
                      className="w-full"
                    >
                      {t("intro.createAccount")}
                    </ActionButton>
                  </div>

                  <div className="flex-1">
                    <ActionButton
                      onClick={() => navigate("/login")}
                      variant="secondary"
                      theme={resolvedTheme}
                      className="w-full"
                    >
                      {t("intro.signIn")}
                    </ActionButton>
                  </div>
                </div>

                <p
                  className={`text-xs sm:text-sm mt-6 ${
                    resolvedTheme === "dark" ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  {t("intro.footnote")}
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Scroll Progress Bar */}
        <AnimatePresence>
          {scrollProgress > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
            >
              <div
                className={`px-4 py-2 rounded-full backdrop-blur-xl ${
                  resolvedTheme === "dark"
                    ? "bg-[#080F2E]/80 border border-white/15"
                    : "bg-white/90 border border-black/10"
                } shadow-2xl`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(scrollProgress * 100)}
                aria-label="Page scroll progress"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-28 sm:w-36 h-1.5 rounded-full overflow-hidden ${
                      resolvedTheme === "dark" ? "bg-gray-800" : "bg-gray-200"
                    }`}
                  >
                    <motion.div
                      className="h-full bg-gradient-to-r from-[#8B1EF3] via-[#4431F7] to-[#055BFB]"
                      style={{ width: `${scrollProgress * 100}%` }}
                      transition={{ type: "spring", damping: 20 }}
                    />
                  </div>
                  <span
                    className={`text-xs font-bold ${
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

      <div className="sr-only" aria-live="polite">
        {t("intro.srWelcome")}
      </div>

      <style>{`
        .safe-area-bottom {
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }
        @media screen and (max-width: 768px) {
          input, textarea {
            font-size: 16px !important;
          }
        }
        .touch-target {
          min-height: 48px;
          min-width: 48px;
        }
        * {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  );
}
