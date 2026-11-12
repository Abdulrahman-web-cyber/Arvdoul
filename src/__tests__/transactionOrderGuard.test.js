/**
 * src/__tests__/transactionOrderGuard.test.js
 *
 * Firestore transactions require every read to happen before the first write.
 * The SDK enforces this at runtime (`Transaction.get()` throws
 * "Firestore transactions require all reads to be executed before all writes."
 * once the write batch is non-empty), so a `t.get()` placed after a
 * `t.set/update/delete()` does not "sometimes work" — it throws every time and
 * the whole transaction (a view count, a withdrawal rejection, a balance move)
 * silently never happens.
 *
 * This bit `trackProfileView` / `recordPostView` (view analytics never counted)
 * and the withdrawal reject path (locked coins stayed stranded). This guard
 * scans every `runTransaction` callback in `functions/` and `src/` and fails if
 * any callback reads after it writes.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Remove comments and string/template-literal bodies so regexes match code only. */
function stripNonCode(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') {
      const j = src.indexOf('*/', i + 2);
      i = j < 0 ? n : j + 2;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      const j = src.indexOf('\n', i);
      i = j < 0 ? n : j;
      continue;
    }
    if (c === '`' || c === "'" || c === '"') {
      const q = c;
      i += 1;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === q) { i += 1; break; }
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(js|jsx)$/.test(entry.name) && !entry.name.endsWith('.cjs')) acc.push(full);
  }
  return acc;
}

/** Every `runTransaction(cb)` callback body, with the transaction param name. */
function transactionCallbacks(src) {
  const found = [];
  const re = /runTransaction\(\s*(?:async\s*)?\((\w+)\)\s*=>\s*\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const t = m[1];
    const open = m.index + m[0].length - 1;
    let depth = 0;
    let end = open;
    for (let j = open; j < src.length; j += 1) {
      if (src[j] === '{') depth += 1;
      else if (src[j] === '}') {
        depth -= 1;
        if (depth === 0) { end = j; break; }
      }
    }
    found.push({ t, body: src.slice(open + 1, end), offset: open + 1 });
  }
  return found;
}

describe('Firestore transaction read-before-write ordering', () => {
  const files = [...walk(path.join(root, 'functions')), ...walk(path.join(root, 'src'))];

  test('no runTransaction callback reads after it writes', () => {
    const offenders = [];
    for (const file of files) {
      const src = stripNonCode(fs.readFileSync(file, 'utf8'));
      for (const { t, body, offset } of transactionCallbacks(src)) {
        const write = body.search(new RegExp(`\\b${t}\\.(set|update|delete)\\(`));
        if (write < 0) continue;
        const read = body.search(new RegExp(`\\b${t}\\.(get|getAll)\\(`));
        if (read > write) {
          const line = src.slice(0, offset + read).split('\n').length;
          offenders.push(`${path.relative(root, file)}:${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test('the scan actually inspects transaction callbacks (not silently empty)', () => {
    const hits = files.filter((f) => /runTransaction\(/.test(fs.readFileSync(f, 'utf8')));
    expect(hits.length).toBeGreaterThan(0);
  });

  test('no runTransaction callback awaits a money callable or callableFunction', () => {
    // A transaction callback can be retried by the SDK, so a network call in
    // the callback (a coin credit, a callable) can run more than once for a
    // single logical write — a double-mint. `storyService.answerQuiz` credited
    // the quiz reward via `monetization.addCoins(...)` inside its transaction;
    // the credit now runs after commit with a deterministic idempotency key.
    const offenders = [];
    for (const file of files) {
      const src = stripNonCode(fs.readFileSync(file, 'utf8'));
      for (const { body, offset } of transactionCallbacks(src)) {
        const m = body.search(/\b(?:addCoins|spendCoins|transferCoins|callFunction|httpsCallable)\s*\(/);
        if (m >= 0) {
          const line = src.slice(0, offset + m).split('\n').length;
          offenders.push(`${path.relative(root, file)}:${line}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
