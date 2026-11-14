/**
 * @jest-environment node
 *
 * N444 — the home feed ranked on fields no writer populates, so the engagement
 * term was a constant 0.
 *
 * `feedService._calculateFallbackScore` read the top-level `post.likeCount` /
 * `commentCount` / `shareCount` / `viewCount`. No writer anywhere sets those —
 * the canonical counters are `posts/{id}.stats.*`, and even those are seeded `0`
 * at create and only ever mutated through the sharded `counter_shards`
 * documents (`CountersManager`, inside `firestoreService.toggleLike`/`toggleSave`/
 * `sharePost` and `commentService.createComment`). The scorer therefore saw 0
 * for every post, so every post got the same base score and the feed collapsed
 * to pure recency.
 *
 * Two things must stay true:
 *   1. `_calculateFallbackScore` reads the real `post.stats.*` fields.
 *   2. `_fetchOptimizedSources` overlays the shard sums onto the fetched posts
 *      *before* scoring (`_overlayFeedCounters`), so the scorer sees the truth.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = fs.readFileSync(path.join(root, 'src/services/feedService.js'), 'utf8');

describe('home feed ranks on real engagement counters (N444)', () => {
  test('_calculateFallbackScore reads post.stats.* (the sharded fields)', () => {
    const block = src.slice(
      src.indexOf('_calculateFallbackScore(post)'),
      src.indexOf('_hashString(str)'),
    );
    expect(block).toMatch(/post\.stats\?\.likes/);
    expect(block).toMatch(/post\.stats\?\.comments/);
    expect(block).toMatch(/post\.stats\?\.shares/);
    expect(block).toMatch(/post\.stats\?\.views/);
    // The top-level fields must not be the primary source any more.
    expect(block).not.toMatch(/const likes = post\.likeCount \|\| post\.likes/);
  });

  test('the fetched sources are overlaid with the shard sums before scoring', () => {
    // `_fetchOptimizedSources` must await the overlay before it returns, so the
    // scorer (which runs on the returned object) sees the real counts.
    const fetchBlock = src.slice(
      src.indexOf('async _fetchOptimizedSources('),
      src.indexOf('async _overlayFeedCounters('),
    );
    expect(fetchBlock).toMatch(/await this\._overlayFeedCounters\(sources\)/);
    // ...and the overlay itself reads the sharded counters, not the raw field.
    const overlay = src.slice(
      src.indexOf('async _overlayFeedCounters('),
      src.indexOf('_scoreAndRankPostsOptimized(sources'),
    );
    expect(overlay).toMatch(/countersManager\.applyAll\(\{/);
    expect(overlay).toMatch(/collection: 'posts'/);
    for (const field of ['likes', 'comments', 'shares', 'saves', 'views']) {
      expect(overlay).toContain(`'${field}'`);
    }
  });

  test('no dead watch-time ranking term remains (N445)', () => {
    // `avgWatchTime` is never written on a post (or mirrored for a video — the
    // server writes `stats.totalWatchTime`), so the boost was dead code.
    expect(src).not.toMatch(/p\.avgWatchTime/);
    expect(src).not.toMatch(/WATCH_TIME_WEIGHT/);
  });
});
