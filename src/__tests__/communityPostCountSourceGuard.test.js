/**
 * Community `stats.postCount` / `stats.activityScore` must have a real
 * decrement writer (N451).
 *
 * Both fields are seeded in `functions/communities.js#createCommunity` and were
 * incremented by `createCommunityPost`, but NOTHING ever decremented them — a
 * deleted, unpublished or moved community post left the counters pointing at
 * content that no longer exists, so both drifted upward forever. The community
 * document is server-write-only, so the derived counters must be maintained by
 * a server trigger: `functions/communityPostCounters.js#onCommunityPostWrite`.
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const countersSrc = read('functions/communityPostCounters.js');
const indexSrc = read('functions/index.js');
const communitiesSrc = read('functions/communities.js');
const screenSrc = read('src/screens/Community/CommunityDetailScreen.jsx');
const serviceSrc = read('src/services/communityService.js');

describe('community postCount has a real writer (N451)', () => {
  test('index.js merges the communityPostCounters module', () => {
    expect(indexSrc).toMatch(/merge\(require\('\.\/communityPostCounters\.js'\)\)/);
  });

  test('the seed and the trigger agree on the field name', () => {
    // The seed creates the fields the trigger moves.
    expect(communitiesSrc).toMatch(/postCount: 0/);
    expect(communitiesSrc).toMatch(/activityScore: 100/);
    expect(countersSrc).toMatch(/'stats\.postCount'/);
    expect(countersSrc).toMatch(/'stats\.activityScore'/);
  });

  test('the create callable no longer writes the counters (single writer)', () => {
    // If the callable kept its inline increment, a create would be counted
    // twice: once here and once by the trigger.
    const start = communitiesSrc.indexOf('exports.createCommunityPost');
    const body = communitiesSrc.slice(start, start + 3000);
    expect(body).not.toMatch(/'stats\.postCount'/);
    expect(body).not.toMatch(/'stats\.activityScore'/);
  });

  test('it is a firestore document trigger on posts/{postId}, not a callable', () => {
    expect(countersSrc).toMatch(/exports\.onCommunityPostWrite = functions\.firestore/);
    expect(countersSrc).toMatch(/\.document\('posts\/\{postId\}'\)/);
    expect(countersSrc).toMatch(/\.onWrite\(/);
    // A document trigger has no `onCall`.
    expect(countersSrc).not.toMatch(/onCall\(/);
  });

  test('it applies a net delta so it never double-counts or drifts', () => {
    // before → -1, after → +1, so a like/comment/view update cancels to zero.
    expect(countersSrc).toMatch(/if \(countsAsCommunityPost\(before\)\) bump\(communityIdOf\(before\), -1\)/);
    expect(countersSrc).toMatch(/if \(countsAsCommunityPost\(after\)\) bump\(communityIdOf\(after\), \+1\)/);
    expect(countersSrc).toMatch(/FieldValue\.increment\(delta\)/);
    // Only a live, published community post counts — a draft, a pending-approval
    // post or a deleted one does not.
    expect(countersSrc).toMatch(/post\.visibility === 'community'/);
    expect(countersSrc).toMatch(/post\.status === 'published'/);
    expect(countersSrc).toMatch(/post\.isDeleted === false/);
  });

  test('a non-member cannot inflate a foreign community counter (forgery guard)', () => {
    expect(countersSrc).toMatch(/snap\.data\(\)\.members \|\| \{\}/);
    expect(countersSrc).toMatch(/if \(authorId && !\(\(snap\.data\(\)\.members \|\| \{\}\)\[authorId\]\)\) return;/);
  });

  test('a reconcile job heals pre-trigger drift with a bounded count()', () => {
    expect(countersSrc).toMatch(/exports\.reconcileCommunityPostCounts = functions\.pubsub/);
    expect(countersSrc).toMatch(/\.count\(\)/);
    expect(countersSrc).toMatch(/\.limit\(RECONCILE_BATCH\)/);
  });

  test('the counter is actually consumed by the UI (not a dead field)', () => {
    expect(serviceSrc).toMatch(/postCount: unknownNumber\(community\.stats\?\.postCount\)/);
    expect(screenSrc).toMatch(/\['Posts', community\.stats\?\.postCount\]/);
  });
});
