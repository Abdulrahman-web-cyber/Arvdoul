// functions/polls.js – ARVDOUL POLLS & PREDICTION MARKETS (server-authoritative)
// Voting is a Cloud Function because:
//   1. firestore.rules only allow the creator/admin to update polls — a voter
//      writing vote counters directly would be denied (or worse, allowed to
//      tamper with option text if rules were loosened).
//   2. Prediction wagers must debit real coins through the double-entry
//      ledger inside the same transaction as the vote.
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { checkRateLimit } = require('./rateLimit');
const { getUserIdFromContext } = require('./auth');
const { awardXpSafe } = require('./xpAward');

const db = admin.firestore();

exports.votePoll = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    await checkRateLimit(uid, 'votePoll', 30, 60000);
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

    // Casting a civic vote grants XP. The vote is already committed, so the
    // award is best-effort; `pollId` makes it idempotent (one vote per poll).
    await awardXpSafe(uid, 'civic_vote_cast', { source: pollId });

    return { success: true, poll: result };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', err.message);
  }
});

// ---------------------------------------------------------------------------
// Post-embedded poll voting.
//
// A poll attached to a post lives on `posts/{postId}.poll` (composer shape:
// `{ options: string[]|{id,text,votes}[], allowMultiple, closesAt, rewardCoins }`),
// not in the top-level `polls` collection. The client used to mutate the poll
// counters directly inside `firestoreService.voteOnPoll`'s transaction — but the
// posts update rule lets ANY signed-in user change `poll`, so vote counts were
// forgeable, there was no server-side expiry check, and the `isMultiple` branch
// incremented the option count without recording a vote (double-vote / re-tap
// inflation). Voting is now a callable: eligibility, expiry, option validation,
// one-vote-per-viewer dedupe and the reward credit all happen server-side.
exports.votePostPoll = functions.https.onCall(async (data, context) => {
  try {
    const uid = getUserIdFromContext(context);
    await checkRateLimit(uid, 'votePostPoll', 30, 60000);

    const { postId, optionId } = data || {};
    if (!postId || !optionId) {
      throw new functions.https.HttpsError('invalid-argument', 'postId and optionId required');
    }

    const postRef = db.collection('posts').doc(postId);

    const result = await db.runTransaction(async (t) => {
      const postSnap = await t.get(postRef);
      if (!postSnap.exists) throw new functions.https.HttpsError('not-found', 'Post not found');
      const post = postSnap.data();
      const poll = post.poll;
      if (!poll || !Array.isArray(poll.options) || poll.options.length === 0) {
        throw new functions.https.HttpsError('failed-precondition', 'This post has no poll');
      }

      // Expiry: `closesAt` is stored as a Date or an ISO string.
      if (poll.closesAt) {
        const closesAt = poll.closesAt.toDate ? poll.closesAt.toDate() : new Date(poll.closesAt);
        if (!Number.isNaN(closesAt.getTime()) && closesAt.getTime() < Date.now()) {
          throw new functions.https.HttpsError('failed-precondition', 'This poll has closed');
        }
      }

      // Normalise the composer's string options to `{ id, text, votes }` so the
      // vote is keyed on a stable id (the old code keyed on the raw index and
      // silently incremented nothing when options were plain strings).
      const options = poll.options.map((o, idx) => (
        typeof o === 'string'
          ? { id: `opt_${idx}`, text: o, votes: 0 }
          : { id: o.id ?? `opt_${idx}`, text: o.text ?? '', votes: o.votes || 0 }
      ));
      const target = options.find((o) => o.id === optionId);
      if (!target) throw new functions.https.HttpsError('invalid-argument', 'Option not found');

      // One vote per (viewer, option). A single-choice poll keys on the viewer
      // alone (a second choice is a duplicate); a multi-choice poll keys on
      // (viewer, option), so a viewer may pick several distinct options but not
      // the same one twice.
      const allowMultiple = poll.allowMultiple === true;
      const voteId = allowMultiple ? `${uid}_${optionId}` : uid;
      const voteRef = postRef.collection('poll_votes').doc(voteId);
      const rewardRef = postRef.collection('poll_votes').doc(`${uid}__reward`);
      const voteSnap = await t.get(voteRef);
      if (voteSnap.exists) {
        throw new functions.https.HttpsError('already-exists', 'You have already voted on this poll');
      }
      const rewardSnap = await t.get(rewardRef);
      const firstVote = !rewardSnap.exists;

      target.votes += 1;
      const totalVotes = (poll.totalVotes || 0) + 1;
      options.forEach((o) => { o.percentage = Math.round((o.votes / totalVotes) * 100); });

      t.update(postRef, {
        'poll.options': options,
        'poll.totalVotes': totalVotes,
        'stats.pollVotes': admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      t.set(voteRef, {
        userId: uid,
        optionId,
        optionIndex: options.findIndex((o) => o.id === optionId),
        votedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      if (firstVote) {
        // Marker (server-only) so the reward is credited exactly once per
        // (viewer, post), however many options a multi-choice poll allows.
        t.set(rewardRef, { userId: uid, rewardMarker: true, votedAt: admin.firestore.FieldValue.serverTimestamp() });
      }

      return { options, totalVotes, rewardCoins: firstVote ? (Number(poll.rewardCoins) || 0) : 0 };
    });

    // Reward credit is server-authoritative and idempotent (one credit per
    // post). The client only shows the toast; it never mints the coins.
    const reward = result.rewardCoins;
    if (reward > 0) {
      const userRef = db.collection('users').doc(uid);
      await db.runTransaction(async (t) => {
        const userSnap = await t.get(userRef);
        if (!userSnap.exists) return;
        const balance = Number(userSnap.data().coins) || 0;
        const newBalance = balance + reward;
        t.update(userRef, { coins: newBalance });
        t.set(db.collection('coin_transactions').doc(), {
          userId: uid,
          type: 'credit',
          amount: reward,
          reason: 'poll_vote_reward',
          metadata: { postId },
          balanceAfter: newBalance,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expireAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });
        t.set(db.collection('system').doc('coin_supply'),
          { totalCoins: admin.firestore.FieldValue.increment(reward) }, { merge: true });
      });
    }

    // Casting a vote grants XP; already committed, so the award is best-effort.
    await awardXpSafe(uid, 'civic_vote_cast', { source: postId });

    return { success: true, options: result.options, totalVotes: result.totalVotes, rewardCoins: reward };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', err.message);
  }
});
