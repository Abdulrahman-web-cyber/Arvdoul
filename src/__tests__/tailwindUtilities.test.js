/**
 * Tailwind utility validity guard (N111).
 *
 * Tailwind only generates a utility when its modifier exists in the scale. An
 * opacity step that is not in `theme.opacity` (defaults + `tailwind.config.js`
 * `extend.opacity`) produces NO CSS rule at all — the class is silently a no-op
 * and the element renders transparent/unstyled. That is how `bg-white/8` and
 * `border-white/12` shipped across the search components, `videoUtils` glass
 * classes and the ThemeProvider glass presets: 19 invisible surfaces with a
 * green build and a passing lint.
 *
 * This guard scans every `(color)/(opacity)` utility in `src` and fails if the
 * opacity step is not declared, so a new step must be added to the config in the
 * same change (as `/8` and `/12` now are).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const paletteColors = require('tailwindcss/colors');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'src');

// Tailwind's default opacity scale (tailwindcss/defaultTheme). Kept inline so
// this test does not depend on the installed Tailwind version's export shape.
const DEFAULT_OPACITY = new Set([
  0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100,
]);

function configuredOpacitySteps() {
  const config = readFileSync(path.join(root, 'tailwind.config.js'), 'utf8');
  const block = config.match(/opacity:\s*\{([^}]*)\}/s);
  const steps = new Set(DEFAULT_OPACITY);
  if (block) {
    for (const m of block[1].matchAll(/(\d+)\s*:/g)) steps.add(Number(m[1]));
  }
  return steps;
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.jsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Any color-opacity utility: bg-white/8, border-white/12, from-arvdoul-purple/30 …
const UTILITY = /\b(?:bg|border|text|from|via|to|ring|divide|fill|stroke|outline|decoration|placeholder|accent|caret|shadow)-[a-z][a-z0-9-]*\/(\d+)\b/g;

// Any palette shade utility: bg-gray-750, dark:bg-gray-750, border-gray-700 …
const SHADE = /\b(?:bg|border|text|from|via|to|ring|divide|fill|stroke|outline|decoration|placeholder|accent|caret)-([a-z][a-z0-9]*)-(\d{2,3})\b/g;

const DEFAULT_SHADES = new Set([0, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);

// Tailwind's built-in animation utilities (keyframes it ships). Custom names must
// be declared in `tailwind.config.js` `animation`.
const DEFAULT_ANIMATIONS = new Set(['none', 'spin', 'ping', 'pulse', 'bounce']);

function configBlockKeys(blockName) {
  const config = readFileSync(path.join(root, 'tailwind.config.js'), 'utf8');
  const block = config.match(new RegExp(`${blockName}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`, 's'));
  const keys = new Set();
  if (block) for (const m of block[1].matchAll(/'([^']+)':/g)) keys.add(m[1]);
  return keys;
}

// `animate-in` + `fade-in` / `zoom-in-95` / `slide-in-from-*` are the
// tailwindcss-animate plugin API, reimplemented in src/styles/tailwind.css. Every
// such class used in src must have a selector there, or the entrance is a no-op.
const ENTRANCE_CLASS = /^(?:animate-in|fade-in|fade-out|zoom-in-\d+|zoom-out-\d+|slide-in-from-[a-z]+-\d+|slide-out-to-[a-z]+-\d+|spin-in-\d+)$/;

function entranceSelectors() {
  const css = readFileSync(path.join(SRC, 'styles/tailwind.css'), 'utf8');
  const names = new Set();
  for (const m of css.matchAll(/\.([a-z][a-z0-9-]*)\s*[,{]/g)) names.add(m[1]);
  return names;
}

// Colors whose shade set differs from the default scale. Everything else must be
// a default shade; anything outside both is a typo (e.g. `gray-750`).
function knownShades(color) {
  const def = paletteColors[color];
  if (!def || typeof def === 'string') return null; // not a palette we validate
  return new Set(Object.keys(def).map(Number).filter((n) => !Number.isNaN(n)));
}

describe('tailwind utilities reference declared scale steps (N111)', () => {
  test('every color/opacity step used in src is declared in the opacity scale', () => {
    const configured = configuredOpacitySteps();
    const offenders = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(UTILITY)) {
        const step = Number(m[1]);
        if (!configured.has(step)) {
          offenders.push(`${path.relative(root, file)}: ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('every palette shade used in src exists (no gray-750-style typos)', () => {
    const offenders = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(SHADE)) {
        const [, color, shade] = m;
        const shades = knownShades(color);
        if (!shades) continue; // custom/arvdoul-* colors or non-palette classes
        if (!shades.has(Number(shade)) && !DEFAULT_SHADES.has(Number(shade))) {
          offenders.push(`${path.relative(root, file)}: ${m[0]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('every animate-* utility is a built-in or declared in the config', () => {
    const declared = configBlockKeys('animation');
    const offenders = [];
    for (const file of walk(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\banimate-([a-z0-9-]+)/g)) {
        const name = m[1];
        if (name === 'in') continue; // `animate-in` entrance class, checked below
        if (DEFAULT_ANIMATIONS.has(name) || declared.has(name)) continue;
        offenders.push(`${path.relative(root, file)}: ${m[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('every entrance class (animate-in API) has a selector in tailwind.css', () => {
    const selectors = entranceSelectors();
    const offenders = [];
    for (const file of walk(SRC)) {
      if (file.endsWith('styles/tailwind.css')) continue;
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\b([a-z][a-z0-9-]*)\b/g)) {
        const cls = m[1];
        if (!ENTRANCE_CLASS.test(cls)) continue;
        if (!selectors.has(cls)) offenders.push(`${path.relative(root, file)}: ${cls}`);
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  test('the /8 and /12 glass steps stay declared', () => {
    const configured = configuredOpacitySteps();
    expect(configured.has(8)).toBe(true);
    expect(configured.has(12)).toBe(true);
  });
});
