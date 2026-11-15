'use strict';

// Community `stats.postCount` / `stats.activityScore` writer (N451).
//
// `communities/{communityId}.stats.postCount` and `.stats.activityScore` are
// seeded in `functions/communities.js#createCommunity` (0 and 100) and were
// incremented by `createCommunityPost` (+1 / +10) — but NOTHING ever
// decremented them. Deleting a community post (author delete, batch delete or
// admin removal), moving a post to another community, or unpublishing one left
// the counters pointing at content that no longer exists, so both numbers
// drifted upward forever. `CommunityDetailScreen` renders `stats.postCount` as
// the community's "Posts" card and `communityService.getCommunityStats` reads
// both, so the drift was user-visible — the same "counter with no (decrement)
// writer" class as the follower counters (N431), post engagement counters
// (N433) and the community event counter (N434).
//
// The community document is server-write-only, so the derived counters are
// maintained here as a NET-DELTA document trigger on `posts/{postId}`: a post
// counts toward its community while it is a live, published community post, so
// a create/publish is `+1`, a delete/unpublish is `-1`, and a re-write that
// leaves the post's liveness unchanged (a like/comment/view update) cancels to
// zero — no community is read or written for those.
//
// A forged `communityId` cannot inflate a foreign community: the delta is only
// applied for a community the post's author is actually a member of (the
// counter-forgery guard, identical in spirit to `eventCounters.js`).

const functions = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// A community's "Posts" card counts posts a member can see in the community
// list (`communityService.getCommunityPosts`): a live, published community post
// — not a draft, not a pending-approval post, not a deleted one. This is the
// same predicate the list and `getCommunityStats` queries use, so the number
// and the list agree.
function countsAsCommunityPost(post) {
  if (!post) return false;
  return typeof post.communityId === 'string' && post.communityId !== '' &&
    post.visibility === 'community' &&
    post.status === 'published' &&
    post.isDeleted === false;
}

function communityIdOf(post) {
  if (!post) return null;
  return typeof post.communityId === 'string' && post.communityId ? post.communityId : null;
}

exports.onCommunityPostWrite = functions.firestore
  .document('posts/{postId}')
  .onWrite(async (change) => {
    const before = change.before.exists ? change.before.data() : null;
    const after = change.after.exists ? change.after.data() : null;

    // Net delta per community: -1 if the post counted before, +1 if it counts
    // after. A community change (or a soft delete/unpublish) is handled by the
    // same delta.
    const deltas = new Map();
    const bump = (communityId, delta) => {
      if (!communityId || delta === 0) return;
      deltas.set(communityId, (deltas.get(communityId) || 0) + delta);
    };
    if (countsAsCommunityPost(before)) bump(communityIdOf(before), -1);
    if (countsAsCommunityPost(after)) bump(communityIdOf(after), +1);

    // A re-write that leaves the post's liveness unchanged (a like/comment/view
    // update) cancels to a zero delta: drop those so no community doc is read
    // or written.
    const entries = [...deltas.entries()].filter(([, delta]) => delta !== 0);
    if (entries.length === 0) return;

    const authorId = (after && after.authorId) || (before && before.authorId) || null;

    // Only update communities that still exist: an update to a missing doc
    // would fail the whole batch.
    const ids = entries.map(([communityId]) => communityId);
    const snaps = await db.getAll(...ids.map((id) => db.collection('communities').doc(id)));

    const batch = db.batch();
    let writes = 0;
    snaps.forEach((snap, i) => {
      if (!snap.exists) return;
      // Only a member's post counts toward the community (forgery guard): a
      // client cannot point a post at a foreign community to inflate its
      // counter. A decrement for a community the author has since left is still
      // skipped here, mirroring `eventCounters.js`; `reconcileCommunityPostCounts`
      // heals any such drift.
      if (authorId && !((snap.data().members || {})[authorId])) return;
      const delta = deltas.get(ids[i]);
      if (!delta) return;
      batch.update(snap.ref, {
        'stats.postCount': FieldValue.increment(delta),
        'stats.activityScore': FieldValue.increment(delta * 10),
        updatedAt: FieldValue.serverTimestamp(),
      });
      writes += 1;
    });
    if (writes > 0) await batch.commit();
  });

const RECONCILE_BATCH = 200;

/**
 * Reconcile `communities/{id}.stats.postCount` against the community's real
 * posts.
 *
 * The trigger keeps the counters correct from now on, but every community that
 * received a post before it existed carries drift (the count was only ever
 * incremented). This cursor-paged job recomputes the true value (a bounded
 * `count()` over `posts where communityId == id`, no scan) and writes it only
 * when it differs, so a steady-state run costs one read per community and no
 * writes. `activityScore` is rebased from the same delta the count moved by
 * (the seed is 100 and each post adds 10), so a corrected count and score stay
 * consistent.
 */
exports.reconcileCommunityPostCounts = functions.pubsub
  .schedule('every 6 hours')
  .onRun(async () => {
    const cursorRef = db.collection('system').doc('community_post_count_cursor');
    const cursorSnap = await cursorRef.get();
    const lastId = cursorSnap.exists ? cursorSnap.data().lastId : null;

    let query = db.collection('communities').orderBy('__name__').limit(RECONCILE_BATCH);
    if (lastId) {
      const lastDoc = await db.collection('communities').doc(lastId).get();
      if (lastDoc.exists) query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      if (lastId) await cursorRef.set({ lastId: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { processed: 0 };
    }

    let processed = 0;
    let reconciled = 0;
    let newLastId = lastId;
    for (const docSnap of snapshot.docs) {
      const countSnap = await db.collection('posts')
        .where('communityId', '==', docSnap.id)
        .where('visibility', '==', 'community')
        .where('status', '==', 'published')
        .where('isDeleted', '==', false)
        .count()
        .get();
      const real = countSnap.data().count;
      const stored = docSnap.data().stats?.postCount;
      if (stored !== real) {
        const delta = real - (typeof stored === 'number' ? stored : 0);
        await docSnap.ref.update({
          'stats.postCount': real,
          'stats.activityScore': FieldValue.increment(delta * 10),
          updatedAt: FieldValue.serverTimestamp(),
        });
        reconciled += 1;
      }
      newLastId = docSnap.id;
      processed++;
    }

    await cursorRef.set(
      {
        lastId: snapshot.size < RECONCILE_BATCH ? null : newLastId,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return { processed, reconciled };
  });
