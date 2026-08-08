// src/components/ui/OfflineIndicator.jsx
import React, { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { offlineQueue } from '../../utils/OfflineQueue';

export const OfflineIndicator = memo(({ className = '' }) => {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const updatePending = () => {
      try {
        if (offlineQueue && typeof offlineQueue.size === 'function') {
          setPendingCount(offlineQueue.size());
        }
      } catch {
        // Fallback gracefully
      }
    };

    updatePending();
    const interval = setInterval(updatePending, 3000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && pendingCount === 0) return null;

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className={cn(
            'fixed top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full',
            'bg-arvdoul-surface/95 backdrop-blur-xl border border-arvdoul-border shadow-arvdoul-glass',
            'flex items-center gap-2.5 text-xs text-white select-none',
            className
          )}
          role="status"
          aria-live="polite"
        >
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <WifiOff className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-medium">
            📡 You are offline. {pendingCount > 0 ? `${pendingCount} item${pendingCount > 1 ? 's' : ''} pending sync.` : 'Changes will sync automatically.'}
          </span>
        </motion.div>
      )}

      {isOnline && pendingCount > 0 && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className={cn(
            'fixed top-3 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-full',
            'bg-arvdoul-surface/95 backdrop-blur-xl border border-arvdoul-border shadow-arvdoul-glass',
            'flex items-center gap-2 text-xs text-white/90 select-none',
            className
          )}
          role="status"
        >
          <RefreshCw className="w-3 h-3 text-arvdoul-glow-cyan animate-spin" />
          <span>Syncing {pendingCount} item{pendingCount > 1 ? 's' : ''}...</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

OfflineIndicator.displayName = 'OfflineIndicator';

export default OfflineIndicator;
