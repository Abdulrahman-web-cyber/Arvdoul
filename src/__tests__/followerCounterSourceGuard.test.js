/**
 * Follower/following counters must have one source of truth (N431).
 *
 * `users/{uid}.followerCount` is seeded `0` at signup and never written again —
 * every follow/unfollow mutation increments a sharded `counter_shards` document
 * (client `CountersManager`, used inside `userService.followUser`/`unfollowUser`/
 * `approveFollowRequest`/`blockUser`). Server readers that trusted the raw field
 * therefore always saw `0`:
 *   * the fan-out threshold in `feed.js`/`stories.js` (`followerCount > 10000`)
 *     never tripped, so a celebrity's post/story was fanned out to every
 *     follower — the exact unbounded write storm the pull model exists to avoid;
 *   * the Algolia user index (`search.js`) shipped `followerCount: 0` for every
 *     user, so search rendered a fabricated "0 followers".
 *
 * The fix: `functions/userCounters.js` reads the shard sum authoritatively
 * (`readUserCounter`, used by the two fan-out decisions) and a scheduled mirror
 * (`aggregateUserCounters`) writes the sum back onto `users/{uid}` so every
 * remaining reader reads a real number. The counts are also made
 * server-authoritative in the rules + the client contract so an owner cannot
 * mint their own standing.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const indexSrc = read('functions/index.js');
const countersSrc = read('functions/userCounters.js');
const feedSrc = read('functions/feed.js');
const storiesSrc = read('functions/stories.js');
const rules = read('firestore.rules');
const contracts = read('src/config/profileContracts.js');
const clientCounters = read('src/utils/CountersManager.js');

describe('follower/following counters have a single authoritative source (N431)', () => {
  test('the counter module exists and is merged into index.js', () => {
    expect(indexSrc).toMatch(/merge\(require\('\.\/userCounters\.js'\)\)/);
    expect(countersSrc).toMatch(/exports\.aggregateUserCounters\s*=\s*functions\.pubsub/);
    expect(countersSrc).toMatch(/exports\.readUserCounter\s*=/);
  });

  test('the server shard hash + layout stay byte-identical to the client', () => {
    // The client writes the shards and sums them on read; a drifted algorithm
    // makes server and client read different documents and the count silently
    // wrong (the same class the analytics.js hash guard covers).
    const extractFn = (src) => {
      const m = src.match(/function\s+hashString\s*\([^)]*\)\s*\{[\s\S]*?\n\}/);
      return m && m[0].replace(/\s+/g, ' ').trim();
    };
    expect(extractFn(countersSrc)).toBeTruthy();
    expect(extractFn(countersSrc)).toBe(extractFn(clientCounters));

    const layout = (src) => {
      const m = src.match(/`\$\{hashString\([^`]*?\)\}__\$\{[^}]*\}__\$\{[^}]*\}`/);
      return m && m[0];
    };
    expect(layout(countersSrc)).toBeTruthy();
    expect(layout(countersSrc)).toBe(layout(clientCounters));
  });

  test('the mirror writes the shard sum back onto users/{uid} (and only when it changed)', () => {
    expect(countersSrc).toMatch(/db\.getAll\(/);           // one batched shard read
    expect(countersSrc).toMatch(/patch\.followerCount\s*=\s*followers\.value/);
    expect(countersSrc).toMatch(/patch\.followingCount\s*=\s*following\.value/);
    // Only write when the value actually changed, so the users onWrite trigger
    // (Algolia indexing) does not churn.
    expect(countersSrc).toMatch(/data\.followerCount\s*!==\s*followers\.value/);
    // Never overwrite a real legacy value with 0 when no shard exists yet.
    expect(countersSrc).toMatch(/followers\.found\s*>\s*0/);
  });

  test('both fan-out threshold decisions read the authoritative count, not the raw field', () => {
    for (const src of [feedSrc, storiesSrc]) {
      expect(src).toContain("require('./userCounters')");
      expect(src).toMatch(/readUserCounter\(/);
      // The raw-field read that always returned 0 must be gone.
      expect(src).not.toMatch(/data\(\)\?\.followerCount\s*\|\|\s*0/);
    }
  });

  test('the fan-out gate fails toward the pull model when the count is unknown', () => {
    // feed.js must not fan out an unbounded follower set if the count cannot be
    // resolved; the safe default is "treat as large".
    expect(feedSrc).toMatch(/followerCount\s*=\s*Number\.MAX_SAFE_INTEGER/);
  });

  test('follower/following counts are server-authoritative in the rules and the contract', () => {
    const start = rules.indexOf('function touchesServerAuthoritativeFields');
    const helper = rules.slice(start, rules.indexOf(']);', start));
    expect(helper).toContain("'followerCount'");
    expect(helper).toContain("'followingCount'");
    // Client contract parity (profilePiiBoundary.test.js enforces exact equality).
    expect(contracts).toMatch(/SERVER_AUTHORITATIVE_FIELDS[\s\S]*?'followerCount'/);
    expect(contracts).toMatch(/SERVER_AUTHORITATIVE_FIELDS[\s\S]*?'followingCount'/);
  });

  test('the users create rule pins the counts to 0 (no minted standing at signup)', () => {
    expect(rules).toContain("request.resource.data.get('followerCount', null) == 0");
    expect(rules).toContain("request.resource.data.get('followingCount', null) == 0");
  });
});
