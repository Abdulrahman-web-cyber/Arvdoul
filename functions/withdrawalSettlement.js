// functions/withdrawalSettlement.js — the single settlement path for creator
// withdrawal requests.
//
// A withdrawal moves real money (Stripe payout) and mutates balances, so the
// logic must exist exactly once. Before this module the HTTPS worker
// (`processWithdrawal`) held the only implementation, which meant the admin
// console had to either duplicate the money logic or write the status straight
// to Firestore. It did the latter, which minted a "completed" payout without a
// payout ever being sent and without debiting the creator's locked coins.
//
// Both entry points now call `settleWithdrawal`:
//   * `processWithdrawal` (secret-authenticated HTTPS worker / scheduler)
//   * `adminDecideWithdrawal` (admin-gated callable used by the console)
//
// The module only needs Stripe and the shared ledger helper, so they are
// injected rather than re-created here (monetization.js owns the single
// Stripe client and the double-entry `createLedgerEntry`).

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { coinsToUsd } = require('./levelConfig.cjs');
const { readCoinBalance, writeCoinBalance } = require('./coinBalance');

const db = admin.firestore();

// Payout methods the platform can actually settle on. A Stripe Connect payout
// targets the creator's own connected account; there is no PayPal payout
// integration. Accepting a `paypal` request and then calling
// `stripe.payouts.create` without a connected account would send the creator's
// money from the PLATFORM account to an account that is not theirs.
const STRIPE_PAYOUT_METHODS = new Set(['stripe', 'stripe_connected', 'stripe_express']);

/**
 * Resolve a payout provider for a withdrawal, or explain why it cannot settle.
 *
 * The connected Stripe account is resolved server-side from `payout_settings`,
 * NEVER from the client-supplied `paymentDetails` (a client could otherwise
 * name any account, or a bogus `stripeAccount: 'connected'` string).
 *
 * @returns {Promise<{ok: true, accountId: string} | {ok: false, terminal: boolean, reason: string}>}
 */
async function resolvePayoutProvider(withdrawalData) {
  const method = withdrawalData.paymentMethod;
  if (method === 'paypal') {
    return {
      ok: false,
      terminal: true,
      reason: 'PayPal payouts are not supported. Connect a Stripe payout account to withdraw.',
    };
  }
  if (!STRIPE_PAYOUT_METHODS.has(method)) {
    return {
      ok: false,
      terminal: true,
      reason: `Unsupported payout method: ${method || 'none'}.`,
    };
  }
  const snap = await db.collection('payout_settings').doc(withdrawalData.userId).get();
  const settings = snap.exists ? snap.data() : null;
  if (!settings || !settings.stripeAccountId || settings.status !== 'ready') {
    return {
      ok: false,
      terminal: false,
      reason: 'No verified Stripe payout account. Complete payout onboarding before withdrawing.',
    };
  }
  return { ok: true, accountId: settings.stripeAccountId };
}

/**
 * Reject a withdrawal and release the creator's locked coins in one
 * transaction. Idempotent: a request already in a terminal state is left
 * alone, so a retried approval/rejection cannot double-release.
 */
async function rejectAndRelease(withdrawalId, withdrawalData, failureReason) {
  const withdrawalRef = db.collection('withdrawal_requests').doc(withdrawalId);
  await db.runTransaction(async (t) => {
    // Firestore transactions require every read BEFORE the first write. The
    // previous order updated `lockedCoins` and then ran `t.get(query)`, which
    // throws ("transactions require all reads before all writes"), so rejecting
    // a withdrawal failed and the creator's locked coins stayed stranded.
    const freshSnap = await t.get(withdrawalRef);
    if (!freshSnap.exists) return;
    const status = freshSnap.data().status;
    if (status !== 'pending' && status !== 'pending_review') return;
    const lockSnapshot = await t.get(
      db.collection('coin_transactions')
        .where('metadata.withdrawalId', '==', withdrawalId)
        .where('type', '==', 'withdrawal_lock')
    );
    writeCoinBalance(t, withdrawalData.userId, { lockedCoins: admin.firestore.FieldValue.increment(-withdrawalData.amount) });
    lockSnapshot.forEach((doc) => t.update(doc.ref, {
      status: 'cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    }));
    t.update(withdrawalRef, {
      status: 'rejected',
      ...(failureReason ? { failureReason } : {}),
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { status: 'rejected', amount: withdrawalData.amount };
}

/**
 * Approve or reject a pending withdrawal request.
 *
 * @param {Object} deps
 * @param {Object} deps.stripe            Stripe client (already configured).
 * @param {Function} deps.createLedgerEntry (tx, debit, credit, amount, meta) => void
 * @param {number} deps.maxRetries        Firestore transaction retry count.
 * @param {string} withdrawalId
 * @param {'approve'|'reject'} action
 * @returns {Promise<{status: string, payoutId?: string, usdAmount?: number}>}
 */
async function settleWithdrawal(deps, withdrawalId, action) {
  const { stripe, createLedgerEntry, maxRetries = 5 } = deps;

  if (!withdrawalId || !['approve', 'reject'].includes(action)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'withdrawalId and action (approve|reject) are required.'
    );
  }

  const runTransaction = async (updateFn) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await db.runTransaction(updateFn);
      } catch (error) {
        if (attempt === maxRetries) throw error;
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 100));
      }
    }
    return undefined;
  };

  const withdrawalRef = db.collection('withdrawal_requests').doc(withdrawalId);
  const withdrawalSnap = await withdrawalRef.get();
  if (!withdrawalSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Withdrawal request not found.');
  }

  const withdrawalData = withdrawalSnap.data();
  const validStatus = withdrawalData.status === 'pending' || withdrawalData.status === 'pending_review';
  if (!validStatus) {
    throw new functions.https.HttpsError('failed-precondition', 'Withdrawal already processed.');
  }

  if (action === 'approve') {
    if (!stripe) {
      throw new functions.https.HttpsError('failed-precondition', 'Payments are not configured yet.');
    }

    // Resolve the payout provider BEFORE locking, so a request that can never
    // be paid (PayPal, or a Stripe method with no connected account) fails
    // without leaving the withdrawal stuck in `processing`. A terminal reason
    // (no supported provider) rejects and RELEASES the creator's locked coins;
    // a non-terminal reason (onboarding incomplete) returns the request to
    // `pending` so it can settle once onboarding finishes.
    const provider = await resolvePayoutProvider(withdrawalData);
    if (!provider.ok) {
      if (provider.terminal) {
        await rejectAndRelease(withdrawalId, withdrawalData, provider.reason);
        throw new functions.https.HttpsError('failed-precondition', provider.reason);
      }
      await withdrawalRef.update({
        status: 'pending',
        processingError: provider.reason,
      });
      throw new functions.https.HttpsError('failed-precondition', provider.reason);
    }

    const serverId = `worker-${Math.random().toString(36).substring(7)}`;
    const lockExpiresAt = Date.now() + 5 * 60 * 1000;
    const lockObtained = await runTransaction(async (t) => {
      const freshSnap = await t.get(withdrawalRef);
      const curStatus = freshSnap.data().status;
      if (curStatus !== 'pending' && curStatus !== 'pending_review') return false;
      t.update(withdrawalRef, {
        status: 'processing',
        processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        lockOwner: serverId,
        lockExpiresAt: new Date(lockExpiresAt),
      });
      return true;
    });

    if (!lockObtained) {
      throw new functions.https.HttpsError('aborted', 'Withdrawal is being processed by another request.');
    }

    // Verify the creator still holds the locked coins BEFORE moving any real
    // money. A Stripe payout is irreversible, so a balance that shrank between
    // the request and the approval (a concurrent spend, an admin debit) must
    // fail here rather than after a payout has already been sent. The finalize
    // transaction below re-checks, but it runs after Stripe and cannot
    // un-send the money.
    //
    // A failed settlement must also RELEASE the hold: `lockedCoins` is what
    // makes the coins unavailable in the wallet, so leaving it set would strand
    // the creator's balance forever on a withdrawal that never pays out.
    const preflight = await runTransaction(async (t) => {
      const freshSnap = await t.get(withdrawalRef);
      if (freshSnap.data().status !== 'processing' || freshSnap.data().lockOwner !== serverId) {
        throw new Error('Invalid lock state.');
      }
      const bal = await readCoinBalance(t, withdrawalData.userId, { fallbackToPublic: true });
      const balance = bal.coins;
      const locked = bal.lockedCoins;
      if (locked < withdrawalData.amount || balance < withdrawalData.amount) {
        const releaseAmount = Math.min(withdrawalData.amount, locked);
        if (releaseAmount > 0) {
          writeCoinBalance(t, withdrawalData.userId, { lockedCoins: admin.firestore.FieldValue.increment(-releaseAmount) });
        }
        t.update(withdrawalRef, {
          status: 'failed',
          failureReason: 'Insufficient balance before payout.',
          lockOwner: admin.firestore.FieldValue.delete(),
          lockExpiresAt: admin.firestore.FieldValue.delete(),
        });
        return false;
      }
      return true;
    });
    if (!preflight) {
      throw new functions.https.HttpsError('failed-precondition', 'Insufficient balance to settle this withdrawal.');
    }

    // Convert through the shared helper so the settled payout uses exactly the
    // same rate/rounding policy the wallet and payout screens display. There is
    // no caller-supplied rate override — a second rate is how a payout drifts
    // from what the creator was shown.
    const usdAmount = coinsToUsd(withdrawalData.amount);
    const stripeAmount = Math.round(usdAmount * 100);
    const stripeIdempotencyKey = `wd_${withdrawalId}`;
    let payout;
    try {
      payout = await stripe.payouts.create(
        { amount: stripeAmount, currency: 'usd', method: 'standard' },
        { idempotencyKey: stripeIdempotencyKey, stripeAccount: provider.accountId }
      );
    } catch (stripeError) {
      await withdrawalRef.update({
        status: 'pending',
        processingError: stripeError.message,
        lockOwner: admin.firestore.FieldValue.delete(),
        lockExpiresAt: admin.firestore.FieldValue.delete(),
      });
      throw new functions.https.HttpsError('unavailable', `Stripe payout failed: ${stripeError.message}`);
    }

    await runTransaction(async (t) => {
      const finalSnap = await t.get(withdrawalRef);
      if (finalSnap.data().status !== 'processing' || finalSnap.data().lockOwner !== serverId) {
        throw new Error('Invalid lock state.');
      }

      const finalBal = await readCoinBalance(t, withdrawalData.userId, { fallbackToPublic: true });
      const currentBalance = finalBal.coins;
      const currentLocked = finalBal.lockedCoins;

      if (currentLocked < withdrawalData.amount || currentBalance < withdrawalData.amount) {
        t.update(withdrawalRef, { status: 'failed', failureReason: 'Insufficient balance at finalization.' });
        throw new Error('Insufficient balance.');
      }

      writeCoinBalance(t, withdrawalData.userId, {
        coins: admin.firestore.FieldValue.increment(-withdrawalData.amount),
        lockedCoins: admin.firestore.FieldValue.increment(-withdrawalData.amount),
        lastWithdrawalCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const finalTxRef = db.collection('coin_transactions').doc();
      t.set(finalTxRef, {
        userId: withdrawalData.userId, type: 'debit', amount: withdrawalData.amount,
        reason: 'withdrawal_completed',
        metadata: { withdrawalId, stripePayoutId: payout.id, usdAmount },
        balanceAfter: currentBalance - withdrawalData.amount,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });

      createLedgerEntry(t, `users:${withdrawalData.userId}`, 'system:reserve', withdrawalData.amount, {
        reason: 'withdrawal',
        transactionId: finalTxRef.id,
        payoutId: payout.id,
      });

      // Coins redeemed for fiat leave circulation, so the incremental supply
      // counter (`system/coin_supply`, bumped by every mint/burn path) must be
      // decremented too. Without this the scheduled `auditCoins` reconciliation
      // reported permanent drift after every payout (supply counted coins the
      // creator no longer holds).
      t.set(db.collection('system').doc('coin_supply'),
        { totalCoins: admin.firestore.FieldValue.increment(-withdrawalData.amount) },
        { merge: true });

      t.update(withdrawalRef, {
        status: 'completed',
        stripePayoutId: payout.id,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        lockOwner: admin.firestore.FieldValue.delete(),
        lockExpiresAt: admin.firestore.FieldValue.delete(),
      });
    });

    return { status: 'completed', payoutId: payout.id, usdAmount, amount: withdrawalData.amount };
  }

  // action === 'reject'
  return rejectAndRelease(withdrawalId, withdrawalData);
}

module.exports = { settleWithdrawal, STRIPE_PAYOUT_METHODS };
