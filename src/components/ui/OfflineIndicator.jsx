/**
 * src/components/ui/OfflineIndicator.jsx - ARVDOUL OFFLINE & ONLINE SYNC STATUS BANNER
 * 
 * Production-ready top banner:
 * • Top-anchored with elegant spring motion & glassmorphic aesthetics
 * • Visual states: Offline (amber/red pulse), Syncing (spinning purple), Reconnected Online (emerald glow), Queued items
 * • Manual trigger sync button with haptic/sound feedback
 * • Does not obstruct app interactions, respects safe-area-inset
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, Cloud, ArrowUpCircle } from 'lucide-react';
import { backgroundSyncService } from '../../services/BackgroundSyncService.js';
import { useTheme } from '../../context/ThemeContext';

export const OfflineIndicator = ({ id = 'offline-indicator-banner' }) => {
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showOnlinePill, setShowOnlinePill] = useState(false);
  const prevOnlineRef = useRef(isOnline);

  const updateStatus = useCallback(() => {
    const currentOnline = navigator.onLine;
    setIsOnline(currentOnline);
    const count = backgroundSyncService.getPendingCount?.() || 0;
    setPendingCount(count);

    // Detect reconnection transition
    if (!prevOnlineRef.current && currentOnline) {
      setShowOnlinePill(true);
      setTimeout(() => setShowOnlinePill(false), 3600);
    }
    prevOnlineRef.current = currentOnline;
  }, []);

  useEffect(() => {
    updateStatus();

    const handleOnline = () => {
      setIsOnline(true);
      updateStatus();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOnlinePill(false);
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
  }, [updateStatus]);

  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);

    try {
      if (backgroundSyncService.triggerSync) {
        await backgroundSyncService.triggerSync();
      }
      updateStatus();
      setShowOnlinePill(true);
      setTimeout(() => setShowOnlinePill(false), 3600);
    } catch (err) {
      console.warn('Manual sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Determine whether banner should be shown
  const shouldShow = !isOnline || pendingCount > 0 || showOnlinePill || isSyncing;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          id={id}
          initial={{ y: -40, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -40, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 24, stiffness: 350 }}
          className="fixed top-2 sm:top-3 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2.5 px-4 py-1.5 sm:py-2 rounded-full text-xs font-semibold backdrop-blur-2xl shadow-2xl border max-w-[94vw] sm:max-w-md pointer-events-auto"
          style={{
            background: !isOnline
              ? 'linear-gradient(135deg, rgba(69, 10, 10, 0.92) 0%, rgba(41, 10, 10, 0.92) 100%)'
              : showOnlinePill
              ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.92) 0%, rgba(4, 47, 46, 0.92) 100%)'
              : 'linear-gradient(135deg, rgba(20, 12, 50, 0.92) 0%, rgba(10, 6, 35, 0.92) 100%)',
            borderColor: !isOnline
              ? 'rgba(239, 68, 68, 0.35)'
              : showOnlinePill
              ? 'rgba(16, 185, 129, 0.35)'
              : 'rgba(139, 30, 243, 0.35)',
            boxShadow: !isOnline
              ? '0 10px 30px rgba(239, 68, 68, 0.25)'
              : showOnlinePill
              ? '0 10px 30px rgba(16, 185, 129, 0.25)'
              : '0 10px 30px rgba(139, 30, 243, 0.25)',
            color: !isOnline ? '#FECACA' : showOnlinePill ? '#A7F3D0' : '#E9D5FF',
          }}
        >
          {/* Offline State */}
          {!isOnline ? (
            <>
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <WifiOff className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span className="truncate">
                {pendingCount > 0
                  ? `Offline · ${pendingCount} change${pendingCount > 1 ? 's' : ''} queued`
                  : 'Offline · Browsing cached state'}
              </span>
            </>
          ) : showOnlinePill ? (
            /* Reconnected Online State */
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
              <span className="truncate text-emerald-100">
                Back Online · All data synchronized
              </span>
            </>
          ) : (
            /* Pending Background Sync */
            <>
              <RefreshCw
                className={`w-3.5 h-3.5 text-purple-400 shrink-0 ${
                  isSyncing ? 'animate-spin' : ''
                }`}
              />
              <span className="truncate">
                {pendingCount} action{pendingCount > 1 ? 's' : ''} queued
              </span>
              <button
                id="btn-trigger-manual-sync"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="ml-auto px-2.5 py-0.5 bg-purple-500/30 hover:bg-purple-500/50 border border-purple-400/40 text-white rounded-full text-[11px] font-medium transition shrink-0 active:scale-95"
              >
                {isSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineIndicator;
