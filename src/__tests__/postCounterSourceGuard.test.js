/**
 * Post engagement counters must have a single authoritative source (N433).
 *
 * Every like/save/share/comment mutation routes its increment to a sharded
 * `counter_shards` document (client `CountersManager`, inside
 * `firestoreService.toggleLike`/`toggleSave`/`sharePost` and
 * `commentService.createComment`/`deleteComment`). No writer ever updates
 * `posts/{postId}.stats.likes` (etc.) — the field is seeded `0` at create and
 * left there. Server readers that trusted it therefore saw a fabricated zero:
 *   * `feed.js#processScoreUpdates` read `post.likeCount`/`commentCount`/
 *     `shareCount`/`viewCount` — top-level fields never written at all — so the
 *     engagement term was a constant 0 and every post ranked purely by recency;
 *   * `search.js#indexPost` shipped the stale `stats.likes`/`stats.comments` to
 *     the Algolia post index, so content search sorted by a fabricated 0.
 *
 * The fix mirrors the video counter model: `functions/postCounters.js` sums the
 * shards (`readPostCounterShards`, one batched `getAll`) and the scheduled
 * `aggregatePostCounters` writes the sums back onto `posts/{postId}.stats`, and
 * `feed.js` now reads the real `stats.*` fields.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const countersSrc = read('functions/postCounters.js');
const indexSrc = read('functions/index.js');
const feedSrc = read('functions/feed.js');
const clientCounters = read('src/utils/CountersManager.js');

describe('post engagement counters have a single authoritative source (N433)', () => {
  test('index.js merges the postCounters module', () => {
    expect(indexSrc).toMatch(/merge\(require\('\.\/postCounters\.js'\)\)/);
  });

  test('the server shard hash + doc-id layout is byte-identical to the client', () => {
    // Same djb2 variant as CountersManager.hashString.
    const serverHash = countersSrc.match(/function hashString\(str\) \{[\s\S]*?\n\}/);
    expect(serverHash).not.toBeNull();
    expect(serverHash[0]).toContain('h = 5381');
    expect(serverHash[0]).toContain('h = ((h << 5) + h + str.charCodeAt(i)) >>> 0');
    expect(serverHash[0]).toContain("h.toString(36)");
    // Same doc-id shape: `${hash}__${field}__${shardIndex}`.
    expect(countersSrc).toMatch(/doc\(`\$\{hashString\(docPath\)\}__\$\{field\}__\$\{shardIndex\}`\)/);
    // The client writes/reads the same layout.
    expect(clientCounters).toContain("__${field}__${shardIndex}");
    expect(clientCounters).toContain('5381');
    // Same shard count.
    expect(countersSrc).toMatch(/COUNTER_SHARDS = 10/);
    expect(clientCounters).toMatch(/shards = 10/);
  });

  test('the shard read is one batched getAll, not a scan', () => {
    expect(countersSrc).toMatch(/db\.getAll\(\.\.\.refs\)/);
    expect(countersSrc).not.toMatch(/collection\([^)]*\)\.get\(\)/);
  });

  test('the mirror writes the sums onto posts/{postId}.stats', () => {
    expect(countersSrc).toMatch(/exports\.aggregatePostCounters = functions\.pubsub/);
    expect(countersSrc).toMatch(/patch\[`stats\.\$\{field\}`\] = value/);
    expect(countersSrc).toMatch(/POST_COUNTER_FIELDS = \['likes', 'comments', 'shares', 'saves'\]/);
  });

  test('feed ranking reads the real stats fields, not the never-written top-level ones', () => {
    const scoreBlock = feedSrc.slice(
      feedSrc.indexOf('async function processScoreUpdates'),
      feedSrc.indexOf('exports.', feedSrc.indexOf('async function processScoreUpdates')),
    );
    expect(scoreBlock).toMatch(/const stats = post\.stats \|\| \{\}/);
    expect(scoreBlock).toMatch(/stats\.likes/);
    expect(scoreBlock).not.toMatch(/post\.likeCount/);
    expect(scoreBlock).not.toMatch(/post\.commentCount/);
    expect(scoreBlock).not.toMatch(/post\.shareCount/);
    expect(scoreBlock).not.toMatch(/post\.viewCount/);
  });
});

describe('PostAnalyticsScreen resolves the real (sharded) view total (N437)', () => {
  const screen = read('src/screens/PostAnalyticsScreen.jsx');

  test('reads the sharded view counter, not the seeded stats.views', () => {
    // `recordPostView` writes `counter_shards`, never `stats.views`, so the raw
    // field is a permanent 0. The screen must sum the shards via CountersManager.
    expect(screen).toMatch(/countersManager\.get\(\{[\s\S]*?field: 'views'/);
    expect(screen).toMatch(/docPath: `posts\/\$\{postId\}`/);
  });

  test('the raw seeded stats.views is never presented as the measured total', () => {
    expect(screen).not.toMatch(/stat\(postDoc\.stats\?\.views \?\? postDoc\.viewsCount \?\? postDoc\.views\)/);
  });
});
