// src/screens/SplashScreen.jsx

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { resolveSplashDestination } from "../utils/profileCompletion.js";
import { hasStoredAuthSession } from "../utils/security.js";
import { ArvdoulEmblem, ArvdoulWordmark } from "../components/Shared/ArvdoulLogo.jsx";

/**
 * World-Class Cinematic Splash Screen
 * 
 * Delivers a refined, luxury brand reveal experience:
 * - Fluid 3D emblem with ambient breathing aura
 * - Wide-tracked geometric wordmark with quiet creator subtitle
 * - Sleek, non-intrusive hairline progress beam
 * - Milestone-driven state resolution without simulated timers or jitter
 * - Full tap/keyboard skip affordance and graceful exit reveal
 */
export default function SplashScreen() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { authInitialized, isAuthenticated, needsOnboarding } = useAuth();
  
  const [progress, setProgress] = useState(25);
  const [isExiting, setIsExiting] = useState(false);
  const mountedRef = useRef(true);

  // Dynamic theme tokens
  const themeConfig = useMemo(() => {
    const resolvedTheme = theme === "system" 
      ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme;
    
    const isDark = resolvedTheme === 'dark';
    return {
      isDark,
      background: isDark ? '#03071B' : '#F8FAFC',
      radialAura: isDark
        ? 'radial-gradient(circle at 50% 48%, rgba(139, 30, 243, 0.22) 0%, rgba(68, 49, 247, 0.08) 40%, transparent 72%)'
        : 'radial-gradient(circle at 50% 48%, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.04) 40%, transparent 72%)',
      auraRing: isDark
        ? 'radial-gradient(circle, rgba(0, 240, 255, 0.25) 0%, rgba(139, 30, 243, 0.35) 50%, transparent 75%)'
        : 'radial-gradient(circle, rgba(37, 99, 235, 0.2) 0%, rgba(124, 58, 237, 0.25) 50%, transparent 75%)',
      beamGradient: 'linear-gradient(90deg, #8B1EF3 0%, #38BDF8 60%, #00F0FF 100%)',
    };
  }, [theme]);

  // Handle immediate navigation
  const handleProceed = useCallback(() => {
    if (!mountedRef.current) return;
    const hasStored = hasStoredAuthSession();
    const destination = resolveSplashDestination({
      isAuthenticated,
      needsOnboarding,
      hasStoredSession: hasStored,
    });
    navigate(destination, { 
      replace: true,
      state: { fromSplash: true }
    });
  }, [isAuthenticated, needsOnboarding, navigate]);

  // Milestone-driven progress based solely on auth initialization
  useEffect(() => {
    mountedRef.current = true;
    if (authInitialized) {
      setProgress(100);
    } else {
      setProgress(60);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [authInitialized]);

  // Resolve session and initiate graceful transition
  useEffect(() => {
    let completeTimer;
    let exitTimer;

    const executeExit = () => {
      if (!mountedRef.current) return;
      setIsExiting(true);
      exitTimer = setTimeout(() => {
        handleProceed();
      }, 350);
    };

    if (authInitialized) {
      // Session resolved: short pause to appreciate brand reveal then exit
      completeTimer = setTimeout(executeExit, 400);
    } else {
      // Safety ceiling: max 7s timeout for offline or connection drops
      completeTimer = setTimeout(executeExit, 7000);
    }

    return () => {
      clearTimeout(completeTimer);
      clearTimeout(exitTimer);
    };
  }, [authInitialized, handleProceed]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="splash-screen"
        initial={{ opacity: 0 }}
        animate={{ opacity: isExiting ? 0 : 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center cursor-pointer select-none overflow-hidden"
        onClick={handleProceed}
        role="button"
        tabIndex={0}
        aria-label="Arvdoul - Enter"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleProceed();
          }
        }}
        style={{ background: themeConfig.background }}
      >
        {/* Ambient Radial Bloom */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none transition-opacity duration-700"
          style={{ background: themeConfig.radialAura }}
        />

        {/* Central Brand Composition */}
        <motion.div 
          initial={{ scale: 0.92, opacity: 0, y: 12 }}
          animate={{ 
            scale: isExiting ? 1.04 : 1, 
            opacity: isExiting ? 0 : 1,
            y: 0 
          }}
          transition={{ 
            type: "spring", 
            stiffness: 280, 
            damping: 24,
            mass: 0.8 
          }}
          className="relative z-10 flex flex-col items-center justify-center px-6"
        >
          {/* Emblem with Breathing Aura Ring */}
          <div className="relative flex items-center justify-center mb-6">
            {/* Ambient Breathing Aura */}
            <motion.div
              aria-hidden="true"
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.35, 0.65, 0.35],
              }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="absolute w-36 h-36 rounded-full blur-2xl pointer-events-none"
              style={{ background: themeConfig.auraRing }}
            />

            {/* Official 3D Insignia */}
            <div className="relative z-10 drop-shadow-[0_8px_32px_rgba(139,30,243,0.35)]">
              <ArvdoulEmblem
                size={104}
                theme={themeConfig.isDark ? 'dark' : 'light'}
                animate={true}
                showPlate={true}
              />
            </div>
          </div>

          {/* Wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="flex flex-col items-center text-center"
          >
            <ArvdoulWordmark
              variant={themeConfig.isDark ? "gradient" : "auto"}
              size="xl"
            />
            <span className="mt-2.5 text-[10px] sm:text-[11px] font-semibold tracking-[0.28em] uppercase text-slate-500 dark:text-slate-400 select-none">
              The Creator Ecosystem
            </span>
          </motion.div>

          {/* Sleek Hairline Progress Beam */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.3 }}
            className="mt-8 w-36 sm:w-44 h-[2px] rounded-full overflow-hidden bg-black/5 dark:bg-white/10"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: themeConfig.beamGradient }}
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 220, damping: 28 }}
            />
          </motion.div>
        </motion.div>

        {/* Quiet Minimal Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="absolute bottom-7 text-center pointer-events-none select-none"
        >
          <span className="text-[11px] tracking-widest uppercase font-medium text-slate-400 dark:text-slate-600">
            © {new Date().getFullYear()} Arvdoul
          </span>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}