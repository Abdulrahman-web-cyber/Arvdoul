/**
 * Coordinates between IndexedDB (OfflineQueue), online network transitions,
 * server APIs, and reactive UI sync status indicators.
 */

import { offlineQueue } from '../utils/OfflineQueue';

// Re-export the canonical queue singleton. A second OfflineQueue instance
// would keep its own in-memory fallback and drain state, so operations queued
// through the service layer could never be drained by this engine.
export { offlineQueue };

let isSyncing = false;
let currentSyncPromise = null;
let lastSyncTime = null;
const syncListeners = new Set();

/**
 * Dispatch sync state changes to all subscribers
 */
function notifyListeners(state) {
  syncListeners.forEach((listener) => {
    try {
      listener(state);
    } catch (err) {
      console.warn('Sync listener error:', err);
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('arvdoul-sync-status', {
        detail: state,
      })
    );
  }
}

/**
 * Subscribe to sync engine status changes
 */
export function subscribeSyncStatus(listener) {
  syncListeners.add(listener);
  // Emit current state immediately
  getQueueStatus().then(listener);
  return () => syncListeners.delete(listener);
}

/**
 * Fetch current offline queue count and status
 */
export async function getQueueStatus() {
  const pending = await offlineQueue.getPendingCount();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  return {
    isOnline,
    isSyncing,
    pendingCount: pending,
    lastSyncTime,
  };
}

/**
 * Registry of handlers for different operation types
 */
const operationHandlers = new Map();

/**
 * Register a handler for a specific operation type
 * @param {string} type - e.g. 'post.like', 'message.send'
 * @param {Function} handler - async function(payload)
 */
export function registerSyncHandler(type, handler) {
  operationHandlers.set(type, handler);
}

// Built-in handlers for common social actions
registerSyncHandler('post.like', async (payload) => {
  const { feedService } = await import('../services/feedService');
  return feedService.likePost(payload.postId, payload.userId);
});

registerSyncHandler('post.unlike', async (payload) => {
  const { feedService } = await import('../services/feedService');
  return feedService.unlikePost(payload.postId, payload.userId);
});

registerSyncHandler('user.follow', async (payload) => {
  // Canonical follow implementation lives on userService; the previous
  // `followService` module never existed and the payload key was wrong, so the
  // queued op could not be replayed at all.
  const { getUserService } = await import('../services/userService');
  return getUserService().followUser(payload.followerId, payload.followingId);
});

registerSyncHandler('user.unfollow', async (payload) => {
  const { getUserService } = await import('../services/userService');
  return getUserService().unfollowUser(payload.followerId, payload.followingId);
});

registerSyncHandler('message.send', async (payload) => {
  const { default: messagesService } = await import('../services/messagesService');
  return messagesService.sendMessage(payload.conversationId, payload.message, payload.options || {});
});

registerSyncHandler('notification.markRead', async (payload) => {
  const { getNotificationsService } = await import('../services/notificationsService');
  return getNotificationsService().markNotificationAsRead(payload.notificationId, payload.userId);
});

/**
 * Drains the offline queue by executing pending operations against their handlers.
 * Includes conflict resolution, exponential backoff, and retry handling.
 */
export async function syncQueue({ ownerUid = null } = {}) {
  if (currentSyncPromise) {
    return currentSyncPromise;
  }
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (!isOnline) {
    notifyListeners(await getQueueStatus());
    return;
  }

  currentSyncPromise = (async () => {
    isSyncing = true;
    notifyListeners(await getQueueStatus());

    try {
      // Process items in the queue
      await offlineQueue.drain(async (op) => {
        const handler = operationHandlers.get(op.type);
        if (!handler) {
          console.warn(`[SyncEngine] No handler registered for op type: "${op.type}". Marking resolved.`);
          return { skipped: true, reason: 'no-handler' };
        }

        // Conflict detection: if payload contains a clientTimestamp older than 7 days, drop or resolve
        if (op.payload?.clientTimestamp) {
          const ageMs = Date.now() - new Date(op.payload.clientTimestamp).getTime();
          const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
          if (ageMs > SEVEN_DAYS_MS) {
            console.warn(`[SyncEngine] Op ${op.id} (${op.type}) expired due to conflict window. Dropping.`);
            return { expired: true };
          }
        }

        return await handler(op.payload);
      }, { ownerUid });

      lastSyncTime = Date.now();
    } catch (err) {
      console.warn('[SyncEngine] Error during queue drain:', err);
    } finally {
      isSyncing = false;
      currentSyncPromise = null;
      notifyListeners(await getQueueStatus());
    }
  })();

  return currentSyncPromise;
}

/**
 * Enqueues an action for guaranteed delivery (optimistic + persistent).
 * Immediately attempts to drain if online.
 */
export async function enqueueAction({ type, payload = {}, priority = 'medium', idempotencyKey = null, ownerUid = null }) {
  const opId = await offlineQueue.enqueue({
    type,
    payload: {
      clientTimestamp: new Date().toISOString(),
      ...payload,
    },
    priority,
    idempotencyKey,
    ownerUid,
  });

  notifyListeners(await getQueueStatus());

  // If online, trigger a background drain scoped to the owning account so a
  // queued op is never executed on behalf of a different session.
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    syncQueue({ ownerUid }).catch(() => {});
  }

  return opId;
}

const sessionOwnerUid = () =>
  (typeof window !== 'undefined' ? window._arvdoul_auth?.currentUser?.uid || null : null);

// Auto-wire online/offline listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    const uid = sessionOwnerUid();
    // Only drain the signed-in account's queue; never replay another
    // account's pending writes.
    if (!uid) return;
    console.info('🌐 App went online. Draining offline mutation queue...');
    syncQueue({ ownerUid: uid });
  });

  window.addEventListener('offline', () => {
    console.info('📴 App went offline. Operations will be queued in IndexedDB.');
    getQueueStatus().then(notifyListeners);
  });
}

/**
 * Purge queued operations on account change. Ops owned by the departing
 * account are dropped so a later session cannot replay them.
 * @param {string|null} uid
 */
export async function purgeQueueForOwner(uid) {
  const removed = await offlineQueue.purgeOwner(uid);
  notifyListeners(await getQueueStatus());
  return removed;
}

export default {
  offlineQueue,
  syncQueue,
  enqueueAction,
  getQueueStatus,
  subscribeSyncStatus,
  registerSyncHandler,
  purgeQueueForOwner,
};
