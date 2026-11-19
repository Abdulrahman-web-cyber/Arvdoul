'use strict';

// Server-computed engagement metrics for a user (N432).
//
// `ACHIEVEMENTS_CATALOG` / `TITLES_CATALOG` criteria are evaluated against
// metric fields on `users/{uid}` (`commentsCount`, `pollVotesCount`,
// `profilesVisitedCount`, `giftsSentCount`, `hostedLive`, `likesCount`,
// `friendsCount`, `lifetimeCoinsEarned`, …). No writer ever populates those
// fields, so the evaluators read a permanent `0` and the affected achievements
// and titles can never be earned — an advertised-but-dead feature.
//
// This module computes the metrics that have a real, cheap source: a bounded
// aggregation over the collections the platform actually writes. Each metric is
// best-effort (a failure leaves it `undefined`, which the evaluators treat as
// unmet — fail-closed, never a fabricated pass).
//
// Metrics with no cheap source are deliberately NOT computed here and remain
// documented blockers (see the N432 ledger entry):
//   * `friendsCount` — mutual-follow intersection, not a single collection.
//   * `lifetimeCoinsEarned` / `hasPassport` / `isPioneer` — need a product
//     definition or a signup-cutoff constant that does not exist yet.

const admin = require('firebase-admin');

function db() {
  return admin.firestore();
}

async function safeCount(query) {
  try {
    const snap = await query.count().get();
    return snap.data().count;
  } catch (err) {
    return undefined;
  }
}

async function safeSum(query, field) {
  try {
    const snap = await query.aggregate({ total: { sum: field } }).get();
    const total = snap.data().total;
    return typeof total === 'number' ? total : undefined;
  } catch (err) {
    return undefined;
  }
}

/**
 * Compute the real engagement metrics for a user.
 * @param {string} uid
 * @returns {Promise<Object>} only the metrics that could be resolved
 */
async function computeUserMetrics(uid) {
  if (!uid) return {};
  const metrics = {};

  const [
    commentsCount,
    pollVotesCount,
    profilesVisitedCount,
    giftsSentCount,
    postsCount,
    likesCount,
    storiesCount,
    vibeReactionsCount,
    vibeRepliesCount,
    vibeGiftsSentCount,
    vibeStories100Views,
  ] = await Promise.all([
    safeCount(db().collection('comments').where('userId', '==', uid)),
    safeCount(db().collection('poll_votes').where('userId', '==', uid)),
    safeCount(db().collection('profile_views').where('viewerId', '==', uid)),
    safeCount(db().collection('gift_transactions').where('senderId', '==', uid)),
    safeCount(db().collection('posts').where('authorId', '==', uid)),
    // Total likes across the author's posts. `posts.stats.likes` is a real
    // number now that `aggregatePostCounters` mirrors the sharded counter onto
    // it (N433); before that it was a permanent 0.
    safeSum(db().collection('posts').where('authorId', '==', uid), 'stats.likes'),
    safeCount(db().collection('stories').where('userId', '==', uid)),
    safeCount(db().collectionGroup('reactions').where('userId', '==', uid).where('targetType', '==', 'vibe')),
    safeCount(db().collection('story_replies').where('userId', '==', uid)),
    safeCount(db().collection('gift_transactions').where('senderId', '==', uid).where('giftContext', '==', 'vibe')),
    safeCount(db().collection('stories').where('userId', '==', uid).where('stats.views', '>=', 100)),
  ]);

  if (commentsCount !== undefined) metrics.commentsCount = commentsCount;
  if (pollVotesCount !== undefined) metrics.pollVotesCount = pollVotesCount;
  if (profilesVisitedCount !== undefined) metrics.profilesVisitedCount = profilesVisitedCount;
  if (giftsSentCount !== undefined) metrics.giftsSentCount = giftsSentCount;
  if (postsCount !== undefined) metrics.postsCount = postsCount;
  if (likesCount !== undefined) metrics.likesCount = likesCount;
  if (storiesCount !== undefined) metrics.storiesCount = storiesCount;
  if (vibeReactionsCount !== undefined) metrics.vibeReactionsCount = vibeReactionsCount;
  if (vibeRepliesCount !== undefined) metrics.vibeRepliesCount = vibeRepliesCount;
  if (vibeGiftsSentCount !== undefined) metrics.vibeGiftsSentCount = vibeGiftsSentCount;
  if (vibeStories100Views !== undefined) metrics.vibeViewsMax = vibeStories100Views > 0 ? 100 : 0;

  try {
    const liveSnap = await db().collection('live_streams').where('userId', '==', uid).limit(1).get();
    metrics.hostedLive = !liveSnap.empty;
  } catch (err) {
    // leave `hostedLive` undefined (unmet)
  }

  return metrics;
}

module.exports = { computeUserMetrics };
