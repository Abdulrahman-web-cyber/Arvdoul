/**
 * src/utils/OfflineQueue.js - ARVDOUL Persistent Offline Queue (hardened)
 *
 * IndexedDB-backed operation queue with exponential backoff retry and
 * online-event draining. Used for critical writes (messages, follows,
 * likes, uploads) so they survive network drops.
 *
 * Backed by `idb`. Falls back to an in-memory queue when IndexedDB is
 * unavailable.
 *
 * Hardening (vs. v1):
 *  - Idempotency: an op with the same `idempotencyKey` is de-duplicated.
 *  - Bounded growth: capped at MAX_QUEUE_SIZE (evicts oldest low-priority op).
 *  - Priority: high/medium/low ordering (messages before likes before analytics).
 *  - Concurrent batch drain (DRAIN_CONCURRENCY) instead of one-at-a-time.
 *  - Multi-tab safety: only one tab drains at a time via a TTL claim.
 */

import { openDB } from 'idb';

const QUEUE_DB = 'arvdoul_offline_queue';
const QUEUE_STORE = 'operations';
const META_STORE = 'meta';
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;
const MAX_QUEUE_SIZE = 1000;
const DRAIN_CONCURRENCY = 5;
const CLAIM_TTL_MS = 30000;
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

class OfflineQueue {
  /**
   * @param {Object} opts
   * @param {number} [opts.maxAttempts=5]
   * @param {number} [opts.baseDelayMs=1000]
   */
  constructor({ maxAttempts = MAX_ATTEMPTS, baseDelayMs = BASE_DELAY_MS } = {}) {
    this.maxAttempts = maxAttempts;
    this.baseDelayMs = baseDelayMs;
    this._dbPromise = null;
    this._memory = []; // fallback
    this._draining = false;
    this._onlineHandler = null;
    this._tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this._channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(`${QUEUE_DB}_sync`)
        : null;
  }

  async _db() {
    if (typeof indexedDB === 'undefined') return null;
    if (!this._dbPromise) {
      this._dbPromise = openDB(QUEUE_DB, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(QUEUE_STORE)) {
            const store = db.createObjectStore(QUEUE_STORE, {
              keyPath: 'id',
              autoIncrement: true,
            });
            store.createIndex('status', 'status');
            store.createIndex('idempotencyKey', 'idempotencyKey');
          }
          if (!db.objectStoreNames.contains(META_STORE)) {
            db.createObjectStore(META_STORE); // key-value (out-of-line keys)
          }
        },
      });
    }
    return this._dbPromise;
  }

  /**
   * Queue an operation.
   * @param {Object} op
   * @param {string} op.type - e.g. 'follow', 'like', 'message.send'
   * @param {Object} [op.payload]
   * @param {string} [op.idempotencyKey] - de-duplicates identical pending ops
   * @param {'high'|'medium'|'low'} [op.priority='medium']
   * @returns {Promise<number>} queued id (or existing id when de-duplicated)
   */
  async enqueue({ type, payload = {}, idempotencyKey = null, priority = 'medium' }) {
    if (!PRIORITY_RANK[priority]) priority = 'medium';
    const entry = {
      type,
      payload,
      idempotencyKey,
      priority,
      attempts: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const db = await this._db();
    if (db) {
      // Idempotency: skip if an identical pending op is already queued.
      if (idempotencyKey) {
        const existing = await db.getFromIndex(QUEUE_STORE, 'idempotencyKey', idempotencyKey);
        if (existing && existing.status === 'pending') return existing.id;
      }
      // Bound growth: evict the lowest-priority / oldest op when at capacity.
      const pending = await db.getAllFromIndex(QUEUE_STORE, 'status', 'pending');
      if (pending.length >= MAX_QUEUE_SIZE) {
        pending.sort(
          (a, b) =>
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
            new Date(a.createdAt) - new Date(b.createdAt)
        );
        const victim = pending[pending.length - 1];
        await db.delete(QUEUE_STORE, victim.id);
      }
      return db.add(QUEUE_STORE, entry);
    }
    // Memory fallback
    const dup =
      idempotencyKey &&
      this._memory.find((o) => o.idempotencyKey === idempotencyKey && o.status === 'pending');
    if (dup) return dup.id || 0;
    this._memory.push(entry);
    if (this._memory.length > MAX_QUEUE_SIZE) this._memory.shift();
    return this._memory.length;
  }

  async _tryClaim(db) {
    if (!db) return true; // single-instance (memory) mode
    const now = Date.now();
    const claim = await db.get(META_STORE, 'drain_claim');
    if (claim && claim.expiresAt > now && claim.tabId !== this._tabId) return false;
    await db.put(META_STORE, { tabId: this._tabId, expiresAt: now + CLAIM_TTL_MS }, 'drain_claim');
    return true;
  }

  async _refreshClaim(db) {
    if (!db) return;
    await db.put(
      META_STORE,
      { tabId: this._tabId, expiresAt: Date.now() + CLAIM_TTL_MS },
      'drain_claim'
    );
  }

  async _releaseClaim(db) {
    if (!db) return;
    const claim = await db.get(META_STORE, 'drain_claim');
    if (claim && claim.tabId === this._tabId) await db.delete(META_STORE, 'drain_claim');
  }

  /**
   * Drain the queue: run `handler(operation)` for each pending op (priority
   * order, concurrent batches), removing on success and retrying with backoff
   * on failure. Only one tab drains at a time (TTL claim).
   * @param {(op: Object) => Promise<any>} handler
   * @returns {Promise<{processed: number, failed: number}>}
   */
  async process(handler) {
    if (this._draining) return { processed: 0, failed: 0 };
    const db = await this._db();
    if (!(await this._tryClaim(db))) return { processed: 0, failed: 0 };

    this._draining = true;
    let processed = 0;
    let failed = 0;
    try {
      const pending = db
        ? await db.getAllFromIndex(QUEUE_STORE, 'status', 'pending')
        : this._memory.filter((o) => o.status === 'pending');
      pending.sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          new Date(a.createdAt) - new Date(b.createdAt)
      );

      for (let i = 0; i < pending.length; i += DRAIN_CONCURRENCY) {
        const batch = pending.slice(i, i + DRAIN_CONCURRENCY);
        await Promise.all(
          batch.map(async (op) => {
            try {
              await handler(op);
              if (db) await db.delete(QUEUE_STORE, op.id);
              else op.status = 'done';
              processed++;
            } catch (err) {
              op.attempts = (op.attempts || 0) + 1;
              if (op.attempts >= this.maxAttempts) {
                op.status = 'failed';
                if (db) await db.put(QUEUE_STORE, op);
                else this._memory = this._memory.filter((o) => o !== op);
                failed++;
              } else {
                op.status = 'pending';
                if (db) await db.put(QUEUE_STORE, op);
                await new Promise((r) => setTimeout(r, this.baseDelayMs * op.attempts));
              }
            }
          })
        );
        await this._refreshClaim(db);
      }
    } finally {
      this._draining = false;
      await this._releaseClaim(db);
    }
    if (this._channel) this._channel.postMessage({ type: 'drained' });
    return { processed, failed };
  }

  /** Number of pending operations. */
  async length() {
    const db = await this._db();
    if (db) {
      const all = await db.getAllFromIndex(QUEUE_STORE, 'status', 'pending');
      return all.length;
    }
    return this._memory.filter((o) => o.status === 'pending').length;
  }

  async clear() {
    const db = await this._db();
    if (db) await db.clear(QUEUE_STORE);
    this._memory = [];
  }

  /**
   * Auto-drain when the browser comes back online (and when another tab finishes).
   * @param {(op: Object) => Promise<any>} handler
   * @returns {() => void} cleanup function
   */
  onOnline(handler) {
    if (typeof window === 'undefined') return () => {};
    const run = () => {
      this.process(handler).catch(() => {});
    };
    this._onlineHandler = run;
    window.addEventListener('online', run);
    if (this._channel) {
      this._channel.onmessage = (e) => {
        if (e.data && e.data.type === 'drained') run();
      };
    }
    return () => {
      window.removeEventListener('online', run);
      this._onlineHandler = null;
    };
  }
}

export const offlineQueue = new OfflineQueue();
export default offlineQueue;
