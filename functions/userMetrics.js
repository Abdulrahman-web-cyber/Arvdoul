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
//   * `likesCount` — the per-post like count is a sharded `counter_shards`
//     value, not `posts.stats.likes` (never incremented), so summing it needs a
//     per-post shard read; left for a dedicated backfill.
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

/**
 * Compute the real engagement metrics for a user.
 * @param {string} uid
 * @returns {Promise<Object>} only the metrics that could be resolved
 */
async function computeUserMetrics(uid) {
  if (!uid) return {};
  const metrics = {};

  const [commentsCount, pollVotesCount, profilesVisitedCount, giftsSentCount] = await Promise.all([
    safeCount(db().collection('comments').where('userId', '==', uid)),
    safeCount(db().collection('poll_votes').where('userId', '==', uid)),
    safeCount(db().collection('profile_views').where('viewerId', '==', uid)),
    safeCount(db().collection('gift_transactions').where('senderId', '==', uid)),
  ]);

  if (commentsCount !== undefined) metrics.commentsCount = commentsCount;
  if (pollVotesCount !== undefined) metrics.pollVotesCount = pollVotesCount;
  if (profilesVisitedCount !== undefined) metrics.profilesVisitedCount = profilesVisitedCount;
  if (giftsSentCount !== undefined) metrics.giftsSentCount = giftsSentCount;

  try {
    const liveSnap = await db().collection('live_streams').where('userId', '==', uid).limit(1).get();
    metrics.hostedLive = !liveSnap.empty;
  } catch (err) {
    // leave `hostedLive` undefined (unmet)
  }

  return metrics;
}

module.exports = { computeUserMetrics };
