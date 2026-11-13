/**
 * Gift-price single-source guard.
 *
 * `GIFT_VALUES` / `GIFT_CATALOG` in `src/shared/levelConfig.cjs` own every gift
 * type and price, and `functions/monetization.js` prices gifts from the synced
 * copy. A price table re-declared in a screen silently drifts from what the
 * `sendGift` callable actually charges — `PostOptionsDrawer` toasted
 * "Sent crown (50 coins)" from a local `{ rose: 5, crown: 50, … }` literal with
 * a `|| 5` default, so an unknown gift would have advertised 5 coins.
 *
 * The client must read `GIFT_VALUES`; only the canonical config (and the
 * derived `data/videoData.js` catalog) may spell the numbers out.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GIFT_VALUES } from '../shared/levelConfig.cjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '__tests__', 'dist', 'build', '.git'].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
};

// Files allowed to spell out gift prices: the canonical config and the catalog
// that derives from it.
const ALLOWED = new Set([
  path.join(root, 'src/shared/levelConfig.cjs'),
  path.join(root, 'src/data/videoData.js'),
]);

const giftTypes = Object.keys(GIFT_VALUES);

describe('gift prices have a single source', () => {
  test('the canonical table is the one the guard reads', () => {
    expect(GIFT_VALUES).toMatchObject({ rose: 5, crown: 50, diamond: 100, rocket: 500 });
  });

  test('no src module re-declares a gift price literal', () => {
    const offenders = [];
    for (const file of walk(path.join(root, 'src'))) {
      if (ALLOWED.has(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      // Strip comments so a documenting mention (e.g. the PostOptionsDrawer
      // note) is not flagged; we only care about executable literals.
      const code = text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
      for (const type of giftTypes) {
        const price = GIFT_VALUES[type];
        const re = new RegExp(`\\b${type}\\s*:\\s*${price}\\b`);
        if (re.test(code)) {
          offenders.push(`${path.relative(root, file)} → ${type}: ${price}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('PostOptionsDrawer reads GIFT_VALUES, not a local price table', () => {
    const src = fs.readFileSync(path.join(root, 'src/screens/PostOptionsDrawer.jsx'), 'utf8');
    expect(src).toContain("from '../shared/levelConfig.cjs'");
    expect(src).toContain('GIFT_VALUES[giftType]');
    expect(src).not.toMatch(/const fallback = \{ rose: 5/);
  });
});
