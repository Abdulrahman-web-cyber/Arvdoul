/**
 * ARVDOUL Offline Cache Utility
 */

const DEFAULT_TTL = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Saves data to the offline localStorage cache.
 * @param {string} key
 * @param {any} data
 */
export function saveToCache(key, data) {
  try {
    const entry = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (err) {
    console.error('Failed to save to offline cache:', err);
  }
}

/**
 * Loads and returns data from the offline localStorage cache, or null if expired/non-existent.
 * @param {string} key
 * @param {number} ttl
 * @returns {any}
 */
export function loadFromCache(key, ttl = DEFAULT_TTL) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry.timestamp !== 'number') return null;
    if (Date.now() - entry.timestamp > ttl) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch (err) {
    console.error('Failed to load from offline cache:', err);
    return null;
  }
}
