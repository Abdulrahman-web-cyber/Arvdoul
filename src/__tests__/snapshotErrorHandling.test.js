/**
 * Firestore realtime-listener error-handling guard.
 *
 * `onSnapshot(query, onNext)` without the third argument silently drops errors:
 * a rules denial or a dropped connection leaves the UI on stale data with no
 * log and an unhandled rejection. Every listener must pass an error callback so
 * a failed subscription is observable (23 of 31 were missing one).
 *
 * These assertions fail on the pre-fix code so the regression cannot return.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') walk(rel, out);
    } else if (/\.(js|jsx)$/.test(e.name)) out.push(rel);
  }
  return out;
}

function splitTopArgs(s) {
  const args = [];
  let depth = 0;
  let cur = '';
  let inStr = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      cur += c;
      if (c === inStr && s[i - 1] !== '\\') inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; cur += c; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    if (c === ')' || c === ']' || c === '}') depth--;
    if (c === ',' && depth === 0) { args.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

function listenersWithoutErrorHandler(code) {
  const bad = [];
  const re = /onSnapshot\s*\(/g;
  let m;
  while ((m = re.exec(code))) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    let inStr = null;
    for (; i < code.length; i++) {
      const c = code[i];
      if (inStr) { if (c === inStr && code[i - 1] !== '\\') inStr = null; continue; }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if (c === '(') depth++;
      else if (c === ')') { depth--; if (depth === 0) break; }
    }
    if (splitTopArgs(code.slice(start, i)).length < 3) {
      bad.push(code.slice(0, m.index).split('\n').length);
    }
  }
  return bad;
}

describe('every onSnapshot listener handles errors', () => {
  test('no listener is registered without an error callback', () => {
    const offenders = [];
    for (const f of walk('src')) {
      const bad = listenersWithoutErrorHandler(fs.readFileSync(path.join(root, f), 'utf8'));
      if (bad.length) offenders.push(`${f}:${bad.join(',')}`);
    }
    expect(offenders).toEqual([]);
  });
});
