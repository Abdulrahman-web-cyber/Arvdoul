/**
 * False-success toast guard.
 *
 * A `catch` block that toasts a *persistence* claim ("saved locally",
 * "queued", "saved offline") is only honest if the same handler actually
 * wrote the record to a durable local store. CommentsDrawer toasted
 * "Comment saved locally" after a failed server write while only holding the
 * comment in React state — the read path merges
 * `arvdoul_local_comments_<postId>` from localStorage, so the comment vanished
 * on the next load.
 *
 * The scan is deliberately narrow: it only looks at catch blocks whose success
 * toast claims a local/queued/offline persistence, and requires the enclosing
 * handler to touch localStorage / sessionStorage / IndexedDB / the offline
 * queue. Non-persistence catch toasts (a clipboard `execCommand` fallback, a
 * GPS-coordinate fallback) are out of scope.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(root, 'src');

function collect(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collect(full));
    else if (/\.(jsx|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function catchBlocks(source) {
  const blocks = [];
  const re = /catch\s*(?:\([^)]*\))?\s*\{/g;
  let m;
  while ((m = re.exec(source))) {
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth += 1;
      else if (source[i] === '}') depth -= 1;
      i += 1;
    }
    blocks.push({ body: source.slice(start, i - 1), index: m.index });
  }
  return blocks;
}

/** Start of the enclosing handler (useCallback/function/arrow const). */
function handlerStart(source, catchIndex) {
  const before = source.slice(0, catchIndex);
  const anchors = [
    /(?:const|let|var)\s+\w+\s*=\s*(?:useCallback|async)?\s*\([^)]*\)\s*=>\s*\{/g,
    /(?:const|let|var)\s+\w+\s*=\s*async\s*\([^)]*\)\s*=>\s*\{/g,
    /(?:async\s+)?function\s+\w+\s*\([^)]*\)\s*\{/g,
  ];
  let best = 0;
  for (const re of anchors) {
    let m;
    while ((m = re.exec(before))) best = Math.max(best, m.index);
  }
  return best;
}

const PERSIST = /localStorage|sessionStorage|indexedDB|IndexedDB|offlineQueue|dbRef\.current|\.put\(/;
const CLAIM = /toast\.success\([^)]*(local|offline|queued|saved)/i;

describe('false-success toast guard: a "saved locally" claim must persist', () => {
  test('every catch that claims local persistence actually writes one', () => {
    const violations = [];
    for (const file of collect(SRC)) {
      const source = fs.readFileSync(file, 'utf8');
      for (const { body, index } of catchBlocks(source)) {
        if (!CLAIM.test(body)) continue;
        const handler = source.slice(handlerStart(source, index), index + body.length);
        if (!PERSIST.test(handler)) {
          const line = source.slice(0, index).split('\n').length;
          violations.push(`${path.relative(root, file)}:${line}: catch claims local persistence without a local write`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('CommentsDrawer persists an optimistic comment when the server write fails', () => {
    const src = fs.readFileSync(path.join(SRC, 'screens/CommentsDrawer.jsx'), 'utf8');
    const catchIdx = src.lastIndexOf("catch (err) {\n      if (!mountedRef.current) return;\n      console.warn('Comment post error");
    expect(catchIdx).toBeGreaterThan(-1);
    const block = src.slice(catchIdx, catchIdx + 900);
    expect(block).toMatch(/localStorage\.setItem\(key/);
    expect(block).toMatch(/toast\.success\('Comment saved locally'\)/);
  });
});
