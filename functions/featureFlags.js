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
// Canonical admin helpers and audit writer — never re-declared locally, so an
// account cannot be admin for one endpoint and not another (see AGENTS.md).
const { assertAdmin } = require('./auth');
const { checkRateLimit } = require('./rateLimit');
const { writeAudit } = require('./admin');
const { DEFAULT_FLAGS, isKnownFlag } = require('./featureFlagRegistry.cjs');

const db = admin.firestore();

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
  await writeAudit(
    actorUid,
    clearing ? 'feature_flag_cleared' : 'feature_flag_overridden',
    flag,
    { value: record.value, overridden: record.overridden },
    'feature_flag'
  );

  return { success: true, flag, value: record.value, overridden: record.overridden };
});
