// functions/polls.js – ARVDOUL POLLS (server-authoritative)
// Voting is a Cloud Function because firestore.rules only allow the
// creator/admin to update a poll — a voter writing vote counters directly
// would be denied (or worse, allowed to tamper with option text if the rules
// were loosened). Prediction-market wagering is intentionally not implemented:
// it was a coin value sink with no settlement engine (see votePoll below).
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

      // Prediction-market wagers were a value sink: `votePoll` debited the
      // wager through the double-entry ledger and burned it from
      // `system/coin_supply`, but NO settlement path exists anywhere in the
      // repo — nothing resolves a poll, credits a winner, refunds a loser or
      // releases the pool on expiry. Every wager therefore destroyed the
      // creator's coins permanently while the UI promised "payout will trigger
      // upon close". A parimutuel/fixed-odds payout, a resolver, a tie/refund
      // policy and a house cut are product decisions (charter §5.1, §7.15), so
      // rather than invent one this path now refuses to move money at all.
      // Re-enable only alongside a real settlement engine.
      if (wager > 0) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Prediction wagers are not available: there is no settlement engine to pay out or refund a pool.'
        );
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
        votedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        id: pollId,
        ...poll,
        options,
        totalVotes: newTotal,
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
// `{ options: string[]|{id,text,votes}[], allowMultiple, closesAt }`),
// not in the top-level `polls` collection. The client used to mutate the poll
// counters directly inside `firestoreService.voteOnPoll`'s transaction — but the
// posts update rule lets ANY signed-in user change `poll`, so vote counts were
// forgeable, there was no server-side expiry check, and the `isMultiple` branch
// incremented the option count without recording a vote (double-vote / re-tap
// inflation). Voting is now a callable: eligibility, expiry, option validation
// and one-vote-per-viewer dedupe all happen server-side.
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
      const voteSnap = await t.get(voteRef);
      if (voteSnap.exists) {
        throw new functions.https.HttpsError('already-exists', 'You have already voted on this poll');
      }

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

      return { options, totalVotes };
    });

    // NOTE: post-poll voter rewards were removed. The composer let the author
    // name `rewardCoins` client-side and this function minted that many coins to
    // each first-time voter, incrementing `coin_supply` while debiting nobody —
    // an unbounded faucet (a creator could set 1000/voter and mint unlimited
    // coins). Funding a reward from the author's balance needs an escrow model
    // (reserve at publish, refund the unused pool) that does not exist, so no
    // reward is credited until that is designed. Charter §5.1 / §7.15.

    // Casting a vote grants XP; already committed, so the award is best-effort.
    await awardXpSafe(uid, 'civic_vote_cast', { source: postId });

    return { success: true, options: result.options, totalVotes: result.totalVotes };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', err.message);
  }
});
