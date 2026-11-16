/**
 * src/__tests__/reindexCoversWholeCollectionGuard.test.js
 *
 * N488 — `functions/search.js#batchReindex` (the 24h Algolia rebuild) issued a
 * single `.limit(500)` read per collection, so "reindex" only ever rebuilt the
 * first 500 users/posts/videos. Every document beyond that kept whatever Algolia
 * already had (stale or missing) while the log claimed the reindex "completed".
 *
 * The fix walks the whole collection with a `__name__` cursor. This guard pins
 * the cursor walk and fails if the bounded single-page rebuild returns.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'functions/search.js'), 'utf8');

const reindexBlock = src.slice(
  src.indexOf('async function reindexCollection'),
  src.indexOf('exports.batchReindex')
);

describe('batchReindex covers the whole collection (N488)', () => {
  test('the reindex walks with a __name__ cursor, not a single limited page', () => {
    expect(reindexBlock.length).toBeGreaterThan(0);
    expect(reindexBlock).toMatch(/orderBy\('__name__'\)/);
    expect(reindexBlock).toMatch(/startAfter\(cursor\)/);
    // The loop keeps going until a page comes back short.
    expect(reindexBlock).toMatch(/if \(snap\.size < PAGE\) break;/);
    expect(reindexBlock).toMatch(/if \(snap\.empty\) break;/);
  });

  test('batchReindex runs the cursor walk for users, posts and videos', () => {
    const body = src.slice(src.indexOf('exports.batchReindex'));
    expect(body).toMatch(/reindexCollection\('users'/);
    expect(body).toMatch(/reindexCollection\('posts'/);
    expect(body).toMatch(/reindexCollection\('videos'/);
    // The old one-shot `collection(...).limit(PAGE).get()` rebuild is gone.
    expect(body).not.toMatch(/collection\('users'\)\.limit\(/);
    expect(body).not.toMatch(/collection\('posts'\)\.limit\(/);
    expect(body).not.toMatch(/collection\('videos'\)\.limit\(/);
  });
});
