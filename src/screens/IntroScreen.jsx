// This file must reflect: 'everything should be more extremely advanced, styled, ultra pro max professional creation and robust also production ready and working perfectly smooth'

// src/screens/IntroScreen.jsx
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
import ThemeToggle from "@components/Shared/ThemeToggle";
import { 
  motion, 
  useReducedMotion 
} from "framer-motion";
import { useAuth } from "@context/AuthContext";

/* -------------------- Advanced Error Boundary -------------------- */
class IntroErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("[Arvdoul Intro Error]:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
          <div className="max-w-md text-center p-8 rounded-2xl bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl shadow-2xl border border-gray-100 dark:border-gray-700">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900/30 dark:to-pink-900/30 flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Temporary Glitch</h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
              The intro screen encountered an issue. This won't affect the main application.
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:shadow-lg transition-all duration-300"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* -------------------- Advanced Background Particles (Performance Aware) -------------------- */
const BackgroundParticles = memo(({ theme, shouldAnimate }) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);

  useEffect(() => {
    if (!shouldAnimate || typeof window === "undefined") return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
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
      const particleCount = Math.min(40, Math.floor(width / 40));
      particlesRef.current = Array.from({ length: particleCount }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2 + 1,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.15 + 0.05,
        color: theme === "dark" 
          ? `rgba(59, 130, 246, ${Math.random() * 0.1 + 0.05})`
          : `rgba(99, 102, 241, ${Math.random() * 0.08 + 0.03})`,
      }));
    };

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particlesRef.current.forEach(particle => {
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
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [theme, shouldAnimate]);

  if (!shouldAnimate) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: theme === "dark" ? 0.25 : 0.12 }}
    />
  );
});

/* -------------------- PERFECT CENTERED LOGO -------------------- */
const HeroLogo = memo(({ theme, onClick }) => {
  const [logoError, setLogoError] = useState(false);
  const resolvedTheme = theme === 'system' ? 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : 
    theme;

  const logoPath = useMemo(() => {
    return resolvedTheme === "dark" 
      ? "/logo/logo-dark.png" 
      : "/logo/logo-light.png";
  }, [resolvedTheme]);

  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 flex items-center justify-center shadow-2xl overflow-hidden cursor-pointer"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/10">
        <img 
          src={logoPath} 
          alt="Arvdoul Logo" 
          className="w-full h-full object-contain"
          onError={(e) => {
            e.target.style.display = 'none';
            setLogoError(true);
          }}
        />
        {logoError && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-500">
            <span className="text-2xl font-bold text-white">A</span>
          </div>
        )}
      </div>
    </motion.div>
  );
});

/* -------------------- Perfect Button Component with Shimmer -------------------- */
const ActionButton = memo(({ 
  children, 
  onClick, 
  variant = "primary",
  theme,
  className = "",
  disabled = false,
  ariaLabel 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const baseStyles = "relative px-8 py-3.5 rounded-xl font-semibold transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto";

  const variants = {
    primary: theme === "dark"
      ? "bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white shadow-lg hover:shadow-xl hover:shadow-blue-500/25"
      : "bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white shadow-lg hover:shadow-xl hover:shadow-purple-500/30",
    secondary: theme === "dark"
      ? "bg-gray-800/70 text-gray-200 border border-gray-700/50 hover:bg-gray-700/70 hover:border-gray-600/50"
      : "bg-white/90 text-gray-800 border border-gray-300/60 hover:bg-gray-50/90 hover:border-gray-400/60",
  };

  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ y: 0, scale: 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className} overflow-hidden`}
      aria-label={ariaLabel}
    >
      {/* Shimmer sweep effect */}
      <motion.div
        className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/30 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: isHovered ? "100%" : "-100%" }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      />
      <span className="relative z-10 text-base">{children}</span>
    </motion.button>
  );
});

/* -------------------- Main Component -------------------- */
export default function IntroScreenWrapper() {
  return (
    <IntroErrorBoundary>
      <IntroScreen />
    </IntroErrorBoundary>
  );
}

function IntroScreen() {
  const navigate = useNavigate();
  const themeCtx = useTheme?.() || { theme: "light" };
  const { theme } = themeCtx;
  const auth = useAuth?.() || { user: null, loading: false };

  const prefersReducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [deviceLowMemory, setDeviceLowMemory] = useState(false);

  // Resolve effective theme
  const resolvedTheme = useMemo(() => {
    if (typeof window === "undefined") return "light";
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return theme || "light";
  }, [theme]);

  // Check device memory & reduced motion
  useEffect(() => {
    if (typeof window !== "undefined") {
      setDeviceLowMemory(navigator.deviceMemory < 4);
    }
  }, []);

  // Determine if animations should run
  const shouldAnimate = !prefersReducedMotion && !deviceLowMemory;

  // Prevent scroll on this screen
  useEffect(() => {
    if (typeof document === "undefined") return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Static scroll progress (0% since no scroll)
  const scrollProgress = 0;

  // Background style - matching the original's depth
  const backgroundStyle = useMemo(() => ({
    background: resolvedTheme === "dark"
      ? `radial-gradient(circle at 20% 50%, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 1) 70%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)`
      : `radial-gradient(circle at 20% 50%, rgba(241, 245, 249, 0.6) 0%, rgba(248, 250, 252, 1) 70%), linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)`,
  }), [resolvedTheme]);

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
          <div className="text-sm text-gray-600 dark:text-gray-400 font-medium">Loading Arvdoul...</div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative w-screen h-screen overflow-hidden"
      style={backgroundStyle}
    >
      {/* Background Particles (conditional) */}
      <BackgroundParticles theme={resolvedTheme} shouldAnimate={shouldAnimate} />

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

      {/* Main Content – perfectly centered, never scrolls */}
      <div className="relative z-10 w-full h-full flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          {/* Glassmorphic card wrapper */}
          <div className={`backdrop-blur-md rounded-3xl p-8 sm:p-10 border shadow-2xl ${
            resolvedTheme === "dark" 
              ? "bg-white/5 border-white/10" 
              : "bg-white/10 border-white/20"
          }`}>
            {/* Logo */}
            <HeroLogo 
              theme={theme}
              onClick={() => navigate("/")}
            />

            {/* Bold tagline with animated gradient */}
            <h1 className="text-4xl sm:text-5xl font-extrabold text-center mb-2">
              <span className="block bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 dark:from-blue-300 dark:via-purple-300 dark:to-pink-300 animate-gradientShift">
                The all‑in‑one social universe.
              </span>
            </h1>

            {/* Subtle subtitle */}
            <p className={`text-center text-sm sm:text-base mb-8 ${
              resolvedTheme === "dark" ? "text-gray-300" : "text-gray-700"
            }`}>
              Connect, create, and belong.
            </p>

            {/* CTA Buttons – side by side on mobile and desktop */}
            <div className="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4">
              <ActionButton
                onClick={() => navigate("/signup")}
                variant="primary"
                theme={resolvedTheme}
                className="flex-1"
                ariaLabel="Create account"
              >
                Create Account
              </ActionButton>
              <ActionButton
                onClick={() => navigate("/login")}
                variant="secondary"
                theme={resolvedTheme}
                className="flex-1"
                ariaLabel="Sign in"
              >
                Sign In
              </ActionButton>
            </div>

            <p className={`text-xs text-center mt-6 ${
              resolvedTheme === "dark" ? "text-gray-400" : "text-gray-500"
            }`}>
              No credit card required • Free forever plan available
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Scroll Progress Indicator (static, subtle glow) */}
      <motion.div
        className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className={`px-4 py-1 rounded-full backdrop-blur-md ${
          resolvedTheme === "dark"
            ? "bg-gray-900/70 border border-gray-800/50"
            : "bg-white/80 border border-gray-200/60"
        } shadow-lg`}>
          <div className="flex items-center gap-3">
            <div className={`w-24 h-0.5 rounded-full overflow-hidden ${
              resolvedTheme === "dark" ? "bg-gray-800/50" : "bg-gray-300/50"
            }`}>
              <motion.div
                className="h-full bg-gradient-to-r from-blue-400 to-purple-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                style={{ width: `${scrollProgress * 100}%` }}
              />
            </div>
            <span className={`text-xs font-medium ${
              resolvedTheme === "dark" ? "text-gray-300" : "text-gray-700"
            }`}>
              {Math.round(scrollProgress * 100)}%
            </span>
          </div>
        </div>
      </motion.div>

      {/* Accessibility */}
      <div className="sr-only" aria-live="polite">
        Welcome to Arvdoul. The all‑in‑one social universe. Create account or sign in.
      </div>

      {/* CSS animations and utilities */}
      <style jsx>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradientShift {
          background-size: 200% 200%;
          animation: gradientShift 3s ease infinite;
        }
        /* Mobile safe area support */
        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .pb-safe {
            padding-bottom: env(safe-area-inset-bottom);
          }
        }
        /* Disable tap highlight */
        * {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  );
}