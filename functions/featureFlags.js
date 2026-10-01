/**
 * functions/featureFlags.js - SERVER-AUTHORITATIVE FEATURE FLAG GOVERNANCE
 *
 * Platform-wide kill switches are governance records, not per-device
 * preferences. The admin console cannot write them directly:
 *   - firestore.rules restricts `feature_flags/*` writes to admins, and
 *   - every change here re-checks `admins/{uid}`, validates the flag against the
 *     canonical registry (fail-closed on unknown names) and appends to
 *     moderation_logs so the decision is auditable.
 *
 * The registry is the shared CommonJS module synced by
 * scripts/sync-shared-config.mjs, so client and server cannot drift.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { DEFAULT_FLAGS, isKnownFlag } = require('./featureFlagRegistry.cjs');

const db = admin.firestore();

function getUserIdFromContext(context) {
  if (!context || !context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
  }
  return context.auth.uid;
}

async function assertAdmin(context) {
  const uid = getUserIdFromContext(context);
  const snap = await db.collection('admins').doc(uid).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('permission-denied', 'Administrator access required.');
  }
  return uid;
}

async function checkRateLimit(uid, key, max, windowMs) {
  const ref = db.collection('rate_limits').doc(`${uid}_${key}`);
  const now = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;
    if (!data || now - (data.windowStart || 0) > windowMs) {
      tx.set(ref, { windowStart: now, count: 1, updatedAt: now });
      return;
    }
    if ((data.count || 0) >= max) {
      throw new functions.https.HttpsError('resource-exhausted', 'Too many requests. Slow down.');
    }
    tx.set(ref, { ...data, count: (data.count || 0) + 1, updatedAt: now });
  });
}

async function writeAudit(actorUid, action, targetId, details = {}) {
  await db.collection('moderation_logs').add({
    action,
    actorId: actorUid,
    targetType: 'feature_flag',
    targetId,
    details,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

function coerce(flagName, value) {
  const def = DEFAULT_FLAGS[flagName];
  if (def.type === 'boolean') return value === true || value === 'true';
  if (def.type === 'number') {
    const n = Number(value);
    return Number.isFinite(n) ? n : def.defaultValue;
  }
  return String(value);
}

/** Platform-wide flag overrides, for the client overlay. Admin-only. */
exports.getFeatureFlagOverrides = functions.https.onCall(async (data, context) => {
  await assertAdmin(context);
  const snap = await db.collection('feature_flags').get();
  const overrides = {};
  snap.docs.forEach((doc) => {
    const record = doc.data();
    if (record && record.overridden === true && record.value !== undefined) {
      overrides[doc.id] = record.value;
    }
  });
  return { success: true, overrides };
});

/** Sets (or clears) a platform-wide override. Admin-only, audited. */
exports.setFeatureFlagOverride = functions.https.onCall(async (data, context) => {
  const actorUid = await assertAdmin(context);
  await checkRateLimit(actorUid, 'setFeatureFlagOverride', 60, 60000);

  const { flag, value } = data || {};
  if (!flag || !isKnownFlag(flag)) {
    throw new functions.https.HttpsError('invalid-argument', 'Unknown or missing flag.');
  }

  const def = DEFAULT_FLAGS[flag];
  const clearing = value === null || value === undefined;
  const record = {
    value: clearing ? def.defaultValue : coerce(flag, value),
    overridden: !clearing,
    type: def.type,
    updatedBy: actorUid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection('feature_flags').doc(flag).set(record, { merge: true });
  await writeAudit(actorUid, clearing ? 'feature_flag_cleared' : 'feature_flag_overridden', flag, {
    value: record.value,
    overridden: record.overridden,
  });

  return { success: true, flag, value: record.value, overridden: record.overridden };
});
