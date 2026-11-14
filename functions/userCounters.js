// functions/userCounters.js — authoritative reader for the sharded
// follower/following counters, plus the scheduled mirror that keeps the raw
// `users/{uid}` fields truthful.
//
// Why this module exists (N431):
//   `users/{uid}` is seeded with `followerCount: 0` / `followingCount: 0` at
//   signup and NEVER written again — every follow/unfollow mutation routes the
//   increment to a sharded `counter_shards` document (client `CountersManager`,
//   `userService.followUser`/`unfollowUser`/`approveFollowRequest`/`blockUser`).
//   Server readers that trusted the raw field therefore always saw `0`:
//     * the fan-out threshold in feed.js/stories.js (`followerCount > 10000`)
//       never tripped, so a celebrity's post/story was fanned out to every
//       follower — an unbounded write storm the pull model exists to avoid;
//     * the Algolia user index (`search.js`) shipped `followerCount: 0` for
//       every user, so search rendered a fabricated "0 followers".
//
//   The shards are the source of truth. `readUserCounter` sums them (one
//   batched `getAll` RPC) and is used by the decision paths that must be
//   immediately correct. `aggregateUserCounters` is the eventual-consistency
//   mirror that writes the sum back onto `users/{uid}` so every remaining
//   reader (the search index, `socialGraphService`, the profile projection,
//   ranking/monetization) reads a real number instead of a stale zero.
//
// The shard document id layout MUST stay byte-identical to `hashString()` in
// `src/utils/CountersManager.js` (the client that writes the shards and sums
// them on read). `noFabricatedData.test.js` pins the equality.

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const COUNTER_SHARDS_COLLECTION = 'counter_shards';
const COUNTER_SHARDS = 10;
// Bounded per-run work for the mirror job (cursor-paged, like the video
// counter aggregators). One batch per run keeps the read cost predictable.
const USER_MIRROR_BATCH = 300;

// Must stay byte-identical to hashString() in src/utils/CountersManager.js:
// both sides derive the shard document id from the logical doc path.
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
 * Sum the shard documents for one user counter.
 *
 * @returns {Promise<{ value: number, found: number }>} `found` is the number of
 *   shard documents that exist. `found === 0` means the counter has never been
 *   incremented (no shards), so callers must fall back to the legacy raw field
 *   rather than reporting a real zero.
 */
async function readUserCounterShards(userId, field) {
  const docPath = `users/${userId}`;
  const refs = [];
  for (let i = 0; i < COUNTER_SHARDS; i++) refs.push(shardRef(docPath, field, i));
  // One batched round-trip for all shards (Admin SDK getAll).
  const snaps = await db.getAll(...refs);
  let value = 0;
  let found = 0;
  for (const snap of snaps) {
    if (snap.exists) {
      value += snap.data().value || 0;
      found++;
    }
  }
  return { value, found };
}

/**
 * Authoritative follower/following count for a user, resolving the legacy raw
 * field only when no shard exists (pre-shard data).
 *
 * @param {string} userId
 * @param {'followerCount'|'followingCount'} field
 * @returns {Promise<number>}
 */
async function readUserCounter(userId, field) {
  if (!userId) return 0;
  const { value, found } = await readUserCounterShards(userId, field);
  if (found > 0) return value;
  // No shards yet: the counter has never been mutated since sharding. Use the
  // stored field (0 for a new account, the real value for pre-shard data).
  const snap = await db.collection('users').doc(userId).get();
  const raw = snap.exists ? snap.data()[field] : null;
  return raw == null ? 0 : Number(raw);
}

/**
 * Scheduled mirror: write the shard sum back onto `users/{uid}` so every
 * reader that trusts the raw field (search index, profile hydration, ranking)
 * sees a real number. Only writes when the value actually changed, so the
 * `users` onWrite triggers (Algolia indexing) do not churn.
 */
exports.aggregateUserCounters = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async () => {
    const cursorRef = db.collection('system').doc('user_counter_cursor');
    const cursorSnap = await cursorRef.get();
    const lastId = cursorSnap.exists ? cursorSnap.data().lastId : null;

    let query = db.collection('users').orderBy('__name__').limit(USER_MIRROR_BATCH);
    if (lastId) {
      const lastDoc = await db.collection('users').doc(lastId).get();
      if (lastDoc.exists) query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      // A previous run finished the collection: restart from the top.
      if (lastId) await cursorRef.set({ lastId: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { processed: 0 };
    }

    let processed = 0;
    let newLastId = lastId;
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const [followers, following] = await Promise.all([
        readUserCounterShards(docSnap.id, 'followerCount'),
        readUserCounterShards(docSnap.id, 'followingCount'),
      ]);
      const patch = {};
      // Only mirror when a shard exists, so an empty shard set never overwrites
      // a real legacy value with 0.
      if (followers.found > 0 && data.followerCount !== followers.value) {
        patch.followerCount = followers.value;
      }
      if (following.found > 0 && data.followingCount !== following.value) {
        patch.followingCount = following.value;
      }
      if (Object.keys(patch).length > 0) {
        await docSnap.ref.update(patch);
      }
      newLastId = docSnap.id;
      processed++;
    }

    // End of the collection: reset the cursor so the next run starts over.
    await cursorRef.set(
      {
        lastId: snapshot.size < USER_MIRROR_BATCH ? null : newLastId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { processed };
  });

// Plain helper export (no trigger): merged-out by index.js, required in-process
// by the modules that need an immediately-correct count.
exports.readUserCounter = readUserCounter;
