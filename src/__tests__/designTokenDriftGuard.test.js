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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'src');

const DIVERGENT = /#(B416DB|872FE2|4B6BFF|0EA3E6)/i;
const CANONICAL_LITERAL = /linear-gradient\(\s*135deg\s*,\s*#8B1EF3\s+0%\s*,\s*#4431F7\s+(?:50|52)%\s*,\s*#055BFB\s+100%\s*\)/;

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
  test('the divergent #B416DB gradient family never reappears', () => {
    const offenders = [];
    for (const file of files) {
      if (DIVERGENT.test(readFileSync(file, 'utf8'))) offenders.push(path.relative(root, file));
    }
    expect(offenders).toEqual([]);
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
