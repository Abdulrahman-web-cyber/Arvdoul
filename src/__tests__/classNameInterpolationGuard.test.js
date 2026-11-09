/**
 * Non-interpolated className guard.
 *
 * A `${...}` inside a *double-quoted* JSX attribute is not interpolation — JSX
 * passes the whole string through literally, so the class name ends up as the
 * text `${status.className}` and the element loses its styling. The same
 * happens with an escaped `\${...}` inside a template literal (the expression
 * is emitted verbatim). Both shipped: `EventDetailScreen`/`EventDiscoveryScreen`
 * rendered an uncoloured status badge and `FilterTool`'s search input lost its
 * dark/light surface classes.
 *
 * The scan only looks at `className` attributes, where a stray `${` is
 * unambiguously a bug (never legitimate text), so it stays at zero false
 * positives.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SRC = path.join(root, 'src');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      walk(full, out);
    } else if (/\.jsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('className interpolation guard', () => {
  const files = walk(SRC);

  test('no `${}` is left un-interpolated inside a className', () => {
    const offenders = [];
    for (const file of files) {
      const src = fs.readFileSync(file, 'utf8');
      src.split('\n').forEach((line, i) => {
        // Double-quoted className attribute containing a template expression.
        if (/className="[^"]*\$\{/.test(line)) {
          offenders.push(`${path.relative(root, file)}:${i + 1}`);
          return;
        }
        // Escaped `\${...}` inside a template literal renders literally.
        if (/className=\{`/.test(line) && /\\\$\{/.test(line)) {
          offenders.push(`${path.relative(root, file)}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
