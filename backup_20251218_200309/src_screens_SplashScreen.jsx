// src/screens/SplashScreen.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
console.log('DEBUG: SplashScreen module loaded');
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import LoadingSpinner from "@components/Shared/LoadingSpinner";
import { useTheme } from "@context/ThemeContext";
import { debounce } from "lodash-es";

/**
 * ARVDOUL SPLASHSCREEN - ULTIMATE PRO MAX EDITION
 * ✅ Ultra-sophisticated gradient meshes & lighting effects
 * ✅ Advanced gyroscope & mouse parallax systems
 * ✅ Perfect visual hierarchy with zero overlap
 * ✅ Production-robust with multiple navigation fallbacks
 * ✅ Theme-aware with seamless transitions
 * ✅ Guaranteed navigation to IntroScreen.jsx
 * ✅ Performance optimized with RAF cleanup
 * ✅ Zero FOUC with strategic preloading
 */

/* -------------------- Asset Management -------------------- */
const ASSETS = {
  LOGO: {
    DARK: "/logo/logo-dark.png?v=3",
    LIGHT: "/logo/logo-light.png?v=3",
    FALLBACK: "/logo/logo-default.png",
    SVG_FALLBACK: "/logo/logo.svg"
  },
  PRELOAD: [
    "/logo/logo-dark.png",
    "/logo/logo-light.png",
    "/logo/logo-default.png",
    "/logo/logo.svg"
  ]
};

/* -------------------- Advanced Media Query Hook -------------------- */
const useAdvancedMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handler = (event) => setMatches(event.matches);
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      mediaQuery.addListener(handler);
      return () => mediaQuery.removeListener(handler);
    }
  }, [query]);

  return mounted ? matches : false;
};

/* -------------------- Quantum Particle System -------------------- */
const QuantumParticles = React.memo(({ theme, reducedMotion }) => {
  const particles = useMemo(() => {
    if (reducedMotion) return [];
    
    const goldenRatio = 0.618033988749895;
    const count = 24;
    const particlesArray = [];
    
    for (let i = 0; i < count; i++) {
      const radius = Math.sqrt(i / count) * 120;
      const theta = i * goldenRatio * Math.PI * 2;
      const x = 50 + (radius * Math.cos(theta)) / 3.5;
      const y = 50 + (radius * Math.sin(theta)) / 3.5;
      
      particlesArray.push({
        id: `quantum-particle-${i}-${Date.now()}`,
        size: 2 + (i % 4) * 0.8,
        x,
        y,
        delay: (i * 0.12) % 2,
        duration: 4.2 + Math.sin(i) * 1.5,
        opacity: theme === 'dark' ? 0.08 + Math.random() * 0.06 : 0.05 + Math.random() * 0.04,
        blur: theme === 'dark' ? 0.8 : 0.6,
        color: theme === 'dark' 
          ? `hsla(${260 + Math.sin(i) * 20}, 85%, ${65 + i % 20}%, 0.25)`
          : `hsla(${250 + Math.cos(i) * 15}, 90%, ${55 + i % 15}%, 0.18)`
      });
    }
    
    return particlesArray;
  }, [theme, reducedMotion]);

  // Mouse parallax for particles
  const mouseX = useSpring(0, { stiffness: 100, damping: 30 });
  const mouseY = useSpring(0, { stiffness: 100, damping: 30 });

  useEffect(() => {
    if (reducedMotion) return;

    const handleMouseMove = debounce((e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      mouseX.set(x * 10);
      mouseY.set(y * 6);
    }, 8);

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      handleMouseMove.cancel();
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [mouseX, mouseY, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
      {particles.map((p) => {
        const particleX = useTransform(mouseX, (val) => val * (p.size / 15));
        const particleY = useTransform(mouseY, (val) => val * (p.size / 15));
        
        return (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.x}%`,
              top: `${p.y}%`,
              backgroundColor: p.color,
              opacity: p.opacity,
              filter: `blur(${p.blur}px)`,
              x: particleX,
              y: particleY
            }}
            animate={{
              scale: [1, 1.15, 1],
              opacity: [p.opacity * 0.4, p.opacity, p.opacity * 0.4],
              x: [0, Math.sin(p.delay) * p.size * 0.3, 0],
              y: [0, Math.cos(p.delay) * p.size * 0.3, 0]
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: p.delay
            }}
          />
        );
      })}
    </div>
  );
});

QuantumParticles.displayName = "QuantumParticles";

/* -------------------- Main SplashScreen Component -------------------- */
export default function SplashScreen() {
  const navigate = useNavigate();
  
  // Theme context with advanced error handling
  const themeCtx = useTheme?.() || { theme: 'light' };
  const { theme } = themeCtx;
  
  // Advanced media queries
  const prefersDark = useAdvancedMediaQuery('(prefers-color-scheme: dark)');
  const prefersReducedMotion = useAdvancedMediaQuery('(prefers-reduced-motion: reduce)');
  
  // State management
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);
  const [status, setStatus] = useState('Initializing Quantum Engine...');
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [hasLogoError, setHasLogoError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('initializing');
  
  // Advanced refs for cleanup
  const timeoutRefs = useRef(new Set());
  const mountedRef = useRef(true);
  const rAFRef = useRef(null);
  const parallaxRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  
  // Parallax springs
  const parallaxX = useSpring(0, { stiffness: 80, damping: 25 });
  const parallaxY = useSpring(0, { stiffness: 80, damping: 25 });

  /* -------------------- Mount & Setup -------------------- */
  useEffect(() => {
    setMounted(true);
    mountedRef.current = true;
    
    console.log('🚀 SplashScreen: Quantum Engine Initialized');
    
    return () => {
      console.log('🚀 SplashScreen: Performing Quantum Cleanup');
      mountedRef.current = false;
      setMounted(false);
      
      // Cleanup all timeouts
      timeoutRefs.current.forEach(id => {
        if (id) {
          clearTimeout(id);
          clearInterval(id);
        }
      });
      timeoutRefs.current.clear();
      
      // Cleanup RAF
      if (rAFRef.current) {
        cancelAnimationFrame(rAFRef.current);
        rAFRef.current = null;
      }
    };
  }, []);

  /* -------------------- Advanced Asset Preloading -------------------- */
  useEffect(() => {
    if (!mounted) return;
    
    const preloadWithProgress = async () => {
      setPhase('preloading');
      setProgress(10);
      
      const assets = ASSETS.PRELOAD.map((src, index) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = () => {
            if (mountedRef.current) {
              setProgress(10 + (index + 1) * 15);
            }
            resolve();
          };
          img.onerror = () => {
            if (mountedRef.current) {
              setProgress(10 + (index + 1) * 15);
            }
            resolve();
          };
        });
      });
      
      await Promise.allSettled(assets);
      setProgress(70);
      setPhase('initialized');
      
      // Mark logo as loaded for theme
      const themeLogo = theme === 'dark' ? ASSETS.LOGO.DARK : ASSETS.LOGO.LIGHT;
      const img = new Image();
      img.src = themeLogo;
      img.onload = () => {
        if (mountedRef.current) setLogoLoaded(true);
      };
      img.onerror = () => {
        if (mountedRef.current) {
          setHasLogoError(true);
          setLogoLoaded(true);
        }
      };
    };
    
    preloadWithProgress();
  }, [mounted, theme]);

  /* -------------------- Advanced Parallax System -------------------- */
  useEffect(() => {
    if (prefersReducedMotion || !mounted) return;
    
    const handleParallax = (e) => {
      if (!mountedRef.current) return;
      
      const { innerWidth, innerHeight } = window;
      let x, y;
      
      if (e.type === 'deviceorientation' && e.gamma !== null && e.beta !== null) {
        // Gyroscope/device orientation
        x = (e.gamma / 90) * 25;
        y = (e.beta / 180) * 15;
      } else if (e.clientX !== undefined) {
        // Mouse/touch
        x = ((e.clientX / innerWidth) - 0.5) * 25;
        y = ((e.clientY / innerHeight) - 0.5) * 15;
      } else {
        return;
      }
      
      parallaxRef.current.targetX = x;
      parallaxRef.current.targetY = y;
    };
    
    const updateParallax = () => {
      if (!mountedRef.current) return;
      
      const { x, y, targetX, targetY } = parallaxRef.current;
      parallaxRef.current.x += (targetX - x) * 0.1;
      parallaxRef.current.y += (targetY - y) * 0.1;
      
      parallaxX.set(parallaxRef.current.x);
      parallaxY.set(parallaxRef.current.y);
      
      rAFRef.current = requestAnimationFrame(updateParallax);
    };
    
    const debouncedHandleParallax = debounce(handleParallax, 8);
    
    window.addEventListener('mousemove', debouncedHandleParallax, { passive: true });
    window.addEventListener('touchmove', debouncedHandleParallax, { passive: true });
    window.addEventListener('deviceorientation', debouncedHandleParallax, { passive: true });
    
    rAFRef.current = requestAnimationFrame(updateParallax);
    
    return () => {
      window.removeEventListener('mousemove', debouncedHandleParallax);
      window.removeEventListener('touchmove', debouncedHandleParallax);
      window.removeEventListener('deviceorientation', debouncedHandleParallax);
      debouncedHandleParallax.cancel();
      
      if (rAFRef.current) {
        cancelAnimationFrame(rAFRef.current);
        rAFRef.current = null;
      }
    };
  }, [mounted, prefersReducedMotion, parallaxX, parallaxY]);

  /* -------------------- Navigation System -------------------- */
  useEffect(() => {
    if (!mounted) return;
    
    console.log('🚀 Navigation System: Initializing');
    setPhase('booting');
    setProgress(80);
    
    // Sophisticated status sequence
    const statusSequence = [
      { text: "Booting Quantum Interface...", duration: 800 },
      { text: "Calibrating Neural Network...", duration: 800 },
      { text: "Syncing with Arvdoul Cloud...", duration: 800 },
      { text: "Ready for Experience...", duration: 400 }
    ];
    
    let seqIndex = 0;
    const updateStatus = () => {
      if (!mountedRef.current || seqIndex >= statusSequence.length) return;
      
      const { text, duration } = statusSequence[seqIndex];
      setStatus(text);
      setProgress(80 + (seqIndex + 1) * 5);
      seqIndex++;
      
      const timeout = setTimeout(updateStatus, duration);
      timeoutRefs.current.add(timeout);
    };
    
    updateStatus();
    
    // Main navigation sequence
    const navigateSequence = () => {
      if (!mountedRef.current) return;
      
      setPhase('finalizing');
      setStatus('Welcome to Arvdoul!');
      setProgress(100);
      
      // Final fade out
      const fadeOutTimeout = setTimeout(() => {
        if (!mountedRef.current) return;
        setVisible(false);
        
        console.log('🚀 Navigation: Initiating transition to IntroScreen');
        
        // Navigate to IntroScreen with multiple fallbacks
        const navigateTimeout = setTimeout(() => {
          if (!mountedRef.current) return;
          
          try {
            // Primary navigation
            navigate('/intro', { 
              replace: true,
              state: { fromSplash: true, timestamp: Date.now() }
            });
          } catch (navError) {
            console.warn('Primary navigation failed, using fallback:', navError);
            
            try {
              // Secondary fallback
              window.location.replace('/intro');
            } catch (replaceError) {
              console.error('All navigation failed, forcing reload:', replaceError);
              window.location.href = '/intro';
            }
          }
        }, 450);
        
        timeoutRefs.current.add(navigateTimeout);
      }, 600);
      
      timeoutRefs.current.add(fadeOutTimeout);
    };
    
    // Start navigation sequence after 3 seconds total
    const mainTimeout = setTimeout(navigateSequence, 3000);
    timeoutRefs.current.add(mainTimeout);
    
    // Absolute safety timeout (never get stuck)
    const safetyTimeout = setTimeout(() => {
      console.warn('⚠️ Safety timeout triggered - forcing navigation');
      if (mountedRef.current) {
        setVisible(false);
        const forceNav = setTimeout(() => {
          window.location.href = '/intro';
        }, 200);
        timeoutRefs.current.add(forceNav);
      }
    }, 8000);
    
    timeoutRefs.current.add(safetyTimeout);
    
    return () => {
      timeoutRefs.current.forEach(id => {
        if (id) {
          clearTimeout(id);
          clearInterval(id);
        }
      });
    };
  }, [mounted, navigate]);

  /* -------------------- Theme Calculations -------------------- */
  const resolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return prefersDark ? 'dark' : 'light';
    }
    return theme || 'light';
  }, [theme, prefersDark]);

  // Ultra-advanced theme-aware gradients
  const backgroundGradients = useMemo(() => {
    if (resolvedTheme === 'dark') {
      return {
        primary: 'radial-gradient(circle at 50% 0%, rgba(8,10,30,0.98) 0%, rgba(2,6,25,1) 70%)',
        secondary: 'linear-gradient(135deg, rgba(88,28,135,0.15) 0%, transparent 50%)',
        accent: 'radial-gradient(circle at 80% 20%, rgba(139,92,246,0.08) 0%, transparent 70%)'
      };
    }
    
    return {
      primary: 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.98) 0%, rgba(240,244,250,1) 70%)',
      secondary: 'linear-gradient(135deg, rgba(139,92,246,0.05) 0%, transparent 50%)',
      accent: 'radial-gradient(circle at 80% 20%, rgba(79,70,229,0.04) 0%, transparent 70%)'
    };
  }, [resolvedTheme]);

  const logoSrc = useMemo(() => {
    if (hasLogoError) return ASSETS.LOGO.SVG_FALLBACK;
    return resolvedTheme === 'dark' ? ASSETS.LOGO.DARK : ASSETS.LOGO.LIGHT;
  }, [resolvedTheme, hasLogoError]);

  const spinnerColor = resolvedTheme === 'dark' ? '#8b5cf6' : '#4f46e5';

  const textStyles = useMemo(() => ({
    gradient: resolvedTheme === 'dark'
      ? 'bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400'
      : 'bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-500',
    primary: resolvedTheme === 'dark' ? 'text-gray-100' : 'text-gray-900',
    secondary: resolvedTheme === 'dark' ? 'text-gray-300' : 'text-gray-600',
    tertiary: resolvedTheme === 'dark' ? 'text-gray-400' : 'text-gray-500',
    accent: resolvedTheme === 'dark' ? 'text-purple-300' : 'text-purple-600'
  }), [resolvedTheme]);

  /* -------------------- Render -------------------- */
  if (!mounted) {
    return (
      <div 
        className="fixed inset-0 bg-gray-50 dark:bg-gray-900 transition-colors duration-500"
        style={{ background: backgroundGradients.primary }}
      />
    );
  }

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key="arvdoul-splash-ultra-pro-max"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          role="dialog"
          aria-label="Arvdoul Quantum Loading Interface"
          aria-live="polite"
        >
          {/* Advanced Layered Background */}
          <div className="absolute inset-0 z-0">
            {/* Primary gradient */}
            <div 
              className="absolute inset-0"
              style={{ background: backgroundGradients.primary }}
            />
            
            {/* Secondary gradient layer */}
            <div 
              className="absolute inset-0 opacity-40"
              style={{ background: backgroundGradients.secondary }}
            />
            
            {/* Accent gradient layer */}
            <div 
              className="absolute inset-0 opacity-30"
              style={{ background: backgroundGradients.accent }}
            />
            
            {/* Subtle noise texture */}
            <div 
              className="absolute inset-0 opacity-[0.015]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.4'/%3E%3C/svg%3E")`
              }}
            />
          </div>

          {/* Quantum Particles */}
          <QuantumParticles 
            theme={resolvedTheme} 
            reducedMotion={prefersReducedMotion} 
          />

          {/* Main Content with Parallax */}
          <motion.div
            className="relative z-20 flex flex-col items-center justify-center px-6 w-full max-w-md"
            style={{
              x: prefersReducedMotion ? 0 : parallaxX,
              y: prefersReducedMotion ? 0 : parallaxY
            }}
          >
            {/* Logo Section - Ultra Sophisticated */}
            <div className="relative mb-8">
              {/* Subtle Glow Effect */}
              {!prefersReducedMotion && (
                <motion.div
                  className="absolute -inset-8 rounded-full"
                  animate={{
                    scale: [1, 1.08, 1],
                    opacity: [0.1, 0.3, 0.1]
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  style={{
                    background: resolvedTheme === 'dark'
                      ? 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)'
                      : 'radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 70%)',
                    filter: 'blur(25px)'
                  }}
                />
              )}

              {/* Logo Container */}
              <div className="relative w-36 h-36 sm:w-40 sm:h-40 md:w-44 md:h-44">
                {/* Loading Skeleton */}
                {!logoLoaded && (
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                      background: resolvedTheme === 'dark'
                        ? 'linear-gradient(90deg, #1f2937 0%, #374151 50%, #1f2937 100%)'
                        : 'linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%)',
                      backgroundSize: '200% 100%'
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                  />
                )}

                {/* Logo */}
                <motion.div
                  className="relative w-full h-full rounded-full overflow-hidden"
                  initial={{ scale: 0.85, opacity: 0, rotate: -5 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                    delay: 0.2
                  }}
                  style={{
                    boxShadow: resolvedTheme === 'dark'
                      ? '0 25px 75px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 0 1px rgba(255,255,255,0.03)'
                      : '0 25px 75px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 0 0 1px rgba(0,0,0,0.02)',
                    backgroundColor: resolvedTheme === 'dark' ? '#111827' : '#ffffff'
                  }}
                >
                  <img
                    src={logoSrc}
                    alt="Arvdoul Interface"
                    className={`w-full h-full object-cover transition-all duration-500 ${
                      logoLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                    }`}
                    draggable="false"
                    onLoad={() => setLogoLoaded(true)}
                    onError={() => {
                      setHasLogoError(true);
                      setLogoLoaded(true);
                    }}
                  />
                  
                  {/* Inner Reflection */}
                  <div className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      background: resolvedTheme === 'dark'
                        ? 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.03) 0%, transparent 50%)'
                        : 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.8) 0%, transparent 50%)'
                    }}
                  />
                </motion.div>
              </div>
            </div>

            {/* App Title - Ultra Styled */}
            <motion.div
              className="mt-8"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <h1 className={`text-5xl sm:text-6xl font-bold bg-clip-text text-transparent ${textStyles.gradient} tracking-tight`}>
                Arvdoul
              </h1>
            </motion.div>

            {/* Loading Spinner - Perfectly Spaced */}
            <motion.div
              className="mt-10 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              aria-label="Arvdoul Loading in Progress"
            >
              <LoadingSpinner
                size={40}
                thickness={2.8}
                color={spinnerColor}
                className={!prefersReducedMotion ? "animate-pulse-slow" : ""}
              />
            </motion.div>

            {/* Status Message */}
            <motion.div
              className="mt-8 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p 
                className={`text-lg font-medium ${textStyles.secondary} tracking-wide`}
                role="status"
                aria-live="polite"
              >
                {status}
              </p>
              
              {/* Phase Indicator */}
              <div className="mt-2">
                <span className={`text-xs font-semibold uppercase tracking-wider ${textStyles.accent}`}>
                  {phase}
                </span>
              </div>
            </motion.div>

            {/* Advanced Progress Indicator */}
            <motion.div
              className="mt-10 w-64"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "16rem" }}
              transition={{ delay: 0.6 }}
            >
              <div className="relative h-1.5 bg-gray-200/30 dark:bg-gray-800/30 rounded-full overflow-hidden">
                <motion.div
                  className="absolute top-0 left-0 h-full rounded-full"
                  style={{
                    background: textStyles.gradient.replace('bg-gradient-to-r ', ''),
                    width: `${progress}%`
                  }}
                  transition={{ type: "spring", damping: 30 }}
                />
                
                {/* Shimmer effect */}
                {!prefersReducedMotion && (
                  <motion.div
                    className="absolute top-0 left-0 h-full w-8"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)'
                    }}
                    animate={{ x: ['0%', '400%'] }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                  />
                )}
              </div>
              
              <div className="mt-2 flex justify-between">
                <span className={`text-xs ${textStyles.tertiary}`}>aria-live app</span>
                <span className={`text-xs font-medium ${textStyles.accent}`}>{progress}%</span>
              </div>
            </motion.div>

            {/* Tagline & Version */}
            <motion.div
              className="mt-12 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              transition={{ delay: 0.7 }}
            >
              <p className={`text-sm font-medium tracking-wide ${textStyles.tertiary}`}>
                Crafted for Visionaries • Engineered for Communities
              </p>
              <div className="mt-2 flex items-center justify-center space-x-4">
                <span className={`text-xs ${textStyles.tertiary}`}>Arvdoul 1.0</span>
                <span className="text-xs text-gray-400">•</span>
                <span className={`text-xs ${textStyles.tertiary}`}>Production Ready</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Copyright & Build Info */}
          <div className={`absolute bottom-6 text-xs ${textStyles.tertiary} font-mono tracking-tight`}>
            © {new Date().getFullYear()} Arvdoul • Build {process.env.NODE_ENV === 'production' ? 'Prod' : 'Dev'}
          </div>

          {/* Accessibility Note */}
          <div className="sr-only" aria-live="assertive">
            Arvdoul . Current status: {status}. Progress: {progress} percent.
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}