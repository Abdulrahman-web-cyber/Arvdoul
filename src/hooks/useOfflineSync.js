import { useState, useEffect, useCallback } from 'react';
import {
  getQueueStatus,
  subscribeSyncStatus,
  syncQueue,
  enqueueAction,
} from '../offline/syncEngine';

/**
 * useOfflineSync - React hook providing real-time offline queue state and triggers.
 */
export function useOfflineSync() {
  const [status, setStatus] = useState({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
  });

  useEffect(() => {
    // Initial fetch
    getQueueStatus().then(setStatus);

    // Subscribe to updates
    const unsubscribe = subscribeSyncStatus(setStatus);

    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
      syncQueue();
    };

    const handleOffline = () => {
      setStatus((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncNow = useCallback(async () => {
    return await syncQueue();
  }, []);

  return {
    ...status,
    syncNow,
    enqueueAction,
  };
}

export default useOfflineSync;
