/**
 * Production-ready top banner:
 * • Top-anchored with elegant spring motion & glassmorphic aesthetics
 * • Visual states: Offline (amber/red pulse), Syncing (spinning purple), Reconnected Online (emerald glow), Queued items
 * • Manual trigger sync button with haptic/sound feedback
 * • Does not obstruct app interactions, respects safe-area-inset
 */

import { useState, useEffect, useRef } from "react";
import { brandRgba } from '../../design-system/tokens.js';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { cn } from '../../lib/utils';
import { backgroundSyncService } from '../../services/BackgroundSyncService.js';
import { subscribeSyncStatus } from '../../offline/syncEngine.js';
import { useTheme } from '../../context/ThemeContext';

export const OfflineIndicator = ({ id = 'offline-indicator-banner' }) => {
  const { theme } = useTheme();
  const location = useLocation();
  const pathname = location?.pathname || '/';
  const isSplash = pathname === '/';
  const isDark = theme !== 'light';

  // TopAppBar owns the inline responsive offline/sync banner on all screens where it renders.
  // OfflineIndicator acts strictly as a lightweight fallback on full-bleed routes where TopAppBar
  // is suppressed (studios, calls, live, auth screens) or hidden on desktop (/home, /admin*).
  const isNoTopBarRoute = (
    pathname.startsWith('/call') ||
    pathname.startsWith('/video-editor') ||
    pathname.startsWith('/audio-editor') ||
    pathname.startsWith('/thumbnail-designer') ||
    pathname.startsWith('/live') ||
    pathname.startsWith('/camera') ||
    pathname.startsWith('/create-story') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/welcome') ||
    pathname.startsWith('/setup-profile')
  );
  const isDesktopOnlyFallback = pathname === '/home' || pathname.startsWith('/admin');

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showOnlinePill, setShowOnlinePill] = useState(false);
  const prevOnlineRef = useRef(isOnline);
  const onlineTimerRef = useRef(null);

  // Single source of truth for sync state: the canonical offline engine emits
  // `arvdoul-sync-status` on every queue change and drain start/end. Polling a
  // second copy (`backgroundSyncService.getPendingCount`) could not see the
  // "syncing" transition, so the banner never showed it.
  useEffect(() => {
    const applyStatus = (status) => {
      if (!status) return;
      const currentOnline = status.isOnline !== false;
      setIsOnline(currentOnline);
      setPendingCount(status.pendingCount || 0);
      setIsSyncing(Boolean(status.isSyncing));
      if (!prevOnlineRef.current && currentOnline) {
        setShowOnlinePill(true);
        if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current);
        onlineTimerRef.current = setTimeout(() => setShowOnlinePill(false), 3600);
      }
      prevOnlineRef.current = currentOnline;
    };

    const unsubscribe = subscribeSyncStatus(applyStatus);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      setShowOnlinePill(false);
      if (onlineTimerRef.current) {
        clearTimeout(onlineTimerRef.current);
        onlineTimerRef.current = null;
      }
    };
    const handleQueueChanged = (event) => {
      const nextCount = event?.detail?.count;
      if (typeof nextCount === 'number' && Number.isFinite(nextCount)) {
        setPendingCount(nextCount);
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('arvdoul:sync_queue_changed', handleQueueChanged);

    return () => {
      unsubscribe?.();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('arvdoul:sync_queue_changed', handleQueueChanged);
      if (onlineTimerRef.current) {
        clearTimeout(onlineTimerRef.current);
        onlineTimerRef.current = null;
      }
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);

    try {
      if (backgroundSyncService.triggerSync) {
        await backgroundSyncService.triggerSync();
      }
      setShowOnlinePill(true);
      if (onlineTimerRef.current) clearTimeout(onlineTimerRef.current);
      onlineTimerRef.current = setTimeout(() => setShowOnlinePill(false), 3600);
    } catch (err) {
      console.warn('Manual sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Determine whether fallback banner should be shown
  const allowFallback = isNoTopBarRoute || isDesktopOnlyFallback;
  const shouldShow = !isSplash && allowFallback && (!isOnline || pendingCount > 0 || showOnlinePill || isSyncing);

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          id={id}
          initial={{ y: -24, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -24, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 24, stiffness: 350 }}
          className={cn(
            "fixed top-2.5 right-3 sm:right-5 z-[90] flex flex-wrap sm:flex-nowrap items-center justify-center gap-x-2 gap-y-1 px-3 sm:px-4 py-1.5 rounded-2xl sm:rounded-full text-[11px] sm:text-xs font-semibold backdrop-blur-2xl shadow-lg border w-max max-w-[calc(100vw-24px)] sm:max-w-md pointer-events-auto",
            isDesktopOnlyFallback && !isNoTopBarRoute && "hidden lg:flex"
          )}
          style={{
            background: !isOnline
              ? (isDark
                  ? 'linear-gradient(135deg, rgba(69, 10, 10, 0.78) 0%, rgba(41, 10, 10, 0.82) 100%)'
                  : 'linear-gradient(135deg, rgba(254, 242, 242, 0.94) 0%, rgba(254, 226, 226, 0.92) 100%)')
              : showOnlinePill
              ? (isDark
                  ? 'linear-gradient(135deg, rgba(6, 78, 59, 0.78) 0%, rgba(4, 47, 46, 0.82) 100%)'
                  : 'linear-gradient(135deg, rgba(236, 253, 245, 0.94) 0%, rgba(209, 250, 229, 0.92) 100%)')
              : (isDark
                  ? 'linear-gradient(135deg, rgba(16, 22, 60, 0.78) 0%, rgba(10, 14, 42, 0.84) 100%)'
                  : 'linear-gradient(135deg, rgba(255, 255, 255, 0.94) 0%, rgba(241, 245, 255, 0.92) 100%)'),
            borderColor: !isOnline
              ? (isDark ? 'rgba(239, 68, 68, 0.34)' : 'rgba(220, 38, 38, 0.28)')
              : showOnlinePill
              ? (isDark ? 'rgba(16, 185, 129, 0.34)' : 'rgba(5, 150, 105, 0.28)')
              : brandRgba(isDark ? 0.32 : 0.26),
            boxShadow: !isOnline
              ? '0 10px 26px -10px rgba(239, 68, 68, 0.28)'
              : showOnlinePill
              ? '0 10px 26px -10px rgba(16, 185, 129, 0.28)'
              : `0 10px 26px -10px ${brandRgba(0.24)}`,
            color: !isOnline
              ? (isDark ? '#FECACA' : '#991B1B')
              : showOnlinePill
              ? (isDark ? '#A7F3D0' : '#065F46')
              : (isDark ? '#E9D5FF' : '#1E1B4B'),
          }}
        >
          {/* Offline State */}
          {!isOnline ? (
            <>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shrink-0" />
              <WifiOff className={cn("w-3.5 h-3.5 shrink-0", isDark ? "text-red-400" : "text-red-600")} />
              <span className="truncate max-w-[70vw] sm:max-w-none">
                {pendingCount > 0
                  ? `Offline · ${pendingCount} change${pendingCount > 1 ? 's' : ''} queued`
                  : 'Offline · Browsing cached state'}
              </span>
            </>
          ) : showOnlinePill ? (
            /* Reconnected Online State */
            <>
              <CheckCircle2 className={cn("w-4 h-4 shrink-0", isDark ? "text-emerald-400" : "text-emerald-600")} />
              <span className="truncate max-w-[72vw] sm:max-w-none">
                Back Online · All data synchronized
              </span>
            </>
          ) : (
            /* Pending Background Sync */
            <>
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-purple-400' : 'text-purple-600'} ${
                  isSyncing ? 'animate-spin' : ''
                }`}
              />
              <span className="truncate max-w-[52vw] sm:max-w-none">
                {pendingCount} action{pendingCount > 1 ? 's' : ''} queued
              </span>
              <button
                id="btn-trigger-manual-sync"
                onClick={handleManualSync}
                disabled={isSyncing}
                className={
                  isDark
                    ? "px-2.5 py-0.5 bg-purple-500/30 hover:bg-purple-500/50 border border-purple-400/40 text-white rounded-full text-[11px] font-medium transition shrink-0 active:scale-95"
                    : "px-2.5 py-0.5 bg-purple-600/12 hover:bg-purple-600/20 border border-purple-600/30 text-purple-900 rounded-full text-[11px] font-semibold transition shrink-0 active:scale-95"
                }
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
