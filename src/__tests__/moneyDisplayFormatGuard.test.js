/**
 * Money display formatting guard.
 *
 * `formatCoinsAsUsd` already emits a leading `$` (shared/levelConfig.cjs), so a
 * screen that prefixes it with another literal `$` renders `$$5.00`. Coin
 * values must also never be formatted as USD by hand (`coins.toFixed(2)`) —
 * that bypasses the single rounding policy in `coinsToUsd`.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const walk = (dir) => {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(jsx?|cjs)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(p);
  }
  return out;
};

const files = walk(path.join(root, 'src'));

describe('money display formatting', () => {
  test('no surface double-prefixes formatCoinsAsUsd with a literal $', () => {
    // `$${formatCoinsAsUsd(x)}` (or a template with a literal $ before it)
    // renders "$$5.00" because the helper already emits the sign.
    const re = /\$\$\{[^}]*formatCoinsAsUsd|`\$\$\{formatCoinsAsUsd/;
    const offenders = files.filter((f) => re.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  test('no surface renders a coin amount as USD with a raw toFixed', () => {
    const re = /\$\{?\w*[Ee]arnings\w*\.toFixed\(2\)/;
    const offenders = files.filter((f) => re.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
