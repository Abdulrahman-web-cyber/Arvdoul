// functions/calls.js — server-authoritative voice & video call lifecycle + signaling state
//
// Enforces:
//   - mutual blocks (neither party can call the other)
//   - recipient `settings.privacy.whoCanCall` ('everyone' | 'friends' | 'followers' | 'none')
//   - participant limit (max 6 for group calls)
//   - deterministic 1:1 callId reuse when ringing or active, preserving N114 parity
//   - 12-state lifecycle state machine validation (`initiated` -> `ringing` -> `accepted` -> `connecting` -> `connected` <-> `reconnecting` -> `ended` + terminal states)
//   - honest STUN/TURN & SFU capability reporting (never fabricates TURN/SFU credentials)

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { logger } = require('./logger');
const { checkRateLimit } = require('./rateLimit');
const { getUserIdFromContext, getRuntimeConfig } = require('./auth');
const { writeNotification } = require('./notificationWriter');
const { enqueuePush } = require('./pushQueue');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const MAX_GROUP_CALL_PARTICIPANTS = 6;
const RING_TIMEOUT_MS = 45000;

const VALID_TRANSITIONS = {
  initiated: new Set(['initiated', 'ringing', 'cancelled', 'failed']),
  ringing: new Set(['ringing', 'accepted', 'rejected', 'missed', 'cancelled', 'timed_out', 'failed', 'ended']),
  accepted: new Set(['accepted', 'connecting', 'connected', 'ended', 'failed', 'cancelled']),
  connecting: new Set(['connecting', 'connected', 'reconnecting', 'ended', 'failed']),
  connected: new Set(['connected', 'reconnecting', 'ended', 'failed']),
  reconnecting: new Set(['reconnecting', 'connected', 'ended', 'failed']),
  ended: new Set(['ended']),
  rejected: new Set(['rejected']),
  missed: new Set(['missed']),
  cancelled: new Set(['cancelled']),
  failed: new Set(['failed']),
  timed_out: new Set(['timed_out']),
};

const TERMINAL_STATES = new Set(['ended', 'rejected', 'missed', 'cancelled', 'failed', 'timed_out']);

function httpError(code, message) {
  return new functions.https.HttpsError(code, message);
}

function getIceConfiguration() {
  const turnUrlsRaw = getRuntimeConfig('TURN_URLS', 'webrtc.turn_urls');
  const turnUsername = getRuntimeConfig('TURN_USERNAME', 'webrtc.turn_username');
  const turnCredential = getRuntimeConfig('TURN_CREDENTIAL', 'webrtc.turn_credential');
  const sfuEndpoint = getRuntimeConfig('SFU_ENDPOINT', 'webrtc.sfu_endpoint');

  const iceServers = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];

  let turnConfigured = false;
  if (turnUrlsRaw && turnUsername && turnCredential) {
    const urls = String(turnUrlsRaw)
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length > 0) {
      iceServers.push({
        urls,
        username: String(turnUsername),
        credential: String(turnCredential),
      });
      turnConfigured = true;
    }
  }

  return {
    iceServers,
    turnConfigured,
    sfuConfigured: Boolean(sfuEndpoint),
    sfuEndpoint: sfuEndpoint ? String(sfuEndpoint) : null,
  };
}

async function isMutuallyBlocked(uidA, uidB) {
  const [ab, ba] = await Promise.all([
    db.collection('blocks').doc(`${uidA}_${uidB}`).get(),
    db.collection('blocks').doc(`${uidB}_${uidA}`).get(),
  ]);
  return ab.exists || ba.exists;
}

async function canCallerReachRecipient(callerId, recipientId) {
  if (callerId === recipientId) return { allowed: true };
  if (await isMutuallyBlocked(callerId, recipientId)) {
    return { allowed: false, code: 'permission-denied', reason: 'Calls are unavailable between blocked accounts.' };
  }

  const targetSnap = await db.collection('users').doc(recipientId).get();
  if (!targetSnap.exists) {
    return { allowed: false, code: 'not-found', reason: 'Recipient account not found.' };
  }
  const targetData = targetSnap.data() || {};
  const whoCanCall = targetData?.settings?.privacy?.whoCanCall || 'everyone';

  if (whoCanCall === 'none') {
    return { allowed: false, code: 'permission-denied', reason: 'Recipient has disabled incoming calls.' };
  }
  if (whoCanCall === 'friends') {
    const [f1, f2] = await Promise.all([
      db.collection('follows').doc(`${callerId}_${recipientId}`).get(),
      db.collection('follows').doc(`${recipientId}_${callerId}`).get(),
    ]);
    if (!f1.exists || !f2.exists) {
      return { allowed: false, code: 'permission-denied', reason: 'Recipient only accepts calls from friends.' };
    }
  } else if (whoCanCall === 'followers') {
    const f1 = await db.collection('follows').doc(`${recipientId}_${callerId}`).get();
    if (!f1.exists) {
      return { allowed: false, code: 'permission-denied', reason: 'Recipient only accepts calls from accounts they follow.' };
    }
  }
  return { allowed: true };
}

exports.initiateCall = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'initiateCall', 10, 60000);

  const { conversationId = null, recipientIds = [], callType = 'audio', callId: requestedCallId = null } = data || {};
  if (!['audio', 'video'].includes(callType)) {
    throw httpError('invalid-argument', 'callType must be audio or video.');
  }

  let participants = [];
  let conv = null;
  if (conversationId && typeof conversationId === 'string') {
    const convSnap = await db.collection('conversations').doc(conversationId).get();
    if (!convSnap.exists) {
      throw httpError('not-found', 'Conversation not found.');
    }
    conv = convSnap.data();
    if (!(conv.participants || []).includes(uid)) {
      throw httpError('permission-denied', 'You are not a participant in this conversation.');
    }
    participants = [...new Set([uid, ...(conv.participants || [])])];
  } else if (Array.isArray(recipientIds) && recipientIds.length > 0) {
    participants = [...new Set([uid, ...recipientIds.filter((id) => typeof id === 'string' && id.trim())])];
  } else {
    throw httpError('invalid-argument', 'conversationId or recipientIds is required.');
  }

  if (participants.length < 2) {
    throw httpError('invalid-argument', 'At least one other participant is required.');
  }
  if (participants.length > MAX_GROUP_CALL_PARTICIPANTS) {
    throw httpError('failed-precondition', `Calls support up to ${MAX_GROUP_CALL_PARTICIPANTS} participants.`);
  }

  const callees = participants.filter((id) => id !== uid);
  for (const calleeId of callees) {
    const check = await canCallerReachRecipient(uid, calleeId);
    if (!check.allowed) {
      throw httpError(check.code || 'permission-denied', check.reason);
    }
  }

  const isGroup = Boolean(conv?.type === 'group' || participants.length > 2);
  const deterministicCallId = !isGroup && participants.length === 2
    ? `call_${[...participants].sort().join('_')}`
    : (typeof requestedCallId === 'string' && requestedCallId.trim()
        ? requestedCallId.trim()
        : db.collection('calls').doc().id);

  const callRef = db.collection('calls').doc(deterministicCallId);
  const callerSnap = await db.collection('users').doc(uid).get();
  const callerData = callerSnap.exists ? callerSnap.data() : {};
  const callerName = callerData.displayName || callerData.username || 'Citizen';
  const iceConfig = getIceConfiguration();

  const existingSnap = await callRef.get();
  if (existingSnap.exists) {
    const existing = existingSnap.data();
    if (!TERMINAL_STATES.has(existing.status) && existing.expiresAt?.toMillis?.() > Date.now()) {
      return {
        success: true,
        reused: true,
        call: { id: callRef.id, ...existing },
        ...iceConfig,
      };
    }
  }

  const nowMs = Date.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(nowMs + RING_TIMEOUT_MS);
  const callDoc = {
    id: callRef.id,
    conversationId: conversationId || null,
    callerId: uid,
    callerName,
    callerPhoto: callerData.photoURL || null,
    calleeIds: callees,
    participants,
    acceptedBy: [uid],
    callType,
    isGroup,
    status: 'ringing',
    ringTimeoutMs: RING_TIMEOUT_MS,
    initiatedAt: FieldValue.serverTimestamp(),
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    endedAt: null,
    durationSeconds: 0,
    turnConfigured: iceConfig.turnConfigured,
    sfuConfigured: iceConfig.sfuConfigured,
  };

  await callRef.set(callDoc);

  // Dispatch incoming call alerts (honoring user notification category opt-outs inside notifications/prefs)
  await Promise.allSettled(
    callees.map(async (calleeId) => {
      const settingsSnap = await db.collection('user_settings').doc(calleeId).get();
      const prefs = settingsSnap.exists ? settingsSnap.data()?.notificationPreferences : null;
      if (prefs?.callNotifications === false) return;

      await writeNotification(calleeId, {
        type: 'incoming_call',
        title: `Incoming ${callType} call`,
        message: `${callerName} is calling you`,
        senderId: uid,
        senderName: callerName,
        metadata: {
          callId: callRef.id,
          conversationId: conversationId || callRef.id,
          callType,
          clickAction: `/call/${conversationId || callRef.id}`,
        },
      }).catch((err) => logger.warn('incoming_call notification write failed', { calleeId, error: err.message }));

      if (prefs?.push !== false) {
        await enqueuePush(calleeId, {
          title: `Incoming ${callType} call`,
          body: `${callerName} is calling you`,
          type: 'incoming_call',
          priority: 'high',
          conversationId: conversationId || callRef.id,
          clickAction: `/call/${conversationId || callRef.id}`,
          data: { callId: callRef.id, conversationId: conversationId || callRef.id, callType },
        }).catch((err) => logger.warn('incoming_call push enqueue failed', { calleeId, error: err.message }));
      }
    })
  );

  return {
    success: true,
    reused: false,
    call: { ...callDoc, initiatedAt: new Date(nowMs).toISOString(), createdAt: new Date(nowMs).toISOString() },
    ...iceConfig,
  };
});

exports.respondToCall = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'respondToCall', 30, 60000);

  const { callId, action } = data || {};
  const allowedActions = ['accept', 'reject', 'cancel', 'miss', 'timeout'];
  if (!callId || typeof callId !== 'string' || !allowedActions.includes(action)) {
    throw httpError('invalid-argument', 'callId and valid action (accept|reject|cancel|miss|timeout) required.');
  }

  const statusMap = {
    accept: 'accepted',
    reject: 'rejected',
    cancel: 'cancelled',
    miss: 'missed',
    timeout: 'timed_out',
  };
  const nextStatus = statusMap[action];
  const callRef = db.collection('calls').doc(callId);

  const outcome = await db.runTransaction(async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists) {
      throw httpError('not-found', 'Call session not found.');
    }
    const call = snap.data();
    const participants = Array.isArray(call.participants) ? call.participants : [];
    if (!participants.includes(uid)) {
      throw httpError('permission-denied', 'You are not a participant in this call.');
    }
    if (action === 'cancel' && call.callerId !== uid && participants.length <= 2) {
      throw httpError('permission-denied', 'Only the caller can cancel a ringing call.');
    }

    const currentStatus = call.status || 'ringing';
    if (!VALID_TRANSITIONS[currentStatus]?.has(nextStatus)) {
      throw httpError('failed-precondition', `Invalid call transition from ${currentStatus} to ${nextStatus}.`);
    }
    if (action === 'accept' && call.expiresAt?.toMillis?.() && call.expiresAt.toMillis() < Date.now()) {
      tx.update(callRef, {
        status: 'timed_out',
        endedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      throw httpError('deadline-exceeded', 'This call request has expired.');
    }

    const patch = {
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (action === 'accept') {
      patch.acceptedAt = FieldValue.serverTimestamp();
      patch.acceptedBy = FieldValue.arrayUnion(uid);
    } else {
      patch.endedAt = FieldValue.serverTimestamp();
      patch.endedBy = uid;
    }
    tx.update(callRef, patch);
    return { call, nextStatus };
  });

  if (nextStatus === 'missed' || nextStatus === 'timed_out') {
    const callees = Array.isArray(outcome.call.calleeIds) ? outcome.call.calleeIds : [];
    await Promise.allSettled(
      callees.map((calleeId) =>
        writeNotification(calleeId, {
          type: 'missed_call',
          title: 'Missed call',
          message: `You missed a ${outcome.call.callType || 'voice'} call from ${outcome.call.callerName || 'a citizen'}`,
          senderId: outcome.call.callerId,
          senderName: outcome.call.callerName || 'Citizen',
          metadata: {
            callId,
            conversationId: outcome.call.conversationId || callId,
            callType: outcome.call.callType || 'audio',
          },
        }).catch((err) => logger.warn('missed_call notification failed', { calleeId, error: err.message }))
      )
    );
  }

  return { success: true, callId, status: nextStatus, ...getIceConfiguration() };
});

exports.updateCallSessionState = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'updateCallSessionState', 60, 60000);

  const { callId, state, reason = '' } = data || {};
  if (!callId || typeof callId !== 'string' || !VALID_TRANSITIONS[state]) {
    throw httpError('invalid-argument', 'Valid callId and target state are required.');
  }

  const callRef = db.collection('calls').doc(callId);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists) {
      throw httpError('not-found', 'Call session not found.');
    }
    const call = snap.data();
    const participants = Array.isArray(call.participants) ? call.participants : [];
    if (!participants.includes(uid)) {
      throw httpError('permission-denied', 'You are not a participant in this call.');
    }

    const current = call.status || 'initiated';
    if (!VALID_TRANSITIONS[current]?.has(state)) {
      throw httpError('failed-precondition', `Transition ${current} -> ${state} is not permitted.`);
    }

    const patch = {
      status: state,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (state === 'connected' && !call.connectedAt) {
      patch.connectedAt = FieldValue.serverTimestamp();
    }
    if (TERMINAL_STATES.has(state)) {
      patch.endedAt = FieldValue.serverTimestamp();
      patch.endedBy = uid;
      if (reason && typeof reason === 'string') {
        patch.endReason = reason.slice(0, 120);
      }
      const connectedMs = call.connectedAt?.toMillis?.() || 0;
      if (connectedMs > 0) {
        patch.durationSeconds = Math.max(0, Math.round((Date.now() - connectedMs) / 1000));
      }
    }
    tx.update(callRef, patch);
    return { status: state, durationSeconds: patch.durationSeconds ?? call.durationSeconds ?? 0 };
  });

  return { success: true, callId, ...result };
});

exports.getCallHistory = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'getCallHistory', 30, 60000);

  const requestedLimit = Math.min(Math.max(1, Number(data?.limit) || 25), 50);
  const snap = await db.collection('calls')
    .where('participants', 'array-contains', uid)
    .orderBy('createdAt', 'desc')
    .limit(requestedLimit)
    .get();

  const calls = snap.docs.map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      conversationId: d.conversationId || null,
      callerId: d.callerId || null,
      callerName: d.callerName || null,
      callerPhoto: d.callerPhoto || null,
      calleeIds: Array.isArray(d.calleeIds) ? d.calleeIds : [],
      participants: Array.isArray(d.participants) ? d.participants : [],
      callType: d.callType || 'audio',
      isGroup: Boolean(d.isGroup),
      status: d.status || 'ended',
      durationSeconds: Number(d.durationSeconds || 0),
      initiatedAt: d.initiatedAt?.toDate?.()?.toISOString?.() || null,
      endedAt: d.endedAt?.toDate?.()?.toISOString?.() || null,
      createdAt: d.createdAt?.toDate?.()?.toISOString?.() || null,
    };
  });

  return { success: true, calls, ...getIceConfiguration() };
});
