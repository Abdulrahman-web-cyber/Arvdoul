/**
 * No silent `catch {}` may survive in application source (N148, client half).
 *
 * `functionsSilentCatchGuard` covers the Cloud Functions runtime. This is the
 * client twin: an empty catch in `src` makes a failure indistinguishable from
 * success — the exact class the N142/N147/N148 sweeps fixed (a dropped push
 * token, a lost profile sync, an unrecorded impression, a swallowed parse).
 *
 * A catch body may be a no-op only when it carries a comment stating why
 * nothing is done (a genuinely benign case, e.g. cancelling an already-closed
 * stream reader, or a "must never throw" reporting path). Test files are
 * exempt — a test's `catch {}` is its own control flow.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(root, 'src');

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (/\.(js|jsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function catchBodies(source) {
  const out = [];
  const re = /\bcatch\s*(?:\([^)]*\))?\s*\{/g;
  let m;
  while ((m = re.exec(source))) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
      i++;
    }
    out.push({
      line: source.slice(0, m.index).split('\n').length,
      body: source.slice(start, i - 1),
    });
  }
  return out;
}

const CODE_ONLY = (body) =>
  body
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, '');
const HAS_COMMENT = (body) => /\/\/|\/\*/.test(body);

describe('application catches are handled or explained', () => {
  test('no bare empty catch without an explanatory comment', () => {
    const offenders = [];
    for (const file of collect(SRC)) {
      const src = fs.readFileSync(file, 'utf8');
      for (const { line, body } of catchBodies(src)) {
        if (CODE_ONLY(body) === '' && !HAS_COMMENT(body)) {
          offenders.push(`${path.relative(root, file)}:${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
