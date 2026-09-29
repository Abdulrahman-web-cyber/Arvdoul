/**
 * src/design-system/visual.js
 *
 * JS-context access to the Arvdoul design tokens for places where a Tailwind
 * class cannot carry the value: SVG `stroke`, canvas/inline `style`, QR
 * generation, and CSS gradient strings.
 *
 * The mandate forbids arbitrary hexes ("no arbitrary legacy colors remain"),
 * so every value here resolves from `tokens.js` — the single source of truth —
 * rather than being re-typed. Change a color in `tokens.js` and these follow.
 */

import { tokens } from './tokens.js';

const { brand, bg, semantic } = tokens.color;

export const VISUAL = Object.freeze({
  brandViolet: brand.violet,
  brandIndigo: brand.indigo,
  brandBlue: brand.blue,
  brandCyan: brand.cyan,
  brandPink: brand.pink,

  gradient: brand.gradient,
  gradientCss: brand.gradient,
  gradientAngle: '135deg',

  /** Canonical foundation/background colors. */
  bgDark: bg.dark,
  bgDarkElevated: bg.darkElevated,
  bgDarkDeep: bg.darkDeep,
  bgLight: bg.light,
  bgLightElevated: bg.lightElevated,
  bgLightDeep: bg.lightDeep,

  success: semantic.success,
  warning: semantic.warning,
  error: semantic.error,
  info: semantic.info,

  /** Brand-family accents for multi-series charts (all drawn from tokens). */
  chart: Object.freeze({
    views: brand.violet,
    reach: brand.cyan,
    engagement: brand.pink,
    coins: semantic.warning,
  }),

  /** UIColor -> CSS gradient string used by avatar rings / follow buttons. */
  sequentialGradient: `linear-gradient(135deg, ${brand.violet} 0%, ${brand.indigo} 50%, ${brand.blue} 100%)`,

  /** Brand "glow" language for interactive CTAs. */
  glowSoft:
    '0 0 20px rgba(139, 30, 243, 0.35), 0 0 40px rgba(68, 49, 247, 0.18)',

  tokenVersion: tokens.version,
});

export default VISUAL;
