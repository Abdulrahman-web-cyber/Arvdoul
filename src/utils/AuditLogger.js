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
import { Logger } from './Logger.js';

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
    const entry = {
      action,
      userId: data.userId || null,
      timestamp: new Date().toISOString(),
      correlationId: data.correlationId || null,
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
    const { collection, addDoc } = await import('firebase/firestore');
    const pending = await this.getPending();
    const ref = collection(firestore, collectionName);
    const flushed = [];
    for (const entry of pending) {
      try {
        const docRef = await addDoc(ref, {
          ...entry,
          flushedAt: new Date().toISOString(),
        });
        flushed.push(entry.id ?? docRef.id);
      } catch (err) {
        this.logger.warn('Audit flush failed (event kept locally)', { error: err.message });
        break; // stop on first failure; retry later
      }
    }
    await this.clearPending(flushed);
    return { flushed: flushed.length };
  }
}

export const auditLogger = new AuditLogger();
export default auditLogger;
