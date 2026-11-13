/**
 * @jest-environment node
 *
 * N370 — story shard counters (`view_shards`, `reaction_shards`,
 * `analytics_shards` under `stories/{storyId}`) accepted an unbounded
 * client-written count.
 *
 * The rules bounded the KEY SET (`hasOnly([...])`) but not the VALUE, so any
 * signed-in client could `setDoc` a shard with `count: 999999` and the
 * sum-on-read (`_getShardedViewCount`) would report a forged view/reaction
 * count. The same class as N207: a rule CAN see the post-`increment()` value,
 * so the write is now pinned to a bounded relative change (create: the whole
 * initial value is bounded; update: the delta is bounded).
 *
 * Static checks always run; adversarial checks run against the Firestore
 * emulator when one is reachable (the `guards` CI job provides one).
 */

import fs from 'node:fs';
import path from 'node:path';

const readFile = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

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

describe('story shards are bounded counters (static)', () => {
  const rules = readFile('firestore.rules');

  test('view/reaction/analytics shards bound the value, not only the keys', () => {
    const start = rules.indexOf('match /stories/{storyId}');
    const block = rules.slice(start, rules.indexOf('match /archived_stories', start));
    expect(block).toContain('match /view_shards/{shardId}');
    expect(block).toContain('match /reaction_shards/{shardId}');
    expect(block).toContain('match /analytics_shards/{shardId}');
    // The bound helpers exist and are used by the shard rules.
    expect(block).toContain('fieldDeltaBounded');
    expect(block).toContain('fieldCreateBounded');
    expect(block).toMatch(/viewShardDelta\(\)/);
    expect(block).toMatch(/reactionShardDelta\(\)/);
    expect(block).toMatch(/analyticsShardDelta\(\)/);
    // The old unbounded shape (`count is number` with no range) is gone.
    expect(block).not.toMatch(/request\.resource\.data\.count is number;\s*\n\s*}/);
  });
});

describe('story shard forgery surface (emulator)', () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await emulatorReachable();
    if (!reachable) {
      console.warn(`[storyShardForgeryGuard] emulator not reachable at ${emulatorHost}; skipping adversarial checks`);
    }
  });

  async function makeEnv(projectId) {
    const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
    return initializeTestEnvironment({
      projectId,
      firestore: { rules: readFile('firestore.rules'), host: emulatorHost.split(':')[0], port: Number(emulatorHost.split(':')[1]) },
    });
  }

  test('a one-shot absolute view count is denied; a legitimate +1 is admitted', async () => {
    if (!reachable) return;
    const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc, increment } = await import('firebase/firestore');
    const env = await makeEnv('arvdoul-story-shard-forge');
    try {
      await env.clearFirestore();
      const mallory = env.authenticatedContext('mallory').firestore();

      // A bounded initial value is accepted.
      await assertSucceeds(setDoc(doc(mallory, 'stories/s1/view_shards/shard_0'), { count: 1, updatedAt: new Date() }));
      // An unbounded mint (create) is denied.
      await assertFails(setDoc(doc(mallory, 'stories/s1/view_shards/shard_big'), { count: 999999, updatedAt: new Date() }));
      // A legitimate +1 increment succeeds...
      await assertSucceeds(updateDoc(doc(mallory, 'stories/s1/view_shards/shard_0'), { count: increment(1), updatedAt: new Date() }));
      // ...but an absolute jump is denied.
      await assertFails(updateDoc(doc(mallory, 'stories/s1/view_shards/shard_0'), { count: 999999, updatedAt: new Date() }));
    } finally {
      await env.cleanup();
    }
  });

  test('reaction and analytics shards reject an unbounded mint', async () => {
    if (!reachable) return;
    const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc, increment } = await import('firebase/firestore');
    const env = await makeEnv('arvdoul-story-shard-forge2');
    try {
      await env.clearFirestore();
      const mallory = env.authenticatedContext('mallory').firestore();

      await assertSucceeds(setDoc(doc(mallory, 'stories/s2/reaction_shards/shard_0'), { '❤️': 1, updatedAt: new Date() }));
      await assertFails(setDoc(doc(mallory, 'stories/s2/reaction_shards/shard_big'), { '❤️': 999999, updatedAt: new Date() }));
      await assertSucceeds(updateDoc(doc(mallory, 'stories/s2/reaction_shards/shard_0'), { '❤️': increment(1), updatedAt: new Date() }));
      await assertFails(updateDoc(doc(mallory, 'stories/s2/reaction_shards/shard_0'), { '❤️': 999999, updatedAt: new Date() }));

      await assertSucceeds(setDoc(doc(mallory, 'stories/s3/analytics_shards/shard_0'), { forwardTaps: 1, updatedAt: new Date() }));
      await assertFails(setDoc(doc(mallory, 'stories/s3/analytics_shards/shard_big'), { forwardTaps: 999999, updatedAt: new Date() }));
      await assertFails(updateDoc(doc(mallory, 'stories/s3/analytics_shards/shard_0'), { forwardTaps: 999999, updatedAt: new Date() }));

      // An unauthenticated writer is denied entirely.
      const anon = env.unauthenticatedContext().firestore();
      await assertFails(setDoc(doc(anon, 'stories/s4/view_shards/shard_0'), { count: 1, updatedAt: new Date() }));
    } finally {
      await env.cleanup();
    }
  });
});
