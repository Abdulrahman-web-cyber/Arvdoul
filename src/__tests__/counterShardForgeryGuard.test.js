/**
 * @jest-environment node
 *
 * N207 — `counter_shards/{shardId}` counter integrity.
 *
 * Originally the collection accepted an absolute `{ value: <n> }` from any
 * signed-in client, so a client could mint a count (likes, saves, follows,
 * views …) in one write. The earlier deferral claimed a rule "cannot tell a
 * legitimate `increment(±1)` from an absolute write" — that is false: the
 * Firestore emulator proves `request.resource.data.value` is the *resulting*
 * value and `resource.data.value` the pre-write value, so the rule bounds the
 * RELATIVE increment. A one-shot absolute mint is now denied.
 *
 * What remains (documented, not fully closed): the shard id is still unbound to
 * the writer, so a signed-in client can grind repeated ±1 writes with no
 * per-user rate limit on this collection. The full fix — move every counter
 * mutation server-side and set `allow write: if false` — is still tracked.
 *
 * The static checks always run; the adversarial checks run against the
 * Firestore emulator when one is reachable (the `guards` CI job provides one).
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

describe('counter_shards keeps its documented (N207) shape', () => {
  const rules = readFile('firestore.rules');

  test('the block still documents the residual forgery risk (N207)', () => {
    const start = rules.indexOf('match /counter_shards/{shardId}');
    expect(start).toBeGreaterThan(-1);
    const block = rules.slice(start, start + 2400);
    expect(block).toMatch(/N207/);
  });

  test('read is signed-in, not world-readable', () => {
    const start = rules.indexOf('match /counter_shards/{shardId}');
    const block = rules.slice(start, start + 2400);
    expect(block).not.toMatch(/allow read: if true;/);
    expect(block).toMatch(/allow read: if isSignedIn\(\);/);
  });

  test('create/update pin the single numeric `value` field and bound the delta', () => {
    const start = rules.indexOf('match /counter_shards/{shardId}');
    const block = rules.slice(start, start + 2400);
    expect(block).toMatch(/allow create: if isSignedIn\(\)[\s\S]*value is number/);
    expect(block).toMatch(/hasOnly\(\['value'\]\)/);
    // The relative-increment bound is the forgery defence — it must stay.
    expect(block).toMatch(/request\.resource\.data\.value - resource\.data\.value <= 100/);
    expect(block).toMatch(/request\.resource\.data\.value - resource\.data\.value >= -100/);
  });
});

describe('counter_shards forgery surface (emulator)', () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await emulatorReachable();
    if (!reachable) {
      console.warn(`[counterShardForgeryGuard] emulator not reachable at ${emulatorHost}; skipping adversarial checks`);
    }
  });

  async function makeEnv(projectId) {
    const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
    return initializeTestEnvironment({
      projectId,
      firestore: { rules: readFile('firestore.rules'), host: emulatorHost.split(':')[0], port: Number(emulatorHost.split(':')[1]) },
    });
  }

  test('a full-document overwrite and a non-numeric value are rejected', async () => {
    if (!reachable) return;
    const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
    const { doc, setDoc, updateDoc } = await import('firebase/firestore');
    const env = await makeEnv('arvdoul-counter-shard-shape');
    try {
      await env.clearFirestore();
      const alice = env.authenticatedContext('alice').firestore();
      const anon = env.unauthenticatedContext().firestore();

      // A single small numeric `value` is the accepted shape.
      await assertSucceeds(setDoc(doc(alice, 'counter_shards/s1'), { value: 1 }));
      await assertSucceeds(updateDoc(doc(alice, 'counter_shards/s1'), { value: 2 }));

      // An extra field is a full-document write, not a counter increment.
      await assertFails(setDoc(doc(alice, 'counter_shards/s2'), { value: 1, extra: true }));
      // A non-numeric value is rejected.
      await assertFails(setDoc(doc(alice, 'counter_shards/s3'), { value: 'lots' }));
      // Unauthenticated writers are denied.
      await assertFails(setDoc(doc(anon, 'counter_shards/s4'), { value: 1 }));
    } finally {
      await env.cleanup();
    }
  });

  test('CLOSED GAP: a signed-in client can no longer mint an absolute value (N207)', async () => {
    if (!reachable) return;
    const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc, updateDoc } = await import('firebase/firestore');
    const env = await makeEnv('arvdoul-counter-shard-forge');
    try {
      await env.clearFirestore();
      const mallory = env.authenticatedContext('mallory').firestore();

      // A one-shot absolute mint (create) is DENIED.
      await assertFails(setDoc(doc(mallory, 'counter_shards/forged'), { value: 999999 }));

      // Seed a legitimate counter, then try to jump it absolutely (update) —
      // also DENIED, because the delta is bounded.
      await assertSucceeds(setDoc(doc(mallory, 'counter_shards/real'), { value: 3 }));
      await assertFails(updateDoc(doc(mallory, 'counter_shards/real'), { value: 999999 }));

      // A legitimate ±1 increment still succeeds.
      await assertSucceeds(updateDoc(doc(mallory, 'counter_shards/real'), { value: 4 }));
      const snap = await getDoc(doc(mallory, 'counter_shards/real'));
      expect(snap.data().value).toBe(4);
    } finally {
      await env.cleanup();
    }
  });
});
