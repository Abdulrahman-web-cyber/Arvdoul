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

const db = admin.firestore();

/**
 * Approve or reject a pending withdrawal request.
 *
 * @param {Object} deps
 * @param {Object} deps.stripe            Stripe client (already configured).
 * @param {Function} deps.createLedgerEntry (tx, debit, credit, amount, meta) => void
 * @param {number} deps.coinsPerDollar    Coin→USD conversion rate.
 * @param {number} deps.maxRetries        Firestore transaction retry count.
 * @param {string} withdrawalId
 * @param {'approve'|'reject'} action
 * @returns {Promise<{status: string, payoutId?: string, usdAmount?: number}>}
 */
async function settleWithdrawal(deps, withdrawalId, action) {
  const { stripe, createLedgerEntry, maxRetries = 5 } = deps;
  const coinsPerDollar = Number(deps.coinsPerDollar) > 0 ? Number(deps.coinsPerDollar) : 200;
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

    const usdAmount = withdrawalData.amount / coinsPerDollar;
    const stripeAmount = Math.round(usdAmount * 100);
    const stripeIdempotencyKey = `wd_${withdrawalId}`;
    let payout;
    try {
      payout = await stripe.payouts.create(
        { amount: stripeAmount, currency: 'usd', method: 'standard' },
        { idempotencyKey: stripeIdempotencyKey, stripeAccount: withdrawalData.paymentDetails?.stripeAccountId }
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

      const userRef = db.collection('users').doc(withdrawalData.userId);
      const userSnap = await t.get(userRef);
      const currentBalance = userSnap.data().coins || 0;
      const currentLocked = userSnap.data().lockedCoins || 0;

      if (currentLocked < withdrawalData.amount || currentBalance < withdrawalData.amount) {
        t.update(withdrawalRef, { status: 'failed', failureReason: 'Insufficient balance at finalization.' });
        throw new Error('Insufficient balance.');
      }

      t.update(userRef, {
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
  const userRef = db.collection('users').doc(withdrawalData.userId);
  await runTransaction(async (t) => {
    const freshSnap = await t.get(withdrawalRef);
    if (freshSnap.data().status !== 'pending' && freshSnap.data().status !== 'pending_review') {
      throw new Error('Invalid status for rejection.');
    }
    t.update(userRef, { lockedCoins: admin.firestore.FieldValue.increment(-withdrawalData.amount) });
    const lockSnapshot = await t.get(
      db.collection('coin_transactions')
        .where('metadata.withdrawalId', '==', withdrawalId)
        .where('type', '==', 'withdrawal_lock')
    );
    lockSnapshot.forEach((doc) => t.update(doc.ref, {
      status: 'cancelled',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
    }));
    t.update(withdrawalRef, { status: 'rejected', processedAt: admin.firestore.FieldValue.serverTimestamp() });
  });

  return { status: 'rejected', amount: withdrawalData.amount };
}

module.exports = { settleWithdrawal };
