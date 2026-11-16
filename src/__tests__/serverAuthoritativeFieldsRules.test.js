/**
 * @jest-environment node
 *
 * Server-authoritative economy fields must be refused on a client write to the
 * world-signed-in-readable `users/{uid}` document.
 *
 * `lockedCoins` is the server's withdrawal hold: `getAvailableBalance =
 * coins - lockedCoins` (functions/monetization.js). It is written only by
 * `requestWithdrawal` (locked) and `withdrawalSettlement` (released). It was
 * absent from both `SERVER_AUTHORITATIVE_FIELDS` and the `users/{uid}` rule's
 * `touchesServerAuthoritativeFields()` denylist, so an owner could `updateDoc`
 * their own `lockedCoins` to 0 — raising their spendable balance and letting a
 * second withdrawal be filed against coins already held (two payouts from one
 * balance).
 *
 * The static checks always run; the adversarial checks run against the Firestore
 * emulator when one is reachable (the `guards` CI job provides one).
 */

import fs from 'node:fs';
import path from 'node:path';
import { SERVER_AUTHORITATIVE_FIELDS } from '../config/profileContracts.js';

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

const rulesSrc = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');

// Economy fields a client must never be able to move on its own user doc.
const MUST_BE_SERVER_ONLY = ['coins', 'coinBalance', 'lockedCoins', 'earnings', 'totalEarned'];

describe('server-authoritative economy fields are not client-writable', () => {
  beforeAll(async () => {
    rules = rulesSrc;
    if (await emulatorReachable()) {
      fsMod = await import('firebase/firestore');
    }
  });

  test('the contract lists every economy field as server-authoritative', () => {
    for (const field of MUST_BE_SERVER_ONLY) {
      expect(SERVER_AUTHORITATIVE_FIELDS).toContain(field);
    }
  });

  test('the users/{uid} update rule denies the economy fields (static)', () => {
    const start = rules.indexOf('function touchesServerAuthoritativeFields');
    const helper = rules.slice(start, rules.indexOf(']);', start));
    for (const field of MUST_BE_SERVER_ONLY) {
      expect(helper).toContain(`'${field}'`);
    }
  });

  test('the users/{uid} create rule denies the economy fields (static)', () => {
    const start = rules.indexOf('match /users/{userId}');
    const block = rules.slice(start, rules.indexOf('match /users_private', start));
    expect(block).toContain("'lockedCoins'");
  });

  test('an owner cannot raise their spendable balance by writing lockedCoins (emulator)', async () => {
    if (!fsMod) return;
    const env = await makeEnv('arvdoul-server-authoritative-fields');
    try {
      await env.clearFirestore();
      await env.withSecurityRulesDisabled(async (ctx) => {
        await fsMod.setDoc(fsMod.doc(ctx.firestore(), 'users/self'), {
          displayName: 'S', isPrivate: false, coins: 5000, lockedCoins: 5000,
        });
      });
      const self = env.authenticatedContext('self').firestore();
      await expect(
        fsMod.updateDoc(fsMod.doc(self, 'users/self'), { lockedCoins: 0 }),
      ).rejects.toBeDefined();
      await expect(
        fsMod.updateDoc(fsMod.doc(self, 'users/self'), { coins: 1000000 }),
      ).rejects.toBeDefined();
      // A plain profile edit still succeeds.
      await expect(
        fsMod.updateDoc(fsMod.doc(self, 'users/self'), { displayName: 'S2' }),
      ).resolves.toBeUndefined();
    } finally {
      await env.cleanup();
    }
  });
});
