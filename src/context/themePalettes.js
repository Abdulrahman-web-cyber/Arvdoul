// src/context/themePalettes.js
//
// Theme palettes for ThemeProvider. Kept in a plain .js module (not the .jsx
// provider) so the design-token drift guard can import the values directly.
// Surfaces derive from the design tokens; the brand violet is `#8B1EF3`.

import { tokens } from '../design-system/tokens.js';

const { color: TOKEN_COLOR, shadow: TOKEN_SHADOW } = tokens;

export const LIGHT_THEME = {
  name: 'light',
  colors: {
    background: TOKEN_COLOR.bg.light,
    surface: TOKEN_COLOR.bg.lightElevated,
    glass: TOKEN_COLOR.surface.glassLight,
    glassBorder: TOKEN_COLOR.surface.borderLight,
    text: {
      primary: TOKEN_COLOR.text.primaryLight,
      secondary: TOKEN_COLOR.text.secondaryLight,
      tertiary: TOKEN_COLOR.text.mutedLight,
      inverse: TOKEN_COLOR.text.primaryDark,
    },
    border: {
      light: TOKEN_COLOR.surface.borderLight,
      medium: 'rgba(0,0,0,0.12)',
      strong: 'rgba(0,0,0,0.20)',
    },
    shadow: {
      ambient: '0 20px 60px rgba(0,0,0,0.08)',
      glow: '0 0 40px rgba(139,30,243,0.12)',
      directional: TOKEN_SHADOW.md,
      card: '0 25px 80px rgba(0,0,0,0.08)',
    },
    success: TOKEN_COLOR.semantic.success,
    warning: TOKEN_COLOR.semantic.warning,
    error: TOKEN_COLOR.semantic.error,
    info: TOKEN_COLOR.semantic.info,
  },
  glass: {
    small: 'backdrop-blur-md bg-white/50 border border-white/20',
    medium: 'backdrop-blur-xl bg-white/60 border border-white/30',
    large: 'backdrop-blur-2xl bg-white/70 border border-white/40',
    ultra: 'backdrop-blur-3xl bg-white/80 border border-white/50',
  },
};

export const DARK_THEME = {
  name: 'dark',
  colors: {
    background: TOKEN_COLOR.bg.dark,
    surface: TOKEN_COLOR.surface.glassDark,
    glass: TOKEN_COLOR.surface.borderDark,
    glassBorder: TOKEN_COLOR.surface.borderDark,
    text: {
      primary: TOKEN_COLOR.text.primaryDark,
      secondary: TOKEN_COLOR.text.secondaryDark,
      tertiary: TOKEN_COLOR.text.mutedDark,
      inverse: TOKEN_COLOR.text.primaryLight,
    },
    border: {
      light: 'rgba(255,255,255,0.06)',
      medium: TOKEN_COLOR.surface.borderDark,
      strong: 'rgba(255,255,255,0.20)',
    },
    shadow: {
      ambient: '0 20px 60px rgba(0,0,0,0.4)',
      glow: '0 0 40px rgba(139,30,243,0.25)',
      directional: TOKEN_SHADOW.lg,
      card: '0 25px 80px rgba(139,30,243,0.45)',
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
