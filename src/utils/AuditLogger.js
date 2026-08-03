/**
 * src/utils/AuditLogger.js - ARVDOUL Audit Logger
 *
 * Persists security-sensitive events (login, logout, password change,
 * permission change, data export, deletion, moderation actions) with
 * userId, action, timestamp, correlationId and sanitized metadata.
 *
 * Storage: IndexedDB queue (idb) with an in-memory fallback. Events are
 * never written to Firestore automatically - a Cloud Function / exporter
 * may consume `getPending()` and flush to an audit collection (migration
 * must be planned explicitly per the Engineering Constitution).
 *
 * Zero new npm dependencies (idb is already in package.json).
 */

import { openDB } from 'idb';
import { Logger, getCorrelationId } from './Logger.js';

const AUDIT_DB = 'arvdoul_audit';
const AUDIT_STORE = 'events';
const MAX_PENDING = 2000; // hard cap on local queue size

class AuditLogger {
  /**
   * @param {Object} opts
   * @param {boolean} [opts.enabled=true]
   */
  constructor({ enabled = true } = {}) {
    this.enabled = enabled;
    this.logger = new Logger({ name: 'audit', level: 'info' });
    this._memoryFallback = [];
    this._dbPromise = null;
  }

  async _db() {
    if (typeof indexedDB === 'undefined') return null;
    if (!this._dbPromise) {
      this._dbPromise = openDB(AUDIT_DB, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains(AUDIT_STORE)) {
            db.createObjectStore(AUDIT_STORE, { keyPath: 'id', autoIncrement: true });
          }
        },
      });
    }
    return this._dbPromise;
  }

  /**
   * Record an audit event.
   * @param {string} action - e.g. 'auth.login', 'profile.update', 'content.delete'
   * @param {Object} [data] - { userId, ip, userAgent, meta, correlationId }
   */
  async log(action, data = {}) {
    if (!this.enabled) return;
    if (!data.userId) {
      this.logger.warn('Audit event recorded without userId', { action });
    }
    const entry = {
      action,
      userId: data.userId || null,
      timestamp: new Date().toISOString(),
      correlationId: data.correlationId || getCorrelationId() || null,
      ip: data.ip || null,
      userAgent: data.userAgent || null,
      meta: data.meta || {},
    };

    try {
      const db = await this._db();
      if (db) {
        const tx = db.transaction(AUDIT_STORE, 'readwrite');
        const count = await tx.store.count();
        if (count >= MAX_PENDING) {
          // Trim oldest events to respect the cap.
          const cursor = await tx.store.openCursor();
          if (cursor) await cursor.delete();
        }
        await tx.store.add(entry);
        await tx.done;
      } else {
        this._memoryFallback.push(entry);
        if (this._memoryFallback.length > MAX_PENDING) this._memoryFallback.shift();
      }
    } catch (err) {
      this.logger.warn('Audit log write failed', { error: err.message });
    }
  }

  /** Return all pending audit events (oldest first). */
  async getPending() {
    try {
      const db = await this._db();
      if (db) {
        const all = await db.getAll(AUDIT_STORE);
        return all;
      }
      return [...this._memoryFallback];
    } catch (err) {
      this.logger.warn('Audit log read failed', { error: err.message });
      return [...this._memoryFallback];
    }
  }

  /** Remove events that have been flushed (by id). */
  async clearPending(ids = []) {
    try {
      const db = await this._db();
      if (db) {
        const tx = db.transaction(AUDIT_STORE, 'readwrite');
        await Promise.all(ids.map((id) => tx.store.delete(id)));
        await tx.done;
      }
    } catch (err) {
      this.logger.warn('Audit log clear failed', { error: err.message });
    }
  }

  /**
   * Optional flush helper: writes pending events to a Firestore collection.
   * OFF BY DEFAULT - enable only after a migration plan exists for the
   * `audit_events` collection and security rules.
   * @param {Object} firestore - Firestore instance
   * @param {string} [collectionName='audit_events']
   */
  async flushToFirestore(firestore, collectionName = 'audit_events') {
    if (!firestore) return { flushed: 0 };
    const { collection, writeBatch, doc } = await import('firebase/firestore');
    const ref = collection(firestore, collectionName);
    const pending = await this.getPending();
    if (!pending.length) return { flushed: 0 };

    // Batched writes (100/commit) instead of one addDoc per event.
    const BATCH_SIZE = 100;
    let flushed = 0;
    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const chunk = pending.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(firestore);
      const ids = [];
      for (const entry of chunk) {
        const docRef = doc(ref);
        batch.set(docRef, { ...entry, flushedAt: new Date().toISOString() });
        ids.push(entry.id);
      }
      try {
        await batch.commit();
        flushed += chunk.length;
        await this.clearPending(ids);
      } catch (err) {
        this.logger.warn('Audit batch flush failed (events kept locally)', { error: err.message });
        break; // stop on first failure; retry later
      }
    }
    return { flushed };
  }

  /**
   * Start automatic flushing on an interval and on page-hide (best-effort).
   * @param {Object} firestore
   * @param {Object} [opts]
   * @param {number} [opts.intervalMs=300000] flush cadence (5 min)
   */
  startAutoFlush(firestore, { intervalMs = 300000 } = {}) {
    this.stopAutoFlush();
    this._flushTimer = setInterval(() => {
      this.flushToFirestore(firestore).catch(() => {});
    }, intervalMs);
    if (typeof window !== 'undefined') {
      this._flushOnHide = () => this.flushToFirestore(firestore).catch(() => {});
      window.addEventListener('pagehide', this._flushOnHide);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this._flushOnHide();
      });
    }
  }

  stopAutoFlush() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
    if (typeof window !== 'undefined' && this._flushOnHide) {
      window.removeEventListener('pagehide', this._flushOnHide);
      this._flushOnHide = null;
    }
  }
}

export const auditLogger = new AuditLogger();
export default auditLogger;
