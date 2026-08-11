/**
 * src/components/ui/OfflineIndicator.jsx - ARVDOUL OFFLINE SYNC STATUS BANNER
 *
 * Implements:
 * 1. Reactive network connectivity status (Online / Offline).
 * 2. Pending background sync queue counter (posts, comments, likes queued for sync).
 * 3. Instant manual sync trigger button with visual feedback.
 */

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { backgroundSyncService } from '../../services/BackgroundSyncService.js';

export const OfflineIndicator = ({ id = 'offline-indicator-banner' }) => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const updateStatus = () => {
    setIsOnline(navigator.onLine);
    const count = backgroundSyncService.getPendingCount();
    setPendingCount(count);
  };

  useEffect(() => {
    updateStatus();

    const handleOnline = () => {
      setIsOnline(true);
      updateStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      updateStatus();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(updateStatus, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    setSyncSuccess(false);

    try {
      const result = await backgroundSyncService.triggerSync();
      setPendingCount(backgroundSyncService.getPendingCount());
      if (result.syncedCount > 0) {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 4000);
      }
    } catch {
      // Sync error handled gracefully
    } finally {
      setIsSyncing(false);
    }
  };

  if (isOnline && pendingCount === 0 && !syncSuccess) {
    return null; // Clean aesthetic when fully online and synced
  }

  return (
    <div
      id={id}
      className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full text-xs font-medium backdrop-blur-md shadow-lg border transition-all duration-300 ${
        !isOnline
          ? 'bg-amber-500/90 text-white border-amber-400/50'
          : syncSuccess
          ? 'bg-emerald-500/90 text-white border-emerald-400/50'
          : 'bg-indigo-600/90 text-white border-indigo-400/50'
      }`}
    >
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4 animate-pulse shrink-0" />
          <span>You are offline. Changes saved locally ({pendingCount} pending).</span>
        </>
      ) : syncSuccess ? (
        <>
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>All offline changes successfully synced!</span>
        </>
      ) : (
        <>
          <RefreshCw className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{pendingCount} action{pendingCount > 1 ? 's' : ''} waiting to sync.</span>
          <button
            id="btn-trigger-manual-sync"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="ml-2 px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-full font-semibold transition"
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </>
      )}
    </div>
  );
};

export default OfflineIndicator;
