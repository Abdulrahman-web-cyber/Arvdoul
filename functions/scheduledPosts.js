// functions/scheduledPosts.js — publish due scheduled posts (N377)
//
// The composer has always let a user schedule a post: `firestoreService`
// stamps a future `scheduledTime` and writes `status: 'scheduled'`. Nothing
// ever flipped that status, so a "scheduled" post stayed `status == 'scheduled'`
// forever — invisible to every feed (which requires `status == 'published'`)
// and to the author. This scheduled job is that missing writer.
//
// Design:
//  - Bounded, index-backed query: `status == 'scheduled'` +
//    `scheduledTime <= now`, ordered by `scheduledTime` asc, `limit`ed, with
//    cursor-free re-runs every 5 minutes (a batch that fills the limit is
//    drained on the next tick).
//  - Admin SDK writes (rules are not in play), so a post whose author has since
//    gone private is still published with the correct `authorIsPrivate` gate
//    intact for readers.
//  - Idempotent notification: the in-app notification doc id is deterministic
//    and created with `create()` (throws ALREADY_EXISTS), so a retried run does
//    not double-notify or double-count.

const functions = require('firebase-functions');
const { log } = require('./logger');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const FieldValue = admin.firestore.FieldValue;

const DUE_BATCH_LIMIT = 50;
const NOTIFICATION_SHARDS = 10;


/**
 * Best-effort author notification that a scheduled post went live. Idempotent:
 * the notification doc id is derived from the post id and written with
 * `create()`, so a re-run is a no-op.
 */
async function notifyAuthorPublished(postId, authorId) {
  const notifId = `scheduled_published_${postId}`;
  const notifRef = db.collection('users').doc(authorId).collection('notifications').doc(notifId);
  try {
    await notifRef.create({
      id: notifId,
      type: 'system',
      title: 'Your scheduled post is live',
      message: 'The post you scheduled has been published.',
      read: false,
      clicked: false,
      senderId: null,
      senderName: null,
      metadata: { postId },
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    // ALREADY_EXISTS => a previous run already notified; anything else is a
    // real failure but must not block the publish itself.
    if (err && err.code !== 6) {
      log('WARNING', 'Scheduled-post notification failed', { postId, authorId, error: err.message });
    }
    return;
  }

  const shardIndex = Math.floor(Math.random() * NOTIFICATION_SHARDS);
  try {
    await db.collection('notification_counters').doc(`${authorId}_shard_${shardIndex}`)
      .set({ count: FieldValue.increment(1) }, { merge: true });
  } catch (err) {
    log('WARNING', 'Scheduled-post unread counter failed', { postId, authorId, error: err.message });
  }

  try {
    await db.collection('push_queue').doc(`push_${notifId}`).set({
      userId: authorId,
      payload: {
        title: 'Your scheduled post is live',
        body: 'Tap to view it.',
        type: 'system',
        targetId: postId,
        priority: 'normal',
      },
      status: 'pending',
      retries: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    log('WARNING', 'Scheduled-post push enqueue failed', { postId, authorId, error: err.message });
  }
}

exports.publishScheduledPosts = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    let published = 0;
    let failed = 0;

    let snap;
    try {
      snap = await db.collection('posts')
        .where('status', '==', 'scheduled')
        .where('scheduledTime', '<=', now)
        .orderBy('scheduledTime', 'asc')
        .limit(DUE_BATCH_LIMIT)
        .get();
    } catch (err) {
      log('ERROR', 'Scheduled-post scan failed', { error: err.message });
      return null;
    }

    if (snap.empty) return null;

    for (const doc of snap.docs) {
      const post = doc.data();
      // A soft-deleted or moderation-hidden post must not be revived.
      if (post.isDeleted === true || post.moderationStatus === 'removed' || post.isHidden === true) {
        continue;
      }
      try {
        await doc.ref.update({
          status: 'published',
          publishedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        published += 1;
        if (post.authorId) {
          await notifyAuthorPublished(doc.id, post.authorId);
        }
      } catch (err) {
        failed += 1;
        log('ERROR', 'Scheduled-post publish failed', { postId: doc.id, error: err.message });
      }
    }

    log('INFO', 'Scheduled-post batch completed', { published, failed, scanned: snap.size });
    return null;
  });
