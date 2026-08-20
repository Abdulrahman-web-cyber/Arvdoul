/**
 * src/__tests__/designTokens.test.js
 * Enforces the design-token contract:
 *   - required semantic token groups exist and are non-trivial
 *   - motion tokens carry a reduced-motion policy
 *   - tokens.css declares the global prefers-reduced-motion kill-switch
 *   - tokens.json is a versioned subset in parity with tokens.js
 *   - no hardcoded brand hex colors leak into the design-system components
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokens, TOKEN_VERSION } from '../design-system/tokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const designSystemDir = path.resolve(__dirname, '../design-system');

function read(file) {
  return fs.readFileSync(path.join(designSystemDir, file), 'utf8');
}

describe('design tokens - structure', () => {
  test('tokens are versioned', () => {
    expect(TOKEN_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(tokens.version).toBe(TOKEN_VERSION);
  });

  test('every required semantic group exists and is non-trivial', () => {
    const groups = ['color', 'spacing', 'radius', 'shadow', 'glass', 'motion', 'typography', 'zIndex', 'breakpoints', 'accessibility'];
    for (const group of groups) {
      expect(tokens[group]).toBeDefined();
      expect(Object.keys(tokens[group]).length).toBeGreaterThan(0);
    }
  });

  test('brand identity includes the signature gradient', () => {
    expect(tokens.color.brand.gradient).toContain('linear-gradient');
    expect(tokens.color.brand.gradient).toContain('#8B5CF6'); // violet
    expect(tokens.color.brand.gradient).toContain('#22D3EE'); // cyan
  });

  test('spacing follows a 4px base scale', () => {
    const { xs, sm, md, lg, xl, '2xl': twoXl, '3xl': threeXl } = tokens.spacing;
    expect([xs, sm, md, lg, xl, twoXl, threeXl]).toEqual([4, 8, 16, 24, 32, 48, 64]);
  });

  test('motion tokens include a reduced-motion policy', () => {
    expect(tokens.motion.reduce).toBe('kill');
    expect(tokens.motion.duration.fast).toBeLessThan(tokens.motion.duration.slow);
    expect(tokens.motion.easing.standard).toContain('cubic-bezier');
  });

  test('accessibility minimums are defined', () => {
    expect(tokens.accessibility.touchTargetMin).toBe(44);
    expect(tokens.accessibility.contrastAA).toBe(4.5);
    expect(tokens.accessibility.focusRingWidth).toBe(2);
  });
});

describe('design tokens - CSS parity', () => {
  const css = read('tokens.css');

  test('tokens.css declares the global reduced-motion kill-switch', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation-duration: 0.01ms !important');
    expect(css).toContain('transition-duration: 0.01ms !important');
  });

  test('tokens.css mirrors the brand gradient and key colors', () => {
    expect(css).toContain('--arv-brand-gradient');
    expect(css).toContain('#8B5CF6');
    expect(css).toContain('--arv-shadow-dialog');
    expect(css).toContain('--arv-radius-sheet');
    expect(css).toContain('--arv-z-toast');
  });

  test('tokens.css is imported by the global stylesheet', () => {
    const mainCss = fs.readFileSync(path.resolve(__dirname, '../styles/tailwind.css'), 'utf8');
    expect(mainCss).toContain('tokens.css');
  });
});

describe('design tokens - JSON parity', () => {
  test('tokens.json exists, is versioned, and matches the JS version', () => {
    const json = JSON.parse(read('tokens.json'));
    expect(json.version).toBe(TOKEN_VERSION);
    expect(json.colors.brand.violet).toBe(tokens.color.brand.violet);
    expect(json.colors.brand.gradient).toBe(tokens.color.brand.gradient);
    expect(json.spacing).toEqual(tokens.spacing);
    expect(json.motion.duration).toEqual(tokens.motion.duration);
    expect(json.motion.reduce).toBe('kill');
    expect(json.breakpoints).toEqual(tokens.breakpoints);
  });
});

describe('design-system components - token hygiene', () => {
  test('no hardcoded brand hex colors in design-system components', () => {
    const componentFiles = ['Button.jsx', 'EmptyState.jsx', 'ErrorState.jsx', 'Skeleton.jsx'];
    const brandHexes = ['#8B5CF6', '#6366F1', '#3B82F6', '#22D3EE', '#EC4899', '#C026D3'];
    for (const file of componentFiles) {
      const p = path.join(designSystemDir, file);
      if (!fs.existsSync(p)) continue;
      const content = fs.readFileSync(p, 'utf8');
      for (const hex of brandHexes) {
        // Allowed ONLY inside the shared gradient constant definition
        expect(content).not.toContain(hex);
      }
    }
  });
});
