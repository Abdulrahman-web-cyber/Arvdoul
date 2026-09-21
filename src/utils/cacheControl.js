// src/utils/cacheControl.js

export const CACHE_POLICIES = {
  // Static compiled JS/CSS with content hashes - cached indefinitely
  IMMUTABLE_STATIC: 'public, max-age=31536000, immutable',

  // Media assets (images, transcoded videos, avatars)
  MEDIA_ASSET: 'public, max-age=86400, stale-while-revalidate=604800',

  // Public feeds and community post discovery (micro-caching)
  PUBLIC_FEED_DISCOVERY: 'public, max-age=30, stale-while-revalidate=300',

  // User profile metadata (near real-time)
  USER_PROFILE: 'public, max-age=60, stale-while-revalidate=600',

  // Private sensitive user data (financials, settings, messages)
  PRIVATE_AUTH: 'private, no-cache, no-store, must-revalidate',

  // Health and telemetry endpoints
  NO_CACHE: 'no-store, no-cache, must-revalidate, proxy-revalidate'
};

/**
 * Builds standard Cache-Control headers object
 * @param {keyof typeof CACHE_POLICIES} policyType
 * @returns {Record<string, string>}
 */
export function getCacheHeaders(policyType = 'PUBLIC_FEED_DISCOVERY') {
  const policy = CACHE_POLICIES[policyType] || CACHE_POLICIES.NO_CACHE;
  return {
    'Cache-Control': policy,
    'Vary': 'Accept-Encoding'
  };
}

/**
 * Validates cache freshness against client timestamp
 * @param {number} cachedTimestamp
 * @param {number} maxAgeSeconds
 * @returns {boolean}
 */
export function isCacheValid(cachedTimestamp, maxAgeSeconds = 60) {
  if (!cachedTimestamp || typeof cachedTimestamp !== 'number') return false;
  const age = (Date.now() - cachedTimestamp) / 1000;
  return age >= 0 && age < maxAgeSeconds;
}

export default {
  CACHE_POLICIES,
  getCacheHeaders,
  isCacheValid
};
