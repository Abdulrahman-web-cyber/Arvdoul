/**
 * ARVDOUL Security Utilities
 */

/**
 * Safely parses the stored user object from localStorage without throwing.
 * @returns {object|null}
 */
export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    if (!raw || raw === 'undefined' || raw === 'null' || raw === '[object Object]') return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Safely resolves the stored user ID from localStorage keys without throwing.
 * @returns {string|null}
 */
export function getStoredUid() {
  if (typeof window === 'undefined') return null;
  try {
    const arvdoulUid = localStorage.getItem('arvdoul_uid');
    if (arvdoulUid && typeof arvdoulUid === 'string' && arvdoulUid !== 'undefined' && arvdoulUid !== 'null') {
      return arvdoulUid;
    }
    const genericUid = localStorage.getItem('uid');
    if (genericUid && typeof genericUid === 'string' && genericUid !== 'undefined' && genericUid !== 'null') {
      return genericUid;
    }
    const user = getStoredUser();
    if (user?.uid && typeof user.uid === 'string') {
      return user.uid;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Checks whether an active authentication session exists in storage.
 * Used during app launch to guarantee returning users go directly to Home
 * without any temporary flash of the Intro screen.
 * @returns {boolean}
 */
export function hasStoredAuthSession() {
  if (typeof window === 'undefined') return false;
  try {
    if (window._arvdoul_auth?.currentUser) return true;
    if (localStorage.getItem('arvdoul_has_session') === 'true') return true;
    if (getStoredUid()) return true;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('firebase:authUser:') || key.startsWith('firebase:authUser') || key === 'arvdoul_uid' || key === 'uid' || key === 'user')) {
        const val = localStorage.getItem(key);
        if (val && val !== 'null' && val !== 'undefined' && val !== '') return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Sanitizes an input string to protect against basic XSS attacks.
 * @param {string} input
 * @returns {string}
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
