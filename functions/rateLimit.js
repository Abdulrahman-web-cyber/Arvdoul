// functions/rateLimit.js – SHARED SHARDED RATE LIMITER (extracted from monetization.js)
// O(1)-ish per user+action via 10 shards; TTL-cleanable docs; fail-closed.
const admin = require('firebase-admin');
const functions = require('firebase-functions');

const NUM_RATE_SHARDS = 10;
const RATE_LIMIT_TTL_MS = 60 * 60 * 1000; // 1h — docs expire naturally via window check

async function checkRateLimit(userId, action, maxOps, windowMs = 60000) {
  const now = Date.now();
  const windowStart = now - windowMs;

  await admin.firestore().runTransaction(async (t) => {
    const parentRef = admin.firestore().collection('rate_limits').doc(`${userId}_${action}`);
    const shards = [];
    for (let i = 0; i < NUM_RATE_SHARDS; i++) {
      const shardSnap = await t.get(parentRef.collection('shards').doc(String(i)));
      shards.push(shardSnap.exists ? shardSnap.data() : { count: 0, windowStart: 0 });
    }

    const total = shards.reduce((sum, d) => (d.windowStart >= windowStart ? sum + d.count : sum), 0);
    if (total >= maxOps) {
      throw new functions.https.HttpsError('resource-exhausted', 'RATE_LIMIT_EXCEEDED');
    }

    const shardId = Math.floor(Math.random() * NUM_RATE_SHARDS);
    const shardRef = parentRef.collection('shards').doc(String(shardId));
    const shard = shards[shardId];
    const shardWindowStart = shard.windowStart >= windowStart ? shard.windowStart : now;
    const shardCount = shard.windowStart >= windowStart ? (shard.count || 0) + 1 : 1;

    t.set(shardRef, { count: shardCount, windowStart: shardWindowStart });

    // TTL cleanup (best-effort): keep the collection bounded.
    t.set(parentRef, {
      lastAction: admin.firestore.FieldValue.serverTimestamp(),
      expireAt: new Date(now + RATE_LIMIT_TTL_MS),
    }, { merge: true });
  });
}

module.exports = { checkRateLimit, NUM_RATE_SHARDS };
