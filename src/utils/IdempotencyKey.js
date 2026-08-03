/**
 * src/utils/IdempotencyKey.js - ARVDOUL Idempotency Store
 *
 * Client-side idempotency key generation and dedupe with TTL.
 * Primary correctness still lives in Firestore transactions / Cloud
 * Functions; this utility prevents duplicate double-tap submissions and
 * gives services a shared, consistent implementation.
 *
 * Zero dependencies.
 */

function randomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function safeGetStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (err) { /* unavailable */ }
  return null;
}

class IdempotencyStore {
  /**
   * @param {Object} opts
   * @param {number} [opts.defaultTtlMs=5000] default dedupe window
   */
  constructor({ defaultTtlMs = 5000 } = {}) {
    this.defaultTtlMs = defaultTtlMs;
    this._memory = new Map(); // key -> expiresAt
    this._storage = safeGetStorage();
  }

  /**
   * Generate a deterministic idempotency key for an operation.
   * @param {string} operation - e.g. 'like', 'follow'
   * @param {string[]} [parts] - stable identifiers (ids involved)
   * @returns {string}
   */
  generate(operation, parts = []) {
    return `${operation}:${parts.join(':')}:${randomId()}`;
  }

  /**
   * Record a key as seen. Returns false if it was already recorded
   * within the TTL (duplicate) - caller should skip the operation.
   * @param {string} key
   * @param {number} [ttlMs]
   * @returns {boolean} true if newly recorded (not a duplicate)
   */
  checkAndRecord(key, ttlMs = this.defaultTtlMs) {
    const now = Date.now();
    const seen = this._memory.get(key);
    if (seen && seen > now) return false;

    // Persisted mirror (best-effort) for multi-tab protection.
    if (this._storage) {
      try {
        const stored = this._storage.getItem(`idem:${key}`);
        if (stored && Number(stored) > now) return false;
        this._storage.setItem(`idem:${key}`, String(now + ttlMs));
      } catch (err) { /* ignore */ }
    }

    this._memory.set(key, now + ttlMs);
    // Opportunistic cleanup
    if (this._memory.size > 1000) {
      for (const [k, exp] of this._memory) {
        if (exp <= now) this._memory.delete(k);
      }
    }
    return true;
  }

  /** Explicitly release a key (e.g. after the op completed permanently). */
  release(key) {
    this._memory.delete(key);
    if (this._storage) {
      try { this._storage.removeItem(`idem:${key}`); } catch (err) { /* ignore */ }
    }
  }

  isDuplicate(key) {
    const now = Date.now();
    const seen = this._memory.get(key);
    if (seen && seen > now) return true;
    if (this._storage) {
      try {
        const stored = this._storage.getItem(`idem:${key}`);
        return !!stored && Number(stored) > now;
      } catch (err) { return false; }
    }
    return false;
  }
}

export { IdempotencyStore };
export const idempotencyStore = new IdempotencyStore();
export default idempotencyStore;
