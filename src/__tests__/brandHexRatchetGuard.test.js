/**
 * src/__tests__/brandHexRatchetGuard.test.js
 *
 * Brand-hex ratchet (Tier-3 design-system consolidation).
 *
 * `src/design-system/tokens.*` is the single source of truth for the brand
 * palette (`#8B1EF3` / `#4431F7` / `#055BFB` / `#0088FF` / `#C82BFF`). UI modules
 * that re-declare those literals drift from the tokens and can never be
 * re-themed. The migration is complete: `scripts/brandHexBaseline.json` is now
 * empty, so the guard is a hard zero-tolerance check — ANY raw brand hex in a
 * non-design-system module fails. (It was a *ratchet* while the signup/login/
 * onboarding screens were still frozen; those are now migrated onto the tokens,
 * keeping their own 125deg/52% geometry by importing `tokens.color.brand.*`.)
 *
 * - Adding a raw brand hex anywhere under `src` (outside `src/design-system/`)
 *   fails.
 * - The guard may only tighten; the baseline must stay empty.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'src');

const BRAND_HEX = /#(?:8B1EF3|4431F7|055BFB|0088FF|C82BFF)\b/gi;

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
    const n = (fs.readFileSync(file, 'utf8').match(BRAND_HEX) || []).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

const baseline = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/brandHexBaseline.json'), 'utf8')
);

describe('brand hex ratchet — the baseline may only shrink', () => {
  test('no file exceeds its baseline raw brand-hex count', () => {
    const current = currentCounts();
    const offenders = [];
    for (const [file, n] of Object.entries(current)) {
      const allowed = baseline[file] || 0;
      if (n > allowed) offenders.push(`${file}: ${n} raw brand hex (baseline ${allowed})`);
    }
    expect(offenders.sort()).toEqual([]);
  });

  test('the migration is complete: the baseline is empty and every module is clean', () => {
    // The signup/login/onboarding screens were the last frozen holders of the
    // canonical hexes; they now import `tokens.color.brand.*`. Nothing under
    // `src` (outside `src/design-system/`) may re-declare a brand hex.
    expect(baseline).toEqual({});
    expect(currentCounts()).toEqual({});
  });

  test('the total count never grows', () => {
    const currentTotal = Object.values(currentCounts()).reduce((a, b) => a + b, 0);
    const baselineTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
    expect(currentTotal).toBeLessThanOrEqual(baselineTotal);
  });

  test('the baseline has no stale entries for files that are now clean', () => {
    // Keeps the ratchet honest: when a file is fully migrated, its baseline
    // entry must be deleted (the guard only shrinks), so the number in the
    // repo reflects reality.
    const current = currentCounts();
    const stale = Object.keys(baseline).filter((f) => !current[f]);
    expect(stale).toEqual([]);
  });
});
