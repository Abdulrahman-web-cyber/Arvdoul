/**
 * @jest-environment node
 *
 * Money-path behaviour: coin transfers are atomic, idempotent and
 * supply-neutral.
 *
 * `functions/video.js#transferCoinsInternal` is the single mover behind
 * pay-per-view unlocks and video tips. The historical bugs here were real
 * money bugs, so this suite pins the invariants against the Firestore
 * emulator:
 *
 *   - a transfer debits the sender and credits the recipient by exactly the
 *     same amount (double-entry, balances never drift);
 *   - `system/coin_supply.totalCoins` is unchanged by a transfer (a transfer
 *     moves value, it does not mint or burn);
 *   - a replay with the same `idempotencyKey` returns the recorded result and
 *     moves NOTHING a second time (retry-safe);
 *   - an under-funded sender is rejected and no balance changes.
 *
 * The behavioural assertions run when the emulator is reachable (the `guards`
 * CI job provides one). When it is not, the suite is a no-op rather than a
 * false failure.
 */

import fs from 'node:fs';
import path from 'node:path';

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;

async function emulatorReachable() {
  try {
    const res = await fetch(`http://${emulatorHost}/`, { signal: AbortSignal.timeout(1500) });
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const serverHeader = (res.headers.get('server') || '').toLowerCase();
    if (!res.ok || contentType.includes('text/html') || serverHeader.includes('nginx')) {
      return false;
    }
    const body = (await res.text()).trim();
    return body === 'Ok';
  } catch {
    return false;
  }
}

describe('coin transfer money-path (emulator)', () => {
  let reachable = false;
  let db;
  let transferCoinsInternal;

  const seedUser = async (uid, coins) => {
    // `transferCoinsInternal` checks the public `users/{uid}` doc exists and
    // reads the balance from `users_private/{uid}` (N324). Seed both.
    await db.collection('users').doc(uid).set({ uid, displayName: uid });
    await db.collection('users_private').doc(uid).set({ coins, lockedCoins: 0 });
  };

  const balance = async (uid) =>
    (await db.collection('users_private').doc(uid).get()).data()?.coins;

  const supply = async () =>
    ((await db.collection('system').doc('coin_supply').get()).data()?.totalCoins) || 0;

  beforeAll(async () => {
    reachable = await emulatorReachable();
    if (!reachable) {
      console.warn(`[videoMoneyPath] emulator not reachable at ${emulatorHost}; skipping behavioural checks`);
      return;
    }
    // `functions/video.js` resolves `firebase-admin` from `functions/node_modules`
    // (a different instance from the root copy). Initialise that same instance.
    const { createRequire } = await import('node:module');
    const requireFn = createRequire(import.meta.url);
    const admin = requireFn(path.resolve(process.cwd(), 'functions', 'node_modules', 'firebase-admin'));
    if (!admin.apps.length) admin.initializeApp({ projectId: 'arvdoul-money-test' });
    db = admin.firestore();
    const mod = await import('../../functions/video.js');
    transferCoinsInternal = mod.__test__?.transferCoinsInternal;
    expect(typeof transferCoinsInternal).toBe('function');
  });

  test('a transfer debits and credits by the same amount, leaving supply unchanged', async () => {
    if (!reachable) return;
    const from = `u_from_${Math.random().toString(36).slice(2)}`;
    const to = `u_to_${Math.random().toString(36).slice(2)}`;
    await seedUser(from, 10000);
    await seedUser(to, 250);
    const supplyBefore = await supply();

    const res = await transferCoinsInternal(from, to, 500, 'pay_per_view', {
      videoId: 'v1', idempotencyKey: `ppv_${from}_v1`,
    });

    expect(res.newFromBalance).toBe(9500);
    expect(res.newToBalance).toBe(750);
    expect(await balance(from)).toBe(9500);
    expect(await balance(to)).toBe(750);
    expect(await supply()).toBe(supplyBefore);
  });

  test('a replay with the same key moves nothing a second time', async () => {
    if (!reachable) return;
    const from = `u_from_${Math.random().toString(36).slice(2)}`;
    const to = `u_to_${Math.random().toString(36).slice(2)}`;
    await seedUser(from, 10000);
    await seedUser(to, 0);
    const key = `ppv_${from}_v2`;

    const first = await transferCoinsInternal(from, to, 300, 'pay_per_view', { videoId: 'v2', idempotencyKey: key });
    expect(await balance(from)).toBe(9700);

    const replay = await transferCoinsInternal(from, to, 300, 'pay_per_view', { videoId: 'v2', idempotencyKey: key });
    expect(replay).toEqual(first);
    // Balances are untouched by the replay.
    expect(await balance(from)).toBe(9700);
    expect(await balance(to)).toBe(300);
  });

  test('an under-funded sender is rejected and no balance changes', async () => {
    if (!reachable) return;
    const from = `u_from_${Math.random().toString(36).slice(2)}`;
    const to = `u_to_${Math.random().toString(36).slice(2)}`;
    await seedUser(from, 100);
    await seedUser(to, 0);

    await expect(
      transferCoinsInternal(from, to, 500, 'pay_per_view', { videoId: 'v3', idempotencyKey: `ppv_${from}_v3` })
    ).rejects.toThrow(/Insufficient/i);

    expect(await balance(from)).toBe(100);
    expect(await balance(to)).toBe(0);
  });
});
