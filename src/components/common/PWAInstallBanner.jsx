import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Share2, PlusSquare, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

export function PWAInstallBanner() {
  const { isInstallable, isIOS, promptInstall, dismissPrompt } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If neither standard installable nor iOS install eligible, hide
  if (!isInstallable && !isIOS) return null;

  const handleAction = async () => {
    if (isInstallable) {
      await promptInstall();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  return (
    <AnimatePresence>
      <motion.aside
        role="region"
        aria-label="Install Arvdoul App"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-40"
      >
        <div className="p-4 rounded-2xl bg-gray-900/95 dark:bg-gray-950/95 border border-purple-500/30 text-white shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20 shrink-0">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h4 className="text-sm font-semibold tracking-tight text-white">
                  Install Arvdoul
                </h4>
                <p className="text-xs text-gray-400 mt-0.5 leading-snug">
                  Get faster feeds, offline mode, and instant notification alerts.
                </p>
              </div>
            </div>

            <button
              id="pwa-dismiss-btn"
              type="button"
              onClick={dismissPrompt}
              aria-label="Dismiss app install banner"
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              id="pwa-later-btn"
              type="button"
              onClick={dismissPrompt}
              className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              Not now
            </button>
            <button
              id="pwa-install-action-btn"
              type="button"
              onClick={handleAction}
              className="px-4 py-1.5 text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white rounded-lg shadow-md shadow-purple-600/30 transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              Install App
            </button>
          </div>

          {/* iOS Safari Installation Steps Modal/Drawer */}
          {showIOSGuide && (
            <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-300 space-y-2">
              <p className="font-medium text-purple-300">To install on iOS Safari:</p>
              <ol className="list-decimal list-inside space-y-1 text-gray-400">
                <li className="flex items-center gap-1.5">
                  <span>1. Tap the Share icon</span>
                  <Share2 className="w-3.5 h-3.5 text-blue-400 inline" />
                  <span>in Safari's bottom toolbar</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <span>2. Scroll and tap</span>
                  <strong className="text-white font-medium flex items-center gap-1">
                    <PlusSquare className="w-3.5 h-3.5" /> Add to Home Screen
                  </strong>
                </li>
                <li>3. Tap <strong className="text-white">Add</strong> in the top-right corner</li>
              </ol>
            </div>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}

export default PWAInstallBanner;
