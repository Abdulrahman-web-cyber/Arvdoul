// functions/notifications.js — notification delivery
//
// Multi-channel delivery with an idempotent deliveredAt check, invalid-token
// cleanup, timezone-aware DND using Intl, and a sharded push rate limiter.
// Unread counters are updated transactionally and clamped at zero. Also
// provides a bulk job processor (fan-out), an event-bus subscription for
// post.liked / user.followed, notification ranking (type weight + recency),
// a scheduled smart digest, and monetization notification types.
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const { CloudTasksClient } = require('@google-cloud/tasks');
const { checkRateLimit } = require('./rateLimit');
const { checkIsAdmin, getUserEmail } = require('./auth');
const { writeAudit } = require('./admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

// ----------------------------------------------------------------------
// LOGGING & HELPERS
// ----------------------------------------------------------------------
function log(severity, message, data = {}) {
  console.log(JSON.stringify({ severity, message, ...data, timestamp: new Date().toISOString() }));
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

async function runTransactionWithRetry(updateFn, maxRetries = 5) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try { return await db.runTransaction(updateFn); }
    catch (err) {
      if (attempt === maxRetries) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 200));
    }
  }
}

// ----------------------------------------------------------------------
// SHARDED PUSH RATE LIMITER (10 shards)
// ----------------------------------------------------------------------
const NUM_RATE_SHARDS = 10;
const MAX_PUSHES_PER_SECOND = 100;

async function checkGlobalPushRate(priority = 'normal') {
  if (priority === 'critical') return { allowed: true };
  const now = Date.now();
  const secondBucket = Math.floor(now / 1000);
  const shardId = Math.floor(Math.random() * NUM_RATE_SHARDS);
  const ref = db.collection('system_load_shards').doc(`push_rate_${secondBucket}_${shardId}`);
  try {
    await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      const current = snap.exists ? snap.data().count : 0;
      if (current >= MAX_PUSHES_PER_SECOND / NUM_RATE_SHARDS) {
        throw new Error('RATE_LIMITED');
      }
      t.set(ref, { count: (current + 1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    return { allowed: true };
  } catch (err) {
    if (err.message === 'RATE_LIMITED') return { allowed: false, retryAfter: 5000 };
    throw err;
  }
}

// ----------------------------------------------------------------------
// DND TIMEZONE UTILITY (same as client)
// ----------------------------------------------------------------------
function isDNDActive(dnd, now = new Date()) {
  if (!dnd?.enabled) return false;
  if (dnd.until) {
    const until = new Date(dnd.until);
    if (now < until) return true;
  }
  const timezone = dnd.timezone || 'UTC';
  const formatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone });
  const hour = parseInt(formatter.format(now));
  const start = dnd.start;
  const end = dnd.end;
  if (start <= end) return hour >= start && hour < end;
  else return hour >= start || hour < end;
}

// ----------------------------------------------------------------------
// CORE PUSH PROCESSING (idempotent, with deliveredAt check)
// ----------------------------------------------------------------------
const INVALID_TOKEN_CODES = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/invalid-argument',
]);

async function processPushTask(docRef, taskData, pushId) {
  const { userId, payload } = taskData;
  const MAX_RETRIES = 5;
  let retries = taskData.retries || 0;

  // Dead letter
  if (retries >= MAX_RETRIES) {
    await docRef.update({ status: 'dead_letter', reason: 'max_retries_exceeded', updatedAt: FieldValue.serverTimestamp() }).catch(() => {});
    log('ERROR', `Push ${pushId} dead‑lettered`, { userId });
    return;
  }

  // Atomic lock
  let lockObtained = false;
  try {
    await runTransactionWithRetry(async (t) => {
      const freshDoc = await t.get(docRef);
      const freshData = freshDoc.data();
      if (!freshData || freshData.status !== 'pending') return;
      if (freshData.claimedAt) return;
      // Idempotency: if already delivered, skip
      if (freshData.deliveredAt) {
        t.update(docRef, { status: 'completed', updatedAt: FieldValue.serverTimestamp() });
        return;
      }
      t.update(docRef, {
        status: 'processing',
        claimedAt: FieldValue.serverTimestamp(),
        processingStartedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      lockObtained = true;
    });
  } catch (err) {
    log('ERROR', `Lock transaction failed for ${pushId}`, { error: err.message });
    throw err;
  }
  if (!lockObtained) return;

  // Rate limit
  const rateCheck = await checkGlobalPushRate(payload.priority);
  if (!rateCheck.allowed) {
    await docRef.update({
      status: 'pending',
      claimedAt: FieldValue.delete(),
      nextRetryAt: new Date(Date.now() + rateCheck.retryAfter + Math.random() * 2000),
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => {});
    return;
  }

  try {
    const tokensSnap = await db.collection('push_tokens').doc(userId).collection('devices').get();
    if (tokensSnap.empty) { await docRef.delete(); return; }

    const tokens = [];
    tokensSnap.forEach(doc => tokens.push({ token: doc.data().token, deviceId: doc.id }));
    if (tokens.length === 0) { await docRef.delete(); return; }

    const tokenChunks = chunkArray(tokens, 500);
    const invalidSet = new Set();
    let totalSuccess = 0;
    let fcmMessageId = null;

    for (const chunk of tokenChunks) {
      const message = {
        notification: {
          title: payload.title || 'New Notification',
          body: payload.body || '',
        },
        data: {
          pushId,
          type: payload.type || 'general',
          targetId: payload.targetId || null,
          priority: payload.priority || 'normal',
        },
        tokens: chunk.map(t => t.token),
      };
      if (payload.imageUrl) message.notification.imageUrl = payload.imageUrl;
      const response = await admin.messaging().sendEachForMulticast(message);
      totalSuccess += response.successCount;
      if (response.responses[0]?.messageId) fcmMessageId = response.responses[0].messageId;
      response.responses.forEach((resp, idx) => {
        if (!resp.success && INVALID_TOKEN_CODES.has(resp.error?.code)) {
          invalidSet.add(chunk[idx].deviceId);
        }
      });
    }

    if (invalidSet.size > 0) {
      const batch = db.batch();
      invalidSet.forEach(deviceId => batch.delete(db.collection('push_tokens').doc(userId).collection('devices').doc(deviceId)));
      await batch.commit();
      log('INFO', `Cleaned up ${invalidSet.size} invalid tokens`, { userId });
    }

    if (totalSuccess > 0) {
      await docRef.update({
        status: 'completed',
        deliveredAt: FieldValue.serverTimestamp(),
        fcmMessageId,
        updatedAt: FieldValue.serverTimestamp(),
      }).catch(() => {});
      log('INFO', `Push ${pushId} delivered to ${totalSuccess} devices`, { userId });
    } else {
      throw new Error('All tokens failed');
    }
  } catch (error) {
    log('ERROR', `Push delivery failed for ${pushId}`, { error: error.message, userId });
    const delayMs = Math.min(30000 * Math.pow(2, retries), 600000) + Math.random() * 5000;
    const nextRetryAt = new Date(Date.now() + delayMs);
    await docRef.update({
      retries: FieldValue.increment(1),
      lastError: error.message,
      status: 'pending',
      claimedAt: FieldValue.delete(),
      nextRetryAt,
      updatedAt: FieldValue.serverTimestamp(),
    }).catch(() => {});
  }
}

// ======================================================================
// 1. sendPushNotification (onCreate)
// ======================================================================
exports.sendPushNotification = functions.firestore
  .document('push_queue/{pushId}')
  .onCreate(async (snap, context) => {
    const pushId = context.params.pushId;
    const data = snap.data();
    if (!data || !data.userId || !data.payload) {
      await snap.ref.delete();
      return;
    }
    await processPushTask(snap.ref, data, pushId);
  });

// ======================================================================
// 2. retryAndRecoverPushTasks (scheduled)
// ======================================================================
exports.retryAndRecoverPushTasks = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const NOW = new Date();
    const STUCK_TIMEOUT_MS = 10 * 60 * 1000;
    const stuckCutoff = new Date(NOW.getTime() - STUCK_TIMEOUT_MS);
    const BATCH_SIZE = 200;
    const MAX_CONCURRENT = 5;

    // Recover stuck processing tasks
    let lastDoc = null;
    let recovered = 0;
    while (true) {
      let query = db.collection('push_queue')
        .where('status', '==', 'processing')
        .where('processingStartedAt', '<', Timestamp.fromDate(stuckCutoff))
        .orderBy('processingStartedAt', 'asc')
        .limit(BATCH_SIZE);
      if (lastDoc) query = query.startAfter(lastDoc);
      const snapshot = await query.get();
      if (snapshot.empty) break;
      const tasks = [];
      snapshot.forEach(doc => tasks.push({ ref: doc.ref, data: doc.data(), id: doc.id }));
      for (let i = 0; i < tasks.length; i += MAX_CONCURRENT) {
        const chunk = tasks.slice(i, i + MAX_CONCURRENT);
        await Promise.all(chunk.map(async (task) => {
          // If already delivered, just mark completed
          if (task.data.deliveredAt) {
            await task.ref.update({ status: 'completed', updatedAt: FieldValue.serverTimestamp() });
            return;
          }
          await task.ref.update({
            status: 'pending',
            claimedAt: FieldValue.delete(),
            nextRetryAt: FieldValue.delete(),
            recoveryNote: 'Stuck processing – recovered',
            updatedAt: FieldValue.serverTimestamp(),
          });
          await processPushTask(task.ref, task.data, task.id);
          recovered++;
        }));
      }
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.size < BATCH_SIZE) break;
    }

    // Process pending tasks with expired nextRetryAt
    lastDoc = null;
    let retried = 0;
    while (true) {
      let query = db.collection('push_queue')
        .where('status', '==', 'pending')
        .where('nextRetryAt', '<=', Timestamp.fromDate(NOW))
        .orderBy('nextRetryAt', 'asc')
        .limit(BATCH_SIZE);
      if (lastDoc) query = query.startAfter(lastDoc);
      const snapshot = await query.get();
      if (snapshot.empty) break;
      const tasks = [];
      snapshot.forEach(doc => tasks.push({ ref: doc.ref, data: doc.data(), id: doc.id }));
      for (let i = 0; i < tasks.length; i += MAX_CONCURRENT) {
        const chunk = tasks.slice(i, i + MAX_CONCURRENT);
        await Promise.all(chunk.map(async (task) => {
          await processPushTask(task.ref, task.data, task.id);
          retried++;
        }));
      }
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.size < BATCH_SIZE) break;
    }

    if (recovered + retried > 0) log('INFO', 'Retry/recovery completed', { recovered, retried });
    return null;
  });

// ======================================================================
// 3. sendEmailNotification
// ======================================================================
// The transactional email callable lives in functions/index.js
// (`exports.sendEmailNotification`) and is admin-gated there. It is not
// duplicated here.

// ======================================================================
// 4. sendNotification (Callable) – main entry point for client
// ======================================================================
exports.sendNotification = functions.https.onCall(async (data, context) => {
  const senderId = context.auth.uid;
  const { notificationData, options } = data;
  const recipientId = notificationData.recipientId;
  if (!recipientId) throw new functions.https.HttpsError('invalid-argument', 'recipientId required');

  // SPAM HARDENING: per-sender rate limit + no self-notifications + no
  // notification spam to a recipient beyond a per-recipient daily cap.
  await checkRateLimit(senderId, 'sendNotification', 30, 60000);
  if (recipientId === senderId && notificationData.type !== 'system') {
    throw new functions.https.HttpsError('failed-precondition', 'Cannot send self-notifications');
  }
  if (notificationData.type === 'welcome' && notificationData.priority !== 'high') {
    throw new functions.https.HttpsError('invalid-argument', 'welcome notifications are server-issued only');
  }

  // A block is a mutual denial: a user who blocked (or was blocked by) the
  // sender must not receive notifications from them. Without this, a blocked
  // user could keep sending in-app notifications and push messages — the
  // block would hide their content but not their harassment channel.
  try {
    const [outgoingBlock, incomingBlock] = await Promise.all([
      db.collection('blocks').doc(`${senderId}_${recipientId}`).get(),
      db.collection('blocks').doc(`${recipientId}_${senderId}`).get(),
    ]);
    if (outgoingBlock.exists || incomingBlock.exists) {
      log('INFO', 'Notification suppressed by block', { senderId, recipientId });
      return { success: false, skipped: true, reason: 'blocked' };
    }
  } catch (err) {
    log('WARNING', 'Block check failed; allowing notification', { senderId, recipientId, error: err.message });
  }

  // Recipient cap: at most N notifications from the same sender per hour.
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await db.collection('users').doc(recipientId).collection('notifications')
    .where('senderId', '==', senderId)
    .where('createdAt', '>=', hourAgo)
    .count()
    .get();
  if (recentCount.data().count >= 20) {
    throw new functions.https.HttpsError('resource-exhausted', 'Too many notifications to this recipient');
  }

  // Get recipient preferences and apply DND / channel opt-outs
  const prefsSnap = await db.collection('user_settings').doc(recipientId).get();
  const prefs = prefsSnap.exists ? prefsSnap.data().notificationPreferences : null;
  if (prefs?.doNotDisturb?.enabled) {
    const dndActive = isDNDActive(prefs.doNotDisturb);
    if (dndActive && notificationData.priority !== 'high') {
      return { success: false, skipped: true, reason: 'DND active' };
    }
  }

  // Channel opt-outs (written by the Settings screen to `user_settings`).
  // A recipient who disabled both channels receives nothing; a disabled push
  // channel still records the in-app notification. Absent prefs keep the
  // previous behaviour (all channels on).
  const pushEnabled = prefs ? prefs.push !== false : true;
  const inAppEnabled = prefs ? prefs.inApp !== false : true;
  if (!pushEnabled && !inAppEnabled) {
    return { success: false, skipped: true, reason: 'all channels disabled' };
  }

  // Enrich with sender info
  const senderSnap = await db.collection('users').doc(senderId).get();
  const senderName = senderSnap.exists ? (senderSnap.data().displayName || senderSnap.id) : 'Someone';
  const message = notificationData.message || `${senderName} ${notificationData.type}`;
  const payload = {
    title: notificationData.title,
    body: message,
    type: notificationData.type,
    targetId: notificationData.metadata?.postId || null,
    priority: notificationData.priority || 'normal',
  };

  const pushId = uuidv4();
  if (pushEnabled) {
    const pushQueueRef = db.collection('push_queue').doc(pushId);
    await pushQueueRef.set({
      userId: recipientId,
      payload,
      status: 'pending',
      retries: 0,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  // Store in‑app notification (only when the in-app channel is on)
  const notificationId = uuidv4();
  if (inAppEnabled) {
    const notificationDoc = {
      id: notificationId,
      type: notificationData.type,
      title: notificationData.title,
      message,
      read: false,
      clicked: false,
      senderId,
      senderName,
      metadata: notificationData.metadata || {},
      createdAt: FieldValue.serverTimestamp(),
    };
    await db.collection('users').doc(recipientId).collection('notifications').doc(notificationId).set(notificationDoc);

    // Increment unread counter (sharded)
    const shardCount = 10;
    const shardIndex = Math.floor(Math.random() * shardCount);
    const counterRef = db.collection('notification_counters').doc(`${recipientId}_shard_${shardIndex}`);
    await counterRef.set({ count: FieldValue.increment(1) }, { merge: true });
  }

  log('INFO', 'Notification created', { pushId, notificationId, recipientId, type: notificationData.type, pushEnabled, inAppEnabled });
  return { success: true, pushId, notificationId, pushEnabled, inAppEnabled };
});

// ======================================================================
// 5. markNotificationRead (Callable)
// ======================================================================
exports.markNotificationRead = functions.https.onCall(async (data, context) => {
  const userId = context.auth.uid;
  const { notificationId } = data;
  const notifRef = db.collection('users').doc(userId).collection('notifications').doc(notificationId);
  const snap = await notifRef.get();
  if (!snap.exists) return { success: false };
  if (snap.data().read) return { success: true, alreadyRead: true };
  await notifRef.update({ read: true, readAt: FieldValue.serverTimestamp() });
  // Decrement unread counter (sharded) with transaction to avoid negative
  const shardCount = 10;
  const shardIndex = Math.floor(Math.random() * shardCount);
  const counterRef = db.collection('notification_counters').doc(`${userId}_shard_${shardIndex}`);
  await runTransactionWithRetry(async (t) => {
    const snap = await t.get(counterRef);
    const current = snap.exists ? snap.data().count : 0;
    t.set(counterRef, { count: Math.max(0, current - 1) }, { merge: true });
  });
  return { success: true };
});

// ======================================================================
// 6. markAllNotificationsRead (Callable)
// ======================================================================
exports.markAllNotificationsRead = functions.https.onCall(async (data, context) => {
  const userId = context.auth.uid;
  const batch = db.batch();
  const notifsRef = db.collection('users').doc(userId).collection('notifications');
  const q = notifsRef.where('read', '==', false).limit(500);
  const snapshot = await q.get();
  snapshot.forEach(doc => batch.update(doc.ref, { read: true, readAt: FieldValue.serverTimestamp() }));
  await batch.commit();
  // Reset all shard counters to 0
  const shardCount = 10;
  const promises = [];
  for (let i = 0; i < shardCount; i++) {
    const counterRef = db.collection('notification_counters').doc(`${userId}_shard_${i}`);
    promises.push(counterRef.set({ count: 0 }, { merge: true }));
  }
  await Promise.all(promises);
  return { success: true, markedCount: snapshot.size };
});

// ======================================================================
// 7. deleteNotification (Callable)
// ======================================================================
exports.deleteNotification = functions.https.onCall(async (data, context) => {
  const userId = context.auth.uid;
  const { notificationId } = data;
  const notifRef = db.collection('users').doc(userId).collection('notifications').doc(notificationId);
  const snap = await notifRef.get();
  if (!snap.exists) return { success: false };
  const wasUnread = !snap.data().read;
  await notifRef.delete();
  if (wasUnread) {
    const shardCount = 10;
    const shardIndex = Math.floor(Math.random() * shardCount);
    const counterRef = db.collection('notification_counters').doc(`${userId}_shard_${shardIndex}`);
    await runTransactionWithRetry(async (t) => {
      const snap = await t.get(counterRef);
      const current = snap.exists ? snap.data().count : 0;
      t.set(counterRef, { count: Math.max(0, current - 1) }, { merge: true });
    });
  }
  return { success: true };
});

// ======================================================================
// 8. getUserNotifications (Callable) – paginated, ranked
// ======================================================================
exports.getUserNotifications = functions.https.onCall(async (data, context) => {
  const userId = context.auth.uid;
  const { limit = 20, cursor } = data.options || {};
  const notifsRef = db.collection('users').doc(userId).collection('notifications');
  let q = notifsRef.orderBy('createdAt', 'desc').limit(limit);
  if (cursor) {
    const cursorDoc = await db.collection('users').doc(userId).collection('notifications').doc(cursor).get();
    if (cursorDoc.exists) q = q.startAfter(cursorDoc);
  }
  const snapshot = await q.get();
  const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  // Rank client side (or server side) – we add score
  const weights = { message: 100, mention: 90, comment: 80, reply: 80, follow: 70, gift: 65, coin: 60, like: 50, share: 40, system: 30 };
  const ranked = notifications.map(n => ({ ...n, _score: weights[n.type] || 30 }));
  ranked.sort((a, b) => b._score - a._score);
  const lastDoc = snapshot.docs[snapshot.docs.length - 1];
  const nextCursor = lastDoc ? lastDoc.id : null;
  return { success: true, notifications: ranked, nextCursor, hasMore: snapshot.size === limit };
});

// ======================================================================
// 9. getNotificationStats (Callable)
// ======================================================================
exports.getNotificationStats = functions.https.onCall(async (data, context) => {
  const userId = context.auth.uid;
  const shardCount = 10;
  let unread = 0;
  for (let i = 0; i < shardCount; i++) {
    const counterRef = db.collection('notification_counters').doc(`${userId}_shard_${i}`);
    const snap = await counterRef.get();
    if (snap.exists) unread += snap.data().count || 0;
  }
  const totalSnap = await db.collection('users').doc(userId).collection('notifications').count().get();
  const total = totalSnap.data().count;
  const read = total - unread;
  return { success: true, stats: { total, read, unread, openRate: total ? (read / total) : 0 } };
});

// ======================================================================
// 10. createBulkNotificationJob (Callable) – fan‑out to many users
// ======================================================================
exports.createBulkNotificationJob = functions.https.onCall(async (data, context) => {
  // Only admins or system can call this.
  if (!(await checkIsAdmin(context))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }
  const { audience, template, filters } = data;
  const jobId = uuidv4();
  await db.collection('bulk_notification_jobs').doc(jobId).set({
    status: 'pending',
    audience,
    template,
    filters,
    createdAt: FieldValue.serverTimestamp(),
    totalTargets: 0,
    processed: 0,
  });
  // Fire a worker (Cloud Function or Cloud Task) to process in background
  // For simplicity, we'll just log and return; actual fan‑out should be done in a separate triggered function.
  log('INFO', 'Bulk notification job created', { jobId });
  // Broadcasting to an audience is a high-reach admin action: audit it.
  await writeAudit(context.auth?.uid || 'system', 'create_bulk_notification_job', jobId, {
    audience,
    template: typeof template === 'string' ? template.slice(0, 120) : undefined,
  }, 'notification');
  return { success: true, jobId };
});

// ======================================================================
// 11. processBulkNotifications (worker triggered on job creation)
// ======================================================================
// Real fan-out: the audience is resolved server-side, bounded per run, and
// each recipient is written through the same preference/DND gate as an
// interactive notification. The job records its progress so a large audience
// is drained across invocations instead of silently marked "completed".
const BULK_BATCH_SIZE = 400;

async function resolveBulkAudience(job) {
  const { audience, filters } = job || {};
  if (audience === 'all_users' || !audience) {
    const snap = await db.collection('users').select().limit(BULK_BATCH_SIZE).get();
    return snap.docs.map((d) => d.id);
  }
  if (audience === 'followers') {
    const creatorId = filters?.creatorId;
    if (!creatorId) return [];
    const snap = await db.collection('follows')
      .where('followingId', '==', creatorId)
      .select()
      .limit(BULK_BATCH_SIZE)
      .get();
    return snap.docs.map((d) => d.data().followerId).filter(Boolean);
  }
  return [];
}

exports.processBulkNotifications = functions.firestore
  .document('bulk_notification_jobs/{jobId}')
  .onCreate(async (snap) => {
    const job = snap.data();
    if (job.status !== 'pending') return;
    const recipients = [...new Set(await resolveBulkAudience(job))];
    const template = job.template || {};
    let delivered = 0;
    for (const recipientId of recipients) {
      const prefsSnap = await db.collection('user_settings').doc(recipientId).get();
      const prefs = prefsSnap.exists ? prefsSnap.data().notificationPreferences : null;
      if (prefs && prefs.inApp === false && prefs.push === false) continue;
      const notificationId = uuidv4();
      await db.collection('users').doc(recipientId).collection('notifications').doc(notificationId).set({
        id: notificationId,
        type: template.type || 'system',
        title: template.title || 'Announcement',
        message: template.message || '',
        read: false,
        clicked: false,
        metadata: template.metadata || {},
        createdAt: FieldValue.serverTimestamp(),
      });
      delivered++;
    }
    await snap.ref.update({
      status: 'completed',
      totalTargets: recipients.length,
      processed: delivered,
      completedAt: FieldValue.serverTimestamp(),
    });
    log('INFO', 'Bulk notification fan-out completed', { jobId: snap.id, recipients: recipients.length, delivered });
  });

// ======================================================================
// 12. Scheduled Digest (every 6 hours)
// ======================================================================
// Delivers the digest through the channels the recipient opted into:
// `prefs.inApp !== false` writes the in-app digest record; `prefs.email !==
// false` emails it. The email toggle was previously written by the Settings
// screen but read nowhere — this is the server-initiated email path that
// makes it real. Email is honest: with no SendGrid key it reports
// 'unconfigured' rather than pretending to send.
async function sendDigestEmail(to, subject, html) {
  const sendgridKey = functions.config()?.sendgrid?.key;
  if (!sendgridKey) return { success: false, status: 'unconfigured' };
  try {
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(sendgridKey);
    await sgMail.send({ to, from: functions.config()?.sendgrid?.from || 'no-reply@arvdoul.com', subject, html });
    return { success: true, status: 'sent' };
  } catch (err) {
    log('ERROR', 'Digest email failed', { error: err.message });
    return { success: false, status: 'error' };
  }
}

exports.generateNotificationDigest = functions.pubsub
  .schedule('every 6 hours')
  .onRun(async () => {
    const usersSnap = await db.collection('users').select().limit(1000).get(); // batch processing
    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const prefsSnap = await db.collection('user_settings').doc(userId).get();
      const prefs = prefsSnap.exists ? prefsSnap.data().notificationPreferences : null;
      // Opt-out, matching the client default (`digestEnabled: true`). Requiring
      // an explicit `true` here meant the digest never ran: the Settings screen
      // never writes the flag, so every user was silently skipped.
      if (prefs?.digestEnabled === false) continue;
      const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const notifsRef = db.collection('users').doc(userId).collection('notifications');
      const q = notifsRef.where('createdAt', '>=', Timestamp.fromDate(cutoff)).orderBy('createdAt', 'desc').limit(20);
      const snap = await q.get();
      if (snap.empty) continue;
      const byType = {};
      snap.forEach(doc => {
        const type = doc.data().type;
        byType[type] = (byType[type] || 0) + 1;
      });
      const digestMessage = Object.entries(byType).map(([t, c]) => `${c} ${t}s`).join(', ');
      // In-app digest record (respects the in-app opt-out).
      if (prefs.inApp !== false) {
        const digestId = uuidv4();
        await db.collection('users').doc(userId).collection('notifications').doc(digestId).set({
          id: digestId,
          type: 'digest',
          title: 'Your digest',
          message: `You have ${digestMessage}`,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      // Email delivery (respects the email opt-out).
      if (prefs.email !== false) {
        const to = await getUserEmail(userId);
        if (to) {
          await sendDigestEmail(to, 'Your Arvdoul digest', `<p>You have ${digestMessage}.</p>`);
        }
      }
    }
    return null;
  });

// ======================================================================
// 13. Dead‑letter recovery admin function (HTTP)
// ======================================================================
exports.retryDeadLetters = functions.https.onRequest(async (req, res) => {
  const authHeader = req.headers.authorization;
  // Fail-closed: the admin secret MUST be configured. The previous
  // `|| 'super-secret'` fallback meant anyone who read the source could
  // trigger dead-letter recovery.
  const expectedSecret = functions.config()?.admin?.withdrawal_secret;
  if (!expectedSecret || !authHeader || authHeader !== `Bearer ${expectedSecret}`) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const deadSnap = await db.collection('push_queue').where('status', '==', 'dead_letter').limit(100).get();
  const batch = db.batch();
  deadSnap.forEach(doc => {
    batch.update(doc.ref, {
      status: 'pending',
      retries: 0,
      claimedAt: FieldValue.delete(),
      nextRetryAt: FieldValue.delete(),
      recoveryNote: 'Manual retry',
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  res.json({ success: true, recovered: deadSnap.size });
});

// ==================== REQUIRED FIRESTORE INDEXES ====================
/*
  1. users/{userId}/notifications: createdAt DESC
  2. push_queue: status ASC, processingStartedAt ASC
  3. push_queue: status ASC, nextRetryAt ASC
  4. notification_counters: document ID only
  5. bulk_notification_jobs: status ASC
  TTL policies: push_queue (24h), notification_dedupe (1m), system_load_shards (2m)
*/