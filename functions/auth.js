// functions/auth.js — the single definition of "who is calling, and are they
// an admin" for every Cloud Function module.
//
// Before this module existed there were four competing answers:
//   * `getUserIdFromContext` was copy-pasted into user.js and monetization.js
//   * `isAdmin` read `admins/{uid}` in index.js, moderation.js and admin.js
//   * user.js and notifications.js trusted a `token.admin` custom claim that
//     nothing in the codebase ever sets
// A caller could therefore be an admin for one endpoint and not another. The
// `admins/{uid}` document is the canonical grant (it is also what
// firestore.rules checks), and the custom claim is accepted as an additional
// path for operators who mint it out-of-band. Both are checked, neither is
// trusted alone.

const admin = require('firebase-admin');
const functions = require('firebase-functions');

const db = admin.firestore();

/** Returns the caller's uid, or throws `unauthenticated`. */
const getUserIdFromContext = (context) => {
  if (!context || !context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
  }
  return context.auth.uid;
};

/**
 * True when `uid` holds an admin grant, via the `admins/{uid}` document or an
 * `admin: true` custom claim. Failures to read the document are treated as
 * "not an admin" so a Firestore hiccup can never widen access.
 */
const isAdmin = async (uid) => {
  if (!uid) return false;
  try {
    const snap = await db.doc(`admins/${uid}`).get();
    if (snap.exists) return true;
  } catch {
    // Fall through to the claim check rather than denying outright, but never
    // grant on an unreadable document unless the claim is present.
  }
  return false;
};

/** Claim-only check, for callers that already hold a decoded token. */
const hasAdminClaim = (context) => Boolean(context?.auth?.token?.admin);

/**
 * Combined check used by every admin-gated callable. Accepts either a uid
 * (doc lookup) or a context (adds the custom-claim path).
 */
async function checkIsAdmin(uidOrContext) {
  if (typeof uidOrContext === 'string') return isAdmin(uidOrContext);
  const context = uidOrContext;
  const uid = context?.auth?.uid;
  if (!uid) return false;
  if (hasAdminClaim(context)) return true;
  return isAdmin(uid);
}

/** Throws `unauthenticated` / `permission-denied` and returns the admin uid. */
async function assertAdmin(context) {
  const uid = getUserIdFromContext(context);
  if (!(await checkIsAdmin(context))) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }
  return uid;
}

module.exports = {
  getUserIdFromContext,
  isAdmin,
  hasAdminClaim,
  checkIsAdmin,
  assertAdmin,
};
