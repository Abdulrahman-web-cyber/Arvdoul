/**
 * Every content image loads lazily (N505).
 *
 * A bare `<img>` ships without a decode hint and without lazy loading, so a
 * long feed of full-resolution media blocks the main thread while it decodes
 * and competes for bandwidth with the content the user is actually looking at.
 * The app standardises on `src/components/Shared/LazyImage.jsx`, which sets
 * `loading="lazy"` (opt-out for above-the-fold hero media) and
 * `decoding="async"`.
 *
 * This guard walks every JSX file and fails on a raw `<img ...>` tag (the only
 * file allowed to render one is the primitive itself). Because `LazyImage`
 * defaults `loading="lazy"` and `decoding="async"`, routing every image
 * through it means no image can silently regress to blocking, non-deferred
 * loading; the primitive is asserted separately.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const srcDir = path.join(root, 'src');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (/\.jsx$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('N505 — content images load through LazyImage', () => {
  test('no raw <img> tags outside the LazyImage primitive', () => {
    const offenders = [];
    for (const file of walk(srcDir)) {
      if (path.basename(file) === 'LazyImage.jsx') continue;
      const src = fs.readFileSync(file, 'utf8');
      if (/<img\b/.test(src)) offenders.push(path.relative(root, file));
    }
    expect(offenders).toEqual([]);
  });

  test('the LazyImage primitive defaults to lazy + async decode', () => {
    const s = fs.readFileSync(path.join(srcDir, 'components/Shared/LazyImage.jsx'), 'utf8');
    expect(s).toContain("loading = 'lazy'");
    expect(s).toContain("decoding = 'async'");
    expect(s).toContain('loading={loading}');
    expect(s).toContain('decoding={decoding}');
  });
});
