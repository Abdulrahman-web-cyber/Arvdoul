// functions/polls.js – ARVDOUL POLLS & PREDICTION MARKETS (server-authoritative)
// Voting is a Cloud Function because:
//   1. firestore.rules only allow the creator/admin to update polls — a voter
//      writing vote counters directly would be denied (or worse, allowed to
//      tamper with option text if rules were loosened).
//   2. Prediction wagers must debit real coins through the double-entry
//      ledger inside the same transaction as the vote.
const functions = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

function getUserIdFromContext(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign in required');
  }
  return context.auth.uid;
}

exports.votePoll = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    const { pollId, optionId, wagerCoins = 0 } = data || {};
    if (!pollId || !optionId) {
      throw new functions.https.HttpsError('invalid-argument', 'pollId and optionId required');
    }
    const wager = Number(wagerCoins) || 0;

    const pollRef = db.collection('polls').doc(pollId);
    const voteRef = db.collection('poll_votes').doc(`${uid}_${pollId}`);

    const result = await db.runTransaction(async (t) => {
      const pollSnap = await t.get(pollRef);
      if (!pollSnap.exists) throw new functions.https.HttpsError('not-found', 'Poll not found');
      const poll = pollSnap.data();
      const options = Array.isArray(poll.options) ? poll.options.map((o) => ({ ...o })) : [];
      const target = options.find((o) => o.id === optionId);
      if (!target) throw new functions.https.HttpsError('invalid-argument', 'Option not found');

      const voteSnap = await t.get(voteRef);
      if (voteSnap.exists) {
        throw new functions.https.HttpsError('already-exists', 'You have already voted on this poll');
      }

      // Wager: real coin debit inside the same transaction (double-entry).
      if (wager > 0) {
        if (!poll.isPredictionMarket) {
          throw new functions.https.HttpsError('invalid-argument', 'This poll is not a prediction market');
        }
        const userRef = db.collection('users').doc(uid);
        const userSnap = await t.get(userRef);
        if (!userSnap.exists) throw new functions.https.HttpsError('not-found', 'User not found');
        const balance = userSnap.data().coins || 0;
        const locked = userSnap.data().lockedCoins || 0;
        if (balance - locked < wager) {
          throw new functions.https.HttpsError('failed-precondition', `Insufficient coins. You need ${wager} coins.`);
        }
        const newBalance = balance - wager;
        t.update(userRef, { coins: newBalance });

        const txRef = db.collection('coin_transactions').doc();
        t.set(txRef, {
          userId: uid,
          type: 'debit',
          amount: wager,
          reason: 'poll_wager',
          metadata: { pollId, optionId },
          balanceAfter: newBalance,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });

        t.set(db.collection('system').doc('coin_supply'),
          { totalCoins: admin.firestore.FieldValue.increment(-wager) }, { merge: true });

        t.set(pollRef, { poolCoins: admin.firestore.FieldValue.increment(wager) }, { merge: true });
      }

      // Vote counters.
      target.votes = (target.votes || 0) + 1;
      const newTotal = (poll.totalVotes || 0) + 1;
      options.forEach((o) => {
        o.percentage = Math.round(((o.votes || 0) / newTotal) * 100);
      });

      t.update(pollRef, { options, totalVotes: newTotal });

      t.set(voteRef, {
        pollId,
        optionId,
        userId: uid,
        wagerCoins: wager,
        votedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        id: pollId,
        ...poll,
        options,
        totalVotes: newTotal,
        poolCoins: (poll.poolCoins || 0) + wager,
        hasVoted: optionId,
      };
    });

    return { success: true, poll: result };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', err.message);
  }
});
