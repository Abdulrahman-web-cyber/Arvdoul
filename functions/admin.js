// functions/admin.js — server-authoritative administrative actions.
//
// Administrative mutations (ban/suspend/verify, queue reads) must never be
// performed from the client: a client write is indistinguishable from a
// forged one. Every action here re-checks `admins/{uid}` membership on the
// server, writes an immutable audit entry, and only then touches user data.
//
// Required composite index:
//   user_reports: status ASC, createdAt DESC  (see firestore.indexes.json)

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { checkRateLimit } = require('./rateLimit');
const { assertAdmin, isAdmin, getUserIdFromContext } = require('./auth');

const db = admin.firestore();

// Fields an admin may legitimately change on another account, and the only
// values they may take. Anything not listed here is rejected outright.
const ADMIN_USER_ACTIONS = {
  ban: { accountStatus: 'banned' },
  suspend: { accountStatus: 'suspended' },
  unban: { accountStatus: 'active' },
  restore: { accountStatus: 'active' },
  verify: { isVerified: true },
  unverify: { isVerified: false },
};

async function writeAudit(actorUid, action, targetId, details = {}) {
  await db.collection('moderation_logs').add({
    actorId: actorUid,
    actorUid,
    action,
    targetId,
    targetType: 'user',
    details,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ----------------------------------------------------------------------
//  applyUserAdminAction — ban / suspend / restore / verify (admin only)
// ----------------------------------------------------------------------
exports.applyUserAdminAction = functions.https.onCall(async (data, context) => {
  const actorUid = await assertAdmin(context);
  await checkRateLimit(actorUid, 'applyUserAdminAction', 60, 60000);

  const { userId, action } = data || {};
  if (!userId || typeof userId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'A userId is required.');
  }
  const patch = ADMIN_USER_ACTIONS[action];
  if (!patch) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `action must be one of: ${Object.keys(ADMIN_USER_ACTIONS).join(', ')}.`
    );
  }

  const userRef = db.doc(`users/${userId}`);
  const snap = await userRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found.');
  }

  await userRef.update({
    ...patch,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await writeAudit(actorUid, action, userId, patch);

  return { success: true, userId, action, applied: patch };
});

// ----------------------------------------------------------------------
//  applyVerificationDecision — approve/reject a creator application
// ----------------------------------------------------------------------
exports.applyVerificationDecision = functions.https.onCall(async (data, context) => {
  const actorUid = await assertAdmin(context);
  await checkRateLimit(actorUid, 'applyVerificationDecision', 60, 60000);

  const { applicationId, decision, reason = '' } = data || {};
  if (!applicationId || !['approved', 'rejected'].includes(decision)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'applicationId and decision (approved|rejected) are required.'
    );
  }

  const appRef = db.doc(`creator_verifications/${applicationId}`);
  const appSnap = await appRef.get();
  if (!appSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Verification application not found.');
  }

  const applicantUserId = appSnap.data().userId;
  const userRef = applicantUserId ? db.doc(`users/${applicantUserId}`) : null;

  await db.runTransaction(async (tx) => {
    const patch = {
      status: decision,
      reviewedBy: actorUid,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (decision === 'rejected') {
      patch.rejectionReason = String(reason).slice(0, 500);
    }
    tx.update(appRef, patch);

    // Granting the badge is a server-authoritative change to the user doc.
    if (decision === 'approved' && userRef) {
      tx.update(userRef, {
        isVerified: true,
        isCreator: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        verifiedBy: actorUid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  await writeAudit(
    actorUid,
    decision === 'approved' ? 'CREATOR_VERIFICATION_APPROVED' : 'CREATOR_VERIFICATION_REJECTED',
    applicationId,
    { applicantUserId, reason: decision === 'rejected' ? String(reason).slice(0, 500) : undefined }
  );

  return { success: true, applicationId, decision };
});

// ----------------------------------------------------------------------
//  listUsers — paginated user directory (admin only)
// ----------------------------------------------------------------------
exports.listUsers = functions.https.onCall(async (data, context) => {
  const actorUid = await assertAdmin(context);
  await checkRateLimit(actorUid, 'listUsers', 30, 60000);

  const { limit: rawLimit = 50 } = data || {};
  const limitCount = Math.min(Math.max(Number(rawLimit) || 50, 1), 200);

  const snap = await db.collection('users')
    .orderBy('createdAt', 'desc')
    .limit(limitCount)
    .get();

  return {
    success: true,
    users: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
});

// ----------------------------------------------------------------------
//  resolveUserReport — moderation queue resolution (admin only)
// ----------------------------------------------------------------------
exports.resolveUserReport = functions.https.onCall(async (data, context) => {
  const actorUid = await assertAdmin(context);
  await checkRateLimit(actorUid, 'resolveUserReport', 60, 60000);

  const { reportId, action, reason = '' } = data || {};
  if (!reportId || !['resolved', 'dismissed', 'escalated'].includes(action)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'reportId and action (resolved|dismissed|escalated) are required.'
    );
  }

  const reportRef = db.doc(`user_reports/${reportId}`);
  const snap = await reportRef.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('not-found', 'Report not found.');
  }

  await reportRef.update({
    status: action,
    resolutionReason: String(reason).slice(0, 500),
    resolvedBy: actorUid,
    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await writeAudit(actorUid, 'resolve_report', reportId, { action });

  return { success: true, reportId, status: action };
});

// ----------------------------------------------------------------------
//  Admin roster management
//
//  `admins/{uid}` is written by the server only (see firestore.rules), which
//  is correct but left no way to create the *first* admin. bootstrapOwner
//  closes that gap: the platform owner, identified by the OWNER_EMAILS
//  function environment variable set at deploy time, can claim admin after
//  signing in with a verified email. Every grant/revoke is audited, and
//  revoking the final admin is refused so the platform cannot lock itself out
//  of its own moderation tools.
// ----------------------------------------------------------------------

const configuredOwnerEmails = () =>
  (process.env.OWNER_EMAILS || process.env.OWNER_EMAIL || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

async function adminCount() {
  const snap = await db.collection('admins').limit(2).get();
  return snap.size;
}

/** Idempotent grant. Returns { created: false } when the grant already existed. */
async function grantAdmin(actorUid, targetUid, reason) {
  const ref = db.doc(`admins/${targetUid}`);
  const existing = await ref.get();
  if (existing.exists) return { created: false };
  await ref.set({
    grantedBy: actorUid,
    grantedAt: admin.firestore.FieldValue.serverTimestamp(),
    reason: String(reason || '').slice(0, 500),
  });
  return { created: true };
}

// ----------------------------------------------------------------------
//  bootstrapOwner — one-time path to the first admin account
// ----------------------------------------------------------------------
exports.bootstrapOwner = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  await checkRateLimit(uid, 'bootstrapOwner', 5, 60000);

  const owners = configuredOwnerEmails();
  if (owners.length === 0) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No OWNER_EMAILS is configured for this functions deployment. Set it and redeploy before claiming ownership.'
    );
  }

  const email = String(context.auth.token.email || '').toLowerCase();
  if (!email || !owners.includes(email)) {
    throw new functions.https.HttpsError('permission-denied', 'This account is not a configured platform owner.');
  }
  // A verified email is what makes ownership of the address provable.
  if (context.auth.token.email_verified !== true) {
    throw new functions.https.HttpsError('failed-precondition', 'Verify your email address before claiming ownership.');
  }

  const { created } = await grantAdmin(uid, uid, 'owner bootstrap');
  await writeAudit(uid, created ? 'admin_bootstrap' : 'admin_bootstrap_noop', uid, { email });
  return { success: true, created, uid };
});

// ----------------------------------------------------------------------
//  grantAdmin / revokeAdmin / listAdmins (existing admins only)
// ----------------------------------------------------------------------
exports.grantAdmin = functions.https.onCall(async (data, context) => {
  const actorUid = await assertAdmin(context);
  await checkRateLimit(actorUid, 'grantAdmin', 30, 60000);

  const { userId, reason = '' } = data || {};
  if (!userId || typeof userId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'A userId is required.');
  }
  const target = await db.doc(`users/${userId}`).get();
  if (!target.exists) {
    throw new functions.https.HttpsError('not-found', 'User not found.');
  }

  const { created } = await grantAdmin(actorUid, userId, reason);
  await writeAudit(actorUid, created ? 'admin_grant' : 'admin_grant_noop', userId, { reason });
  return { success: true, userId, created };
});

exports.revokeAdmin = functions.https.onCall(async (data, context) => {
  const actorUid = await assertAdmin(context);
  await checkRateLimit(actorUid, 'revokeAdmin', 30, 60000);

  const { userId } = data || {};
  if (!userId || typeof userId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'A userId is required.');
  }

  // The last-admin guard runs inside the transaction so two concurrent revokes
  // cannot both pass a check and strip the platform of its final admin.
  await db.runTransaction(async (tx) => {
    const roster = await tx.get(db.collection('admins').limit(2));
    if (roster.size <= 1) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Refusing to remove the last admin: the platform would lose all moderation access.'
      );
    }
    const target = await tx.get(db.doc(`admins/${userId}`));
    if (!target.exists) {
      throw new functions.https.HttpsError('not-found', 'That account is not an admin.');
    }
    tx.delete(db.doc(`admins/${userId}`));
  });
  await writeAudit(actorUid, 'admin_revoke', userId, {});
  return { success: true, userId };
});

exports.listAdmins = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);
  const snap = await db.collection('admins').get();
  return {
    success: true,
    admins: snap.docs.map((d) => ({ uid: d.id, ...d.data() })),
  };
});

// ----------------------------------------------------------------------
//  getAdminStatus — lets a signed-in client learn its *own* admin status
//  without read access to the whole admins collection.
// ----------------------------------------------------------------------
exports.getAdminStatus = functions.https.onCall(async (data, context) => {
  const uid = getUserIdFromContext(context);
  return { success: true, isAdmin: await isAdmin(uid) };
});