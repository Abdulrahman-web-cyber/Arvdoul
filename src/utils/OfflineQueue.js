/**
 * src/utils/OfflineQueue.js - ARVDOUL Persistent Offline Queue
 *
 * IndexedDB-backed operation queue with exponential backoff retry and
 * online-event draining. Used for critical writes (messages, follows,
 * likes, uploads) so they survive network drops.
 *
 * Backed by `idb` (already a dependency). Falls back to in-memory queue
 * when IndexedDB is unavailable.
 *
 * Conflict resolution: operations carry a client-generated timestamp and an
 * optional version; consumers decide how to reconcile (documented per use).
 */

import { openDB } from 'idb';

const QUEUE_DB = 'arvdoul_offline_queue';
const QUEUE_STORE = 'operations';
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000;

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
  }

  async _db() {
    if (typeof indexedDB === 'undefined') return null;
    if (!this._dbPromise) {
      this._dbPromise = openDB(QUEUE_DB, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(QUEUE_STORE)) {
            const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
            store.createIndex('status', 'status');
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
   * @param {string} [op.idempotencyKey]
   * @returns {Promise<number>} queued id
   */
  async enqueue({ type, payload = {}, idempotencyKey = null }) {
    const entry = {
      type,
      payload,
      idempotencyKey,
      attempts: 0,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const db = await this._db();
    if (db) {
      const id = await db.add(QUEUE_STORE, entry);
      return id;
    }
    this._memory.push(entry);
    return this._memory.length;
  }

  /**
   * Drain the queue: run `handler(operation)` for each pending op,
   * removing it on success and retrying with backoff on failure.
   * @param {(op: Object) => Promise<any>} handler
   * @returns {Promise<{processed: number, failed: number}>}
   */
  async process(handler) {
    if (this._draining) return { processed: 0, failed: 0 };
    this._draining = true;
    let processed = 0;
    let failed = 0;
    try {
      const db = await this._db();
      const pending = db
        ? await db.getAllFromIndex(QUEUE_STORE, 'status', 'pending')
        : this._memory.filter((o) => o.status === 'pending');

      for (const op of pending) {
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
            failed++;
          } else {
            op.status = 'pending';
            if (db) await db.put(QUEUE_STORE, op);
            // Backoff: leave in queue; next drain will retry.
            await new Promise((r) => setTimeout(r, this.baseDelayMs * op.attempts));
          }
        }
      }
    } finally {
      this._draining = false;
    }
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
   * Auto-drain when the browser comes back online.
   * @param {(op: Object) => Promise<any>} handler
   * @returns {() => void} cleanup function
   */
  onOnline(handler) {
    if (typeof window === 'undefined') return () => {};
    this._onlineHandler = () => {
      this.process(handler).catch(() => {});
    };
    window.addEventListener('online', this._onlineHandler);
    return () => {
      window.removeEventListener('online', this._onlineHandler);
      this._onlineHandler = null;
    };
  }
}

export const offlineQueue = new OfflineQueue();
export default offlineQueue;
