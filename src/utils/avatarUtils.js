// src/utils/avatarUtils.js - Instant Deterministic SVG Avatar Generator
/**
 * Generates beautiful, responsive SVG avatars based on user ID and display name.
 * Prevents missing/broken image states and replaces static default PNGs with
 * lightweight, high-contrast, scalable vector avatars.
 */

const AVATAR_PALETTES = [
  { primary: '#3B82F6', secondary: '#1D4ED8', text: '#FFFFFF' }, // Royal Blue
  { primary: '#8B5CF6', secondary: '#6D28D9', text: '#FFFFFF' }, // Purple
  { primary: '#10B981', secondary: '#047857', text: '#FFFFFF' }, // Emerald
  { primary: '#EC4899', secondary: '#BE185D', text: '#FFFFFF' }, // Pink
  { primary: '#F97316', secondary: '#C2410C', text: '#FFFFFF' }, // Orange
  { primary: '#06B6D4', secondary: '#0E7490', text: '#FFFFFF' }, // Cyan
  { primary: '#6366F1', secondary: '#4338CA', text: '#FFFFFF' }, // Indigo
  { primary: '#F43F5E', secondary: '#BE123C', text: '#FFFFFF' }, // Rose
  { primary: '#14B8A6', secondary: '#0F766E', text: '#FFFFFF' }, // Teal
];

const avatarCache = new Map();

/**
 * Generate initials from name or ID
 */
export function getInitials(name = 'User') {
  if (!name || typeof name !== 'string') return 'U';
  const clean = name.trim();
  if (!clean) return 'U';
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.substring(0, 2).toUpperCase();
}

/**
 * Deterministically generate an SVG avatar Data URL
 */
export function generateDefaultAvatarSvg(userId = '', displayName = 'User', size = 200) {
  const safeId = String(userId || displayName || 'user_guest');
  const cacheKey = `${safeId}_${displayName}_${size}`;
  if (avatarCache.has(cacheKey)) {
    return avatarCache.get(cacheKey);
  }

  try {
    let hash = 0;
    for (let i = 0; i < safeId.length; i++) {
      hash = ((hash << 5) - hash) + safeId.charCodeAt(i);
      hash = hash & hash;
    }
    hash = Math.abs(hash);

    const initials = getInitials(displayName || safeId);
    const palette = AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
    const patternId = `pat_${hash.toString(16).slice(0, 8)}`;
    const fontSize = initials.length === 2 ? Math.round(size * 0.38) : Math.round(size * 0.44);
    const textX = size / 2;
    const textY = size / 2 + Math.round(fontSize * 0.35);

    const svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g_${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.primary}" />
      <stop offset="100%" stop-color="${palette.secondary}" />
    </linearGradient>
    <pattern id="${patternId}" x="0" y="0" width="${Math.round(size * 0.2)}" height="${Math.round(size * 0.2)}" patternUnits="userSpaceOnUse">
      <circle cx="${Math.round(size * 0.1)}" cy="${Math.round(size * 0.1)}" r="${Math.round(size * 0.04)}" fill="#ffffff" opacity="0.12"/>
    </pattern>
  </defs>
  <rect x="0" y="0" width="${size}" height="${size}" fill="url(#g_${hash})" rx="${Math.round(size * 0.16)}" />
  <rect x="0" y="0" width="${size}" height="${size}" fill="url(#${patternId})" rx="${Math.round(size * 0.16)}" />
  <text x="${textX}" y="${textY}" text-anchor="middle" dominant-baseline="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        font-size="${fontSize}" font-weight="700"
        fill="${palette.text}" letter-spacing="0.5" style="user-select: none;">
    ${initials}
  </text>
</svg>`.trim();

    let uri;
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      uri = `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
    } else {
      uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    }

    // Cap cache entries to prevent memory growth
    if (avatarCache.size > 1000) {
      const firstKey = avatarCache.keys().next().value;
      avatarCache.delete(firstKey);
    }
    avatarCache.set(cacheKey, uri);
    return uri;
  } catch {
    return `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><rect width="${size}" height="${size}" fill="#3B82F6" rx="${size/6}"/><text x="${size/2}" y="${size/2 + 10}" text-anchor="middle" font-family="sans-serif" font-size="${size/3}" font-weight="bold" fill="white">U</text></svg>`
    )}`;
  }
}

/**
 * Returns a safe avatar URL. If given a custom photoURL (not placeholder/default),
 * returns it. Otherwise returns the generated SVG avatar.
 */
export function getSafeAvatarUrl(photoURL, displayName = 'User', userId = '') {
  if (
    photoURL &&
    typeof photoURL === 'string' &&
    photoURL.trim() !== '' &&
    !photoURL.includes('default-profile') &&
    !photoURL.includes('default_profile') &&
    !photoURL.includes('default-avatar') &&
    !photoURL.includes('placeholder')
  ) {
    return photoURL;
  }
  return generateDefaultAvatarSvg(userId, displayName);
}
