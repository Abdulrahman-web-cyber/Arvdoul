/**
 * Brand-gradient drift guard (N104).
 *
 * `src/design-system/tokens.js` / `tokens.css` declare themselves the SINGLE
 * SOURCE OF TRUTH for the brand gradient ("Every visual decision in the app must
 * come from these tokens"), but the running app does not consume them: the brand
 * gradient is hardcoded inline across the UI, and in a family the tokens do not
 * even define. Two divergent families shipped:
 *
 *   - tokens:   #8B1EF3 -> #4431F7 -> #055BFB   (declared, ~unused)
 *   - app:      #B416DB -> #872FE2 -> #4B6BFF -> #0EA3E6  (what actually renders)
 *
 * This is the "impressive-looking but not wired to real systems" pattern: the
 * token file and its parity test stay green while the real UI ignores it, so the
 * "single source of truth" is a false claim. Fixing it fully means migrating the
 * UI onto the tokens (a large visual change, out of scope for a correctness
 * pass), so this guard instead FREEZES the current hardcoded count and fails if
 * it grows. It may only shrink — migrate a literal to the token and lower the
 * number in the same change. Do not raise a number to make the test pass.
 */

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'src');

// Frozen 2026-11-03. Only shrink these.
const BASELINE = {
  brandLiterals: 57, // occurrences of the app's #B416DB gradient family literal
  brandLiteralFiles: 27, // src files containing at least one
};

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.jsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('brand gradient is not further hardcoded (N104)', () => {
  test('hardcoded brand-literal count does not grow', () => {
    const files = walk(SRC);
    let occurrences = 0;
    let filesWith = 0;
    for (const file of files) {
      const matches = readFileSync(file, 'utf8').match(/#B416DB/g);
      if (matches) {
        occurrences += matches.length;
        filesWith += 1;
      }
    }
    // A new hardcoded literal is a new divergence from the design tokens.
    expect(occurrences).toBeLessThanOrEqual(BASELINE.brandLiterals);
    expect(filesWith).toBeLessThanOrEqual(BASELINE.brandLiteralFiles);
  });
});
