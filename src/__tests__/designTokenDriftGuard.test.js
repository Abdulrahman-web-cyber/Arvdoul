/**
 * Brand-gradient drift guard (N104 — now closed).
 *
 * `src/design-system/tokens.js` / `tokens.css` are the SINGLE SOURCE OF TRUTH
 * for the brand gradient. Historically the app ignored them: a divergent family
 * (`#B416DB -> #872FE2 -> #4B6BFF -> #0EA3E6`) shipped in 27 files while the
 * tokens declared `#8B1EF3 -> #4431F7 -> #055BFB`, and the canonical gradient
 * was re-declared inline in half a dozen modules. The token file and its parity
 * test stayed green the whole time, so the "single source of truth" was a false
 * claim (the "impressive-looking but not wired" pattern).
 *
 * The UI is now migrated onto the tokens. This guard asserts the STRONG
 * invariants that keep it that way, rather than freezing a count:
 *
 *   1. The divergent family must never reappear anywhere in `src`.
 *   2. No module outside the design system may declare the canonical gradient
 *      as a string literal — it must import `BRAND_GRADIENT`.
 *   3. `tokens.js`, `tokens.css` and `tokens.json` must agree on the value.
 *
 * The signup/login/onboarding screens are exempt from (2) by policy: they carry
 * their own 125deg/52% geometry and are intentionally frozen.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokens, BRAND_GRADIENT } from '../design-system/tokens.js';
import { LIGHT_THEME, DARK_THEME } from '../context/themePalettes.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'src');

const DIVERGENT = /#(B416DB|872FE2|4B6BFF|0EA3E6)/i;
// The same divergent family, in rgba() decimal form. The hex-only guard missed
// these: rgba(180,22,219) shipped in FollowButton/GlassButton, rgba(135,47,226)
// in editorConstants and the legacy `rgba(138,43,226)` (BlueViolet) violet in the
// search glass components and ThemeProvider — none in the brand family.
const DIVERGENT_RGBA = /rgba?\(\s*(?:180\s*,\s*22\s*,\s*219|135\s*,\s*47\s*,\s*226|75\s*,\s*107\s*,\s*255|14\s*,\s*163\s*,\s*230|138\s*,\s*43\s*,\s*226)\b/i;
const CANONICAL_LITERAL = /linear-gradient\(\s*135deg\s*,\s*#8B1EF3\s+0%\s*,\s*#4431F7\s+(?:50|52)%\s*,\s*#055BFB\s+100%\s*\)/;
// Tailwind's default purple/pink/cyan ramp, used as a stand-in for the brand
// gradient in GlassButton's `gradient` variant. The brand gradient is
// `#8B1EF3 → #4431F7 → #055BFB`; a `from-purple-600 via-pink-600` triple is a
// second brand gradient and must not be introduced.
const ROGUE_GRADIENT = /from-purple-600\s+via-pink-600\s+to-cyan-500/;
// The SAME rogue gradient in raw-hex form: Tailwind purple-600 → fuchsia-600 →
// cyan-500, plus the pink-500 / rose variants the post cards used as a
// "neon purple" stand-in for the brand gradient. `#9333ea`/`#c026d3` were
// re-declared as `ARVDOUL_GRADIENT` and in `getDesignTokens().actionBarBg`, so a
// change to the canonical brand would silently miss every post card. They are
// now migrated onto `BRAND_GRADIENT`; this pins them out.
const ROGUE_GRADIENT_HEX = /#(?:9333ea|c026d3)\b/i;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(jsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(SRC);

describe('brand gradient — design system is the single source of truth (N104)', () => {
  test('the divergent #B416DB gradient family never reappears (hex or rgba)', () => {
    const offenders = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (DIVERGENT.test(text) || DIVERGENT_RGBA.test(text)) offenders.push(path.relative(root, file));
    }
    expect(offenders).toEqual([]);
  });

  test('no rogue purple/pink/cyan gradient stands in for the brand gradient', () => {
    const offenders = [];
    for (const file of files) {
      if (ROGUE_GRADIENT.test(readFileSync(file, 'utf8'))) offenders.push(path.relative(root, file));
    }
    expect(offenders).toEqual([]);
  });

  test('the rogue gradient never reappears in raw-hex form (#9333ea / #c026d3)', () => {
    const offenders = [];
    for (const file of files) {
      if (ROGUE_GRADIENT_HEX.test(readFileSync(file, 'utf8'))) offenders.push(path.relative(root, file));
    }
    expect(offenders).toEqual([]);
  });

  test('the ThemeProvider palettes derive their surfaces from the design tokens', () => {
    expect(LIGHT_THEME.colors.background).toBe(tokens.color.bg.light);
    expect(LIGHT_THEME.colors.surface).toBe(tokens.color.bg.lightElevated);
    expect(DARK_THEME.colors.background).toBe(tokens.color.bg.dark);
    expect(DARK_THEME.colors.text.primary).toBe(tokens.color.text.primaryDark);
  });

  test('no module outside the design system re-declares the canonical gradient literal', () => {
    const offenders = [];
    for (const file of files) {
      const rel = path.relative(root, file);
      if (rel.startsWith('src/design-system/')) continue;
      if (CANONICAL_LITERAL.test(readFileSync(file, 'utf8'))) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  test('tokens.js, tokens.css and tokens.json agree on the gradient value', () => {
    const css = readFileSync(path.join(SRC, 'design-system/tokens.css'), 'utf8');
    const json = JSON.parse(readFileSync(path.join(SRC, 'design-system/tokens.json'), 'utf8'));
    expect(BRAND_GRADIENT).toBe(tokens.color.brand.gradient);
    expect(css).toContain(`--arv-brand-gradient: ${tokens.color.brand.gradient};`);
    expect(json.colors.brand.gradient).toBe(tokens.color.brand.gradient);
  });
});
