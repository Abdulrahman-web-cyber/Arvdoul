/**
 * @jest-environment node
 *
 * `videos/{videoId}` was `allow read: if true`, so any client — signed in or
 * not — could point-read a PRIVATE or `followers` video's metadata, an
 * UNLISTED one, a still-processing (`uploading`/`processing`) one, or a
 * soft-deleted one, simply by knowing its id. `videoService.getVideo` enforces
 * exactly that shape in the browser, but a client check is not authorization.
 *
 * The read is now split into `get` (the per-document decision) and `list` (the
 * query must prove a public-or-own shape, because rules are not filters). The
 * `stats` / `like_shards` subcollections were also `allow read: if true`, which
 * leaked a private video's engagement through the subcollection path; they are
 * now creator-scoped.
 *
 * The static checks always run; the adversarial checks run against the
 * Firestore emulator when one is reachable.
 */

import fs from 'node:fs';
import path from 'node:path';

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

async function emulatorReachable() {
  if (!emulatorHost) return false;
  try {
    const res = await fetch(`http://${emulatorHost}/`);
    return res.ok || res.status === 200;
  } catch {
    return false;
  }
}

let fsMod;
let rules;

async function makeEnv(projectId) {
  const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
  return initializeTestEnvironment({
    projectId,
    firestore: { rules, host: emulatorHost.split(':')[0], port: Number(emulatorHost.split(':')[1]) },
  });
}

const readFile = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

/** Remove `//` line comments so a prose mention of a rule can't satisfy a check. */
function stripLineComments(src) {
  return src.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
}

function videosBlock(rulesSrc) {
  const start = rulesSrc.indexOf('match /videos/{videoId}');
  return rulesSrc.slice(start, rulesSrc.indexOf('// ==================== COPYRIGHT', start));
}

describe('videos read authorization (N301)', () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await emulatorReachable();
    if (!reachable) {
      console.warn(`[videoReadPrivacyRules] emulator not reachable at ${emulatorHost}; skipping adversarial checks`);
      return;
    }
    rules = readFile('firestore.rules');
    fsMod = await import('firebase/firestore');
  });

  test('the videos block is no longer world-readable', () => {
    const block = stripLineComments(videosBlock(readFile('firestore.rules')));
    expect(block).not.toMatch(/allow read:\s*if true/);
    expect(block).toContain('allow get: if videoReadableByViewer()');
    expect(block).toContain('allow list: if videoListableByViewer()');
  });

  test('the get rule fails closed on visibility/status/deletion', () => {
    const rulesSrc = readFile('firestore.rules');
    const start = rulesSrc.indexOf('function videoReadableByViewer()');
    const body = rulesSrc.slice(start, rulesSrc.indexOf('function videoListableByViewer()', start));
    expect(body).toMatch(/resource\.data\.isDeleted == false/);
    expect(body).toMatch(/resource\.data\.status == 'ready'/);
    expect(body).toMatch(/resource\.data\.visibility == 'public'/);
    expect(body).toMatch(/resource\.data\.visibility == 'followers'/);
    expect(body).toMatch(/followEdgeExists\(uid\(\), resource\.data\.userId\)/);
    // The owner branch must not be gated on status/visibility.
    expect(body).toMatch(/isSignedIn\(\) && \(resource\.data\.userId == uid\(\)/);
  });

  test('the list rule requires the query to prove public-or-own', () => {
    const rulesSrc = readFile('firestore.rules');
    const start = rulesSrc.indexOf('function videoListableByViewer()');
    const body = rulesSrc.slice(start, rulesSrc.indexOf('// Fields that must never appear', start));
    expect(body).toMatch(/resource\.data\.isDeleted == false/);
    expect(body).toMatch(/resource\.data\.status == 'ready'/);
    expect(body).toMatch(/resource\.data\.visibility == 'public'/);
    expect(body).toMatch(/resource\.data\.userId == uid\(\)/);
  });

  test('the video stats / like_shards subcollections are creator-scoped, not public', () => {
    const block = videosBlock(readFile('firestore.rules'));
    expect(block).not.toMatch(/match \/stats\/\{statId\}\s*\{\s*allow read: if true/);
    expect(block).not.toMatch(/match \/like_shards\/\{shardId\}\s*\{\s*allow read: if true/);
    expect(block).toContain('parentVideo().userId == uid()');
  });

  test('a stranger cannot read a private/processing/deleted video; the owner can (emulator)', async () => {
    if (!reachable) return;
    const env = await makeEnv('arvdoul-video-read-privacy');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        const base = { type: 'video', stats: {}, isDeleted: false };
        await fsMod.setDoc(fsMod.doc(db, 'videos/public1'), { ...base, userId: 'alice', visibility: 'public', status: 'ready' });
        await fsMod.setDoc(fsMod.doc(db, 'videos/private1'), { ...base, userId: 'alice', visibility: 'private', status: 'ready' });
        await fsMod.setDoc(fsMod.doc(db, 'videos/processing1'), { ...base, userId: 'alice', visibility: 'public', status: 'processing' });
        await fsMod.setDoc(fsMod.doc(db, 'videos/deleted1'), { ...base, userId: 'alice', visibility: 'public', status: 'ready', isDeleted: true });
        await fsMod.setDoc(fsMod.doc(db, 'videos/followers1'), { ...base, userId: 'alice', visibility: 'followers', status: 'ready' });
        await fsMod.setDoc(fsMod.doc(db, 'follows/bob_alice'), { followerId: 'bob', followingId: 'alice' });
        await fsMod.setDoc(fsMod.doc(db, 'videos/private1/stats/s1'), { views: 5 });
      });
      const anon = env.unauthenticatedContext().firestore();
      const stranger = env.authenticatedContext('stranger').firestore();
      const bob = env.authenticatedContext('bob').firestore();
      const alice = env.authenticatedContext('alice').firestore();

      await expect(fsMod.getDoc(fsMod.doc(stranger, 'videos/public1'))).resolves.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(stranger, 'videos/private1'))).rejects.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(stranger, 'videos/processing1'))).rejects.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(stranger, 'videos/deleted1'))).rejects.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(stranger, 'videos/followers1'))).rejects.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(bob, 'videos/followers1'))).resolves.toBeDefined();
      // A PUBLIC video is world-readable, exactly like a public post/community —
      // an anonymous client may read it (the rule has no `isSignedIn()` gate on
      // the public branch). The fix here was to stop anonymous reads of a
      // PRIVATE/processing/deleted video by id, not to hide public content.
      await expect(fsMod.getDoc(fsMod.doc(anon, 'videos/public1'))).resolves.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(anon, 'videos/private1'))).rejects.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(alice, 'videos/private1'))).resolves.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(stranger, 'videos/private1/stats/s1'))).rejects.toBeDefined();
      await expect(fsMod.getDoc(fsMod.doc(alice, 'videos/private1/stats/s1'))).resolves.toBeDefined();
    } finally {
      await env.cleanup();
    }
  });
});
