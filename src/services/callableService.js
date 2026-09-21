/**
 * callableService — one place to invoke Cloud Functions callables.
 *
 * Screens used to inline an httpsCallable + getFunctions pair in a dozen
 * files, each with its own error handling and none of them awaiting the
 * Firebase app. This centralises app binding, unwraps the HttpsError code so
 * callers can branch on it, and keeps the callable name list in one place.
 */

const FUNCTIONS = {
  // Privileged administrative actions (server re-checks admins/{uid}).
  APPLY_USER_ADMIN_ACTION: 'applyUserAdminAction',
  APPLY_VERIFICATION_DECISION: 'applyVerificationDecision',
  RESOLVE_USER_REPORT: 'resolveUserReport',
  GET_ADMIN_STATUS: 'getAdminStatus',
  BOOTSTRAP_OWNER: 'bootstrapOwner',
  GRANT_ADMIN: 'grantAdmin',
  REVOKE_ADMIN: 'revokeAdmin',
  LIST_ADMINS: 'listAdmins',

  // Progression
  AWARD_EXPERIENCE: 'awardExperience',
};

/** Error shape every callable failure is normalised into. */
export class CallableError extends Error {
  constructor(message, code, original) {
    super(message);
    this.name = 'CallableError';
    this.code = code || 'unknown';
    this.original = original;
  }
}

async function resolveFunctions() {
  const { getFunctions } = await import('firebase/functions');
  // firebase/firebase.js initialises the default app eagerly at module load,
  // so getFunctions() binds to that same instance the rest of the app uses.
  return getFunctions();
}

/**
 * Invoke a callable by name and return its `data` payload.
 *
 * @param {string} name  Callable name (use the FUNCTIONS map).
 * @param {object} payload Arguments for the callable.
 * @throws {CallableError} with `.code` matching the HttpsError code.
 */
export async function callFunction(name, payload = {}) {
  const { httpsCallable } = await import('firebase/functions');
  const functions = await resolveFunctions();
  try {
    const result = await httpsCallable(functions, name)(payload);
    return result?.data;
  } catch (error) {
    throw new CallableError(
      error?.message || `Callable ${name} failed`,
      error?.code || 'unknown',
      error
    );
  }
}

/** True when the caller holds an admin grant (checked server-side). */
export async function fetchAdminStatus() {
  const data = await callFunction(FUNCTIONS.GET_ADMIN_STATUS);
  return Boolean(data?.isAdmin);
}

export { FUNCTIONS };
export default { callFunction, fetchAdminStatus, FUNCTIONS, CallableError };
