/**
 * src/__tests__/a11yInteractiveGuard.test.js
 *
 * Static accessibility guard for the whole `src` tree:
 *
 *  1. A `cursor-pointer` element that handles `onClick` must be a real
 *     interactive element (a <button>/<a>/<input> or a role= override), so it
 *     is keyboard-reachable and announced by assistive tech. The old
 *     `<div className="... cursor-pointer" onClick=...>` pattern is invisible
 *     to a keyboard user.
 *  2. Every <img> must carry an `alt` attribute (an empty alt is valid for a
 *     decorative image; a missing alt is not).
 *  3. Every <iframe> must carry a `title`.
 *
 * The remaining `<div onClick>` backdrops (modal scrims that close on outside
 * click) are intentionally allowed: they are not the sole way to operate the
 * dialog and are excluded by the `cursor-pointer` requirement above.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.jsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const files = walk(path.join(root, 'src')).map((f) => ({
  rel: path.relative(root, f),
  src: fs.readFileSync(f, 'utf8'),
}));

/** Returns every opening tag string for `name` in a source file. */
function openingTags(src, name) {
  const re = new RegExp(`<${name}\\b[^>]*>`, 'gs');
  return [...src.matchAll(re)].map((m) => m[0]);
}

describe('accessibility - interactive elements', () => {
  test('no clickable cursor-pointer div/span without a role', () => {
    const offenders = [];
    for (const { rel, src } of files) {
      for (const tag of openingTags(src, 'div').concat(openingTags(src, 'span'))) {
        if (!/cursor-pointer/.test(tag)) continue;
        if (!/onClick/.test(tag)) continue;
        if (/role=/.test(tag)) continue;
        offenders.push(`${rel}: ${tag.replace(/\s+/g, ' ').slice(0, 100)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('every <img> declares alt (empty is allowed for decorative)', () => {
    const offenders = [];
    for (const { rel, src } of files) {
      for (const tag of openingTags(src, 'img')) {
        if (!/\balt=/.test(tag)) offenders.push(`${rel}: ${tag.slice(0, 90)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  test('every <iframe> declares a title', () => {
    const offenders = [];
    for (const { rel, src } of files) {
      for (const tag of openingTags(src, 'iframe')) {
        if (!/\btitle=/.test(tag)) offenders.push(`${rel}: ${tag.slice(0, 90)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
