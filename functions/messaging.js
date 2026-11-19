// functions/messaging.js — messaging callables and triggers
//
// Scheduled dispatch runs exactly-once. Includes privacy-aware push, hybrid
// Algolia + Firestore search, and rate limiting.

const functions = require('firebase-functions');
const { log, logger } = require('./logger');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

// Safe Algolia import – optional
let algoliaSearchLib = null;
try {
  algoliaSearchLib = require('algoliasearch');
} catch (e) {
  logger.warn('algoliasearch package not installed; search will fall back to Firestore');
}

const { getRuntimeConfig } = require('./auth');
const ALGOLIA_APP_ID = getRuntimeConfig('ALGOLIA_APP_ID', 'algolia.app_id');
const ALGOLIA_ADMIN_KEY = getRuntimeConfig('ALGOLIA_ADMIN_KEY', 'algolia.admin_key');
const ALGOLIA_MESSAGES_INDEX = getRuntimeConfig('ALGOLIA_MESSAGES_INDEX', 'algolia.messages_index', 'messages');
const USE_ALGOLIA = !!(ALGOLIA_APP_ID && ALGOLIA_ADMIN_KEY && algoliaSearchLib);

let algoliaIndex = null;
if (USE_ALGOLIA) {
  const algoliaFactory = algoliaSearchLib.default || algoliaSearchLib;
  const client = algoliaFactory(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY);
  algoliaIndex = client.initIndex(ALGOLIA_MESSAGES_INDEX);
}

const { enqueuePush } = require('./pushQueue');
const { checkRateLimit } = require('./rateLimit');

// ----------------------------------------------------------------------
//  LOGGING
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
//  CONCURRENCY LIMITER
// ----------------------------------------------------------------------
function createConcurrencyLimiter(maxConcurrent) {
  let running = 0;
  const queue = [];
  const runNext = () => {
    if (running >= maxConcurrent || queue.length === 0) return;
    const next = queue.shift();
    running++;
    next().finally(() => {
      running--;
      runNext();
    });
  };
  return function enqueue(fn) {
    return new Promise((resolve, reject) => {
      queue.push(async () => {
        try { resolve(await fn()); } catch (err) { reject(err); }
      });
      runNext();
    });
  };
}
const messageLimiter = createConcurrencyLimiter(5);

// ----------------------------------------------------------------------
//  SHARDED RATE LIMITER — shared implementation in ./rateLimit.js.
//  This module previously carried its own copy; the shared limiter keeps a
//  single shard algorithm and error contract across every endpoint.
// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
//  TRANSACTION RETRY WRAPPER
// ----------------------------------------------------------------------
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

// ----------------------------------------------------------------------
//  HELPERS
// ----------------------------------------------------------------------
async function getUserDisplayInfo(userId) {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return { displayName: 'Unknown', photoURL: null };
  const u = userDoc.data();
  return { displayName: u.displayName || u.username || userId, photoURL: u.photoURL || null };
}

/**
 * Check if sender is allowed to push‑notify recipient.
 * Reads the recipient's message permission from `user_settings/{recipientId}`.
 */
async function canSendPushToRecipient(senderId, recipientId) {
  const [block1, block2] = await Promise.all([
    db.collection('blocks').doc(`${senderId}_${recipientId}`).get(),
    db.collection('blocks').doc(`${recipientId}_${senderId}`).get(),
  ]);
  if (block1.exists || block2.exists) return false;

  // Read the recipient's DM preference from `users/{uid}.settings.privacy.allowDMs`
  // — the document the Settings screen writes and `firestore.rules` `dmAllowedTo()`
  // enforces. It was previously read from a `messagePermission` field that
  // nothing ever wrote, so this check silently allowed everyone.
  const settingsDoc = await db.collection('users').doc(recipientId).get();
  const allowDMs = settingsDoc.exists
    ? (settingsDoc.data()?.settings?.privacy?.allowDMs || 'everyone')
    : 'everyone';

  if (allowDMs === 'none') return false;
  if (allowDMs === 'everyone') return true;
  if (allowDMs === 'friends') {
    const [forward, backward] = await Promise.all([
      db.collection('follows').doc(`${senderId}_${recipientId}`).get(),
      db.collection('follows').doc(`${recipientId}_${senderId}`).get(),
    ]);
    return forward.exists && backward.exists;
  }
  return true;
}

// ======================================================================
//  1. searchMessages (Callable) – IMPLEMENTED
// ======================================================================
exports.searchMessages = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
  }
  const userId = context.auth.uid;
  const { conversationId, query, limit = 20 } = data;
  if (!conversationId || !query || typeof query !== 'string') {
    throw new functions.https.HttpsError('invalid-argument',
      'conversationId and query are required.');
  }

  await checkRateLimit(userId, 'searchMessages', 10, 60000);

  const convRef = db.collection('conversations').doc(conversationId);
  const convSnap = await convRef.get();
  if (!convSnap.exists || !(convSnap.data().participants || []).includes(userId)) {
    throw new functions.https.HttpsError('permission-denied',
      'You are not a participant of this conversation.');
  }

  // 1. Algolia search
  if (USE_ALGOLIA) {
    try {
      const results = await algoliaIndex.search(query, {
        filters: `conversationId:${conversationId}`,
        hitsPerPage: Math.min(limit, 100),
      });
      return { success: true, results: results.hits };
    } catch (err) {
      log('WARN', 'Algolia search failed, falling back to Firestore', { error: err.message });
    }
  }

  // 2. Firestore fallback prefix search
  try {
    const conversation = convSnap.data();
    let shardPath = `conversations/${conversationId}/messages`;
    if (conversation.type === 'group' && conversation.participantCount >= 1000) {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      shardPath = `conversations/${conversationId}/messages_${year}_${month}`;
    }
    const [coll, docId, subColl] = shardPath.split('/');
    const messagesRef = db.collection(coll).doc(docId).collection(subColl);

    const q = messagesRef
      .where('content', '>=', query)
      .where('content', '<=', query + '\uf8ff')
      .orderBy('content')
      .orderBy('createdAt', 'desc')
      .limit(Math.min(limit, 100));
    const snapshot = await q.get();

    const results = [];
    snapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
    log('INFO', 'Search completed via Firestore', { userId, conversationId, hitCount: results.length });
    return { success: true, results };
  } catch (error) {
    log('ERROR', 'Search failed', { userId, error: error.message });
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ======================================================================
//  2. scheduledMessageDispatcher (every 1 minute) – atomic & idempotent
// ======================================================================
async function processScheduledMessage(docRef) {
  const result = await runTransactionWithRetry(async (t) => {
    const freshSnap = await t.get(docRef);
    const fresh = freshSnap.data();
    if (!fresh || fresh.status !== 'pending') return null;

    const { conversationId, senderId, data: messageData } = fresh;
    if (!conversationId || !senderId || !messageData) {
      t.update(docRef, { status: 'failed', error: 'Invalid metadata', updatedAt: FieldValue.serverTimestamp() });
      return null;
    }

    const convRef = db.collection('conversations').doc(conversationId);
    const convSnap = await t.get(convRef);
    if (!convSnap.exists) {
      t.update(docRef, { status: 'failed', error: 'Conversation not found', updatedAt: FieldValue.serverTimestamp() });
      return null;
    }
    const conv = convSnap.data();

    if (conv.type === 'channel') {
      const isAdmin = (conv.admins || []).includes(senderId);
      const isMod = (conv.moderators || []).includes(senderId);
      if (!isAdmin && !isMod) {
        t.update(docRef, { status: 'failed', error: 'Channel posting denied', updatedAt: FieldValue.serverTimestamp() });
        return null;
      }
    }

    const senderProfile = await getUserDisplayInfo(senderId);
    const now = FieldValue.serverTimestamp();
    const messageId = admin.firestore().collection('_').doc().id;
    const message = {
      id: messageId,
      conversationId,
      senderId,
      senderName: senderProfile.displayName,
      senderPhoto: senderProfile.photoURL,
      type: messageData.type || 'text',
      content: messageData.content || '',
      mentions: messageData.mentions || [],
      replyTo: messageData.replyTo || null,
      forwardFrom: messageData.forwardFrom || null,
      threadId: messageData.threadId || null,
      threadDepth: messageData.threadDepth || 0,
      reactions: {},
      isEdited: false,
      isDeleted: false,
      deletedFor: [],
      readBy: [],
      deliveredTo: [],
      createdAt: now,
      updatedAt: now,
      ttlExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      encrypted: false,
    };

    const messagesRef = convRef.collection('messages').doc(messageId);
    const lastMsgRef = db.collection('last_messages').doc(conversationId);
    t.set(messagesRef, message);
    t.set(lastMsgRef, {
      messageId,
      text: message.content?.length > 50 ? message.content.slice(0, 50) + '…' : (message.content || ''),
      senderId,
      type: message.type,
      timestamp: now,
      updatedAt: now,
    });
    t.update(convRef, { lastActivity: now, updatedAt: now });
    t.update(docRef, {
      status: 'sent',
      sentAt: now,
      processingStartedAt: now,
    });

    log('INFO', 'Scheduled message sent atomically', { messageId, conversationId });
    return {
      conversationId,
      senderId,
      messageId,
      content: message.content,
      participants: conv.participants || [],
      mutedBy: conv.mutedBy || [],
      senderName: senderProfile.displayName,
    };
  });

  if (!result) return;

  const { participants, mutedBy, senderId, conversationId, messageId, content, senderName } = result;
  const pushPromises = participants
    .filter(uid => uid !== senderId && !mutedBy.includes(uid))
    .map(async (uid) => {
      const allowed = await canSendPushToRecipient(senderId, uid);
      if (!allowed) return;
      enqueuePush(uid, {
        type: 'message',
        title: `Message from ${senderName}`,
        body: content ? content.slice(0, 100) : '',
        data: { conversationId, messageId, senderId },
      }).catch(err => log('WARN', 'Push failed for scheduled msg', { uid, error: err.message }));
    });
  await Promise.allSettled(pushPromises);
}

exports.scheduledMessageDispatcher = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    const now = new Date();
    const BATCH_LIMIT = 100;
    try {
      const pendingSnap = await db.collection('scheduled_messages')
        .where('scheduleAt', '<=', Timestamp.fromDate(now))
        .where('status', '==', 'pending')
        .limit(BATCH_LIMIT)
        .get();
      if (pendingSnap.empty) return null;

      const tasks = pendingSnap.docs.map(doc =>
        messageLimiter(() => processScheduledMessage(doc.ref))
      );
      const results = await Promise.allSettled(tasks);
      let sent = 0, failed = 0;
      results.forEach(r => {
        if (r.status === 'fulfilled') sent++;
        else { failed++; log('ERROR', 'Scheduled processing failed', { error: r.reason?.message }); }
      });
      log('INFO', 'Scheduled dispatch batch completed', { sent, failed });
      return null;
    } catch (error) {
      log('ERROR', 'Dispatcher crashed', { error: error.message });
      return null;
    }
  });

// ======================================================================
//  2b. Stuck scheduled message recovery
// ======================================================================
exports.recoverStuckScheduledDispatch = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async (context) => {
    const stuckTimeout = new Date(Date.now() - 5 * 60 * 1000);
    const stuckSnap = await db.collection('scheduled_messages')
      .where('status', '==', 'processing')
      .where('processingStartedAt', '<', Timestamp.fromDate(stuckTimeout))
      .limit(50)
      .get();
    if (stuckSnap.empty) return null;

    const batch = db.batch();
    let recovered = 0;
    stuckSnap.forEach(doc => {
      batch.update(doc.ref, {
        status: 'pending',
        processingError: 'Recovered from stuck processing',
        updatedAt: FieldValue.serverTimestamp(),
      });
      recovered++;
    });
    await batch.commit();
    log('INFO', 'Recovered stuck scheduled messages', { recovered });
    return null;
  });

// ======================================================================
//  3. callSignaling (Callable)
// ======================================================================
exports.callSignaling = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
  }
  const userId = context.auth.uid;
  const { callId, sdp, type, conversationId } = data;
  if (!callId || !sdp || !type || !['offer', 'answer', 'ice-candidate'].includes(type)) {
    throw new functions.https.HttpsError('invalid-argument',
      'callId, sdp, and type (offer|answer|ice-candidate) are required.');
  }

  await checkRateLimit(userId, 'callSignaling', 30, 60000);

  try {
    const callRef = db.collection('calls').doc(callId);
    const callDoc = await callRef.get();

    if (!callDoc.exists) {
      if (!conversationId) {
        throw new functions.https.HttpsError('failed-precondition',
          'conversationId is required when call document does not exist.');
      }
      const convSnap = await db.collection('conversations').doc(conversationId).get();
      if (!convSnap.exists || !(convSnap.data().participants || []).includes(userId)) {
        throw new functions.https.HttpsError('permission-denied',
          'You are not a participant of this conversation.');
      }
      await callRef.set({
        id: callId,
        conversationId,
        participants: [userId],
        status: 'ringing',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      const callData = callDoc.data();
      const convId = callData.conversationId || conversationId;
      if (!convId) {
        throw new functions.https.HttpsError('failed-precondition', 'Call is orphaned – no conversation.');
      }
      const convSnap = await db.collection('conversations').doc(convId).get();
      if (!convSnap.exists || !(convSnap.data().participants || []).includes(userId)) {
        throw new functions.https.HttpsError('permission-denied',
          'You are not a participant of this conversation.');
      }
      if (!(callData.participants || []).includes(userId)) {
        await callRef.update({
          participants: admin.firestore.FieldValue.arrayUnion(userId),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    await callRef.collection('signals').doc().set({
      type,
      sdp,
      userId,
      createdAt: FieldValue.serverTimestamp(),
      expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    log('INFO', 'Signalling message stored', { callId, type, userId });
    return { success: true };
  } catch (error) {
    log('ERROR', 'Call signalling failed', { callId, error: error.message });
    throw new functions.https.HttpsError('internal', error.message);
  }
});

// ======================================================================
//  4. cleanupOldCalls (scheduled every 24 hours) – deletes only ended calls
// ======================================================================
async function deleteSignalsSubcollection(callRef, pageSize = 500) {
  const signalsRef = callRef.collection('signals');
  let deleted = 0;
  let lastDoc = null;
  let loops = 0;
  const MAX_LOOPS = 100;

  while (loops < MAX_LOOPS) {
    loops++;
    let q = signalsRef.orderBy('__name__').limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }
  return deleted;
}

exports.cleanupOldCalls = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    // Drain the whole backlog: re-query a bounded page until nothing matches.
    // Each page is deleted before the next read, so no cursor is needed and a
    // backlog larger than one page is not left behind (the old single `limit`
    // read only ever cleaned 200 calls per day).
    let totalDeleted = 0;
    for (;;) {
      const snaps = await db.collection('calls')
        .where('status', 'in', ['ended', 'terminated', 'completed', 'failed'])
        .where('createdAt', '<', Timestamp.fromDate(cutoff))
        .limit(200)
        .get();
      if (snaps.empty) break;
      for (const doc of snaps.docs) {
        const deletedSignals = await deleteSignalsSubcollection(doc.ref);
        await doc.ref.delete();
        totalDeleted += 1 + deletedSignals;
      }
      if (snaps.size < 200) break;
    }
    if (totalDeleted) log('INFO', 'Old calls cleaned up', { totalDeleted });
    return null;
  });

// ==================== REQUIRED FIRESTORE INDEXES ====================
/*
  1. scheduled_messages: status ASC, scheduleAt ASC  → dispatcher
  2. scheduled_messages: status ASC, processingStartedAt ASC  → stuck recovery
  3. For each conversation's messages subcollection:
       content ASC, createdAt DESC  → search fallback
  4. calls: status ASC, createdAt ASC → cleanup (with status filter)
  5. users: no extra index — allowDMs lives at users/{uid}.settings.privacy.allowDMs
*/

// Roadmap: end-to-end encryption. Implement Signal Protocol / ECDH + AES-GCM.
// The client encrypts the payload and the server stores only encrypted blobs,
// with security rules enforcing encrypted content. Tracked work, not shipped
// behavior.

// ======================================================================
//  UNREAD COUNTERS — server-authoritative increments
//  Triggered on every message create (both the flat messages subcollection
//  and the supergroup monthly shards). Client-side writes to other users'
//  counters are denied by rules; this trigger is the only writer.
//  Cost: 1 read (conversation) + up to N shard writes for N participants —
//  bounded to conversations ≤ 200 participants (same bound as the client
//  inbox); larger groups rely on the lastRead position instead.
// ======================================================================
const UNREAD_INCREMENT_MAX_PARTICIPANTS = 200;
const UNREAD_SHARD_COUNT = 10;
const UNREAD_TOTAL_SHARD_COUNT = 8;

async function incrementUnreadForMessage(conversationId, senderId, messageId, createdAt) {
  try {
    const convSnap = await db.collection('conversations').doc(conversationId).get();
    if (!convSnap.exists) return;
    const conv = convSnap.data();
    if (conv.type === 'channel') return;
    const participants = Array.isArray(conv.participants) ? conv.participants : [];
    if (participants.length > UNREAD_INCREMENT_MAX_PARTICIPANTS) return;
    if (participants.length <= 1) return;

    // Read the conversation's disableReadReceipts flag once.
    if (conv.disableReadReceipts) return;

    const batch = db.batch();
    let ops = 0;
    for (const userId of participants) {
      if (userId === senderId) continue;
      const counterId = `unread_${conversationId}_${userId}`;
      const shard = Math.floor(Math.random() * UNREAD_SHARD_COUNT);
      const shardRef = db.collection('unread_counters').doc(counterId).collection('shards').doc(String(shard));
      batch.set(shardRef, {
        count: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      const totalShard = Math.floor(Math.random() * UNREAD_TOTAL_SHARD_COUNT);
      const totalRef = db.collection('user_unread_totals').doc(userId).collection('shards').doc(String(totalShard));
      batch.set(totalRef, {
        count: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });

      ops += 2;
      if (ops >= 400) break; // safety cap: 200 participants × 2
    }
    if (ops > 0) await batch.commit();
    log('INFO', 'Unread counters incremented', { conversationId, senderId, messageId, recipients: participants.length - 1 });
  } catch (err) {
    log('WARN', 'Unread counter increment failed', { conversationId, error: err.message });
  }
}

exports.onMessageCreated = functions.firestore
  .document('conversations/{conversationId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const data = snap.data() || {};
    const createdAt = data.createdAt || FieldValue.serverTimestamp();
    await incrementUnreadForMessage(context.params.conversationId, data.senderId || 'system', context.params.messageId, createdAt);
  });

exports.onShardedMessageCreated = functions.firestore
  .document('conversations/{conversationId}/messages_{year}_{month}/{messageId}')
  .onCreate(async (snap, context) => {
    const data = snap.data() || {};
    await incrementUnreadForMessage(context.params.conversationId, data.senderId || 'system', context.params.messageId, data.createdAt || FieldValue.serverTimestamp());
  });

// Join a group via an invite link. This MUST run server-side: adding yourself
// to `participants` is exactly the write the `conversations` update rule
// refuses for a non-admin, so the client `joinGroupViaInvite` transaction was
// always denied and the invite link did nothing. The Admin SDK bypasses rules,
// so the join is validated here (expiry, max uses) and applied atomically.
exports.joinGroupViaInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
  }
  const uid = context.auth.uid;
  const { inviteId } = data || {};
  if (!inviteId || typeof inviteId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'inviteId is required.');
  }

  await checkRateLimit(uid, 'joinGroupViaInvite', 10, 60000);

  const inviteRef = db.collection('group_invites').doc(inviteId);

  const outcome = await db.runTransaction(async (transaction) => {
    const inviteSnap = await transaction.get(inviteRef);
    if (!inviteSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Invite not found.');
    }
    const invite = inviteSnap.data();
    if (invite.revoked === true) {
      throw new functions.https.HttpsError('failed-precondition', 'Invite has been revoked.');
    }

    const conversationId = invite.conversationId;
    if (!conversationId || typeof conversationId !== 'string') {
      throw new functions.https.HttpsError('failed-precondition', 'Invite is not linked to a conversation.');
    }

    const convRef = db.collection('conversations').doc(conversationId);
    const convSnap = await transaction.get(convRef);
    if (!convSnap.exists) {
      throw new functions.https.HttpsError('not-found', 'Conversation not found.');
    }
    const conv = convSnap.data();
    const participants = Array.isArray(conv.participants) ? conv.participants : [];
    const alreadyMember = participants.includes(uid);

    const ownerUid = conv.ownerId || conv.createdBy;
    if (ownerUid && ownerUid !== uid) {
      const [b1, b2] = await Promise.all([
        transaction.get(db.collection('blocks').doc(`${uid}_${ownerUid}`)),
        transaction.get(db.collection('blocks').doc(`${ownerUid}_${uid}`)),
      ]);
      if (b1.exists || b2.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot join a group hosted by a blocked account.');
      }
    }

    const expiresMs = invite.expiresAt && typeof invite.expiresAt.toDate === 'function'
      ? invite.expiresAt.toDate().getTime()
      : null;
    if (expiresMs && expiresMs < Date.now()) {
      throw new functions.https.HttpsError('failed-precondition', 'Invite has expired.');
    }
    if (!alreadyMember && invite.maxUses && (invite.uses || 0) >= invite.maxUses) {
      throw new functions.https.HttpsError('failed-precondition', 'Invite has reached its maximum uses.');
    }

    if (alreadyMember) {
      return { conversationId, alreadyMember: true, pendingApproval: false };
    }

    if (conv.settings?.approvalRequired === true) {
      transaction.update(convRef, {
        [`joinRequests.${uid}`]: {
          userId: uid,
          inviteId,
          status: 'pending',
          requestedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { conversationId, alreadyMember: false, pendingApproval: true };
    }

    transaction.update(convRef, {
      participants: FieldValue.arrayUnion(uid),
      [`roles.${uid}`]: 'member',
      participantCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(inviteRef, { uses: FieldValue.increment(1) });

    const msgRef = convRef.collection('messages').doc();
    transaction.set(msgRef, {
      id: msgRef.id,
      conversationId,
      type: 'system',
      eventType: 'user_joined_via_invite',
      eventData: { userId: uid },
      senderId: 'system',
      senderName: 'System',
      createdAt: FieldValue.serverTimestamp(),
      isSystem: true,
    });

    return { conversationId, alreadyMember: false, pendingApproval: false };
  });

  log('INFO', 'Group invite processed', { uid, inviteId, ...outcome });
  return { success: true, ...outcome };
});

// ======================================================================
//  PART 2: SERVER-AUTHORITATIVE GROUP GOVERNANCE, INVITES & MENTIONS
// ======================================================================
const crypto = require('node:crypto');
const { getUserIdFromContext } = require('./auth');
const { writeNotification } = require('./notificationWriter');

const GROUP_ROLE_RANK = { owner: 4, admin: 3, moderator: 2, member: 1 };

function resolveGroupRole(conv, uid) {
  if (!conv || !uid) return null;
  if (!(conv.participants || []).includes(uid) && conv.ownerId !== uid && conv.createdBy !== uid) {
    return null;
  }
  if (conv.ownerId === uid || (!conv.ownerId && conv.createdBy === uid)) return 'owner';
  if (conv.roles?.[uid] && GROUP_ROLE_RANK[conv.roles[uid]]) return conv.roles[uid];
  if ((conv.admins || []).includes(uid)) return 'admin';
  if ((conv.moderators || []).includes(uid)) return 'moderator';
  return 'member';
}

async function isPairBlocked(a, b) {
  if (!a || !b || a === b) return false;
  const [ab, ba] = await Promise.all([
    db.collection('blocks').doc(`${a}_${b}`).get(),
    db.collection('blocks').doc(`${b}_${a}`).get(),
  ]);
  return ab.exists || ba.exists;
}

async function canAddTargetToGroup(actorUid, targetUid) {
  if (actorUid === targetUid) return true;
  if (await isPairBlocked(actorUid, targetUid)) return false;

  const targetSnap = await db.collection('users').doc(targetUid).get();
  if (!targetSnap.exists) return false;
  const scope = targetSnap.data()?.settings?.privacy?.whoCanAddToGroups || 'everyone';
  if (scope === 'none') return false;
  if (scope === 'everyone') return true;
  if (scope === 'friends') {
    const [f1, f2] = await Promise.all([
      db.collection('follows').doc(`${actorUid}_${targetUid}`).get(),
      db.collection('follows').doc(`${targetUid}_${actorUid}`).get(),
    ]);
    return f1.exists && f2.exists;
  }
  if (scope === 'followers') {
    const f = await db.collection('follows').doc(`${targetUid}_${actorUid}`).get();
    return f.exists;
  }
  return true;
}

exports.createGroupConversation = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'createGroupConversation', 10, 60000);

  const { name, description = '', photoURL = null, memberIds = [], settings = {} } = data || {};
  const cleanedName = typeof name === 'string' ? name.trim().slice(0, 80) : '';
  if (!cleanedName) {
    throw new functions.https.HttpsError('invalid-argument', 'A group name is required.');
  }

  const candidateIds = [...new Set(
    (Array.isArray(memberIds) ? memberIds : [])
      .filter((id) => typeof id === 'string' && id.trim() && id !== uid)
      .slice(0, 50)
  )];

  const allowedMembers = [uid];
  const skippedInvitees = [];
  for (const targetUid of candidateIds) {
    const ok = await canAddTargetToGroup(uid, targetUid);
    if (ok) allowedMembers.push(targetUid);
    else skippedInvitees.push(targetUid);
  }

  const convRef = db.collection('conversations').doc();
  const safeSettings = {
    whoCanSend: ['everyone', 'moderators', 'admins'].includes(settings?.whoCanSend) ? settings.whoCanSend : 'everyone',
    whoCanInvite: ['everyone', 'moderators', 'admins'].includes(settings?.whoCanInvite) ? settings.whoCanInvite : 'moderators',
    whoCanEditInfo: ['everyone', 'moderators', 'admins'].includes(settings?.whoCanEditInfo) ? settings.whoCanEditInfo : 'admins',
    whoCanModerate: ['moderators', 'admins'].includes(settings?.whoCanModerate) ? settings.whoCanModerate : 'moderators',
    whoCanPin: ['everyone', 'moderators', 'admins'].includes(settings?.whoCanPin) ? settings.whoCanPin : 'moderators',
    approvalRequired: settings?.approvalRequired === true,
  };

  const roles = { [uid]: 'owner' };
  for (const m of allowedMembers) {
    if (m !== uid) roles[m] = 'member';
  }

  const now = FieldValue.serverTimestamp();
  const groupDoc = {
    id: convRef.id,
    type: 'group',
    name: cleanedName,
    description: typeof description === 'string' ? description.trim().slice(0, 500) : '',
    photoURL: typeof photoURL === 'string' && photoURL.trim() ? photoURL.trim().slice(0, 500) : null,
    ownerId: uid,
    createdBy: uid,
    participants: allowedMembers,
    participantCount: allowedMembers.length,
    admins: [uid],
    moderators: [],
    mutedMembers: [],
    roles,
    settings: safeSettings,
    joinRequests: {},
    isActive: true,
    mutedBy: [],
    pinnedBy: [],
    archivedBy: [],
    pinnedMessages: [],
    lastRead: { [uid]: now },
    createdAt: now,
    updatedAt: now,
    lastActivity: now,
  };

  await convRef.set(groupDoc);
  const sysMsgRef = convRef.collection('messages').doc();
  await sysMsgRef.set({
    id: sysMsgRef.id,
    conversationId: convRef.id,
    type: 'system',
    senderId: 'system',
    senderName: 'System',
    content: `Group "${cleanedName}" created`,
    eventType: 'group_created',
    isSystem: true,
    createdAt: now,
  });

  await db.collection('last_messages').doc(convRef.id).set({
    messageId: sysMsgRef.id,
    senderId: 'system',
    type: 'system',
    text: `Group "${cleanedName}" created`,
    timestamp: now,
    updatedAt: now,
  });

  return {
    success: true,
    conversationId: convRef.id,
    addedCount: allowedMembers.length,
    skippedInvitees,
  };
});

exports.manageGroupMember = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'manageGroupMember', 40, 60000);

  const { conversationId, targetUserId, action, role = null, muted = null } = data || {};
  const validActions = ['add', 'remove', 'leave', 'assignRole', 'toggleMuteMember'];
  if (!conversationId || !validActions.includes(action)) {
    throw new functions.https.HttpsError('invalid-argument', 'conversationId and valid action required.');
  }

  const targetUid = action === 'leave' ? uid : targetUserId;
  if (!targetUid || typeof targetUid !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'targetUserId is required.');
  }

  const convRef = db.collection('conversations').doc(conversationId);
  await db.runTransaction(async (tx) => {
    const convSnap = await tx.get(convRef);
    if (!convSnap.exists) throw new functions.https.HttpsError('not-found', 'Conversation not found.');
    const conv = convSnap.data();
    if (conv.type !== 'group' && conv.type !== 'channel') {
      throw new functions.https.HttpsError('failed-precondition', 'Only group/channel conversations support member management.');
    }

    const actorRole = resolveGroupRole(conv, uid);
    if (!actorRole) throw new functions.https.HttpsError('permission-denied', 'You are not a member of this group.');
    const actorRank = GROUP_ROLE_RANK[actorRole] || 0;
    const targetRole = resolveGroupRole(conv, targetUid);
    const targetRank = GROUP_ROLE_RANK[targetRole] || 0;

    if (action === 'add') {
      const invitePolicy = conv.settings?.whoCanInvite || 'moderators';
      const minRank = invitePolicy === 'everyone' ? 1 : invitePolicy === 'admins' ? 3 : 2;
      if (actorRank < minRank) {
        throw new functions.https.HttpsError('permission-denied', 'You do not have permission to invite members.');
      }
      if ((conv.participants || []).includes(targetUid)) return;
      const ok = await canAddTargetToGroup(uid, targetUid);
      if (!ok) {
        throw new functions.https.HttpsError('permission-denied', 'Recipient privacy settings or a block prevent adding them.');
      }
      tx.update(convRef, {
        participants: FieldValue.arrayUnion(targetUid),
        [`roles.${targetUid}`]: 'member',
        participantCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (action === 'leave') {
      if (actorRole === 'owner') {
        const remaining = (conv.participants || []).filter((p) => p !== uid);
        if (remaining.length > 0) {
          throw new functions.https.HttpsError('failed-precondition', 'Transfer ownership to another member before leaving.');
        }
      }
      tx.update(convRef, {
        participants: FieldValue.arrayRemove(uid),
        admins: FieldValue.arrayRemove(uid),
        moderators: FieldValue.arrayRemove(uid),
        [`roles.${uid}`]: FieldValue.delete(),
        participantCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (action === 'remove') {
      if (actorRank < 2 || targetUid === uid || actorRank <= targetRank) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot remove a member of equal or higher rank.');
      }
      tx.update(convRef, {
        participants: FieldValue.arrayRemove(targetUid),
        admins: FieldValue.arrayRemove(targetUid),
        moderators: FieldValue.arrayRemove(targetUid),
        mutedMembers: FieldValue.arrayRemove(targetUid),
        [`roles.${targetUid}`]: FieldValue.delete(),
        participantCount: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (action === 'assignRole') {
      if (!['owner', 'admin', 'moderator', 'member'].includes(role)) {
        throw new functions.https.HttpsError('invalid-argument', 'Valid role required.');
      }
      if (!targetRole) throw new functions.https.HttpsError('not-found', 'Target user is not in this group.');
      if (actorRole !== 'owner' && (role === 'owner' || role === 'admin' || targetRank >= actorRank)) {
        throw new functions.https.HttpsError('permission-denied', 'Only the group owner can promote/demote admins or transfer ownership.');
      }
      const patch = {
        [`roles.${targetUid}`]: role,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (role === 'owner') {
        patch.ownerId = targetUid;
        patch[`roles.${uid}`] = 'admin';
        patch.admins = FieldValue.arrayUnion(targetUid, uid);
        patch.moderators = FieldValue.arrayRemove(targetUid);
      } else if (role === 'admin') {
        patch.admins = FieldValue.arrayUnion(targetUid);
        patch.moderators = FieldValue.arrayRemove(targetUid);
      } else if (role === 'moderator') {
        patch.admins = FieldValue.arrayRemove(targetUid);
        patch.moderators = FieldValue.arrayUnion(targetUid);
      } else {
        patch.admins = FieldValue.arrayRemove(targetUid);
        patch.moderators = FieldValue.arrayRemove(targetUid);
      }
      tx.update(convRef, patch);
    } else if (action === 'toggleMuteMember') {
      if (actorRank < 2 || actorRank <= targetRank) {
        throw new functions.https.HttpsError('permission-denied', 'Insufficient rank to mute/unmute this member.');
      }
      const shouldMute = muted !== null ? Boolean(muted) : !(conv.mutedMembers || []).includes(targetUid);
      tx.update(convRef, {
        mutedMembers: shouldMute ? FieldValue.arrayUnion(targetUid) : FieldValue.arrayRemove(targetUid),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return { success: true, conversationId, action, targetUserId: targetUid };
});

exports.updateGroupSettings = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'updateGroupSettings', 25, 60000);

  const { conversationId, name, description, photoURL, settings } = data || {};
  if (!conversationId) throw new functions.https.HttpsError('invalid-argument', 'conversationId is required.');

  const convRef = db.collection('conversations').doc(conversationId);
  const convSnap = await convRef.get();
  if (!convSnap.exists) throw new functions.https.HttpsError('not-found', 'Conversation not found.');
  const conv = convSnap.data();

  const role = resolveGroupRole(conv, uid);
  const rank = GROUP_ROLE_RANK[role] || 0;
  const editPolicy = conv.settings?.whoCanEditInfo || 'admins';
  const minEditRank = editPolicy === 'everyone' ? 1 : editPolicy === 'moderators' ? 2 : 3;

  if (rank < minEditRank && !settings) {
    throw new functions.https.HttpsError('permission-denied', 'Insufficient permissions to edit group info.');
  }

  const patch = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof name === 'string' && name.trim()) patch.name = name.trim().slice(0, 80);
  if (typeof description === 'string') patch.description = description.trim().slice(0, 500);
  if (typeof photoURL === 'string') patch.photoURL = photoURL.trim().slice(0, 500) || null;

  if (settings && typeof settings === 'object') {
    if (rank < 3) {
      throw new functions.https.HttpsError('permission-denied', 'Only group owners or admins can change group permissions.');
    }
    const existing = conv.settings || {};
    patch.settings = {
      whoCanSend: ['everyone', 'moderators', 'admins'].includes(settings.whoCanSend) ? settings.whoCanSend : (existing.whoCanSend || 'everyone'),
      whoCanInvite: ['everyone', 'moderators', 'admins'].includes(settings.whoCanInvite) ? settings.whoCanInvite : (existing.whoCanInvite || 'moderators'),
      whoCanEditInfo: ['everyone', 'moderators', 'admins'].includes(settings.whoCanEditInfo) ? settings.whoCanEditInfo : (existing.whoCanEditInfo || 'admins'),
      whoCanModerate: ['moderators', 'admins'].includes(settings.whoCanModerate) ? settings.whoCanModerate : (existing.whoCanModerate || 'moderators'),
      whoCanPin: ['everyone', 'moderators', 'admins'].includes(settings.whoCanPin) ? settings.whoCanPin : (existing.whoCanPin || 'moderators'),
      approvalRequired: typeof settings.approvalRequired === 'boolean' ? settings.approvalRequired : Boolean(existing.approvalRequired),
    };
  }

  await convRef.update(patch);
  return { success: true, conversationId };
});

exports.createGroupInvite = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'createGroupInvite', 15, 60000);

  const { conversationId, expiresInHours = 168, maxUses = 50 } = data || {};
  if (!conversationId) throw new functions.https.HttpsError('invalid-argument', 'conversationId is required.');

  const convSnap = await db.collection('conversations').doc(conversationId).get();
  if (!convSnap.exists) throw new functions.https.HttpsError('not-found', 'Conversation not found.');
  const conv = convSnap.data();

  const role = resolveGroupRole(conv, uid);
  const rank = GROUP_ROLE_RANK[role] || 0;
  const invitePolicy = conv.settings?.whoCanInvite || 'moderators';
  const minRank = invitePolicy === 'everyone' ? 1 : invitePolicy === 'admins' ? 3 : 2;
  if (rank < minRank) {
    throw new functions.https.HttpsError('permission-denied', 'You do not have permission to generate group invite links.');
  }

  const clampedHours = Math.min(Math.max(1, Number(expiresInHours) || 168), 24 * 30);
  const clampedUses = maxUses === null ? null : Math.min(Math.max(1, Number(maxUses) || 50), 5000);
  const inviteCode = crypto.randomBytes(12).toString('base64url');

  const inviteDoc = {
    conversationId,
    createdBy: uid,
    uses: 0,
    maxUses: clampedUses,
    revoked: false,
    expiresAt: Timestamp.fromMillis(Date.now() + clampedHours * 3600 * 1000),
    createdAt: FieldValue.serverTimestamp(),
  };

  await db.collection('group_invites').doc(inviteCode).set(inviteDoc);
  return {
    success: true,
    inviteId: inviteCode,
    maxUses: clampedUses,
    expiresAt: inviteDoc.expiresAt.toDate().toISOString(),
  };
});

exports.revokeGroupInvite = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'revokeGroupInvite', 20, 60000);

  const { inviteId } = data || {};
  if (!inviteId) throw new functions.https.HttpsError('invalid-argument', 'inviteId is required.');

  const inviteRef = db.collection('group_invites').doc(inviteId);
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) throw new functions.https.HttpsError('not-found', 'Invite not found.');
  const invite = inviteSnap.data();

  const convSnap = await db.collection('conversations').doc(invite.conversationId).get();
  const conv = convSnap.exists ? convSnap.data() : {};
  const rank = GROUP_ROLE_RANK[resolveGroupRole(conv, uid)] || 0;
  if (invite.createdBy !== uid && rank < 2) {
    throw new functions.https.HttpsError('permission-denied', 'Only the creator or a group moderator/admin can revoke this invite.');
  }

  await inviteRef.update({
    revoked: true,
    revokedBy: uid,
    revokedAt: FieldValue.serverTimestamp(),
  });
  return { success: true, inviteId };
});

exports.respondGroupJoinRequest = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'respondGroupJoinRequest', 30, 60000);

  const { conversationId, requesterId, decision } = data || {};
  if (!conversationId || !requesterId || !['approve', 'reject'].includes(decision)) {
    throw new functions.https.HttpsError('invalid-argument', 'conversationId, requesterId, and decision (approve|reject) required.');
  }

  const convRef = db.collection('conversations').doc(conversationId);
  await db.runTransaction(async (tx) => {
    const convSnap = await tx.get(convRef);
    if (!convSnap.exists) throw new functions.https.HttpsError('not-found', 'Conversation not found.');
    const conv = convSnap.data();
    const rank = GROUP_ROLE_RANK[resolveGroupRole(conv, uid)] || 0;
    if (rank < 2) {
      throw new functions.https.HttpsError('permission-denied', 'Moderator or admin permission required to review join requests.');
    }

    const patch = {
      [`joinRequests.${requesterId}`]: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (decision === 'approve' && !(conv.participants || []).includes(requesterId)) {
      patch.participants = FieldValue.arrayUnion(requesterId);
      patch[`roles.${requesterId}`] = 'member';
      patch.participantCount = FieldValue.increment(1);
    }

    tx.update(convRef, patch);
  });

  if (decision === 'approve') {
    await writeNotification(requesterId, {
      type: 'group_message',
      title: 'Join request approved',
      message: 'Your request to join the group has been approved.',
      senderId: uid,
      senderName: 'Group Admin',
      metadata: { conversationId },
    }).catch((err) => log('WARN', 'Join approval notification failed', { requesterId, error: err.message }));
  }

  return { success: true, conversationId, requesterId, decision };
});

exports.sendMentionNotifications = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'sendMentionNotifications', 30, 60000);

  const { conversationId, messageId, mentionedUserIds = [], snippet = '' } = data || {};
  if (!conversationId || !Array.isArray(mentionedUserIds) || mentionedUserIds.length === 0) {
    return { success: true, notified: 0 };
  }

  const convSnap = await db.collection('conversations').doc(conversationId).get();
  if (!convSnap.exists) throw new functions.https.HttpsError('not-found', 'Conversation not found.');
  const conv = convSnap.data();
  const participants = Array.isArray(conv.participants) ? conv.participants : [];
  if (!participants.includes(uid)) {
    throw new functions.https.HttpsError('permission-denied', 'Not a participant in this conversation.');
  }

  const senderInfo = await getUserDisplayInfo(uid);
  const mutedBy = Array.isArray(conv.mutedBy) ? conv.mutedBy : [];
  const targets = [...new Set(mentionedUserIds)]
    .filter((id) => id !== uid && participants.includes(id) && !mutedBy.includes(id))
    .slice(0, 15);

  let notified = 0;
  await Promise.allSettled(
    targets.map(async (targetId) => {
      if (await isPairBlocked(uid, targetId)) return;
      const settingsSnap = await db.collection('user_settings').doc(targetId).get();
      const prefs = settingsSnap.exists ? settingsSnap.data()?.notificationPreferences : null;
      if (prefs?.mentions === false) return;

      await writeNotification(targetId, {
        type: 'mention',
        title: `${senderInfo.displayName} mentioned you`,
        message: String(snippet || 'Mentioned you in a group chat').slice(0, 120),
        senderId: uid,
        senderName: senderInfo.displayName,
        metadata: { conversationId, messageId: messageId || null },
      });
      notified += 1;
    })
  );

  return { success: true, notified };
});

