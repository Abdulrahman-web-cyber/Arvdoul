/**
 * Every `catch` in the Cloud Functions runtime must handle or explain (N148).
 *
 * The client sweeps (N142/N147) made silent catches observable in `src`; the
 * server runtime still had bare `catch {}` / `catch (_) {}` blocks where a
 * failure was indistinguishable from success — `auth.isAdmin` failing closed
 * with no trace, `stories` leaving orphaned Storage objects, `moderation`
 * skipping a report counter, `user.deleteUserData` skipping push-token cleanup.
 *
 * The rule is deliberately minimal so it stays at zero false positives: a
 * catch body is allowed to be a no-op only when it carries a comment that
 * states why nothing is done (a genuinely benign case such as cancelling an
 * already-closed stream reader). An empty body with no explanation fails.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FUNCTIONS = path.join(root, 'functions');

function collect(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/** Returns every catch body, keeping comments, with the line it starts on. */
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

describe('cloud function catches are handled or explained', () => {
  test('no bare empty catch without an explanatory comment', () => {
    const offenders = [];
    for (const file of collect(FUNCTIONS)) {
      const src = fs.readFileSync(file, 'utf8');
      for (const { line, body } of catchBodies(src)) {
        if (CODE_ONLY(body) === '' && !HAS_COMMENT(body)) {
          offenders.push(`${path.relative(root, file)}:${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the previously-silent server paths now log', () => {
    const pins = [
      ['functions/auth.js', 'Admin grant lookup failed'],
      ['functions/auth.js', 'users_private email read failed'],
      ['functions/moderation.js', 'reportCount increment skipped'],
      ['functions/stories.js', 'story media delete failed'],
      ['functions/user.js', 'push token cleanup failed'],
      ['functions/monetization.js', 'Ad targeting profile read failed'],
    ];
    const missing = pins.filter(([rel, needle]) => {
      const src = fs.readFileSync(path.join(root, rel), 'utf8');
      return !src.includes(needle);
    });
    expect(missing).toEqual([]);
  });
});
