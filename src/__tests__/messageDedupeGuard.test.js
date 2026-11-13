/**
 * @jest-environment node
 *
 * N369 — `message_dedupe` was `allow read, write: if isSignedIn()`.
 *
 * The dedupe key is `sha256(senderId:conversationId:type:content:mediaHash)`.
 * Its pre-image is entirely public, so any signed-in client could compute a
 * victim's next key and pre-create the record, causing the victim's
 * `_checkDuplicate` to see a hit and throw "Duplicate message" — a targeted
 * send-suppression. The same open read let a client `list` the whole collection
 * and enumerate every recent send key.
 *
 * The rule now binds each record to its sender: `create`/`update` must stamp
 * `senderId == uid()`, and `read` is owner-scoped (a missing doc stays readable
 * so the ordinary "no duplicate yet" check is unaffected). The client stamps
 * `senderId` on write and treats a denied read as "no duplicate".
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

describe('message_dedupe is bound to its sender (static)', () => {
  const rules = readFile('firestore.rules');
  const start = rules.indexOf('match /message_dedupe/{key}');
  const block = rules.slice(start, start + 1600);

  test('the open read, write rule is gone', () => {
    expect(start).toBeGreaterThan(-1);
    expect(block).not.toMatch(/allow read, write: if isSignedIn\(\);/);
  });

  test('create/update must stamp the caller as senderId', () => {
    expect(block).toMatch(/allow create, update: if isSignedIn\(\) && request\.resource\.data\.senderId == uid\(\)/);
  });

  test('read is owner-scoped (with a missing-doc allowance)', () => {
    expect(block).toMatch(/allow read: if isSignedIn\(\) && \(resource == null \|\| resource\.data\.senderId == uid\(\)\)/);
  });

  test('the client stamps senderId and tolerates a denied read', () => {
    const svc = readFile('src/services/messagesService.js');
    expect(svc).toMatch(/senderId: currentUser\.uid/);
    expect(svc).toMatch(/permission-denied.*return false|return false/);
  });
});

describe('message_dedupe forgery surface (emulator)', () => {
  let reachable = false;

  beforeAll(async () => {
    reachable = await emulatorReachable();
    if (!reachable) {
      console.warn(`[messageDedupeGuard] emulator not reachable at ${emulatorHost}; skipping adversarial checks`);
    }
  });

  async function makeEnv(projectId) {
    const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
    return initializeTestEnvironment({
      projectId,
      firestore: { rules: readFile('firestore.rules'), host: emulatorHost.split(':')[0], port: Number(emulatorHost.split(':')[1]) },
    });
  }

  test('a client can read/create its own record but not mint another sender\'s', async () => {
    if (!reachable) return;
    const { assertFails, assertSucceeds } = await import('@firebase/rules-unit-testing');
    const { doc, setDoc, getDoc } = await import('firebase/firestore');
    const env = await makeEnv('arvdoul-dedupe-guard');
    try {
      await env.clearFirestore();
      const alice = env.authenticatedContext('alice').firestore();
      const mallory = env.authenticatedContext('mallory').firestore();

      // Alice's own record round-trips.
      await assertSucceeds(setDoc(doc(alice, 'message_dedupe/key_alice'), { senderId: 'alice', expiresAt: new Date() }));
      await assertSucceeds(getDoc(doc(alice, 'message_dedupe/key_alice')));

      // A missing doc is readable (the ordinary "no duplicate yet" check).
      await assertSucceeds(getDoc(doc(mallory, 'message_dedupe/key_absent')));

      // Mallory cannot mint a record naming Alice (send-suppression).
      await assertFails(setDoc(doc(mallory, 'message_dedupe/key_victim'), { senderId: 'alice', expiresAt: new Date() }));

      // Mallory cannot read Alice's record.
      await assertFails(getDoc(doc(mallory, 'message_dedupe/key_alice')));

      // An unauthenticated client is denied entirely.
      const anon = env.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(anon, 'message_dedupe/key_absent')));
      await assertFails(setDoc(doc(anon, 'message_dedupe/key_anon'), { senderId: 'anon', expiresAt: new Date() }));
    } finally {
      await env.cleanup();
    }
  });
});
