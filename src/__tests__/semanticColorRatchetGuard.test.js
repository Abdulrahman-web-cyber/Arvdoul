/**
 * src/__tests__/semanticColorRatchetGuard.test.js
 *
 * Semantic-color ratchet (design-system consolidation, tier 4).
 *
 * `src/design-system/tokens.js` (`tokens.color.semantic.*`) is the single source
 * of truth for the semantic palette — success / warning / error, in their
 * base and `*Light` variants (`#10B981` / `#059669`, `#F59E0B` / `#D97706`,
 * `#EF4444` / `#DC2626`). The brand-gradient ratchet
 * (`brandHexRatchetGuard.test.js`) already pins the brand family at zero, but
 * the semantic hexes were still re-declared as raw literals in ~15 modules, so
 * a change to the canonical success/warning/error shade would silently miss
 * them. This guard closes that class.
 *
 * It is a *ratchet*: `scripts/semanticHexBaseline.json` freezes the remaining
 * per-file counts (a handful of design-tool color palettes that are genuinely
 * NOT semantic-status colors — the video/image editors' user-facing swatch
 * lists — are left as literals on purpose). The counts may only shrink:
 *
 * - Adding a raw semantic hex anywhere under `src` (outside
 *   `src/design-system/`) fails.
 * - A file that drops to zero must have its baseline entry deleted, so the
 *   number in the repo reflects reality.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'src');

const SEMANTIC_HEX = /#(?:10B981|059669|F59E0B|D97706|EF4444|DC2626)\b/gi;

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
    const n = (fs.readFileSync(file, 'utf8').match(SEMANTIC_HEX) || []).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

const baseline = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/semanticHexBaseline.json'), 'utf8')
);

describe('semantic color ratchet — the baseline may only shrink', () => {
  test('no file exceeds its baseline raw semantic-hex count', () => {
    const current = currentCounts();
    const offenders = [];
    for (const [file, n] of Object.entries(current)) {
      const allowed = baseline[file] || 0;
      if (n > allowed) offenders.push(`${file}: ${n} raw semantic hex (baseline ${allowed})`);
    }
    expect(offenders.sort()).toEqual([]);
  });

  test('the baseline has no stale entries for files that are now clean', () => {
    const current = currentCounts();
    const stale = Object.keys(baseline).filter((f) => !current[f]);
    expect(stale).toEqual([]);
  });

  test('the total count never grows', () => {
    const currentTotal = Object.values(currentCounts()).reduce((a, b) => a + b, 0);
    const baselineTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
    expect(currentTotal).toBeLessThanOrEqual(baselineTotal);
  });

  test('the migrated modules import the tokens instead of the raw literals', () => {
    // Spot-check the highest-signal migrations so a future revert cannot pass by
    // simply re-raising the baseline. The remaining baseline entries are
    // decorative palettes (editor swatches, chart/gold gradients) that are not
    // semantic status colors and intentionally stay as literals.
    const migrated = {
      'src/components/Shared/LoadingSpinner.jsx': /tokens\.color\.semantic\./,
      'src/screens/SplashScreen.jsx': /tokens\.color\.semantic\./,
    };
    for (const [rel, re] of Object.entries(migrated)) {
      expect(fs.readFileSync(path.join(root, rel), 'utf8')).toMatch(re);
    }
  });
});
