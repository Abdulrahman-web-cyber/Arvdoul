// Guards that every composite Firestore query in src has a declared index.
//
// Firestore only reveals a missing index at runtime, as a FAILED_PRECONDITION
// error in production. This statically extracts `query(...)` calls that combine
// a `where` filter with an `orderBy`, then checks `firestore.indexes.json`
// covers them. Single-field and equality-only queries use automatic indexes and
// are skipped.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.jsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Returns the substring of a call argument list starting at `openParen`. */
function sliceCall(source, openParen) {
  let depth = 0;
  for (let i = openParen; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1;
    else if (source[i] === ')') {
      depth -= 1;
      if (depth === 0) return source.slice(openParen, i + 1);
    }
  }
  return '';
}

function extractQueries(source) {
  const found = [];
  const re = /query\(/g;
  let match;
  while ((match = re.exec(source))) {
    const body = sliceCall(source, match.index + match[0].length - 1);
    if (!body || !body.includes('orderBy')) continue;

    const collectionMatch = body.match(/collection\(\s*[^,]+,\s*['"]([A-Za-z_]+)['"]/);
    if (!collectionMatch) continue;

    const wheres = [...body.matchAll(/where\(\s*['"]([A-Za-z_][\w.]*)['"]\s*,/g)].map(m => m[1]);
    const orders = [...body.matchAll(/orderBy\(\s*['"]([A-Za-z_][\w.]*)['"]/g)].map(m => m[1]);
    // orderBy('__name__') is implicit in every single-field index, so it never
    // requires a composite index of its own.
    const effectiveOrders = orders.filter(o => o !== '__name__');

    const fields = new Set([...wheres, ...effectiveOrders]);
    if (fields.size <= 1) continue;

    found.push({ collection: collectionMatch[1], fields });
  }
  return found;
}

describe('Firestore index coverage', () => {
  const indexes = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'firestore.indexes.json'), 'utf8')
  ).indexes;

  const declared = new Map();
  for (const index of indexes) {
    const names = index.fields.map(f => f.fieldPath);
    if (!declared.has(index.collectionGroup)) declared.set(index.collectionGroup, []);
    declared.get(index.collectionGroup).push(new Set(names));
  }

  test('every composite query has a declared composite index', () => {
    const missing = [];

    const roots = [path.join(ROOT, 'src'), path.join(ROOT, 'functions')];
    for (const file of roots.flatMap(root => walk(root))) {
      const source = fs.readFileSync(file, 'utf8');
      for (const { collection, fields } of extractQueries(source)) {
        const candidates = declared.get(collection) || [];
        const covered = candidates.some(
          index => fields.size <= index.size && [...fields].every(f => index.has(f))
        );
        if (!covered) {
          missing.push(
            `${path.relative(ROOT, file)} -> ${collection} [${[...fields].sort().join(', ')}]`
          );
        }
      }
    }

    expect([...new Set(missing)].sort()).toEqual([]);
  });

  test('index definitions are well formed', () => {
    for (const index of indexes) {
      expect(index.collectionGroup).toBeTruthy();
      expect(Array.isArray(index.fields)).toBe(true);
      expect(index.fields.length).toBeGreaterThan(0);
      for (const field of index.fields) {
        expect(field.fieldPath).toBeTruthy();
        // A field is either ordered or an array config, never both.
        expect(Boolean(field.order) !== Boolean(field.arrayConfig)).toBe(true);
      }
    }
  });
});