// src/context/ThemeProvider.jsx - ARVDOUL ULTIMATE THEME SYSTEM
// World-class design system with ARVDOUL DNA gradient, glassmorphism, and spring animations
// Surpasses TikTok, Instagram, YouTube with futuristic UI

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, memo } from "react";

// ==================== ARVDOUL DESIGN TOKENS ====================

/**
 * ARVDOUL DNA Gradient - The signature gradient used throughout the platform
 */
export const ARVDOUL_GRADIENT = 'linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)';
export const ARVDOUL_GRADIENT_CSS = {
  background: 'linear-gradient(135deg, #B416DB 0%, #872FE2 35%, #4B6BFF 70%, #0EA3E6 100%)'
};

/**
 * ARVDOUL Brand Colors
 */
export const ARVDOUL_COLORS = {
  primary: {
    purple: '#B416DB',
    violet: '#872FE2',
    blue: '#4B6BFF',
    cyan: '#0EA3E6',
  },
  gradient: ['#B416DB', '#872FE2', '#4B6BFF', '#0EA3E6'],
};

/**
 * Spacing Scale - Consistent spacing throughout
 */
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
};

/**
 * Border Radius Scale
 */
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  full: 9999,
};

/**
 * Light Theme Palette
 */
const LIGHT_THEME = {
  name: 'light',
  colors: {
    background: '#F8F9FA',
    surface: '#FFFFFF',
    glass: 'rgba(255,255,255,0.7)',
    glassBorder: 'rgba(0,0,0,0.08)',
    text: {
      primary: '#0F172A',
      secondary: '#475569',
      tertiary: '#94A3B8',
      inverse: '#FFFFFF',
    },
    border: {
      light: 'rgba(0,0,0,0.06)',
      medium: 'rgba(0,0,0,0.12)',
      strong: 'rgba(0,0,0,0.20)',
    },
    shadow: {
      ambient: '0 20px 60px rgba(0,0,0,0.08)',
      glow: '0 0 40px rgba(138,43,226,0.12)',
      directional: '0 8px 32px rgba(0,0,0,0.06)',
      card: '0 25px 80px rgba(0,0,0,0.08)',
    },
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  glass: {
    small: 'backdrop-blur-md bg-white/50 border border-white/20',
    medium: 'backdrop-blur-xl bg-white/60 border border-white/30',
    large: 'backdrop-blur-2xl bg-white/70 border border-white/40',
    ultra: 'backdrop-blur-3xl bg-white/80 border border-white/50',
  },
};

/**
 * Dark Theme Palette
 */
const DARK_THEME = {
  name: 'dark',
  colors: {
    background: '#050510',
    surface: 'rgba(255,255,255,0.05)',
    glass: 'rgba(255,255,255,0.08)',
    glassBorder: 'rgba(255,255,255,0.12)',
    text: {
      primary: '#FFFFFF',
      secondary: '#C9C9D6',
      tertiary: '#94A3B8',
      inverse: '#0F172A',
    },
    border: {
      light: 'rgba(255,255,255,0.06)',
      medium: 'rgba(255,255,255,0.12)',
      strong: 'rgba(255,255,255,0.20)',
    },
    shadow: {
      ambient: '0 20px 60px rgba(0,0,0,0.4)',
      glow: '0 0 40px rgba(138,43,226,0.25)',
      directional: '0 8px 32px rgba(0,0,0,0.25)',
      card: '0 25px 80px rgba(138,43,226,0.45)',
    },
    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#60A5FA',
  },
  glass: {
    small: 'backdrop-blur-md bg-white/5 border border-white/10',
    medium: 'backdrop-blur-xl bg-white/8 border border-white/12',
    large: 'backdrop-blur-2xl bg-white/10 border border-white/15',
    ultra: 'backdrop-blur-3xl bg-white/12 border border-white/20',
  },
};

/**
 * Spring Animation Configurations
 */
export const SPRING_CONFIG = {
  // Card animations - subtle bounce
  card: {
    type: 'spring',
    damping: 25,
    stiffness: 300,
    mass: 0.8,
  },
  // Button animations - quick response
  button: {
    type: 'spring',
    damping: 20,
    stiffness: 400,
    mass: 0.5,
  },
  // Bottom sheet animations - smooth glide
  bottomSheet: {
    type: 'spring',
    damping: 30,
    stiffness: 200,
    mass: 1,
  },
  // Like animation - punchy pop
  like: {
    type: 'spring',
    damping: 10,
    stiffness: 500,
    mass: 0.3,
  },
  // General purpose - balanced
  general: {
    type: 'spring',
    damping: 20,
    stiffness: 300,
    mass: 0.8,
  },
};

/**
 * Easing Configurations
 */
export const EASING = {
  easeInOut: [0.4, 0, 0.2, 1],
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  spring: [0.175, 0.885, 0.32, 1.275],
};

/**
 * Animation Durations
 */
export const DURATION = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 500,
  slower: 750,
};

// ==================== CONTEXT ====================

const ThemeContext = createContext(null);

// ==================== HOOK ====================

/**
 * useTheme - World-class theme hook with full ARVDOUL design system
 * 
 * @returns {Object} Theme context with all utilities
 * 
 * @example
 * const { theme, isDark, colors, glass, spacing, spring, gradient } = useTheme();
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  
  if (!context) {
    console.warn("useTheme must be used within ThemeProvider");
    return getDefaultTheme();
  }
  
  return context;
};

/**
 * Get default theme for when outside provider
 */
const getDefaultTheme = () => ({
  theme: 'light',
  systemTheme: 'light',
  resolvedTheme: 'light',
  isDark: false,
  toggleTheme: () => {},
  setTheme: () => {},
  colors: LIGHT_THEME.colors,
  glass: LIGHT_THEME.glass,
  spacing: SPACING,
  radius: RADIUS,
  spring: SPRING_CONFIG,
  easing: EASING,
  duration: DURATION,
  gradient: ARVDOUL_GRADIENT,
});

// ==================== PROVIDER ====================

/**
 * ThemeProvider - World-class theme provider with ARVDOUL design system
 */
export const ThemeProvider = memo(({ children }) => {
  const [theme, setThemeState] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    }
    return 'light';
  });

  const [systemTheme, setSystemTheme] = useState('light');
  const [mounted, setMounted] = useState(false);

  // Set mounted state
  useEffect(() => {
    setMounted(true);
  }, []);

  // Detect system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    handleChange(mediaQuery);
    
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Calculate resolved theme
  const resolvedTheme = theme === 'system' ? systemTheme : theme;
  const isDark = resolvedTheme === 'dark';

  // Get current theme config
  const currentTheme = isDark ? DARK_THEME : LIGHT_THEME;

  // Apply theme to document
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
    localStorage.setItem('theme', theme);
    
    // Apply CSS custom properties for easy access
    root.style.setProperty('--arvdoul-primary', ARVDOUL_COLORS.primary.purple);
    root.style.setProperty('--arvdoul-gradient', ARVDOUL_GRADIENT);
  }, [theme, resolvedTheme]);

  // Update theme
  const setTheme = useCallback((newTheme) => {
    if (newTheme === 'light' || newTheme === 'dark' || newTheme === 'system') {
      setThemeState(newTheme);
    }
  }, []);

  // Toggle theme
  const toggleTheme = useCallback(() => {
    setThemeState(current => {
      if (current === 'light') return 'dark';
      if (current === 'dark') return 'light';
      return systemTheme === 'light' ? 'dark' : 'light';
    });
  }, [systemTheme]);

  // Memoize the context value for performance
  const contextValue = useMemo(() => ({
    // Basic theme info
    theme,
    systemTheme,
    resolvedTheme,
    isDark,
    
    // Theme controls
    toggleTheme,
    setTheme,
    
    // Full color palette
    colors: currentTheme.colors,
    
    // Glassmorphism utilities
    glass: currentTheme.glass,
    
    // Design tokens
    spacing: SPACING,
    radius: RADIUS,
    
    // Animation configs
    spring: SPRING_CONFIG,
    easing: EASING,
    duration: DURATION,
    
    // ARVDOUL gradient
    gradient: ARVDOUL_GRADIENT,
    gradientCss: ARVDOUL_GRADIENT_CSS,
    
    // Utility functions
    getGlassClass: (size = 'medium') => currentTheme.glass[size] || currentTheme.glass.medium,
    getShadowClass: (type = 'ambient') => currentTheme.colors.shadow[type] || currentTheme.colors.shadow.ambient,
    
    // Spacing helper
    space: (size) => SPACING[size] || SPACING.lg,
    
    // Radius helper
    round: (size) => RADIUS[size] || RADIUS.lg,
    
  }), [theme, systemTheme, resolvedTheme, isDark, toggleTheme, setTheme, currentTheme]);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <div style={{ visibility: 'hidden' }} className="min-h-screen">
        {children}
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
});

ThemeProvider.displayName = 'ThemeProvider';

// ==================== EXPORTS ====================

export {
  LIGHT_THEME,
  DARK_THEME,
};

export default ThemeProvider;
