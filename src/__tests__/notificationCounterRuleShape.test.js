/**
 * src/__tests__/notificationCounterRuleShape.test.js
 *
 * Bug class: a counter collection whose Firestore rule keys on the *wrong*
 * document-id shape. `notification_counters` stores one document per shard with
 * id `{userId}_shard_{n}` (see `notificationsService._getTotalUnreadCount`), but
 * the rule authorised with `isOwner(userId)` — i.e. `uid() == "<uid>_shard_3"`,
 * which is never true. Every client read of the unread counter was denied and
 * swallowed, so the Alerts badge and the notification stats silently read zero.
 *
 * `firestoreRulesCoverage` only checks that *a* match block exists; it cannot
 * see that the id shape the rule proves is unreachable. This guard pins the
 * contract statically (always) and, when a Firestore emulator is reachable,
 * proves it adversarially (owner reads allowed, foreign reads denied).
 *
 * @jest-environment node
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const service = fs.readFileSync(path.join(root, 'src/services/notificationsService.js'), 'utf8');

function notificationCounterBlock() {
  const start = rules.indexOf('match /notification_counters/');
  expect(start).toBeGreaterThan(-1);
  return rules.slice(start, rules.indexOf('match /', start + 10));
}

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;

async function emulatorReachable() {
  if (!emulatorHost) return false;
  try {
    const res = await fetch(`http://${emulatorHost}/`);
    return res.ok;
  } catch {
    return false;
  }
}

describe('notification_counters rule matches the real shard-id shape', () => {
  test('the client builds ids as `${userId}_shard_${i}`', () => {
    expect(service).toMatch(/`\$\{userId\}_shard_\$\{i\}`/);
  });

  test('the rule authorises the shard-id prefix, not the bare userId', () => {
    const block = notificationCounterBlock();
    // The reachable shape: uid() must be the prefix of the shard id.
    expect(block).toMatch(/counterId\.matches\(uid\(\) \+ '_shard_\[0-9\]\+'\)/);
    // The old, unreachable shape must not come back.
    expect(block).not.toMatch(/isOwner\(userId\)/);
  });

  test('clients cannot write the counters (server-owned)', () => {
    expect(notificationCounterBlock()).toMatch(/allow write: if false/);
  });
});

describe('notification_counters read is allowed for the owner (emulator)', () => {
  let reachable = false;
  let fsMod;

  beforeAll(async () => {
    reachable = await emulatorReachable();
    if (reachable) fsMod = await import('firebase/firestore');
  });

  test('owner reads own shard, a stranger cannot', async () => {
    if (!reachable) return;
    const { initializeTestEnvironment } = await import('@firebase/rules-unit-testing');
    const env = await initializeTestEnvironment({
      projectId: 'arvdoul-notif-counter-test',
      firestore: {
        rules,
        host: emulatorHost.split(':')[0],
        port: Number(emulatorHost.split(':')[1]),
      },
    });
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        const db = ctx.firestore();
        await fsMod.setDoc(fsMod.doc(db, 'notification_counters', 'alice_shard_0'), { count: 3 });
      });
      const alice = env.authenticatedContext('alice').firestore();
      const own = await fsMod.getDoc(fsMod.doc(alice, 'notification_counters', 'alice_shard_0'));
      expect(own.data().count).toBe(3);

      const bob = env.authenticatedContext('bob').firestore();
      await expect(
        fsMod.getDoc(fsMod.doc(bob, 'notification_counters', 'alice_shard_0'))
      ).rejects.toMatchObject({ code: 'permission-denied' });
    } finally {
      await env.cleanup();
    }
  });
});
