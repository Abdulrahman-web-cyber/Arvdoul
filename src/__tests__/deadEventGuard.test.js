/**
 * Dead-event guard.
 *
 * The app coordinates several cross-cutting actions with `window` custom
 * events (`arvdoul:*`). A dispatched event with no listener is a silent no-op:
 * `arvdoul:navigate` fired on a foreground-notification click but nothing
 * listened, so the click never moved; `arvdoul:post_id_synced` fired when an
 * optimistic post id was replaced but the feed kept the temp id.
 *
 * This guard fails if any `arvdoul:*` event is dispatched in `src` (or the
 * service worker) with no matching `addEventListener` anywhere in `src` or
 * `public`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function collect(dir, exts, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, exts, out);
    else if (exts.some((e) => entry.name.endsWith(e))) out.push(full);
  }
  return out;
}

const sources = [
  ...collect(path.join(root, 'src'), ['.js', '.jsx']),
  ...collect(path.join(root, 'public'), ['.js']),
];

function names(src, kind) {
  const re = new RegExp(
    `${kind}\\(\\s*(?:new CustomEvent\\(\\s*)?['"\`](arvdoul:[\\w:-]+)['"\`]`,
    'g',
  );
  return [...src.matchAll(re)].map((m) => m[1]);
}

describe('dead-event guard - every dispatched arvdoul:* event has a listener', () => {
  test('no arvdoul:* event is dispatched without a listener', () => {
    const dispatched = new Set();
    const listened = new Set();
    for (const file of sources) {
      const src = fs.readFileSync(file, 'utf8');
      for (const n of names(src, 'dispatchEvent')) dispatched.add(n);
      for (const n of names(src, 'addEventListener')) listened.add(n);
    }
    const dead = [...dispatched].filter((n) => !listened.has(n)).sort();
    expect(dead).toEqual([]);
  });
});
