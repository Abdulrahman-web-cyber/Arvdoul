/**
 * src/design-system/tokens.js
 * ARVDOUL DESIGN TOKENS — SINGLE SOURCE OF TRUTH
 *
 * Every visual decision in the app must come from these tokens. The values
 * here are mirrored 1:1 into tokens.css (CSS variables) and tokens.json
 * (versioned payload usable by backend email templates / tooling). The
 * `designTokens.test.js` suite enforces:
 *   - required semantic token groups exist
 *   - motion tokens include a reduced-motion policy
 *   - tokens.css declares the prefers-reduced-motion kill-switch
 *   - JS <-> JSON parity
 *
 * Versioning: bump `version` on ANY visual change. A version bump should
 * trigger a visual regression review of the whole app.
 */

export const TOKEN_VERSION = '1.0.0';

export const tokens = {
  version: TOKEN_VERSION,

  /** Brand identity - the #8B1EF3 → #4431F7 → #055BFB signature gradient family. */
  color: {
    brand: {
      violet: '#8B1EF3',
      indigo: '#4431F7',
      blue: '#055BFB',
      cyan: '#0088FF',
      pink: '#C82BFF',
      fuchsia: '#8B1EF3',
      glowPink: '#C82BFF',
      glowBlue: '#0088FF',
      gradient: 'linear-gradient(135deg, #8B1EF3 0%, #4431F7 50%, #055BFB 100%)',
    },
    bg: {
      dark: '#03071B',
      darkElevated: '#080F2E',
      darkDeep: '#020412',
      light: '#F6F8FC',
      lightElevated: '#FFFFFF',
      lightDeep: '#EEF2F8',
    },
    text: {
      primaryDark: '#FFFFFF',
      secondaryDark: 'rgba(255, 255, 255, 0.7)',
      mutedDark: 'rgba(255, 255, 255, 0.45)',
      primaryLight: '#111827',
      secondaryLight: 'rgba(0, 0, 0, 0.6)',
      mutedLight: 'rgba(0, 0, 0, 0.4)',
    },
    semantic: {
      success: '#10B981',
      successLight: '#059669',
      warning: '#F59E0B',
      warningLight: '#D97706',
      error: '#EF4444',
      errorLight: '#DC2626',
      info: '#055BFB',
      verified: '#055BFB',
      online: '#10B981',
      away: '#F59E0B',
      busy: '#EF4444',
    },
    surface: {
      glassDark: 'rgba(255, 255, 255, 0.06)',
      glassLight: 'rgba(255, 255, 255, 0.8)',
      overlay: 'rgba(3, 7, 27, 0.75)',
      borderDark: 'rgba(255, 255, 255, 0.08)',
      borderLight: 'rgba(0, 0, 0, 0.08)',
    },
  },

  /** 4px-based spacing scale. */
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    '2xl': 48,
    '3xl': 64,
  },

  /** Border radius scale. */
  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    '2xl': 24,
    modal: 24,
    sheet: 28,
    full: 9999,
  },

  /** Elevation + glass shadows. */
  shadow: {
    sm: '0 1px 2px rgba(2, 4, 10, 0.1)',
    md: '0 4px 12px rgba(2, 4, 10, 0.15)',
    lg: '0 12px 32px rgba(2, 4, 10, 0.2)',
    dialog: '0 24px 64px rgba(2, 4, 10, 0.35)',
    glow: '0 0 20px rgba(139, 92, 246, 0.25)',
    glowStrong: '0 0 32px rgba(139, 92, 246, 0.45)',
  },

  /** Glassmorphism backdrop blur. */
  glass: {
    backdropBlur: '24px',
    backdropBlurHeavy: '40px',
    saturate: '180%',
  },

  /**
   * Motion tokens. Durations in ms, easings in cubic-bezier form.
   * `reduce: 'kill'` is the mandatory policy: with
   * prefers-reduced-motion: reduce, ALL motion collapses to instant or
   * opacity-only (enforced globally in tokens.css and via
   * <MotionConfig reducedMotion="user">).
   */
  motion: {
    duration: {
      fast: 150,
      base: 240,
      slow: 300,
      enter: 400,
      exit: 200,
    },
    easing: {
      standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
      emphasize: 'cubic-bezier(0.05, 0.7, 0.1, 1.0)',
      spring: 'spring(1, 160, 24)',
    },
    stagger: {
      list: 50,
      modal: 20,
    },
    reduce: 'kill',
  },

  /** Typography scale (rem-based). */
  typography: {
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      black: 900,
    },
    fontFamily: {
      sans: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      display: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    },
  },

  /** z-index scale. */
  zIndex: {
    base: 0,
    sticky: 10,
    nav: 40,
    overlay: 50,
    modal: 60,
    sheet: 70,
    toast: 80,
    max: 100,
  },

  /** Layout breakpoints (px). */
  breakpoints: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
  },

  /** Accessibility minimums. */
  accessibility: {
    touchTargetMin: 44,
    contrastAA: 4.5,
    contrastAALarge: 3,
    focusRingWidth: 2,
  },
};

export default tokens;
