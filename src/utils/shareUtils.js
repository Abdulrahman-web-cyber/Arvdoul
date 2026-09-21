// src/utils/shareUtils.js
//
// Canonical profile sharing. Every entry point (own profile, public profile,
// QR modal) resolves the same link and reuses one identity fallback chain so a
// shared URL always matches the profile it was shared from.

export const PROFILE_ORIGIN =
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://arvdoul.app';

/**
 * Resolves the public handle used in share links.
 * Prefers a real username; falls back to the user id so a link is still valid
 * for accounts that never chose one.
 */
export function getProfileHandle(profile) {
  const candidates = [profile?.username, profile?.handle];
  for (const raw of candidates) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value && !value.startsWith('user_') && value !== 'user' && value !== 'creator') {
      return value;
    }
  }
  return profile?.uid || profile?.id || '';
}

/** Builds the absolute public profile URL for a profile or user id. */
export function getProfileUrl(profile) {
  const handle = getProfileHandle(profile);
  return `${PROFILE_ORIGIN}/profile/${handle}`;
}

/**
 * Stable human-readable identity code derived from the immutable user id.
 * Deterministic, so the same user always shows the same code.
 */
export function getGlobalIdentityCode(profile) {
  const id = profile?.uid || profile?.id || '';
  return id ? `ARV-${String(id).toUpperCase()}` : '';
}

/**
 * Shares a profile using the native share sheet when available, otherwise
 * copies the link to the clipboard.
 *
 * @returns {Promise<{shared: boolean, copied: boolean, cancelled: boolean, url: string}>}
 */
export async function shareProfile(profile, { title, text } = {}) {
  const url = getProfileUrl(profile);
  const shareTitle = title || `${profile?.displayName || 'Profile'} on Arvdoul`;

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: shareTitle, url, ...(text ? { text } : {}) });
      return { shared: true, copied: false, cancelled: false, url };
    } catch (error) {
      // The user dismissing the share sheet is not an error.
      if (error?.name === 'AbortError') {
        return { shared: false, copied: false, cancelled: true, url };
      }
    }
  }

  await copyToClipboard(url);
  return { shared: false, copied: true, cancelled: false, url };
}

/** Copies text using the async clipboard API with an execCommand fallback. */
export async function copyToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  if (typeof document !== 'undefined') {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand('copy');
      return true;
    } finally {
      document.body.removeChild(el);
    }
  }

  throw new Error('Clipboard is not available in this environment');
}