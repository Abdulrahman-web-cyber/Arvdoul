// src/context/ThemeProvider.jsx

import { createContext, useContext, useState, useEffect, useCallback, useMemo, memo } from "react";
import { BRAND_GRADIENT } from "../design-system/tokens.js";
import { LIGHT_THEME, DARK_THEME } from "./themePalettes.js";

/**
 * ARVDOUL DNA Gradient - The signature gradient used throughout the platform
 */
export const ARVDOUL_GRADIENT = BRAND_GRADIENT;
export const ARVDOUL_GRADIENT_CSS = {
  background: BRAND_GRADIENT
};

/**
 * ARVDOUL Brand Colors
 */
export const ARVDOUL_COLORS = {
  primary: {
    purple: '#8B1EF3',
    violet: '#4431F7',
    blue: '#055BFB',
    cyan: '#0088FF',
  },
  gradient: ['#8B1EF3', '#4431F7', '#055BFB', '#0088FF'],
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

const ThemeContext = createContext(null);

/**
 * useTheme - theme hook with full ARVDOUL design system
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

/**
 * Safe localStorage access - sandboxed iframes (previews, embedded webviews)
 * can throw SecurityError on ANY storage access. A crash here would unmount
 * the entire app (ThemeProvider has no error boundary above it), which used
 * to present as a blank screen or the intro glitch. Never throw on storage.
 */
function safeStorageGet(key) {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeStorageSet(key, value) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked - theme just won't persist */
  }
}

/**
 * ThemeProvider - theme provider with ARVDOUL design system
 */
export const ThemeProvider = memo(({ children }) => {
  const [theme, setThemeState] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = safeStorageGet('theme');
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

  // Detect system theme changes (guarded: matchMedia may be missing in
  // embedded webviews - the global polyfill covers it, this is belt+braces)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

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
    safeStorageSet('theme', theme);
    
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

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
});

ThemeProvider.displayName = 'ThemeProvider';

export {
  LIGHT_THEME,
  DARK_THEME,
};

export default ThemeProvider;
