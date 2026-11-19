// src/services/vibeDraftService.js
//
// Persistent local IndexedDB draft store for Arvdoul Vibes Studio.
// Keeps unsaved edits, media Blobs, text overlays, drawing strokes, audience
// choices, and idempotency keys strictly scoped to userId so accounts remain
// isolated and large media blobs never touch Firestore.

import { logger } from '../utils/Logger.js';
import { createVibeIdempotencyKey } from '../config/vibeContracts.js';

const DB_NAME = 'arvdoul_vibe_drafts';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const MAX_DRAFTS_PER_USER = 10;

class VibeDraftService {
  constructor() {
    this._memoryFallback = new Map();
    this._dbPromise = null;
  }

  _hasIndexedDB() {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  }

  _openDB() {
    if (!this._hasIndexedDB()) return Promise.resolve(null);
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('userId', 'userId', { unique: false });
            store.createIndex('updatedAt', 'updatedAt', { unique: false });
          }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => {
          logger.warn('[VibeDrafts] IndexedDB open failed; using memory fallback', {
            error: e?.target?.error?.message,
          });
          resolve(null);
        };
      } catch (err) {
        logger.warn('[VibeDrafts] IndexedDB unavailable', { error: err?.message });
        resolve(null);
      }
    });
    return this._dbPromise;
  }

  _normalizeDraft(userId, draft = {}) {
    const id = draft.id || `draft_${userId}_active`;
    return {
      ...draft,
      id,
      userId,
      idempotencyKey: draft.idempotencyKey || createVibeIdempotencyKey(userId),
      updatedAt: Date.now(),
    };
  }

  async saveDraft(userId, draft = {}) {
    if (!userId) return null;
    const record = this._normalizeDraft(userId, draft);
    const db = await this._openDB();
    if (!db) {
      this._memoryFallback.set(record.id, record);
      return record;
    }

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(record);
        tx.oncomplete = async () => {
          await this._pruneOldDrafts(userId).catch((e) =>
            logger.debug('[VibeDrafts] prune skipped', { error: e?.message })
          );
          resolve(record);
        };
        tx.onerror = (e) => {
          logger.warn('[VibeDrafts] save failed', { error: e?.target?.error?.message });
          this._memoryFallback.set(record.id, record);
          resolve(record);
        };
      } catch (err) {
        logger.warn('[VibeDrafts] save threw', { error: err?.message });
        this._memoryFallback.set(record.id, record);
        resolve(record);
      }
    });
  }

  async getDraft(userId, draftId = null) {
    if (!userId) return null;
    const targetId = draftId || `draft_${userId}_active`;
    const db = await this._openDB();
    if (!db) {
      const mem = this._memoryFallback.get(targetId);
      return mem && mem.userId === userId ? mem : null;
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(targetId);
        req.onsuccess = () => {
          const item = req.result;
          resolve(item && item.userId === userId ? item : null);
        };
        req.onerror = () => resolve(null);
      } catch (err) {
        logger.warn('[VibeDrafts] get failed', { error: err?.message });
        resolve(null);
      }
    });
  }

  async listDrafts(userId) {
    if (!userId) return [];
    const db = await this._openDB();
    if (!db) {
      return [...this._memoryFallback.values()]
        .filter((d) => d.userId === userId)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const idx = tx.objectStore(STORE_NAME).index('userId');
        const req = idx.getAll(userId);
        req.onsuccess = () => {
          const list = Array.isArray(req.result) ? req.result : [];
          list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          resolve(list);
        };
        req.onerror = () => resolve([]);
      } catch (err) {
        logger.warn('[VibeDrafts] list failed', { error: err?.message });
        resolve([]);
      }
    });
  }

  async deleteDraft(userId, draftId = null) {
    if (!userId) return;
    const targetId = draftId || `draft_${userId}_active`;
    this._memoryFallback.delete(targetId);
    const db = await this._openDB();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(targetId);
        getReq.onsuccess = () => {
          if (getReq.result && getReq.result.userId === userId) {
            store.delete(targetId);
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch (err) {
        logger.warn('[VibeDrafts] delete failed', { error: err?.message });
        resolve();
      }
    });
  }

  async _pruneOldDrafts(userId) {
    const all = await this.listDrafts(userId);
    if (all.length <= MAX_DRAFTS_PER_USER) return;
    const stale = all.slice(MAX_DRAFTS_PER_USER);
    await Promise.all(stale.map((d) => this.deleteDraft(userId, d.id)));
  }
}

export const vibeDraftService = new VibeDraftService();
export default vibeDraftService;
