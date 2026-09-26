// src/screens/SplashScreen.jsx - ULTIMATE PROFESSIONAL PRODUCTION VERSION
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import LoadingSpinner from "@components/Shared/LoadingSpinner";
import { resolveSplashDestination } from "../utils/profileCompletion.js";
import { hasStoredAuthSession } from "../utils/security.js";

export default function SplashScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { authInitialized, isAuthenticated, needsOnboarding } = useAuth();
  
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Initializing");
  const [isReady, setIsReady] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  
  const mountedRef = useRef(true);
  const progressIntervalRef = useRef(null);
  const statusTimeoutRef = useRef(null);
  const completeTimerRef = useRef(null);

  // Perfect theme configuration
  const themeConfig = useMemo(() => {
    const resolvedTheme = theme === "system" 
      ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    
    return {
      isDark: resolvedTheme === 'dark',
      logo: resolvedTheme === 'dark' ? '/logo/logo-dark.png' : '/logo/logo-light.png',
      fallbackLogo: resolvedTheme === 'dark' ? '/logo/logo-default.png' : '/logo/logo-default.png',
      background: resolvedTheme === 'dark'
        ? '#03071B'
        : '#F6F8FC',
      textPrimary: resolvedTheme === 'dark' ? '#FFFFFF' : '#111827',
      textSecondary: resolvedTheme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
      accentGradient: 'linear-gradient(135deg, #8B1EF3 0%, #4431F7 50%, #055BFB 100%)',
      spinnerColor: '#8B1EF3'
    };
  }, [theme]);

  // Advanced status sequence
  const statusSequence = useMemo(() => [
    { text: "Initializing", progress: 10 },
    { text: "Loading Assets", progress: 25 },
    { text: "Preparing UI", progress: 45 },
    { text: "Connecting Services", progress: 65 },
    { text: "Securing Connection", progress: 80 },
    { text: "Ready", progress: 95 }
  ], []);

  // Preload logo with perfect error handling
  const preloadLogo = useCallback(() => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = themeConfig.logo;
      
      img.onload = () => {
        if (mountedRef.current) {
          setLogoLoaded(true);
          setProgress(15);
        }
        resolve(true);
      };
      
      img.onerror = () => {
        console.warn('Logo failed to load, using fallback');
        // Try fallback logo
        const fallbackImg = new Image();
        fallbackImg.src = themeConfig.fallbackLogo;
        fallbackImg.onload = () => {
          if (mountedRef.current) {
            themeConfig.logo = themeConfig.fallbackLogo;
            setLogoLoaded(true);
            setProgress(15);
          }
          resolve(true);
        };
        fallbackImg.onerror = () => {
          // Final fallback to canvas
          const canvas = document.createElement('canvas');
          canvas.width = 200;
          canvas.height = 200;
          const ctx = canvas.getContext('2d');
          
          // Draw perfect gradient circle
          const gradient = ctx.createRadialGradient(100, 100, 0, 100, 100, 100);
          gradient.addColorStop(0, themeConfig.isDark ? '#3b82f6' : '#2563eb');
          gradient.addColorStop(1, themeConfig.isDark ? '#8b5cf6' : '#7c3aed');
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(100, 100, 80, 0, Math.PI * 2);
          ctx.fill();
          
          // Add letter 'A' with perfect centering
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 70px "Inter", -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('A', 100, 100);
          
          themeConfig.logo = canvas.toDataURL();
          
          if (mountedRef.current) {
            setLogoLoaded(true);
            setProgress(15);
          }
          resolve(true);
        };
      };
    });
  }, [themeConfig]);

  // Smooth realistic splash progress animation matching user expectations
  useEffect(() => {
    mountedRef.current = true;
    preloadLogo();

    let currentProgress = 8;
    setProgress(currentProgress);

    const interval = setInterval(() => {
      if (!mountedRef.current) return;
      currentProgress += Math.random() * 8 + 5;
      if (currentProgress >= 96) {
        currentProgress = 96;
        clearInterval(interval);
      }
      setProgress(Math.min(96, Math.round(currentProgress)));

      // Update status text according to statusSequence
      for (let i = statusSequence.length - 1; i >= 0; i--) {
        if (currentProgress >= statusSequence[i].progress) {
          setStatus(statusSequence[i].text);
          break;
        }
      }
    }, 120);

    return () => {
      clearInterval(interval);
    };
  }, [preloadLogo, statusSequence]);

  // When auth initializes (or safety timeout expires), complete to 100% and navigate cleanly
  useEffect(() => {
    let completeTimer;
    let navTimer;

    const hasStored = hasStoredAuthSession();

    const proceed = () => {
      if (!mountedRef.current) return;
      setProgress(100);
      setStatus("Ready");
      setShowComplete(true);

      navTimer = setTimeout(() => {
        if (!mountedRef.current) return;
        const target = resolveSplashDestination({
          isAuthenticated,
          needsOnboarding,
          hasStoredSession: hasStored
        });
        navigate(target, { 
          replace: true,
          state: { fromSplash: true }
        });
      }, 350);
    };

    if (authInitialized) {
      // Auth is resolved: finish progress bar and navigate to destination immediately
      completeTimer = setTimeout(proceed, 450);
    } else {
      // User may be logged in on device: NEVER navigate to /intro before auth initializes!
      // Keep splash active while auth resolves session. Max 7s safety net for offline/error.
      setStatus("Connecting Services");
      completeTimer = setTimeout(proceed, 7000);
    }

    return () => {
      clearTimeout(completeTimer);
      clearTimeout(navTimer);
    };
  }, [authInitialized, isAuthenticated, needsOnboarding, navigate]);

  // Quick skip on tap / click
  const handleSkip = useCallback(() => {
    const target = resolveSplashDestination({
      isAuthenticated,
      needsOnboarding,
      hasStoredSession: hasStoredAuthSession()
    });
    navigate(target, { replace: true, state: { fromSplash: true } });
  }, [isAuthenticated, needsOnboarding, navigate]);

  // Circular logo component
  const PerfectLogo = useMemo(() => (
    <div className="relative w-28 h-28">
      {/* Circular container */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          type: "spring",
          stiffness: 320,
          damping: 22,
          mass: 0.8
        }}
        className="w-full h-full rounded-full overflow-hidden bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm shadow-2xl relative z-10 p-1 flex items-center justify-center"
        style={{
          boxShadow: themeConfig.isDark
            ? '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)'
            : '0 20px 40px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(0, 0, 0, 0.08)'
        }}
      >
        {/* Logo image */}
        <img
          src={themeConfig.logo}
          alt="Arvdoul"
          className="w-full h-full object-cover rounded-full transition-all duration-300"
          onLoad={() => {
            if (mountedRef.current) {
              setLogoLoaded(true);
            }
          }}
          onError={(e) => {
            e.target.style.display = 'none';
            const parent = e.target.parentElement;
            if (parent) {
              parent.className = "w-full h-full rounded-full flex items-center justify-center";
              parent.style.background = themeConfig.accentGradient;
              const fallback = document.createElement('div');
              fallback.className = "text-4xl font-bold text-white tracking-wider";
              fallback.style.fontFamily = "'Inter', -apple-system, sans-serif";
              fallback.textContent = "A";
              parent.appendChild(fallback);
            }
          }}
        />
      </motion.div>
    </div>
  ), [themeConfig]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="splash-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center cursor-pointer select-none"
        onClick={handleSkip}
        role="button"
        tabIndex={0}
        aria-label="Skip splash screen"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSkip(); }}
        style={{ background: themeConfig.background }}
      >
        {/* Subtle animated gradient background */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          transition={{ duration: 1 }}
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${
              themeConfig.isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(79, 70, 229, 0.08)'
            } 0%, transparent 50%)`
          }}
        />

        {/* Main Content Container */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-sm px-6 space-y-8">
          
          {/* Perfect Circular Logo */}
          {PerfectLogo}
          
          {/* App Name - Professional Typography */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            className="text-center"
          >
            <h1 
              className="text-3xl font-bold tracking-tight"
              style={{ 
                color: themeConfig.textPrimary,
                fontFamily: "'Inter', -apple-system, sans-serif",
                fontWeight: 700,
                letterSpacing: '-0.025em'
              }}
            >
              Arvdoul
            </h1>
          </motion.div>

          {/* Advanced Loading Indicator */}
          <div className="w-full space-y-6">
            {/* Loading Spinner */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, duration: 0.3 }}
              className="flex justify-center"
            >
              <LoadingSpinner
                size={52}
                color={themeConfig.spinnerColor}
                thickness={3.5}
                className="opacity-90"
              />
            </motion.div>

            {/* Status Text */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center space-y-1"
            >
              <p className="text-base font-medium tracking-wide"
                style={{ 
                  color: themeConfig.textPrimary,
                  fontFamily: "'Inter', -apple-system, sans-serif",
                  fontWeight: 500
                }}
              >
                {status}
              </p>
              <p className="text-sm tracking-wide opacity-75"
                style={{ 
                  color: themeConfig.textSecondary,
                  fontFamily: "'Inter', -apple-system, sans-serif"
                }}
              >
                {progress < 100 ? "Preparing your experience" : "Ready to launch"}
              </p>
            </motion.div>

            {/* Advanced Styled Progress Bar */}
            <div className="space-y-3">
              {/* Progress Bar Container */}
              <div className="relative h-2 w-full rounded-full overflow-hidden"
                style={{ 
                  backgroundColor: themeConfig.isDark 
                    ? 'rgba(255, 255, 255, 0.08)' 
                    : 'rgba(0, 0, 0, 0.08)' 
                }}
              >
                {/* Animated Background Shine */}
                <motion.div
                  className="absolute inset-0"
                  animate={{
                    backgroundPosition: ['0% 0%', '100% 0%'],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear"
                  }}
                  style={{
                    background: `linear-gradient(90deg, 
                      transparent 0%, 
                      rgba(255, 255, 255, ${themeConfig.isDark ? '0.05' : '0.1'}) 50%, 
                      transparent 100%)`,
                    backgroundSize: '200% 100%'
                  }}
                />
                
                {/* Main Progress Fill */}
                <motion.div
                  className="h-full rounded-full relative overflow-hidden"
                  style={{
                    width: `${progress}%`,
                    background: themeConfig.accentGradient,
                    boxShadow: `0 0 20px ${themeConfig.isDark ? 'rgba(139, 92, 246, 0.4)' : 'rgba(79, 70, 229, 0.3)'}`
                  }}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", damping: 30, stiffness: 200 }}
                >
                  {/* Animated Shine Overlay */}
                  <motion.div
                    className="absolute inset-0"
                    animate={{
                      x: ['-100%', '100%'],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent)'
                    }}
                  />
                </motion.div>
              </div>
              
              {/* Progress Details */}
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-medium tracking-wide"
                  style={{ 
                    color: themeConfig.textSecondary,
                    fontFamily: "'Inter', -apple-system, sans-serif"
                  }}
                >
                  Loading
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tracking-tight"
                    style={{ 
                      color: themeConfig.textPrimary,
                      fontFamily: "'Inter', -apple-system, sans-serif"
                    }}
                  >
                    {Math.round(progress)}%
                  </span>
                  {progress >= 100 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-2 h-2 rounded-full"
                      style={{ 
                        backgroundColor: themeConfig.isDark ? '#10b981' : '#059669'
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Completion Indicator */}
          {showComplete && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-medium tracking-wide"
                  style={{ 
                    color: themeConfig.isDark ? '#10b981' : '#059669',
                    fontFamily: "'Inter', -apple-system, sans-serif"
                  }}
                >
                  Ready • Launching...
                </span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="absolute bottom-8 text-center"
        >
          <p className="text-xs tracking-wide"
            style={{ 
              color: themeConfig.textSecondary,
              fontFamily: "'Inter', -apple-system, sans-serif",
              opacity: 0.7
            }}
          >
            © {new Date().getFullYear()} Arvdoul
          </p>
        </motion.div>

        {/* Performance Optimization */}
        <div 
          className="sr-only" 
          aria-live="polite" 
          aria-atomic="true"
          role="status"
        >
          {status}. Loading progress: {Math.round(progress)} percent.
        </div>

        {/* Inline Performance Styles */}
        <style>{`
          /* Performance optimizations */
          img {
            content-visibility: auto;
            will-change: transform;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
          }
          
          /* Smooth everything */
          * {
            -webkit-tap-highlight-color: transparent;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            backface-visibility: hidden;
          }
          
          /* Reduced motion */
          @media (prefers-reduced-motion: reduce) {
            *,
            *::before,
            *::after {
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
              transition-duration: 0.01ms !important;
              scroll-behavior: auto !important;
            }
          }
        `}</style>
      </motion.div>
    </AnimatePresence>
  );
}