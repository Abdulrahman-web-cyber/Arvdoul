/**
 * src/__tests__/rateLimitShardCleanupGuard.test.js
 *
 * N491 — `functions/comments.js#deleteOldRateLimitShards` (the 12h cleanup that
 * keeps the rate-limit shard collection bounded) did one unbounded
 * `db.collectionGroup('shards').get()`. The group spans every
 * `rate_limits/{user_action}/shards/{n}` document — one per user × action ×
 * shard — so the single read grows without bound and eventually exceeds the
 * function timeout / memory limit, leaving stale shards behind exactly as the
 * job was meant to prevent. It also deleted one document per awaited round-trip.
 *
 * The fix pages the group with a `__name__` cursor and deletes in batches.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'functions/comments.js'), 'utf8');

const block = src.slice(
  src.indexOf('exports.deleteOldRateLimitShards'),
  src.indexOf('//  Helper: delete all docs in a subcollection')
);

describe('rate-limit shard cleanup is bounded (N491)', () => {
  test('the cleanup pages the collection group with a __name__ cursor', () => {
    expect(block.length).toBeGreaterThan(0);
    expect(block).toMatch(/collectionGroup\('shards'\)/);
    expect(block).toMatch(/orderBy\('__name__'\)/);
    expect(block).toMatch(/startAfter\(cursor\)/);
    expect(block).toMatch(/if \(snap\.size < PAGE\) break;/);
    // The unbounded single read is gone.
    expect(block).not.toMatch(/collectionGroup\('shards'\)\.get\(\)/);
  });

  test('deletes are batched, not one awaited round-trip per document', () => {
    expect(block).toMatch(/db\.batch\(\)/);
    expect(block).toMatch(/batch\.delete\(doc\.ref\)/);
    expect(block).toMatch(/await flush\(\)/);
  });
});
