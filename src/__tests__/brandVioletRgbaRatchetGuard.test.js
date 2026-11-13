/**
 * src/__tests__/brandVioletRgbaRatchetGuard.test.js
 *
 * Brand-violet decimal ratchet (design-system consolidation).
 *
 * The brand violet `#8B1EF3` is `rgb(139, 30, 243)`. The hex ratchet
 * (`brandHexRatchetGuard.test.js`) already pins the canonical hexes at zero, but
 * 73 occurrences of the brand violet were still written in DECIMAL form —
 * `rgba(139,30,243,0.4)` — scattered across shadows, glows and gradients. A
 * decimal literal never moves when the token changes, so it drifts silently.
 *
 * `src/design-system/tokens.js` now exports `brandRgba(alpha)` (and
 * `brandCanvasBackground`) so call sites can derive the value from the token.
 * This is a *ratchet*: `scripts/brandVioletRgbaBaseline.json` freezes the
 * remaining per-file counts and the counts may only shrink — a file that drops
 * to zero must have its baseline entry deleted, so the number reflects reality.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'src');

// `rgba(139, 30, 243` / `rgb(139,30,243` — the brand violet in decimal form.
const BRAND_VIOLET_RGB = /rgba?\(\s*139\s*,\s*30\s*,\s*243/g;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(jsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function currentCounts() {
  const counts = {};
  for (const file of walk(SRC)) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    if (rel.startsWith('src/design-system/')) continue; // the source of truth itself
    const n = (fs.readFileSync(file, 'utf8').match(BRAND_VIOLET_RGB) || []).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

const baseline = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/brandVioletRgbaBaseline.json'), 'utf8')
);

describe('brand violet decimal ratchet — the baseline may only shrink', () => {
  test('no file exceeds its baseline brand-violet rgba() count', () => {
    const current = currentCounts();
    const offenders = [];
    for (const [file, n] of Object.entries(current)) {
      const allowed = baseline[file] || 0;
      if (n > allowed) offenders.push(`${file}: ${n} brand-violet rgba (baseline ${allowed})`);
    }
    expect(offenders.sort()).toEqual([]);
  });

  test('a file that dropped to zero has no stale baseline entry', () => {
    const current = currentCounts();
    const stale = Object.keys(baseline).filter((f) => !current[f]);
    expect(stale).toEqual([]);
  });
});
