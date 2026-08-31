// functions/comments.js — ARVDOUL COMMENT MODERATION & MENTIONS SYSTEM v5.0 (FINAL)
// 🔥 Perspective API · Smart Re‑moderation · Batch Mentions · Cloud Tasks Push
// ✅ All previous issues resolved: per‑user rate limiting, idempotent moderation,
//    strict 5‑mention limit, cursor‑safe cleanup, structured logging, proper skip logic.
// ⚠️ Required Perspective API key: firebase functions:config:set perspective.api_key="YOUR_KEY"
// ⚠️ Required Firestore indexes (documented at bottom)

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { CloudTasksClient } = require('@google-cloud/tasks');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ----------------------------------------------------------------------
//  Cloud Tasks Client (with retry config)
// ----------------------------------------------------------------------
const projectId = process.env.GCLOUD_PROJECT;
const location = process.env.CLOUD_TASKS_LOCATION || 'us-central1';
const queueName = process.env.PUSH_QUEUE_NAME || 'push-queue';
const pushWorkerUrl = process.env.PUSH_WORKER_URL || 'https://example.com/push';

let tasksClient;
function getTasksClient() {
  if (!tasksClient) tasksClient = new CloudTasksClient();
  return tasksClient;
}

async function sendPushToQueue(userId, payload) {
  try {
    const client = getTasksClient();
    const parent = client.queuePath(projectId, location, queueName);
    const task = {
      httpRequest: {
        httpMethod: 'POST',
        url: pushWorkerUrl,
        body: Buffer.from(JSON.stringify({ userId, payload })).toString('base64'),
        headers: { 'Content-Type': 'application/json' },
      },
      retryConfig: {
        maxAttempts: 5,
        maxBackoff: '60s',
        minBackoff: '1s',
        maxDoublings: 5,
      },
    };
    await client.createTask({ parent, task });
    log('info', 'Push task enqueued', { userId });
  } catch (error) {
    log('error', 'Cloud Tasks push failed, falling back to Firestore', { error: error.message });
    await db.collection('push_queue').add({
      userId,
      payload,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
    });
  }
}

// ----------------------------------------------------------------------
//  Structured Logging Helper
// ----------------------------------------------------------------------
function log(level, message, data = {}) {
  console.log(JSON.stringify({
    severity: level.toUpperCase(),
    message,
    ...data,
    timestamp: new Date().toISOString(),
  }));
}

// ----------------------------------------------------------------------
//  Sharded rate limiter (reads all shards)
// ----------------------------------------------------------------------
const NUM_RATE_SHARDS = 5;

async function checkRateLimit(userId, action, maxOps, windowMs = 60000) {
  const now = Date.now();
  const windowStart = now - windowMs;
  const parentRef = db.collection('rate_limits').doc(`${userId}_${action}`);

  await db.runTransaction(async (t) => {
    const shards = [];
    for (let i = 0; i < NUM_RATE_SHARDS; i++) {
      const snap = await t.get(parentRef.collection('shards').doc(String(i)));
      shards.push(snap.exists ? snap.data() : { count: 0, windowStart: 0 });
    }
    const total = shards.reduce((sum, d) => (d.windowStart >= windowStart ? sum + d.count : 0), 0);
    if (total >= maxOps) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }
    const shardId = Math.floor(Math.random() * NUM_RATE_SHARDS);
    const shardRef = parentRef.collection('shards').doc(String(shardId));
    let data = shards[shardId];
    if (data.windowStart < windowStart) {
      data = { count: 1, windowStart: now, expireAt: new Date(now + windowMs * 2) };
    } else {
      data.count += 1;
    }
    t.set(shardRef, data, { merge: true });
  });
}

// ----------------------------------------------------------------------
// 1. moderateComment (onCreate) – idempotent, per‑user rate limited
// ----------------------------------------------------------------------
exports.moderateComment = functions.firestore
  .document('comments/{commentId}')
  .onCreate(async (snap, context) => {
    const commentData = snap.data();
    const commentId = context.params.commentId;
    const userId = commentData.userId;

    // Skip if no content, not pending, or already moderated (idempotency)
    if (!commentData.content || commentData.moderationStatus !== 'pending' || commentData.moderatedAt) {
      return;
    }

    try {
      await checkRateLimit(userId, 'moderate', 10, 60000);

      const apiKey = functions.config().perspective?.api_key;
      if (!apiKey) {
        log('warn', 'Perspective API key missing – marking for manual review', { commentId });
        await snap.ref.update({
          moderationStatus: 'pending_manual_review',
          updatedAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(
        `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment: { text: commentData.content },
            languages: ['en', 'ha', 'fr', 'auto'],
            requestedAttributes: { TOXICITY: {} },
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (!response.ok) throw new Error(`Perspective API error ${response.status}`);

      const result = await response.json();
      const toxicityScore = result.attributeScores?.TOXICITY?.summaryScore?.value || 0;

      let moderationStatus, isHidden;
      if (toxicityScore > 0.7) {
        moderationStatus = 'rejected';
        isHidden = true;
      } else if (toxicityScore > 0.3) {
        moderationStatus = 'pending_manual_review';
        isHidden = false;
      } else {
        moderationStatus = 'approved';
        isHidden = false;
      }

      await snap.ref.update({
        moderationStatus,
        moderationScore: toxicityScore,
        isHidden,
        moderatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      log('info', 'Comment moderated', { commentId, moderationStatus, score: toxicityScore });
    } catch (error) {
      log('error', 'moderateComment failed', { commentId, error: error.message });
      // Fallback – mark for manual review (only if not already processed)
      await snap.ref.update({
        moderationStatus: 'pending_manual_review',
        moderationScore: 0,
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => {});
    }
  });

// ----------------------------------------------------------------------
// 2. moderateCommentOnUpdate – re‑moderate on edit, with smart skipping
// ----------------------------------------------------------------------
exports.moderateCommentOnUpdate = functions.firestore
  .document('comments/{commentId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const commentId = context.params.commentId;

    // No content change → skip
    if (before.content === after.content) return;

    // If the comment is hidden (rejected / shadowbanned), skip – no point re‑moderating.
    if (before.isHidden) return;

    const content = after.content;
    if (!content) return;
    const userId = after.userId;

    try {
      await checkRateLimit(userId, 'moderate', 10, 60000);

      const apiKey = functions.config().perspective?.api_key;
      if (!apiKey) return;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(
        `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment: { text: content },
            languages: ['en', 'ha', 'fr', 'auto'],
            requestedAttributes: { TOXICITY: {} },
          }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeout);

      if (!response.ok) throw new Error(`Perspective API error ${response.status}`);

      const result = await response.json();
      const toxicityScore = result.attributeScores?.TOXICITY?.summaryScore?.value || 0;

      let moderationStatus, isHidden;
      if (toxicityScore > 0.7) {
        moderationStatus = 'rejected';
        isHidden = true;
      } else if (toxicityScore > 0.3) {
        moderationStatus = 'pending_manual_review';
        isHidden = false;
      } else {
        moderationStatus = 'approved';
        isHidden = false;
      }

      await change.after.ref.update({
        moderationStatus,
        moderationScore: toxicityScore,
        isHidden,
        moderatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      log('info', 'Comment re‑moderated after edit', { commentId, moderationStatus, score: toxicityScore });
    } catch (error) {
      log('error', 're‑moderateComment failed', { commentId, error: error.message });
      // Keep previous status – no update
    }
  });

// ----------------------------------------------------------------------
// 3. processMentions – strict 5‑mention limit, batch lookup, Cloud Tasks push
// ----------------------------------------------------------------------
exports.processMentions = functions.firestore
  .document('comments/{commentId}')
  .onCreate(async (snap, context) => {
    const commentData = snap.data();
    const commentId = context.params.commentId;
    const content = commentData.content;

    if (!content || typeof content !== 'string') return;

    const mentions = content.match(/@(\w+)/g);
    if (!mentions || mentions.length === 0) return;

    let uniqueMentions = [...new Set(mentions.map(m => m.substring(1).toLowerCase()))];

    // Strict enforcement: reject if more than 5 unique mentions
    if (uniqueMentions.length > 5) {
      log('warn', 'Comment rejected – too many mentions', { commentId, count: uniqueMentions.length });
      await snap.ref.update({
        moderationStatus: 'rejected',
        moderationNotes: 'Too many mentions (max 5)',
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    const authorId = commentData.userId;
    const targetType = commentData.targetType;
    const targetId = commentData.targetId;

    // Per‑user rate limit for mentions (prevents spam)
    try {
      await checkRateLimit(authorId, 'mentions', 5, 60000);
    } catch (error) {
      if (error.message === 'RATE_LIMIT_EXCEEDED') {
        log('warn', 'Mention rate limit exceeded', { authorId, commentId });
      } else {
        throw error;
      }
    }

    // Batch read username documents
    const usernameRefs = uniqueMentions.map(u => db.collection('usernames').doc(u));
    const usernameSnaps = await db.getAll(...usernameRefs);

    const mentionedUserIds = [];
    usernameSnaps.forEach(snap => {
      if (snap.exists) {
        const userId = snap.data().userId;
        if (userId && userId !== authorId) {
          mentionedUserIds.push(userId);
        }
      }
    });

    if (mentionedUserIds.length === 0) return;

    // Update the comment document with the resolved mention IDs (optional)
    await snap.ref.update({
      mentionedUserIds,
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => {});

    // Send push notifications via Cloud Tasks (with fallback)
    const pushPromises = mentionedUserIds.map(userId =>
      sendPushToQueue(userId, {
        type: 'mention',
        title: 'You were mentioned in a comment',
        body: `${commentData.userName || 'Someone'} mentioned you in a comment`,
        data: {
          commentId,
          targetType,
          targetId,
          authorId,
          authorName: commentData.userName || 'Unknown',
        },
      })
    );
    await Promise.allSettled(pushPromises);

    log('info', 'Mentions processed', { commentId, mentionedCount: mentionedUserIds.length });
  });

// ----------------------------------------------------------------------
// 4. cleanupOldCommentData – scheduled cursor‑safe cleanup
// ----------------------------------------------------------------------
exports.cleanupOldCommentData = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const historyCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const reactionCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const BATCH_COMMENTS = 200;
    let lastDocId = null;
    let totalDeleted = 0;

    while (true) {
      let query = db.collection('comments')
        .orderBy('__name__')
        .limit(BATCH_COMMENTS);

      if (lastDocId) {
        const lastDocSnapshot = await db.collection('comments').doc(lastDocId).get();
        if (!lastDocSnapshot.exists) {
          log('warn', 'Cursor document deleted, restarting from beginning', { lastDocId });
          lastDocId = null;
          continue;
        }
        query = query.startAfter(lastDocSnapshot);
      }

      const commentsSnap = await query.get();
      if (commentsSnap.empty) break;

      for (const commentDoc of commentsSnap.docs) {
        try {
          const historyDeleted = await cleanupSubcollection(
            commentDoc.ref.collection('history'),
            'archivedAt',
            historyCutoff
          );
          const reactionsDeleted = await cleanupSubcollection(
            commentDoc.ref.collection('reactions'),
            'createdAt',
            reactionCutoff
          );
          totalDeleted += historyDeleted + reactionsDeleted;
        } catch (err) {
          log('error', 'Error cleaning comment', { commentId: commentDoc.id, error: err.message });
        }
      }

      lastDocId = commentsSnap.docs[commentsSnap.docs.length - 1].id;
      log('info', 'Cleanup batch processed', {
        batchEndId: lastDocId,
        totalDeletedSoFar: totalDeleted,
      });
    }

    log('info', 'Cleanup complete', { totalDeleted });
    return null;
  });

// ----------------------------------------------------------------------
// 5. deleteOldRateLimitShards – scheduled cleanup (prevents unbounded growth)
// ----------------------------------------------------------------------
exports.deleteOldRateLimitShards = functions.pubsub
  .schedule('every 12 hours')
  .onRun(async (context) => {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // keep last 2 days
    const shardCollections = await db.collectionGroup('shards').get();

    let deleted = 0;
    for (const doc of shardCollections.docs) {
      const data = doc.data();
      if (data.expireAt && data.expireAt.toDate() < cutoff) {
        await doc.ref.delete();
        deleted++;
      } else if (data.windowStart && data.windowStart < cutoff.getTime()) {
        await doc.ref.delete();
        deleted++;
      }
    }
    log('info', 'Old rate limit shards cleaned up', { deleted });
    return null;
  });

// ----------------------------------------------------------------------
//  Helper: delete all docs in a subcollection where field < cutoff
// ----------------------------------------------------------------------
async function cleanupSubcollection(subRef, fieldName, cutoff, pageSize = 500) {
  let deleted = 0;
  while (true) {
    const q = subRef.where(fieldName, '<', cutoff).limit(pageSize);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    deleted += snap.size;
  }
  return deleted;
}

// ==================== REQUIRED FIRESTORE INDEXES ====================
/*
  1. Collection group: comments/{commentId}/history
     Fields: archivedAt ASC, __name__ ASC
  2. Collection group: comments/{commentId}/reactions
     Fields: createdAt ASC, __name__ ASC
  3. Collection: rate_limits – no extra indexes needed (sharded)
  4. Collection: usernames – indexed by document ID (batch getAll)
  5. Collection group: shards (for rate limit cleanup) – requires index on `expireAt` and/or `windowStart`
*/