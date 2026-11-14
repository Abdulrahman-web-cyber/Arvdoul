/**
 * Comment reaction counts must be read from their sharded counter (N439).
 *
 * `commentService.likeComment`/`dislikeComment`/`removeLikeDislike` increment a
 * sharded `counter_shards` counter for `comments/{id}` (fields `likes`/
 * `dislikes`) and never write the numeric fields on the comment document — they
 * stay at their create-time `0`. No read path summed the shards, so
 * `CommentsDrawer` (line ~953 + the "Best" sort) and `VideoComments` rendered a
 * fabricated `0` likes on every comment, and the realtime subscription replaced
 * an optimistic like count with that seeded `0`. `likesBy` is not a substitute:
 * it is capped at `REACTION_ARRAY_CAP`, so it undercounts.
 *
 * The fix overlays the shard sum on every comment read path through
 * `commentService._overlayReactionCounts` → `countersManager.applyAll` (one
 * batched `getAll` per chunk of comments, falling back to the raw field only
 * when no shard exists — mirroring the N431/N433/N437 shard-read pattern).
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CountersManager } from '../utils/CountersManager.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const commentServiceSrc = read('src/services/commentService.js');
const countersSrc = read('src/utils/CountersManager.js');

describe('comment reaction counts resolve their sharded counter (N439)', () => {
  test('commentService overlays the shard sum on every read path', () => {
    // The overlay helper exists and targets the comment reaction fields.
    expect(commentServiceSrc).toMatch(/async _overlayReactionCounts\(comments\)/);
    expect(commentServiceSrc).toMatch(/collection: 'comments'/);
    expect(commentServiceSrc).toMatch(/fields: \['likes', 'dislikes'\]/);

    // getCommentsByPost, getComment, getReplies and the realtime subscription
    // each call it (4 call sites in the service).
    const calls = commentServiceSrc.match(/await this\._overlayReactionCounts\(/g) || [];
    expect(calls.length).toBeGreaterThanOrEqual(4);
  });

  test('countersManager exposes a batched applyAll (not one read per item)', () => {
    expect(countersSrc).toMatch(/async applyAll\(\{ items, collection/);
    expect(countersSrc).toMatch(/m\.getAll\(\.\.\.refs\)/);
    // Bounded refs per batched read.
    expect(countersSrc).toMatch(/refsPerItem = fields\.length \* this\.shards/);
  });
});

describe('countersManager.applyAll overlays shard sums', () => {
  const makeManager = (shardStore) => {
    const mgr = new CountersManager({ shards: 4 });
    mgr._firestore = {};
    mgr._methods = {
      doc: (_fs, collection, id) => ({ path: `${collection}/${id}` }),
      getAll: async (...refs) =>
        refs.map((r) =>
          shardStore.has(r.path)
            ? { exists: () => true, data: () => ({ value: shardStore.get(r.path) }) }
            : { exists: () => false }
        ),
    };
    return mgr;
  };

  test('sums every shard for a comment and writes it onto the item', async () => {
    const shardStore = new Map();
    const mgr = makeManager(shardStore);
    // Two shards hold 3 and 2 → sum 5 for comments/c1.likes.
    shardStore.set(`counter_shards/${mgr._shardKey('comments/c1', 'likes', 0)}`, 3);
    shardStore.set(`counter_shards/${mgr._shardKey('comments/c1', 'likes', 2)}`, 2);

    const items = [{ id: 'c1', likes: 0, dislikes: 0 }];
    await mgr.applyAll({ items, collection: 'comments', fields: ['likes', 'dislikes'], scope: 'top' });

    expect(items[0].likes).toBe(5);
    // No dislikes shard → legacy value kept (never a fabricated 0 that is
    // actually a real 0; the fallback is the stored field).
    expect(items[0].dislikes).toBe(0);
  });

  test('keeps the legacy value when no shard exists at all', async () => {
    const mgr = makeManager(new Map());
    const items = [{ id: 'c2', likes: 7 }];
    await mgr.applyAll({ items, collection: 'comments', fields: ['likes'], scope: 'top' });
    expect(items[0].likes).toBe(7);
  });

  test('handles many comments in bounded batches', async () => {
    const shardStore = new Map();
    const mgr = makeManager(shardStore);
    const items = [];
    for (let i = 0; i < 25; i++) {
      items.push({ id: `c${i}`, likes: 0 });
      shardStore.set(`counter_shards/${mgr._shardKey(`comments/c${i}`, 'likes', 1)}`, i);
    }
    await mgr.applyAll({ items, collection: 'comments', fields: ['likes'], scope: 'top' });
    items.forEach((it, i) => expect(it.likes).toBe(i));
  });
});
