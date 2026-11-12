/**
 * @jest-environment node
 *
 * N207 — `counter_shards/{shardId}` accepts an absolute `{ value: <n> }` from
 * any signed-in client, so a client can forge a count (likes, saves, follows,
 * views …). A rule cannot distinguish a legitimate `increment(±1)` from an
 * absolute write, and the shard id is unbound to the writer, so this is NOT
 * closable by a rule alone: it needs every counter mutation moved server-side
 * (the Admin SDK bypasses rules) before `allow write: if false` can land. That
 * is a ~40-call-site, multi-service refactor, so it stays deferred.
 *
 * What this guard pins is the *current, documented* behaviour so it cannot
 * silently regress to something weaker:
 *  - the read is signed-in (a world-readable counter is an enumeration aid);
 *  - the shape checks stay in place (full-document overwrite + non-number
 *    values rejected);
 *  - the residual risk stays documented inline, so the rule is not mistaken
 *    for a forgery defence.
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
    const block = rules.slice(start, start + 1200);
    expect(block).toMatch(/N207/);
    expect(block).toMatch(/RESIDUAL RISK/);
  });

  test('read is signed-in, not world-readable', () => {
    const start = rules.indexOf('match /counter_shards/{shardId}');
    const block = rules.slice(start, start + 1200);
    expect(block).not.toMatch(/allow read: if true;/);
    expect(block).toMatch(/allow read: if isSignedIn\(\);/);
  });

  test('create/update still pin the single numeric `value` field', () => {
    const start = rules.indexOf('match /counter_shards/{shardId}');
    const block = rules.slice(start, start + 1200);
    expect(block).toMatch(/allow create: if isSignedIn\(\)[\s\S]*value is number/);
    expect(block).toMatch(/allow update: if isSignedIn\(\)[\s\S]*hasOnly\(\['value'\]\)[\s\S]*value is number/);
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

      // A single numeric `value` is the accepted shape.
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

  test('DOCUMENTED GAP: a signed-in client can still write an absolute value (N207)', async () => {
    if (!reachable) return;
    const { assertSucceeds } = await import('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = await import('firebase/firestore');
    const env = await makeEnv('arvdoul-counter-shard-forge');
    try {
      await env.clearFirestore();
      const mallory = env.authenticatedContext('mallory').firestore();

      // This SUCCEEDS today — that is the whole point of N207. The assertion is
      // written as `assertSucceeds` on purpose so that when the server-side
      // migration lands (and this becomes `assertFails`), the change is forced
      // through this test and the ledger rather than happening silently.
      await assertSucceeds(setDoc(doc(mallory, 'counter_shards/forged'), { value: 999999 }));
      const snap = await getDoc(doc(mallory, 'counter_shards/forged'));
      expect(snap.data().value).toBe(999999);
    } finally {
      await env.cleanup();
    }
  });
});
