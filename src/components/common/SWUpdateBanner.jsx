import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Sparkles } from 'lucide-react';

export function SWUpdateBanner() {
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    // Listen for controllerchange
    const handleControllerChange = () => {
      // Reload automatically if user clicked update
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Check if registration has waiting worker
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;

      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setShowUpdate(true);
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setShowUpdate(true);
          }
        });
      });
    }).catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  if (!showUpdate) return null;

  return (
    <AnimatePresence>
      <motion.aside
        role="alert"
        aria-live="polite"
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        className="fixed top-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50"
      >
        <div className="p-3.5 rounded-xl bg-purple-950/90 border border-purple-400/40 text-white shadow-2xl backdrop-blur-md flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-purple-800/80 text-purple-200">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-tight">Update available</p>
              <p className="text-[11px] text-purple-200/80">New features and performance updates ready.</p>
            </div>
          </div>

          <button
            id="sw-update-action-btn"
            type="button"
            onClick={handleUpdate}
            className="px-3 py-1 text-xs font-medium bg-white text-purple-900 rounded-lg hover:bg-purple-100 transition-colors flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95"
          >
            <RefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

export default SWUpdateBanner;
