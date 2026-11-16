// src/__tests__/uiFoundationGuard.test.js
//
// Guards the design-system foundation invariants that the running UI depends on
// but that no existing suite checked:
//
//   * the two declared font families are actually self-hosted (an @font-face for
//     each, pointing at a real file under public/fonts) — `font-display` and
//     `Clash Display` were referenced across the UI while no face was ever loaded,
//     so the "brand display" type silently fell back to Inter;
//   * the shell's `theme-color` meta is the token canvas, not a stray literal,
//     and ThemeProvider keeps it in step with the resolved theme;
//   * the splash loader gradient uses the canonical brand family, not the
//     divergent `#3B82F6`/`#EC4899` pair;
//   * a global keyboard-focus fallback exists (most modules set `outline-none`);
//   * tokens.js <-> tokens.css <-> tokens.json agree on the font stack.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokens } from '../design-system/tokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

describe('UI foundation - self-hosted fonts', () => {
  const css = read('src/design-system/tokens.css');

  test('tokens.css declares an @font-face for each declared family', () => {
    expect(css).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Inter'/);
    expect(css).toMatch(/@font-face\s*\{[^}]*font-family:\s*'Clash Display'/);
  });

  test('every referenced font file exists under public/fonts', () => {
    const refs = [...css.matchAll(/url\('\/fonts\/([\w.-]+\.woff2)'\)/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThanOrEqual(3);
    for (const file of refs) {
      expect(fs.existsSync(path.join(root, 'public/fonts', file))).toBe(true);
    }
  });

  test('the display stack leads with the characterful face', () => {
    expect(tokens.typography.fontFamily.display.startsWith("'Clash Display'")).toBe(true);
    expect(tokens.typography.fontFamily.sans.startsWith("'Inter'")).toBe(true);
  });

  test('tokens.css and tokens.json mirror the font stacks', () => {
    const json = JSON.parse(read('src/design-system/tokens.json'));
    expect(json.typography.fontFamily).toEqual(tokens.typography.fontFamily);
    expect(css).toContain('--arv-font-display');
    expect(css).toContain('Clash Display');
  });

  test('index.html preloads the shell fonts', () => {
    const html = read('index.html');
    expect(html).toMatch(/rel="preload"[^>]*\/fonts\/inter-latin\.woff2/);
  });
});

describe('UI foundation - theme color', () => {
  test('index.html ships the token canvas, not a stray literal', () => {
    const html = read('index.html');
    const meta = html.match(/<meta\s+name="theme-color"\s+content="([^"]+)"/);
    expect(meta).toBeTruthy();
    expect(meta[1]).toBe(tokens.color.bg.dark);
  });

  test('ThemeProvider syncs the meta with the resolved theme', () => {
    const src = read('src/context/ThemeProvider.jsx');
    expect(src).toContain('meta[name="theme-color"]');
    expect(src).toContain('tokens.color.bg.light');
    expect(src).toContain('tokens.color.bg.dark');
  });
});

describe('UI foundation - splash + focus', () => {
  test('the splash loader uses the canonical brand family', () => {
    const html = read('index.html');
    const splash = html.match(/\.app-loading\s*\{[^}]*background:\s*linear-gradient\(([^)]+)\)/);
    expect(splash).toBeTruthy();
    expect(splash[1]).toContain('#8B1EF3');
    expect(splash[1]).not.toContain('#3B82F6');
    expect(splash[1]).not.toContain('#EC4899');
  });

  test('a global :focus-visible fallback exists in the stylesheet', () => {
    const css = read('src/styles/tailwind.css');
    expect(css).toMatch(/:focus-visible\s*\{/);
    expect(css).toContain('--arv-brand-violet');
  });
});

describe('UI foundation - app shell canvas', () => {
  const layout = read('src/layouts/MainLayout.jsx');
  test('the shell canvas derives from the design system, not raw hex', () => {
    expect(layout).toContain('brandCanvasBackground');
    expect(layout).not.toMatch(/from-\[#[0-9a-fA-F]{6}\]/);
  });
  test('the shell does not use w-screen (100vw overflows by the scrollbar)', () => {
    expect(layout).not.toContain('w-screen');
    expect(layout).toContain('w-full');
  });
});

describe('UI foundation - viewport-width overflow (N513)', () => {
  // `100vw` includes the classic desktop scrollbar, so any full-bleed element
  // sized with it overflows the viewport by ~15px and forces a horizontal
  // scroll (masked, but still a layout defect). The shell already uses `w-full`;
  // the remaining offenders are component-level. The global html/body/#root rule
  // must use `100%` too.
  function walk(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, out);
      else if (/\.(jsx|css)$/.test(entry.name)) out.push(full);
    }
    return out;
  }

  test('no component sizes itself with an unbounded viewport width', () => {
    // `w-screen` (Tailwind) and a bare `100vw` / `100vw !important` size an
    // element to the full viewport INCLUDING the scrollbar. A bounded
    // `calc(100vw - Npx)` is fine (used for popovers that must fit a narrow
    // phone), so only the unbounded forms are flagged.
    const offenders = [];
    for (const full of walk(path.join(root, 'src'))) {
      const src = fs.readFileSync(full, 'utf8');
      if (/w-screen|w-\[100vw\]|(?:width|maxWidth|max-width)\s*:?\s*['"]?100vw/.test(src)) {
        offenders.push(path.relative(root, full));
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the global root width is a percentage, not 100vw', () => {
    const css = read('src/styles/tailwind.css');
    const root = css.match(/html,\s*body,\s*#root\s*\{[^}]*\}/);
    expect(root).toBeTruthy();
    expect(root[0]).toContain('width: 100%');
    expect(root[0]).not.toContain('100vw');
  });
});
