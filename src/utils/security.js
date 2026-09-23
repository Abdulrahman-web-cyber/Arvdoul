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
