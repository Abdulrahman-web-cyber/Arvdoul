// src/services/callableService.js
// Canonical entry point for invoking Firebase Cloud Functions callables from client.
// Ensures consistent error handling, app instance binding, and admin status retrieval.

import { getFunctionsInstance } from '../firebase/firebase.js';

export const FUNCTIONS = {
  GET_ADMIN_STATUS: 'getAdminStatus',
  BOOTSTRAP_OWNER: 'bootstrapOwner',
  GRANT_ADMIN: 'grantAdmin',
  REVOKE_ADMIN: 'revokeAdmin',
  LIST_ADMINS: 'listAdmins',
  APPLY_USER_ADMIN_ACTION: 'applyUserAdminAction',
  RESOLVE_USER_REPORT: 'resolveUserReport',
  DELETE_USER_DATA: 'deleteUserData',
};

/**
 * Invoke a Firebase callable function by name
 * @param {string} functionName
 * @param {object} [data={}]
 * @returns {Promise<any>}
 */
export async function callFunction(functionName, data = {}) {
  try {
    const { httpsCallable } = await import('firebase/functions');
    const functions = await getFunctionsInstance();
    const callable = httpsCallable(functions, functionName);
    const result = await callable(data);
    return result?.data;
  } catch (error) {
    console.error(`[callableService] Error calling ${functionName}:`, error);
    throw error;
  }
}

/**
 * Query current user's admin status from the server
 * @returns {Promise<boolean>}
 */
export async function fetchAdminStatus() {
  try {
    const res = await callFunction(FUNCTIONS.GET_ADMIN_STATUS);
    return Boolean(res?.isAdmin);
  } catch (err) {
    // If not configured or unauthenticated, default to false without crashing
    console.warn('[callableService] fetchAdminStatus fallback: false', err?.message);
    return false;
  }
}

/**
 * Claim ownership bootstrap for configured OWNER_EMAILS
 */
export async function bootstrapOwner() {
  return callFunction(FUNCTIONS.BOOTSTRAP_OWNER);
}

/**
 * Grant admin access to a user
 */
export async function grantAdmin(userId, reason = '') {
  return callFunction(FUNCTIONS.GRANT_ADMIN, { userId, reason });
}

/**
 * Revoke admin access for a user
 */
export async function revokeAdmin(userId) {
  return callFunction(FUNCTIONS.REVOKE_ADMIN, { userId });
}

/**
 * List all current admins
 */
export async function listAdmins() {
  return callFunction(FUNCTIONS.LIST_ADMINS);
}

export default {
  FUNCTIONS,
  callFunction,
  fetchAdminStatus,
  bootstrapOwner,
  grantAdmin,
  revokeAdmin,
  listAdmins,
};
