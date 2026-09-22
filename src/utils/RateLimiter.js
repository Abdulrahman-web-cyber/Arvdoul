/**
 * src/utils/RateLimiter.js - ARVDOUL Rate Limiter
 *
 * Client-side sliding-window rate limiter. IMPORTANT: client-side limits are
 * a UX guard, never a security boundary - server-side enforcement lives in
 * Cloud Functions / Firestore rules (see functions/*.js). This utility
 * provides the shared, consistent implementation every service uses.
 *
 * Storage: in-memory Map + optional localStorage persistence (guarded).
 * Zero dependencies.
 */

const FALLBACK_MAX = 1000;

function safeGetStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (err) { /* private mode / unavailable */ }
  return null;
}

class RateLimiter {
  /**
   * @param {Object} opts
   * @param {string} [opts.prefix='rl:'] key prefix
   * @param {boolean} [opts.persist=true] mirror windows to localStorage
   */
  constructor({ prefix = 'rl:', persist = true } = {}) {
    this.prefix = prefix;
    this.persist = persist && !!safeGetStorage();
    this._memory = new Map(); // key -> number[] (timestamps)
    this._persisted = new Map(); // key -> { timestamps, windowMs }
    this._storage = safeGetStorage();
    if (this._storage && this.persist) this._hydrate();
  }

  _hydrate() {
    try {
      const raw = this._storage.getItem(`${this.prefix}_index`);
      if (!raw) return;
      const keys = JSON.parse(raw);
      keys.forEach((k) => {
        try {
          const data = JSON.parse(this._storage.getItem(this.prefix + k));
          if (data) this._persisted.set(k, data);
        } catch (err) { /* skip corrupted entry */ }
      });
    } catch (err) { /* storage unavailable */ }
  }

  _persistKey(key) {
    try {
      if (!this._storage || !this.persist) return;
      this._storage.setItem(this.prefix + key, JSON.stringify(this._persisted.get(key)));
      let index = [];
      try { index = JSON.parse(this._storage.getItem(`${this.prefix}_index`)) || []; } catch (err) {}
      if (!index.includes(key)) {
        index.push(key);
        if (index.length > 500) index = index.slice(-500);
        this._storage.setItem(`${this.prefix}_index`, JSON.stringify(index));
      }
    } catch (err) { /* quota exceeded - memory-only continues */ }
  }

  _window(key, windowMs) {
    const now = Date.now();
    let w = this._persisted.get(key);
    if (!w || w.windowMs !== windowMs) {
      w = { timestamps: [], windowMs };
      this._persisted.set(key, w);
    }
    w.timestamps = w.timestamps.filter((t) => now - t < windowMs);
    return w;
  }

  /**
   * Atomically check + record a hit.
   * @param {string} key - e.g. `analytics:${userId}`
   * @param {Object} opts
   * @param {number} [opts.max=60] max hits per window
   * @param {number} [opts.windowMs=60000] window length
   * @returns {{allowed: boolean, count: number, retryAfterMs: number}}
   */
  checkAndHit(key, { max = 60, windowMs = 60000 } = {}) {
    const window = this._window(this.prefix + key, windowMs);
    if (window.timestamps.length >= max) {
      const oldest = window.timestamps[0];
      const retryAfterMs = Math.max(0, oldest + windowMs - Date.now());
      this._persistKey(key);
      return { allowed: false, count: window.timestamps.length, retryAfterMs };
    }
    window.timestamps.push(Date.now());
    this._persistKey(key);
    return { allowed: true, count: window.timestamps.length, retryAfterMs: 0 };
  }

  /** Check without recording a hit. */
  isAllowed(key, { max = 60, windowMs = 60000 } = {}) {
    const window = this._window(this.prefix + key, windowMs);
    return { allowed: window.timestamps.length < max, count: window.timestamps.length };
  }

  /** Reset a key's window. */
  reset(key) {
    this._memory.delete(key);
    this._persisted.delete(this.prefix + key);
    if (this._storage && this.persist) {
      try { this._storage.removeItem(this.prefix + key); } catch (err) { /* ignore */ }
    }
  }
}

export { RateLimiter };
export const rateLimiter = new RateLimiter();
export default rateLimiter;
