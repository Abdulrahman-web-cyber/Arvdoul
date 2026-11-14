'use strict';

// Post engagement counters: authoritative shard reader + the scheduled mirror
// that keeps `posts/{postId}.stats.{likes,comments,shares,saves}` truthful.
//
// Why this module exists (N433):
//   Every like/save/share/comment mutation routes its increment to a sharded
//   `counter_shards` document (client `CountersManager`, inside
//   `firestoreService.toggleLike`/`toggleSave`/`sharePost` and
//   `commentService.createComment`/`deleteComment`). No writer ever updates
//   `posts/{postId}.stats.likes` (etc.) — the field is seeded `0` at create and
//   left there. Server readers that trusted it therefore always saw a
//   fabricated zero:
//     * `feed.js#processScoreUpdates` read `post.likeCount`/`commentCount`/
//       `shareCount`/`viewCount` — top-level fields that are never written at
//       all — so `personalizationScore`/`trendingScore` collapsed to a pure
//       recency ranking (the engagement term was a constant 0), and the feed
//       ranked every post identically regardless of popularity;
//     * `search.js#indexPost` shipped `stats.likes`/`stats.comments` (both
//       stale 0) to the Algolia post index, so content search sorted by a
//       fabricated engagement score of 0.
//
//   The shards are the source of truth. `readPostCounter` sums them (one
//   batched `getAll` RPC) for the paths that must be immediately correct;
//   `aggregatePostCounters` is the eventual-consistency mirror (cursor-paged,
//   bounded per run) that writes the sums back onto `posts/{postId}` so every
//   remaining reader reads a real number — the same model `video.js` uses for
//   `aggregateVideoViews`/`aggregateVideoLikes`.
//
// The shard document id layout MUST stay byte-identical to `hashString()` in
// `src/utils/CountersManager.js` (the client that writes the shards and sums
// them on read). `postCounterSourceGuard.test.js` pins the equality.

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const COUNTER_SHARDS_COLLECTION = 'counter_shards';
const COUNTER_SHARDS = 10;
// Post fields maintained as sharded counters (shard field -> stats field).
// `views` is included: `functions/analytics.js#recordPostView` increments the
// `views` shard for `posts/{id}` and no writer sets `stats.views`, so without
// mirroring it the feed's view-weighted engagement term was a constant 0 (N441).
const POST_COUNTER_FIELDS = ['likes', 'comments', 'shares', 'saves', 'views'];
// Bounded per-run work for the mirror job (cursor-paged).
const POST_MIRROR_BATCH = 200;

// Must stay byte-identical to hashString() in src/utils/CountersManager.js.
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

function shardRef(docPath, field, shardIndex) {
  return db.collection(COUNTER_SHARDS_COLLECTION)
    .doc(`${hashString(docPath)}__${field}__${shardIndex}`);
}

/**
 * Sum the shard documents for every counter field of one post in a single
 * batched `getAll` RPC (no per-field round-trip, no scan).
 *
 * @returns {Promise<Object<string, {value: number, found: number}>>} keyed by field.
 */
async function readPostCounterShards(postId, fields = POST_COUNTER_FIELDS) {
  const docPath = `posts/${postId}`;
  const refs = [];
  const keys = [];
  for (const field of fields) {
    for (let i = 0; i < COUNTER_SHARDS; i++) {
      refs.push(shardRef(docPath, field, i));
      keys.push(field);
    }
  }
  const snaps = await db.getAll(...refs);
  const out = {};
  for (const field of fields) out[field] = { value: 0, found: 0 };
  snaps.forEach((snap, idx) => {
    if (!snap.exists) return;
    const field = keys[idx];
    out[field].value += snap.data().value || 0;
    out[field].found += 1;
  });
  return out;
}

/**
 * Scheduled mirror: sum each post's sharded counters and write them onto
 * `posts/{postId}.stats` so ranking/search read real values. Only writes a
 * field that actually changed, so a quiet run costs one read batch and no
 * write (and the Algolia `onWrite` index does not churn).
 */
exports.aggregatePostCounters = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const cursorRef = db.collection('system').doc('post_counters_cursor');
    const cursorSnap = await cursorRef.get();
    let lastDoc = null;
    if (cursorSnap.exists && cursorSnap.data().lastId) {
      lastDoc = await db.collection('posts').doc(cursorSnap.data().lastId).get();
      if (!lastDoc.exists) lastDoc = null;
    }

    let query = db.collection('posts').orderBy('__name__').limit(POST_MIRROR_BATCH);
    if (lastDoc) query = query.startAfter(lastDoc);
    const snap = await query.get();
    if (snap.empty) {
      // Reached the end of the collection: reset the cursor for the next sweep.
      await cursorRef.set({ lastId: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { processed: 0 };
    }

    for (const doc of snap.docs) {
      const postId = doc.id;
      const stats = doc.data().stats || {};
      const patch = {};
      let changed = false;

      const sums = await readPostCounterShards(postId);
      for (const field of POST_COUNTER_FIELDS) {
        const { value, found } = sums[field];
        // No shard means the counter was never incremented: leave the stored
        // value untouched (a pre-shard post may already carry a real number).
        if (found === 0) continue;
        if ((stats[field] || 0) !== value) {
          patch[`stats.${field}`] = value;
          changed = true;
        }
      }

      if (changed) {
        patch.updatedAt = FieldValue.serverTimestamp();
        await doc.ref.update(patch);
      }
    }

    const lastProcessedId = snap.docs[snap.docs.length - 1].id;
    await cursorRef.set({ lastId: lastProcessedId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { processed: snap.size };
  });
