// functions/privacyMigration.js — PII boundary backfill + reconciliation.
//
// users/{uid} is readable by every signed-in user (feeds, search, follower
// lists) and Firestore rules cannot field-mask a readable document. Contact
// details, verification flags and Stripe identifiers therefore live on
// users_private/{uid}, which only the owner and admins may read.
//
// Accounts created before the split still carry those fields on the public
// document. This module backfills them into users_private and scrubs them from
// users/{uid}. Every step is idempotent: a migrated (or clean) user is a no-op,
// so the sweep can be re-run, retried and resumed safely.
//
// Required composite index: none (paged on document id).

const admin = require('firebase-admin');
const functions = require('firebase-functions');
const { assertAdmin } = require('./auth');

const db = admin.firestore();

// Must stay in step with PRIVATE_PROFILE_FIELDS in
// src/config/profileContracts.js and touchesPrivateProfileFields() in
// firestore.rules. src/__tests__/profilePiiBoundary.test.js guards the parity.
const PRIVATE_FIELDS = [
  'email',
  'phoneNumber',
  'emailVerified',
  'phoneVerified',
  'stripeCustomerId',
  'stripeAccountId',
  'stripeSubscriptionId',
];

const USERS = 'users';
const PRIVATE = 'users_private';
const MIGRATION_COLLECTION = 'privacy_migrations';
const CURSOR_DOC = 'system_state/privacy_migration';

const PAGE_SIZE = 200;
const MAX_USERS_PER_RUN = 2000;

function pickPrivateFields(data) {
  const out = {};
  for (const field of PRIVATE_FIELDS) {
    if (data[field] !== undefined) out[field] = data[field];
  }
  return out;
}

/**
 * Backfill and scrub a single user. Returns what was done, so a caller can log
 * or audit the run. Safe to call concurrently: the private write is a merge and
 * the public scrub is idempotent.
 */
async function migrateUser(userId) {
  const userRef = db.collection(USERS).doc(userId);
  const privateRef = db.collection(PRIVATE).doc(userId);
  const [userSnap, privateSnap] = await Promise.all([userRef.get(), privateRef.get()]);

  if (!userSnap.exists) return { userId, status: 'missing', copied: 0, scrubbed: 0 };

  const leaked = pickPrivateFields(userSnap.data() || {});
  const leakedKeys = Object.keys(leaked);
  const existing = privateSnap.exists ? privateSnap.data() || {} : {};

  // Never overwrite a value already on the private doc; only fill the gaps so a
  // newer private write cannot be clobbered by a stale public field.
  const toCopy = {};
  for (const [key, value] of Object.entries(leaked)) {
    if (existing[key] === undefined) toCopy[key] = value;
  }

  const copied = Object.keys(toCopy).length;
  if (copied > 0) {
    await privateRef.set(
      { uid: userId, ...toCopy, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );
  }

  let scrubbed = 0;
  if (leakedKeys.length > 0) {
    const deletions = {};
    for (const key of leakedKeys) deletions[key] = admin.firestore.FieldValue.delete();
    await userRef.update(deletions);
    scrubbed = leakedKeys.length;
  }

  const status = copied > 0 || scrubbed > 0 ? 'migrated' : 'clean';
  if (status === 'migrated') {
    await db.collection(MIGRATION_COLLECTION).doc(userId).set(
      {
        userId,
        status,
        copied,
        scrubbed,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  return { userId, status, copied, scrubbed };
}

/**
 * Paged sweep over users/{uid}. Resumes from a stored cursor so a large
 * collection converges across runs instead of timing out; when the cursor
 * reaches the end it resets, so newly created accounts are picked up next run.
 */
async function sweep({ maxUsers = MAX_USERS_PER_RUN } = {}) {
  const cursorRef = db.doc(CURSOR_DOC);
  const cursorSnap = await cursorRef.get();
  const lastDocId = cursorSnap.exists ? cursorSnap.data()?.lastDocId || null : null;

  let query = db.collection(USERS).orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
  if (lastDocId) {
    query = query.startAfter(lastDocId);
  }

  const summary = { scanned: 0, migrated: 0, clean: 0, missing: 0, complete: false };
  let cursor = lastDocId;

  while (summary.scanned < maxUsers) {
    const snap = await query.get();
    if (snap.empty) {
      // Reached the end: restart from the top on the next run.
      summary.complete = true;
      cursor = null;
      break;
    }

    for (const docSnap of snap.docs) {
      const result = await migrateUser(docSnap.id);
      summary.scanned += 1;
      if (result.status === 'migrated') summary.migrated += 1;
      else if (result.status === 'clean') summary.clean += 1;
      else summary.missing += 1;
      if (summary.scanned >= maxUsers) break;
    }

    cursor = snap.docs[snap.docs.length - 1].id;
    if (snap.size < PAGE_SIZE) {
      summary.complete = true;
      cursor = null;
      break;
    }
    query = db.collection(USERS)
      .orderBy(admin.firestore.FieldPath.documentId())
      .startAfter(cursor)
      .limit(PAGE_SIZE);
  }

  await cursorRef.set(
    {
      lastDocId: cursor,
      lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSummary: summary,
    },
    { merge: true },
  );

  return summary;
}

// Daily reconciliation sweep. Bounded per run; idempotent, so a partial run
// simply resumes from the stored cursor.
exports.reconcilePrivacyBoundary = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('every 24 hours')
  .onRun(async () => {
    const summary = await sweep();
    console.log('privacy boundary sweep', summary);
    return null;
  });

// Manual backfill for an operator. Admin-only; rate limited by the caller's
// own cadence (the sweep is cheap for already-clean documents).
exports.backfillPrivacyBoundary = functions.https.onCall(async (data, context) => {
  const actorUid = await assertAdmin(context);
  const maxUsers = Math.min(Math.max(Number(data?.maxUsers) || MAX_USERS_PER_RUN, 1), 5000);
  const summary = await sweep({ maxUsers });
  console.log('privacy boundary backfill', { actorUid, ...summary });
  return { success: true, ...summary };
});

exports.__test__ = { PRIVATE_FIELDS, pickPrivateFields, migrateUser, sweep };
