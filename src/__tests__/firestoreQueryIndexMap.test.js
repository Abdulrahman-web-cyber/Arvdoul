/**
 * src/__tests__/firestoreQueryIndexMap.test.js
 *
 * Firestore cannot serve a query with more than one range/equality constraint
 * unless a composite index exists; a missing index fails the query at runtime
 * with FAILED_PRECONDITION (which most call sites surface as an empty list, so
 * the screen just looks empty). This guard maps the multi-constraint queries in
 * `src` to `firestore.indexes.json` and fails when one is uncovered, so an
 * index can never silently drift from the code that needs it.
 *
 * It also fails on duplicate index definitions and on an index that targets a
 * collection the rules do not declare (an index for a collection nothing can
 * read is dead config).
 *
 * A query with a single equality plus `orderBy('__name__')` is served by the
 * automatic single-field index and is intentionally not required here.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Server-owned / cross-service collections that legitimately have no client rule. */
const SERVER_ONLY_COLLECTIONS = new Set([
  'push_queue',
  'report_impressions',
  'shards',
  'fanout_tasks',
  'moderation_logs',
  'ai_usage_logs',
  'rate_limits',
  'enterprise_tenants',
]);

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Returns the substring inside the parens that open at `start`. */
function innerParens(src, start) {
  let depth = 0;
  let quote = null;
  for (let i = start; i < src.length; i += 1) {
    const ch = src[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
    } else if (ch === '(') {
      depth += 1;
    } else if (ch === ')') {
      depth -= 1;
      if (depth === 0) return src.slice(start + 1, i);
    }
  }
  return '';
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.jsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Multi-constraint query() shapes: `{ collection, fields[] }`. */
function extractQueryShapes() {
  const shapes = [];
  for (const file of walk(path.join(root, 'src'))) {
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    for (const m of src.matchAll(/\bquery\s*\(/g)) {
      const inner = innerParens(src, m.index + m[0].length - 1);
      const colMatch = inner.match(/collection\(\s*[^,()]+,\s*'([\w]+)'\s*\)/);
      if (!colMatch) continue;
      const whereFields = [...inner.matchAll(/\.where\(\s*'([\w.]+)'/g)].map((x) => x[1]);
      const orderFields = [...inner.matchAll(/\.orderBy\(\s*'([\w.]+)'/g)].map((x) => x[1]);
      const constraints = whereFields.length + orderFields.length;
      // One equality + __name__ ordering is served by the automatic index.
      const autoNameOnly =
        whereFields.length === 1 && orderFields.every((f) => f === '__name__');
      if (constraints >= 2 && !autoNameOnly) {
        shapes.push({ file: path.relative(root, file), collection: colMatch[1], fields: [...whereFields, ...orderFields] });
      }
    }
  }
  return shapes;
}

const indexes = JSON.parse(fs.readFileSync(path.join(root, 'firestore.indexes.json'), 'utf8'));
const indexByCollection = new Map();
for (const ix of indexes.indexes || []) {
  const list = indexByCollection.get(ix.collectionGroup) || [];
  list.push((ix.fields || []).map((f) => f.fieldPath));
  indexByCollection.set(ix.collectionGroup, list);
}

function isCovered(collection, fields) {
  const need = new Set(fields.filter((f) => f !== '__name__'));
  for (const idxFields of indexByCollection.get(collection) || []) {
    if ([...need].every((f) => idxFields.includes(f))) return true;
  }
  return false;
}

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
// Every literal segment of every match path (top-level OR nested). An index for
// a collection-group read of a subcollection (`messages`, `liked_posts`,
// `saved_posts`) is legitimate even though it has no top-level rule.
const ruleCollections = new Set();
for (const line of rules.split('\n')) {
  // Greedy `.*` up to the LAST `{` on the line: the block-opening brace. A
  // non-greedy match would stop at the first `{` of `{userId}`.
  const m = line.match(/match\s+\/(.*)\{\s*$/);
  if (!m) continue;
  for (const seg of m[1].split('/')) {
    if (/^[A-Za-z_][\w]*$/.test(seg)) ruleCollections.add(seg);
  }
}
// `messages` is stored under dynamic shard names (`messages_YYYY_MM`) validated
// by `isMessageShardCollection`, so no literal segment exists in the rules.
ruleCollections.add('messages');

describe('Firestore query ↔ index map', () => {
  test('every multi-constraint client query has a covering composite index', () => {
    const uncovered = extractQueryShapes()
      .filter((s) => !isCovered(s.collection, s.fields))
      .map((s) => `${s.file}: ${s.collection}(${s.fields.join(', ')})`);
    expect(uncovered.sort()).toEqual([]);
  });

  test('no duplicate index definitions', () => {
    const seen = new Set();
    const dupes = [];
    for (const ix of indexes.indexes || []) {
      const sig = `${ix.collectionGroup}|${ix.queryScope || 'COLLECTION'}|${(ix.fields || [])
        .map((f) => `${f.fieldPath}:${f.order || 'ASCENDING'}`)
        .join(',')}`;
      if (seen.has(sig)) dupes.push(sig);
      seen.add(sig);
    }
    expect(dupes).toEqual([]);
  });

  test('every index targets a collection that the rules declare (or is server-only)', () => {
    const orphans = [];
    for (const ix of indexes.indexes || []) {
      const col = ix.collectionGroup;
      if (ruleCollections.has(col) || SERVER_ONLY_COLLECTIONS.has(col)) continue;
      orphans.push(col);
    }
    expect([...new Set(orphans)].sort()).toEqual([]);
  });

  test('the index file is substantial (guards a wiped config)', () => {
    expect((indexes.indexes || []).length).toBeGreaterThan(100);
  });
});
