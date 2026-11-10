// functions/privacyPropagation.js — keeps `posts.authorIsPrivate` in step with
// the author's `users/{uid}.isPrivate`.
//
// The post read rule gates a private account's content on a denormalised
// `authorIsPrivate` field, because Firestore rules cannot get() a user document
// while evaluating a list query. The create rule already refuses a post whose
// field disagrees with the author's real privacy. Two gaps remain, and both are
// closed here:
//
//   * posts published before this field existed carry no `authorIsPrivate`, so
//     they are unreadable to everyone but the owner (fail closed). The backfill
//     restores them.
//   * when the owner toggles privacy, already-published posts keep the old
//     value. Propagation rewrites them.
//
// Propagation is a privileged batch write, so it is a callable that rate-limits
// the caller. `propagatePostPrivacy` acts only on the caller's own posts;
// `backfillPostPrivacy` is admin-only for the one-off sweep over legacy data.

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { getUserIdFromContext, assertAdmin } = require('./auth');
const { checkRateLimit } = require('./rateLimit');
const { writeAudit } = require('./admin');

const db = admin.firestore();
const BATCH_LIMIT = 400;
const MAX_POSTS_PER_CALL = 2000;
const PRIVACY_PROPAGATION_WINDOW_MS = 60000;
const MAX_PROPAGATION_CALLS_PER_MINUTE = 10;
const MAX_BACKFILL_USERS_PER_RUN = 5000;

/**
 * Rewrite `authorIsPrivate` on a page of an author's posts when it differs from
 * `isPrivate`. Returns the number of documents actually changed.
 */
async function propagateForAuthor(authorId, isPrivate, maxPosts = MAX_POSTS_PER_CALL) {
  let updated = 0;
  let lastId = null;
  while (updated < maxPosts) {
    let q = db.collection('posts')
      .where('authorId', '==', authorId)
      .orderBy('__name__')
      .limit(BATCH_LIMIT);
    if (lastId) q = q.startAfter(lastId);
    const snap = await q.get();
    if (snap.empty) break;

    const stale = snap.docs.filter((d) => d.data().authorIsPrivate !== isPrivate);
    if (stale.length > 0) {
      const batch = db.batch();
      for (const d of stale) batch.update(d.ref, { authorIsPrivate: isPrivate });
      await batch.commit();
      updated += stale.length;
    }
    lastId = snap.docs[snap.docs.length - 1].id;
    if (snap.size < BATCH_LIMIT) break;
  }
  return updated;
}

// The caller rewrites the denormalised flag on their OWN posts. A malicious
// client cannot use this to hide another author's content because the target is
// always the caller's uid and the value is read from the caller's own user doc.
exports.propagatePostPrivacy = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'propagatePostPrivacy', MAX_PROPAGATION_CALLS_PER_MINUTE, PRIVACY_PROPAGATION_WINDOW_MS);

  const snap = await db.doc(`users/${uid}`).get();
  const isPrivate = snap.exists && snap.data().isPrivate === true;
  const updated = await propagateForAuthor(uid, isPrivate);
  return { success: true, isPrivate, updated };
});

// One-off / resumable sweep so legacy posts (published before the field existed)
// become readable again. Admin-only; paged so it can be re-run.
exports.backfillPostPrivacy = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onCall(async (data, context) => {
    await assertAdmin(context);
    const limit = Math.min(Number(data?.limit) || MAX_BACKFILL_USERS_PER_RUN, MAX_BACKFILL_USERS_PER_RUN);
    const users = await db.collection('users').orderBy('__name__').limit(limit).get();
    let postsUpdated = 0;
    let usersScanned = 0;
    for (const userDoc of users.docs) {
      usersScanned += 1;
      postsUpdated += await propagateForAuthor(userDoc.id, userDoc.data().isPrivate === true);
    }
    // Admin mutations are auditable (AGENTS.md: functions/admin.js#writeAudit).
    await writeAudit(getUserIdFromContext(context), 'backfill_post_privacy', 'posts', {
      usersScanned,
      postsUpdated,
      limit,
    }, 'system');
    return { success: true, usersScanned, postsUpdated };
  });

exports.__test__ = { propagateForAuthor };
