/**
 * @jest-environment node
 *
 * Withdrawal settlement is provider-aware (N326).
 *
 * Before this guard `settleWithdrawal` unconditionally called
 * `stripe.payouts.create(...)` and read the destination from
 * `withdrawalData.paymentDetails.stripeAccountId`. Two real-money defects
 * followed:
 *
 *   1. A `paypal` withdrawal (which the UI offered, with no PayPal payout
 *      integration) settled as a Stripe payout with `stripeAccount: undefined`
 *      — i.e. paid OUT OF THE PLATFORM ACCOUNT to an account that was not the
 *      creator's. The stored PayPal email was never used.
 *   2. The destination account came from a CLIENT-SUPPLIED field, so a caller
 *      could name any connected account.
 *
 * The fix resolves the provider server-side: PayPal (and any non-Stripe
 * method) is rejected and the creator's locked coins are released; a Stripe
 * method requires a `ready` connected account, and the account id comes from
 * `payout_settings`, never from the request.
 *
 * The static assertions always run. The behavioural assertions run against the
 * Firestore emulator when one is reachable (the `guards` CI job provides one).
 */

import fs from 'node:fs';
import path from 'node:path';

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIRESTORE_EMULATOR_HOST = emulatorHost;

const readFile = (rel) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');

async function emulatorReachable() {
  try {
    const res = await fetch(`http://${emulatorHost}/`);
    return res.ok || res.status === 200;
  } catch {
    return false;
  }
}

describe('withdrawal settlement is provider-aware (static)', () => {
  const settlement = readFile('functions/withdrawalSettlement.js');

  test('the payout destination is resolved server-side, not from the request', () => {
    expect(settlement).toContain('resolvePayoutProvider');
    expect(settlement).toContain("collection('payout_settings')");
    expect(settlement).toContain('stripeAccount: provider.accountId');
    // The client-supplied account id must never reach Stripe again.
    expect(settlement).not.toContain('paymentDetails?.stripeAccountId');
  });

  test('PayPal and unknown methods are terminal and release the lock', () => {
    expect(settlement).toContain("method === 'paypal'");
    expect(settlement).toContain('rejectAndRelease');
    expect(settlement).toMatch(/terminal: true/);
  });

  test('requestWithdrawal validates the method before locking coins', () => {
    const monetization = readFile('functions/monetization.js');
    const body = monetization.slice(monetization.indexOf('exports.requestWithdrawal'));
    expect(body).toContain('STRIPE_PAYOUT_METHODS.has(paymentMethod)');
    expect(body).toContain('Unsupported payout method');
  });
});

describe('withdrawal settlement behaviour (emulator)', () => {
  let reachable = false;
  let admin;
  let db;
  let settleWithdrawal;
  let stripeCalls = [];
  let ledgerCalls = [];

  const stripeStub = {
    payouts: {
      create: async (params, opts) => {
        stripeCalls.push({ params, opts });
        return { id: `po_test_${stripeCalls.length}`, status: 'paid' };
      },
    },
  };
  const createLedgerEntry = (tx, debit, credit, amount, meta) => {
    ledgerCalls.push({ debit, credit, amount, meta });
  };
  const deps = () => ({ stripe: stripeStub, createLedgerEntry, maxRetries: 3 });

  async function seedWithdrawal({
    method,
    status = 'pending',
    amount = 5000,
    details = {},
    userCoins = 10000,
    payoutSettings = null,
  }) {
    const uid = `u_${Math.random().toString(36).slice(2)}`;
    await db.collection('users_private').doc(uid).set({ coins: userCoins, lockedCoins: amount });
    const ref = db.collection('withdrawal_requests').doc();
    await ref.set({
      userId: uid,
      amount,
      paymentMethod: method,
      paymentDetails: details,
      status,
      createdAt: new Date(),
    });
    await db.collection('coin_transactions').doc().set({
      userId: uid, type: 'withdrawal_lock', amount, metadata: { withdrawalId: ref.id },
    });
    if (payoutSettings) {
      await db.collection('payout_settings').doc(uid).set(payoutSettings);
    }
    return { uid, wid: ref.id };
  }

  beforeAll(async () => {
    reachable = await emulatorReachable();
    if (!reachable) {
      console.warn(`[withdrawalSettlement] emulator not reachable at ${emulatorHost}; skipping behavioural checks`);
      return;
    }
    // `functions/withdrawalSettlement.js` resolves `firebase-admin` from
    // `functions/node_modules`, which is a DIFFERENT module instance from the
    // root copy. Initialise that same instance so the module sees the app.
    const { createRequire } = await import('node:module');
    const requireFn = createRequire(import.meta.url);
    admin = requireFn(path.resolve(process.cwd(), 'functions', 'node_modules', 'firebase-admin'));
    if (!admin.apps.length) admin.initializeApp({ projectId: 'arvdoul-settlement-test' });
    db = admin.firestore();
    const mod = await import('../../functions/withdrawalSettlement.js');
    settleWithdrawal = mod.settleWithdrawal || mod.default?.settleWithdrawal;
    expect(typeof settleWithdrawal).toBe('function');
  });

  beforeEach(() => {
    stripeCalls = [];
    ledgerCalls = [];
  });

  test('a PayPal withdrawal is rejected and the locked coins are released', async () => {
    if (!reachable) return;
    const { uid, wid } = await seedWithdrawal({ method: 'paypal', details: { email: 'a@b.com' } });

    await expect(settleWithdrawal(deps(), wid, 'approve')).rejects.toThrow(/PayPal/);

    const w = (await db.collection('withdrawal_requests').doc(wid).get()).data();
    expect(w.status).toBe('rejected');
    const u = (await db.collection('users_private').doc(uid).get()).data();
    expect(u.lockedCoins).toBe(0);
    expect(u.coins).toBe(10000);
    expect(stripeCalls).toHaveLength(0);
  });

  test('a Stripe method with no ready account stays pending (no payout, coins held)', async () => {
    if (!reachable) return;
    const { uid, wid } = await seedWithdrawal({
      method: 'stripe_connected',
      payoutSettings: { stripeAccountId: 'acct_1', status: 'onboarding' },
    });

    await expect(settleWithdrawal(deps(), wid, 'approve')).rejects.toThrow(/payout account/i);

    const w = (await db.collection('withdrawal_requests').doc(wid).get()).data();
    expect(w.status).toBe('pending');
    const u = (await db.collection('users_private').doc(uid).get()).data();
    expect(u.lockedCoins).toBe(5000);
    expect(stripeCalls).toHaveLength(0);
  });

  test('an unsupported method is rejected', async () => {
    if (!reachable) return;
    const { wid } = await seedWithdrawal({ method: 'bank' });
    await expect(settleWithdrawal(deps(), wid, 'approve')).rejects.toThrow(/Unsupported/);
    expect(stripeCalls).toHaveLength(0);
  });

  test('a ready account pays to the SERVER account id, never the client-supplied one', async () => {
    if (!reachable) return;
    const supplyBefore = ((await db.collection('system').doc('coin_supply').get()).data()?.totalCoins) || 0;
    const { uid, wid } = await seedWithdrawal({
      method: 'stripe_connected',
      details: { stripeAccountId: 'acct_ATTACKER' },
      payoutSettings: { stripeAccountId: 'acct_SERVER', status: 'ready' },
    });

    const res = await settleWithdrawal(deps(), wid, 'approve');

    expect(res.status).toBe('completed');
    expect(stripeCalls).toHaveLength(1);
    expect(stripeCalls[0].opts.stripeAccount).toBe('acct_SERVER');
    expect(stripeCalls[0].params.amount).toBe(2500); // 5000 coins -> $25.00

    const w = (await db.collection('withdrawal_requests').doc(wid).get()).data();
    expect(w.status).toBe('completed');
    expect(w.stripePayoutId).toBeTruthy();
    const u = (await db.collection('users_private').doc(uid).get()).data();
    expect(u.coins).toBe(5000);
    expect(u.lockedCoins).toBe(0);

    // Redeemed coins leave circulation.
    const supplyAfter = ((await db.collection('system').doc('coin_supply').get()).data()?.totalCoins) || 0;
    expect(supplyAfter - supplyBefore).toBe(-5000);
    expect(ledgerCalls.length).toBeGreaterThan(0);
  });

  test('rejecting a pending withdrawal releases the lock, and cannot double-release', async () => {
    if (!reachable) return;
    const { uid, wid } = await seedWithdrawal({ method: 'stripe_connected' });

    const res = await settleWithdrawal(deps(), wid, 'reject');
    expect(res.status).toBe('rejected');

    const u = (await db.collection('users_private').doc(uid).get()).data();
    expect(u.lockedCoins).toBe(0);
    // A second reject is refused (already processed) and must NOT release the
    // lock a second time — `lockedCoins` stays at 0, never negative.
    await expect(settleWithdrawal(deps(), wid, 'reject')).rejects.toThrow(/already processed/i);
    const u2 = (await db.collection('users_private').doc(uid).get()).data();
    expect(u2.lockedCoins).toBe(0);
  });
});
