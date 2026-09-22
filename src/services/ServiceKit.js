// src/services/ServiceKit.js
// Central facade for cross-cutting service concerns. Importing from here gives every
// service one consistent, production-grade entry point for logging, auditing, caching,
// sharded counters, offline writes, error handling and rate limiting — instead of
// reaching into individual utils. This is the backbone of the 10/10 service refactor.
import { logger } from '../utils/Logger.js';
import { auditLogger } from '../utils/AuditLogger.js';
import { cacheManager } from '../utils/CacheManager.js';
import { countersManager } from '../utils/CountersManager.js';
import { offlineQueue } from '../utils/OfflineQueue.js';
import { errorHandler } from '../utils/ErrorHandler.js';
import { rateLimiter } from '../utils/RateLimiter.js';

/** Default structured logger (PII-redacted, correlation-aware). */
export const log = logger;

/** Create a namespaced child logger, e.g. svcLogger('userService'). */
export function svcLogger(name) {
  return logger.child(name);
}

/** Audit log helper. */
export const audit = auditLogger;

/** Ergonomic cache access (in-memory, LRU, TTL). */
export const cache = {
  get: (namespace, key) => cacheManager.get(namespace, key),
  set: (namespace, key, value, ttlMs) => cacheManager.set(namespace, key, value, ttlMs),
  namespace: (namespace, ttlMs) => cacheManager.namespace(namespace, ttlMs),
  invalidateUser: (userId) => cacheManager.invalidateUser(userId),
  invalidatePattern: (patternSource) => cacheManager.invalidatePattern(patternSource),
  clearNamespace: (namespace) => cacheManager.clearNamespace(namespace),
  /** Cache-aside: return cached value or compute+store via `fetcher`. */
  getOrFetch: (namespace, key, fetcher, ttlMs) =>
    cacheManager.getOrFetch(namespace, key, fetcher, ttlMs),
};

/** Sharded counters (hot-path safe; uses Firestore sub-shards under the hood). */
export const counters = {
  increment: (opts) => countersManager.increment(opts),
  incrementInTransaction: (tx, opts) => countersManager.incrementInTransaction(tx, opts),
  get: (opts) => countersManager.get(opts),
  apply: (opts) => countersManager.apply(opts),
  invalidate: (opts) => countersManager.invalidate(opts),
};

/** Offline-first write queue (IndexedDB + retry, drains on reconnect). */
export const queue = {
  enqueue: (type, payload, idempotencyKey = null) =>
    offlineQueue.enqueue({ type, payload, idempotencyKey }),
  onOnline: (handler) => offlineQueue.onOnline(handler),
  process: (handler) => offlineQueue.process(handler),
};

/** Central error handler (code taxonomy, public-safe messages). */
export const errors = errorHandler;

/** Client-side UX rate limiter (server rules remain authoritative). */
export const rateLimit = rateLimiter;

/**
 * Enhance an error with a stable code + public-safe message and log it.
 * Returns the enhanced error so callers can re-throw or return it.
 */
export function handle(err, ctx = 'service') {
  const enhanced = errorHandler.enhance(err, { defaultMessage: `${ctx} operation failed` });
  logger.error(`${ctx} error`, { code: enhanced.code, message: enhanced.message });
  return enhanced;
}

export default {
  log,
  svcLogger,
  audit,
  cache,
  counters,
  queue,
  errors,
  rateLimit,
  handle,
};
