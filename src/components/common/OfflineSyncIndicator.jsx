import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useOfflineSync } from '../../hooks/useOfflineSync';

export function OfflineSyncIndicator() {
  const { isOnline, isSyncing, pendingCount } = useOfflineSync();
  const [showSyncedSuccess, setShowSyncedSuccess] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline && pendingCount === 0 && !isSyncing) {
      setShowSyncedSuccess(true);
      const timer = setTimeout(() => {
        setShowSyncedSuccess(false);
        setWasOffline(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, isSyncing, wasOffline]);

  // If online, not syncing, and nothing pending, and not showing success, render nothing
  if (isOnline && !isSyncing && pendingCount === 0 && !showSyncedSuccess) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        role="status"
        aria-live="polite"
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        className="fixed top-3 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      >
        <div className="pointer-events-auto px-3.5 py-1.5 rounded-full text-xs font-medium shadow-lg backdrop-blur-md flex items-center gap-2 border transition-all">
          {!isOnline ? (
            <div className="flex items-center gap-2 bg-amber-500/15 text-amber-300 border-amber-500/30 px-3 py-1 rounded-full">
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span>Offline Mode {pendingCount > 0 ? `(${pendingCount} queued)` : ''}</span>
            </div>
          ) : isSyncing ? (
            <div className="flex items-center gap-2 bg-blue-500/15 text-blue-300 border-blue-500/30 px-3 py-1 rounded-full">
              <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
              <span>Syncing {pendingCount} offline change{pendingCount !== 1 ? 's' : ''}...</span>
            </div>
          ) : showSyncedSuccess ? (
            <div className="flex items-center gap-2 bg-emerald-500/15 text-emerald-300 border-emerald-500/30 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>All changes synced</span>
            </div>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default OfflineSyncIndicator;
