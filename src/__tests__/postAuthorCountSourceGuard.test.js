/**
 * `users/{uid}.postCount` must have one authoritative source (N438).
 *
 * `users/{uid}` is seeded `postCount: 0` at signup. The ONLY writer was a
 * best-effort CLIENT increment inside `firestoreService.repostPost`, so:
 *   * a normal post never moved the count (only a *repost* bumped it), and
 *   * the field was absent from the server-authoritative denylist, so any owner
 *     could `updateDoc` it to an arbitrary number (minted standing).
 * It is read by `ProfileMetricsGrid` ("Posts" metric), `QuickAccessPanel`,
 * `AuthContext` and `socialGraphService.hydrateProfiles`, so the wrong value was
 * user-visible.
 *
 * The fix: the count is server-authoritative (rules + `SERVER_AUTHORITATIVE_FIELDS`)
 * and maintained by `functions/userCounters.js` — an `onPostWrite` document
 * trigger applies a net delta per author, and the cursor-paged
 * `reconcileUserPostCounts` job corrects legacy drift with a bounded `count()`.
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
const rules = read('firestore.rules');
const contracts = read('src/config/profileContracts.js');
const clientFirestore = read('src/services/firestoreService.js');
const metricsGrid = read('src/components/profile/ProfileMetricsGrid.jsx');

describe('users/{uid}.postCount has a real, single writer (N438)', () => {
  test('the counter module is merged into index.js', () => {
    expect(indexSrc).toMatch(/merge\(require\('\.\/userCounters\.js'\)\)/);
  });

  test('it is a firestore document trigger on posts/{postId}, not a callable', () => {
    expect(countersSrc).toMatch(/exports\.onPostWrite = functions\.firestore/);
    expect(countersSrc).toMatch(/\.document\('posts\/\{postId\}'\)/);
    expect(countersSrc).toMatch(/\.onWrite\(/);
  });

  test('it applies a net delta so it never double-counts or drifts', () => {
    expect(countersSrc).toMatch(/if \(countsAsPost\(before\)\) bump\(before\.authorId, -1\)/);
    expect(countersSrc).toMatch(/if \(countsAsPost\(after\)\) bump\(after\.authorId, \+1\)/);
    expect(countersSrc).toMatch(/postCount: FieldValue\.increment\(delta\)/);
    // A write that leaves the post's liveness unchanged (a like/comment/view
    // update, or the scheduled engagement mirror) must not read or write a user.
    expect(countersSrc).toMatch(/filter\(\(\[, delta\]\) => delta !== 0\)/);
  });

  test('it only touches users that still exist (no resurrected counters)', () => {
    expect(countersSrc).toMatch(/db\.getAll\(/);
    expect(countersSrc).toMatch(/if \(!snap\.exists\) return;/);
  });

  test('the reconcile job corrects legacy drift with a bounded count()', () => {
    expect(countersSrc).toMatch(/exports\.reconcileUserPostCounts = functions\.pubsub/);
    expect(countersSrc).toMatch(/\.where\('authorId', '==', docSnap\.id\)/);
    expect(countersSrc).toMatch(/\.where\('isDeleted', '==', false\)/);
    expect(countersSrc).toMatch(/\.count\(\)\s*\.get\(\)/);
    expect(countersSrc).toMatch(/\.limit\(POST_COUNT_RECONCILE_BATCH\)/);
  });

  test('postCount is server-authoritative in the rules and the contract', () => {
    const start = rules.indexOf('function touchesServerAuthoritativeFields');
    const helper = rules.slice(start, rules.indexOf(']);', start));
    expect(helper).toContain("'postCount'");
    // Client contract parity (profilePiiBoundary.test.js enforces exact equality).
    expect(contracts).toMatch(/SERVER_AUTHORITATIVE_FIELDS[\s\S]*?'postCount'/);
  });

  test('the users create rule still pins postCount to 0 (no minted standing at signup)', () => {
    expect(rules).toContain("request.resource.data.get('postCount', null) == 0");
  });

  test('the client no longer writes postCount', () => {
    // The removed writer was the drift source (it only ever fired on repost).
    expect(clientFirestore).not.toMatch(/postCount:\s*increment\(/);
    expect(clientFirestore).not.toMatch(/updateUserPostCount/);
  });

  test('the counter is actually consumed by the UI (not a dead field)', () => {
    expect(metricsGrid).toMatch(/profile\?\.postCount/);
  });
});
