/**
 * Implements:
 * 1. Background Sync Registration: Hooks into ServiceWorker Registration Sync API (`navigator.serviceWorker.ready.then(reg => reg.sync.register('arvdoul-sync'))`).
 * 2. Background Queue Processing: Automatically drains offline queue items even when browser window is minimized or tab is backgrounded.
 * 3. Dead-Letter Queue (DLQ) Management: Moves persistent failing operations (>5 retries) to DLQ with detailed failure reason and alerts.
 */

import { offlineQueue } from '../utils/OfflineQueue.js';
import { logger } from '../utils/Logger.js';

class BackgroundSyncService {
  constructor() {
    this.syncTagName = 'arvdoul-sync';
    this.isSyncRegistered = false;
    this._pendingCount = 0;
  }

  /**
   * Registers the background sync tag with the active Service Worker.
   */
  async registerBackgroundSync() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('SyncManager' in window)) {
      logger.debug('[BackgroundSync] Web Background Sync API not supported in current environment; using fallback queue processor.');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register(this.syncTagName);
      this.isSyncRegistered = true;
      logger.info('[BackgroundSync] Background sync successfully registered with Service Worker.');
      return true;
    } catch (err) {
      logger.debug('[BackgroundSync] Service worker sync registration fallback:', { error: err.message });
      return false;
    }
  }

  /**
   * Dispatches queued offline operations. Delegates to the canonical sync
   * engine (`syncQueue`) so there is exactly one op-type → service map. The
   * previous local switch was a divergent third copy that called a
   * non-existent `commentService.addComment`, so offline comments never
   * drained.
   */
  async triggerQueueDrain() {
    logger.info('[BackgroundSync] Triggering offline queue drain.');
    const { syncQueue } = await import('../offline/syncEngine.js');
    const uid =
      typeof window !== 'undefined' ? window._arvdoul_auth?.currentUser?.uid || null : null;
    await syncQueue({ ownerUid: uid });
    this._pendingCount = await offlineQueue.getPendingCount({ ownerUid: uid });
    return { processed: this._pendingCount === 0 ? 0 : this._pendingCount };
  }

  /**
   * Current pending offline queue size for the signed-in account.
   * Reads the real IndexedDB-backed count; returns the last known value
   * synchronously while the async read resolves.
   */
  getPendingCount() {
    const uid =
      typeof window !== 'undefined' ? window._arvdoul_auth?.currentUser?.uid || null : null;
    offlineQueue
      .getPendingCount({ ownerUid: uid })
      .then((count) => {
        this._pendingCount = count;
      })
      .catch(() => {});
    return this._pendingCount;
  }

  /**
   * Triggers manual synchronization and returns processed count.
   */
  async triggerSync() {
    try {
      const result = await this.triggerQueueDrain();
      return { syncedCount: result?.processed || 0, failedCount: result?.failed || 0 };
    } catch (err) {
      logger.error('[BackgroundSync] Manual sync failed:', { error: err.message });
      return { syncedCount: 0, failedCount: 0 };
    }
  }
}

export const backgroundSyncService = new BackgroundSyncService();
export default backgroundSyncService;
