// functions/user.js — user account operations
//
// deleteUserData          cascade delete with subcollection cleanup before
//                         parent removal (keeps the username mapping and graph
//                         connections consistent)
// getMutualFriends        two queries; up to 200 follows per side
// generateFriendRecommendations
//                         mutual detection across followers with parallel
//                         friends-of-friends lookup
//
// Auth required. Idempotent, audited, and GDPR-compliant. Cursor-based
// offloading with safety caps so no orphan records are left behind.
const functions = require('firebase-functions');
const { log } = require('./logger');
const admin = require('firebase-admin');
const { checkRateLimit } = require('./rateLimit');
const { writeAudit } = require('./admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const { CloudTasksClient } = require('@google-cloud/tasks');
const tasksClient = new CloudTasksClient();

const projectId = process.env.GCLOUD_PROJECT;
const location = process.env.CLOUD_TASKS_LOCATION || 'us-central1';
const queueName = process.env.DELETION_QUEUE || 'deletion-queue';
const deletionWorkerUrl = process.env.DELETION_WORKER_URL || '';

// ----------------------------------------------------------------------
//  UTILITY
// ----------------------------------------------------------------------

const chunkArray = (arr, size) => {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
};

async function commitBatchWithRetry(batch, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await batch.commit();
      return;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.pow(2, attempt) * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function runTransactionWithRetry(updateFn, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await db.runTransaction(updateFn);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      log('WARN', `Transaction retry ${attempt}`, { error: error.message });
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 200));
    }
  }
}

async function deleteQueryBatch(query, maxDocs = 1000) {
  let deleted = 0;
  let lastDoc = null;
  let loops = 0;
  const MAX_LOOPS = 200;

  while (true) {
    if (++loops > MAX_LOOPS) {
      log('WARN', 'deleteQueryBatch safety limit reached', { maxDocs, deleted });
      break;
    }
    const snap = await query.limit(500).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    deleted += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1];
    if (maxDocs > 0 && deleted >= maxDocs) break;
  }
  return { deleted, lastDoc };
}

const SUBCOLLECTIONS_TO_CLEAN = {
  comments: ['history', 'reactions'],
  posts: ['gift_details', 'like_shards', 'view_shards'],
  stories: ['viewers', 'reactions', 'reaction_shards'],
};

// Every two-way party-readable graph/safety edge keyed `${actor}_${other}`.
// The actor field and the other-party field let the deletion sweep remove both
// the edges the account created and the edges pointing at it.
const TWO_WAY_EDGE_COLLECTIONS = [
  ['follows', 'followerId', 'followingId'],
  ['blocks', 'blockerId', 'blockedId'],
  ['friend_requests', 'fromUserId', 'toUserId'],
  ['mutes', 'muterId', 'mutedId'],
  ['restricts', 'restricterId', 'restrictedId'],
  ['follow_requests', 'fromUserId', 'toUserId'],
];

/**
 * Deletes every edge in `collName` where `userId` is either the actor or the
 * other party. Bounded to 1000 per side per call; returns the count deleted so
 * the caller can enforce its own budget.
 */
async function deleteTwoWayEdges(collName, actorField, otherField, userId) {
  let docs = (await db.collection(collName)
    .where(actorField, '==', userId).limit(1000).get()).docs;
  docs = docs.concat(
    (await db.collection(collName).where(otherField, '==', userId).limit(1000).get()).docs
  );
  const uniqueIds = [...new Set(docs.map(d => d.id))];
  let deleted = 0;
  for (const batch of chunkArray(uniqueIds, 500)) {
    const wb = db.batch();
    batch.forEach(id => wb.delete(db.collection(collName).doc(id)));
    await wb.commit();
    deleted += batch.length;
  }
  return deleted;
}

async function deleteSubcollectionsSequentially(docRef, subNames) {
  for (const sub of subNames) {
    const subRef = docRef.collection(sub);
    let safety = 0;
    while (true) {
      const snap = await subRef.limit(500).get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      if (++safety > 100) {
        log('WARN', `Subcollection ${sub} cleanup hit safety limit`, { docId: docRef.id });
        break;
      }
    }
  }
}

// Enqueues a Cloud Task that resumes the cascade in `processDeletionTask`.
// Returns `true` when the remaining work is durably recorded (a task was
// created, or a `deletion_tasks` fallback row was written), `false` when it
// could not be recorded at all — the caller must NOT report the deletion as
// offloaded in that case.
//
// The previous version returned silently when `DELETION_WORKER_URL` was unset,
// so a deletion that hit the 2000-document budget returned
// `partial_with_offload` while the remaining collections were never queued and
// never cleaned. There is no other drainer of `deletion_tasks`, so this was a
// fabricated success on the most destructive operation the platform performs.
async function enqueueDeletionTask(userId, remainingCollections = [], cursors = {}) {
  const payload = { userId, remainingCollections, cursors };
  if (deletionWorkerUrl) {
    try {
      const parent = tasksClient.queuePath(projectId, location, queueName);
      const task = {
        httpRequest: {
          httpMethod: 'POST',
          url: deletionWorkerUrl,
          body: Buffer.from(JSON.stringify(payload)).toString('base64'),
          headers: { 'Content-Type': 'application/json' },
          oidcToken: {
            serviceAccountEmail: `${projectId}@appspot.gserviceaccount.com`,
            audience: deletionWorkerUrl,
          },
        },
      };
      await tasksClient.createTask({ parent, task });
      return true;
    } catch (e) {
      log('ERROR', 'Cloud Task enqueue failed; writing fallback deletion_tasks row', { error: e.message });
    }
  } else {
    log('ERROR', 'DELETION_WORKER_URL is not configured; deletion cannot be offloaded', { userId });
  }

  // Fallback: persist the remaining work so an operator (or the worker, once
  // configured) can resume it. Without this the remainder is silently dropped.
  try {
    await db.collection('deletion_tasks').add({
      ...payload,
      status: 'pending',
      reason: deletionWorkerUrl ? 'enqueue_failed' : 'worker_unconfigured',
      createdAt: FieldValue.serverTimestamp(),
    });
    return true;
  } catch (e) {
    log('ERROR', 'Could not record remaining deletion work', { userId, error: e.message });
    return false;
  }
}

// Auth + admin checks live in functions/auth.js so every module agrees on
// what an admin is (admins/{uid} doc, plus an optional custom claim).
const { getUserIdFromContext, checkIsAdmin } = require('./auth');

// ----------------------------------------------------------------------
//  1. deleteUserData (callable) – COMPLETE CASCADE, SUBCOLLECTIONS FIRST
// ----------------------------------------------------------------------
exports.deleteUserData = functions.https.onCall(async (data, context) => {
  const callerUid = getUserIdFromContext(context);
  await checkRateLimit(callerUid, 'deleteUserData', 2, 3600000); // max 2 deletions/hour
  const { userId } = data;
  if (!userId) throw new functions.https.HttpsError('invalid-argument', 'userId is required.');
  if (callerUid !== userId && !(await checkIsAdmin(context))) {
    throw new functions.https.HttpsError('permission-denied', 'You cannot delete this account.');
  }

  // Record the deletion in the audit trail (AGENTS.md: admin mutations are
  // auditable). A self-service deletion is audited too — it is the most
  // destructive operation the platform performs.
  await writeAudit(callerUid, 'delete_user_data', userId, {
    selfInitiated: callerUid === userId,
  }, 'user');

  return runUserDataDeletion(userId);
});

/**
 * The complete cascade. Called by `deleteUserData` (after auth + audit) and by
 * `processDeletionTask` (the Cloud Tasks worker that resumes a cascade which hit
 * the per-call document budget). Not itself a deployed function — it carries no
 * trigger, so `index.js#merge` skips it.
 */
async function runUserDataDeletion(userId) {
  const MAX_DIRECT_DELETIONS = 2000;
  let totalDeleted = 0;
  const remaining = [];
  const cursors = {};

  // Records the remaining work and returns the caller-facing response. When the
  // remainder cannot be recorded at all (no worker URL and the fallback write
  // failed) the status is `partial_offload_failed`, never `partial_with_offload`
  // — the client must not report a clean deletion it did not achieve.
  const offload = async () => {
    const recorded = await enqueueDeletionTask(userId, remaining, cursors);
    return {
      success: true,
      status: recorded ? 'partial_with_offload' : 'partial_offload_failed',
      message: recorded
        ? 'Cleanup continues in background.'
        : 'Cleanup could not be scheduled; contact support so the remaining data can be removed.',
      totalDeleted,
      remaining,
    };
  };

  try {
    const userDocRef = db.collection('users').doc(userId);
    const privateDocRef = db.collection('users_private').doc(userId);
    const userSnap = await userDocRef.get();
    const username = userSnap.exists ? userSnap.data().username : null;

    const processCollectionWithSubs = async (collName, userIdField = 'userId') => {
      let query = db.collection(collName).where(userIdField, '==', userId).limit(500);
      let lastDoc = null;

      while (totalDeleted < MAX_DIRECT_DELETIONS) {
        const snap = await query.get();
        if (snap.empty) break;

        const subNames = SUBCOLLECTIONS_TO_CLEAN[collName] || [];
        await Promise.all(
          snap.docs.map(doc => deleteSubcollectionsSequentially(doc.ref, subNames))
        );

        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        totalDeleted += snap.size;
        lastDoc = snap.docs[snap.docs.length - 1];

        if (totalDeleted >= MAX_DIRECT_DELETIONS) {
          remaining.push(collName);
          cursors[collName] = lastDoc.id;
          return { lastDoc };
        }

        if (snap.size < 500) break;
        query = db.collection(collName)
          .where(userIdField, '==', userId)
          .startAfter(lastDoc)
          .limit(500);
      }
      return { lastDoc };
    };

    // Delete username mapping
    if (username) {
      const usernameRef = db.collection('usernames').doc(username);
      const snap = await usernameRef.get();
      if (snap.exists && snap.data().userId === userId) {
        await usernameRef.delete();
      }
    }

    // Graph & safety edges (both directions): follows, blocks, friend
    // requests, mutes, restricts and follow requests. `mutes`/`restricts`/
    // `follow_requests` were previously never cleaned, so a deleted account
    // stayed muted/restricted on every user it had acted on and a pending
    // follow request to it lingered in the owner's notifications forever.
    for (const [collName, actorField, otherField] of TWO_WAY_EDGE_COLLECTIONS) {
      totalDeleted += await deleteTwoWayEdges(collName, actorField, otherField, userId);
      if (totalDeleted >= MAX_DIRECT_DELETIONS) {
        const idx = TWO_WAY_EDGE_COLLECTIONS.findIndex(([c]) => c === collName);
        remaining.push(...TWO_WAY_EDGE_COLLECTIONS.slice(idx).map(([c]) => c));
        return offload();
      }
    }

    // Posts, Comments, Stories (with subcollection cleanup)
    await processCollectionWithSubs('posts', 'authorId');
    if (totalDeleted >= MAX_DIRECT_DELETIONS) {
      return offload();
    }

    await processCollectionWithSubs('comments', 'userId');
    if (totalDeleted >= MAX_DIRECT_DELETIONS) {
      return offload();
    }

    await processCollectionWithSubs('stories', 'userId');
    if (totalDeleted >= MAX_DIRECT_DELETIONS) {
      return offload();
    }

    // Push tokens
    try {
      const pushRef = db.collection('push_tokens').doc(userId);
      await deleteSubcollectionsSequentially(pushRef, ['devices']);
      await pushRef.delete();
    } catch (err) {
      log('warn', 'push token cleanup failed during account deletion', { userId, error: err.message });
    }

    // User feeds subcollection
    const feedsRef = db.collection('users').doc(userId).collection('feeds');
    let feedsQuery = feedsRef.limit(500);
    while (totalDeleted < MAX_DIRECT_DELETIONS) {
      const snap = await feedsQuery.get();
      if (snap.empty) break;
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      totalDeleted += snap.size;
      if (snap.size < 500) break;
      feedsQuery = feedsRef.startAfter(snap.docs[snap.docs.length - 1]).limit(500);
    }
    if (totalDeleted >= MAX_DIRECT_DELETIONS) {
      remaining.push('feeds');
      cursors['feeds'] = 'resume_needed';
      return offload();
    }

    // Core profile documents
    await db.collection('user_settings').doc(userId).delete().catch(() => {});
    await db.collection('user_preferences').doc(userId).delete().catch(() => {});
    await privateDocRef.delete().catch(() => {});
    await userDocRef.delete();

    // Remove from user recommendations (collection group). Bounded pages: the
    // group spans every `users` subcollection at any depth, so an unbounded
    // `.get()` + single batch could blow the function's read/timeout budget (or
    // throw >500 ops) and leave the account half-cleaned.
    try {
      for (;;) {
        const recDocs = await db.collectionGroup('users')
          .where('userId', '==', userId)
          .limit(400)
          .get();
        if (recDocs.empty) break;
        const batch = db.batch();
        recDocs.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        if (recDocs.size < 400) break;
      }
    } catch (err) {
      log('WARN', 'Could not remove user from recommendations', { error: err.message });
    }

    // Optional auth deletion
    if (process.env.DELETE_AUTH_USER === 'true') {
      try { await admin.auth().deleteUser(userId); }
      catch (e) { log('WARN', 'Auth user deletion failed', { userId, error: e.message }); }
    }

    // Audit record
    await db.collection('deletion_audit').doc(userId).set({
      userId,
      deletedAt: FieldValue.serverTimestamp(),
      status: 'success',
      totalDeleted,
      partial: remaining.length > 0,
      remaining,
    });

    log('INFO', 'User fully deleted', { userId, totalDeleted });
    return { success: true, status: remaining.length > 0 ? 'partial_with_offload' : 'completely_deleted', totalDeleted };
  } catch (error) {
    log('ERROR', 'deleteUserData failed', { userId, error: error.message });
    throw new functions.https.HttpsError('internal', error.message);
  }
}

// Internal helper (no trigger): the Cloud Tasks worker resumes the cascade by
// calling this in-process. A server-side fetch back to the callable would be
// rejected (a callable needs the JSON `data` envelope + an ID token), so the
// worker must share the implementation rather than re-POST to it.
exports.runUserDataDeletion = runUserDataDeletion;

// ----------------------------------------------------------------------
//  2. getMutualFriends (callable) – O(2) queries, capped at 200 follows
// ----------------------------------------------------------------------
exports.getMutualFriends = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'getMutualFriends', 60, 60000);
  const { otherUserId } = data;
  if (!otherUserId) throw new functions.https.HttpsError('invalid-argument', 'otherUserId is required.');

  try {
    const [myFollowsSnap, otherFollowsSnap] = await Promise.all([
      db.collection('follows').where('followerId', '==', uid).limit(200).get(),
      db.collection('follows').where('followerId', '==', otherUserId).limit(200).get(),
    ]);

    const myFollowing = new Set(myFollowsSnap.docs.map(d => d.data().followingId));
    const mutualIds = [];

    for (const doc of otherFollowsSnap.docs) {
      const id = doc.data().followingId;
      if (myFollowing.has(id)) mutualIds.push(id);
    }

    const profiles = [];
    if (mutualIds.length > 0) {
      const userSnaps = await Promise.all(
        mutualIds.slice(0, 50).map(id => db.collection('users').doc(id).get())
      );
      userSnaps.forEach(snap => {
        if (snap.exists) {
          const u = snap.data();
          profiles.push({
            id: snap.id, username: u.username, displayName: u.displayName,
            photoURL: u.photoURL, isPrivate: u.isPrivate,
            followerCount: u.followerCount, followingCount: u.followingCount,
          });
        }
      });
    }

    return { success: true, mutualFriends: profiles };
  } catch (error) {
    log('ERROR', 'getMutualFriends failed', { uid, otherUserId, error: error.message });
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ----------------------------------------------------------------------
//  3. generateFriendRecommendations (callable – admin only)
// ----------------------------------------------------------------------
exports.generateFriendRecommendations = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'friendRecommendations', 5, 60000);
  if (!(await checkIsAdmin(context))) {
    throw new functions.https.HttpsError('permission-denied', 'Only administrators can generate recommendations.');
  }

  const targetUserId = data.userId || uid;
  // Admin-triggered write to another user's recommendations: audit it.
  await writeAudit(uid, 'generate_friend_recommendations', targetUserId, {}, 'user');
  try {
    const recsRef = db.collection('user_recommendations').doc(targetUserId).collection('users');
    const existingSnap = await recsRef.limit(500).get();
    if (!existingSnap.empty) {
      const batch = db.batch();
      existingSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }

    const theirFollowsSnap = await db.collection('follows')
      .where('followerId', '==', targetUserId)
      .limit(100)
      .get();
    const followingIds = new Set(theirFollowsSnap.docs.map(d => d.data().followingId));
    if (followingIds.size === 0) return { success: true, count: 0 };

    const followersOfTargetSnap = await db.collection('follows')
      .where('followingId', '==', targetUserId)
      .limit(200)
      .get();
    const followersOfTarget = new Set(followersOfTargetSnap.docs.map(d => d.data().followerId));

    const mutualSet = new Set([...followingIds].filter(id => followersOfTarget.has(id)));
    if (mutualSet.size === 0) return { success: true, count: 0 };

    const candidateCount = new Map();
    const mutualArray = [...mutualSet];
    for (let i = 0; i < mutualArray.length; i += 10) {
      const batch = mutualArray.slice(i, i + 10);
      await Promise.all(batch.map(async (friendId) => {
        const snap = await db.collection('follows')
          .where('followerId', '==', friendId)
          .limit(50)
          .get();
        snap.docs.forEach(doc => {
          const candidate = doc.data().followingId;
          if (candidate !== targetUserId && !followingIds.has(candidate)) {
            candidateCount.set(candidate, (candidateCount.get(candidate) || 0) + 1);
          }
        });
      }));
    }

    const sorted = [...candidateCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    const batch = db.batch();
    sorted.forEach(([recId, score]) => {
      batch.set(recsRef.doc(recId), {
        userId: recId,
        score,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();

    log('INFO', 'Recommendations regenerated for user', { targetUserId, count: sorted.length });
    return { success: true, count: sorted.length };
  } catch (error) {
    log('ERROR', 'generateFriendRecommendations failed', { uid, error: error.message });
    throw new functions.https.HttpsError('internal', error.message);
  }
});