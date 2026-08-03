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
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this._store.delete(k);
      return null;
    }
    // LRU touch
    this._store.delete(k);
    this._store.set(k, entry);
    return entry.value;
  }

  set(namespace, key, value, ttlMs = this.defaultTtlMs) {
    if (this._store.size >= this.maxSize) {
      const oldest = this._store.keys().next().value;
      if (oldest) this._store.delete(oldest);
    }
    this._store.set(this._makeKey(namespace, key), {
      value,
      expiresAt: Date.now() + (ttlMs > 0 ? ttlMs : this.defaultTtlMs),
    });
  }

  delete(namespace, key) {
    this._store.delete(this._makeKey(namespace, key));
  }

  /** Delete all keys matching a pattern. Supports `*` wildcards (e.g. 'analytics_abc_*'). */
  invalidatePattern(patternSource) {
    const regexSource = String(patternSource).replace(/\*/g, '.*');
    let re;
    try {
      re = new RegExp(`^${regexSource}$`);
    } catch (err) {
      re = new RegExp(regexSource);
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
