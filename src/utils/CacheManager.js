/**
 * src/utils/CacheManager.js - ARVDOUL Central Cache Manager
 *
 * Single entry point for cache get/set/invalidate across the service layer.
 * In-memory LRU with per-entry TTL, namespaces, pattern invalidation and
 * user-scoped invalidation. Backing store is memory; a distributed cache
 * (Redis via Functions) can replace the internals without changing callers.
 *
 * Zero dependencies.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Escape a string for safe use inside a RegExp. Without this, caller-supplied
// patterns in invalidatePattern() could inject regex syntax and cause ReDoS.
// `*` is intentionally left unescaped so it can be converted to `.*` (wildcard).
function escapeRegExp(str) {
  return String(str).replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

// Deep clone cached values so consumers can never mutate the stored reference
// (a real bug class: editing a cached object corrupted the cache for everyone).
function deepClone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(value); } catch (_) { /* fall through */ }
  }
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
}

export class CacheManager {
  /**
   * @param {Object} opts
   * @param {number} [opts.maxSize=1000] max entries across namespaces
   * @param {number} [opts.defaultTtlMs=300000]
   */
  constructor({ maxSize = 1000, defaultTtlMs = DEFAULT_TTL_MS } = {}) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
    this._store = new Map(); // key -> { value, expiresAt }
    this._stats = { hits: 0, misses: 0, sets: 0, evictions: 0 };
  }

  /** Raw access to the underlying store (internal iteration). */
  getStore() { return this._store; }

  _makeKey(namespace, key) {
    return `${namespace}:${key}`;
  }

  /**
   * Create a namespaced cache handle with the same API.
   * @param {string} namespace
   * @param {number} [ttlMs]
   */
  namespace(namespace, ttlMs = this.defaultTtlMs) {
    const self = this;
    const prefix = `${namespace}:`;
    return {
      get: (key) => self.get(namespace, key),
      set: (key, value, entryTtlMs) => self.set(namespace, key, value, entryTtlMs ?? ttlMs),
      delete: (key) => self.delete(namespace, key),
      invalidatePattern: (pattern) => self.invalidatePattern(`${namespace}:${pattern}`),
      invalidateUser: (userId) => self.invalidateUser(namespace, userId),
      clear: () => self.clearNamespace(namespace),
      /** Iterate live keys in this namespace (namespaced, no prefix). */
      keys: () => {
        const out = [];
        for (const k of self._store.keys()) {
          if (k.startsWith(prefix)) out.push(k.slice(prefix.length));
        }
        return out;
      },
      /** Iterate entries [key, value] in this namespace. */
      entries: () => {
        const out = [];
        for (const [k, entry] of self._store) {
          if (k.startsWith(prefix)) out.push([k.slice(prefix.length), entry.value]);
        }
        return out;
      },
      get size() {
        let n = 0;
        for (const k of self._store.keys()) {
          if (k.startsWith(prefix)) n++;
        }
        return n;
      },
    };
  }

  get(namespace, key) {
    const k = this._makeKey(namespace, key);
    const entry = this._store.get(k);
    if (!entry) { this._stats.misses++; return null; }
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this._store.delete(k);
      this._stats.misses++;
      this._stats.evictions++;
      return null;
    }
    // LRU touch
    this._store.delete(k);
    this._store.set(k, entry);
    this._stats.hits++;
    return deepClone(entry.value);
  }

  /**
   * Cache-aside helper: return the cached value, or compute it via `fetcher`,
   * store the result, and return it. `fetcher` may be sync or async. A `null`/
   * `undefined` result is NOT cached (so it will be recomputed next time).
   *
   * @param {string} namespace
   * @param {string} key
   * @param {() => any|Promise<any>} fetcher
   * @param {number} [ttlMs]
   * @returns {Promise<any>}
   */
  async getOrFetch(namespace, key, fetcher, ttlMs) {
    const cached = this.get(namespace, key);
    if (cached !== null && cached !== undefined) return cached;
    const value = await fetcher();
    if (value !== null && value !== undefined) this.set(namespace, key, value, ttlMs);
    return value;
  }

  set(namespace, key, value, ttlMs = this.defaultTtlMs) {
    if (this._store.size >= this.maxSize) {
      const oldest = this._store.keys().next().value;
      if (oldest) { this._store.delete(oldest); this._stats.evictions++; }
    }
    this._store.set(this._makeKey(namespace, key), {
      value: deepClone(value),
      expiresAt: Date.now() + (ttlMs > 0 ? ttlMs : this.defaultTtlMs),
    });
    this._stats.sets++;
  }

  delete(namespace, key) {
    this._store.delete(this._makeKey(namespace, key));
  }

  /** Delete all keys matching a pattern. Supports `*` wildcards (e.g. 'analytics_abc_*').
   *  Caller-supplied patterns are regex-escaped first to prevent ReDoS / injection. */
  invalidatePattern(patternSource) {
    const escaped = escapeRegExp(String(patternSource)).replace(/\*/g, '.*');
    let re;
    try {
      re = new RegExp(`^${escaped}$`);
    } catch (err) {
      re = new RegExp(escaped);
    }
    for (const k of this._store.keys()) {
      if (re.test(k)) this._store.delete(k);
    }
  }

  /** Invalidate everything cached for a user (cross-namespace). */
  invalidateUser(userId) {
    const patterns = [`:${userId}`, `_${userId}`, `/${userId}`];
    for (const k of this._store.keys()) {
      if (k === userId || k.endsWith(`:${userId}`) || patterns.some((p) => k.includes(p))) {
        this._store.delete(k);
      }
    }
  }

  clearNamespace(namespace) {
    const prefix = `${namespace}:`;
    for (const k of this._store.keys()) {
      if (k.startsWith(prefix)) this._store.delete(k);
    }
  }

  clear() { this._store.clear(); }

  get size() { return this._store.size; }

  /** Cache observability: hit/miss/eviction counts + current occupancy. */
  getStats() {
    return { ...this._stats, size: this._store.size, maxSize: this.maxSize };
  }

  /** Remove expired entries (call from a periodic timer). */
  purgeExpired() {
    const now = Date.now();
    for (const [k, entry] of this._store) {
      if (entry.expiresAt && now > entry.expiresAt) this._store.delete(k);
    }
  }
}

/** Singleton shared across all services. */
export const cacheManager = new CacheManager({ maxSize: 2000 });
export default cacheManager;
