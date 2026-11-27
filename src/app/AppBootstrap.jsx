// src/app/AppBootstrap.jsx

import { Suspense, useEffect } from "react";
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from '../context/ThemeContext.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { Toaster } from 'sonner';
import GlobalErrorBoundary from './GlobalErrorBoundary.jsx';
import AppRoutes from '../routes/AppRoutes.jsx';
import OfflineIndicator from '../components/UI/OfflineIndicator.jsx';
import IncomingCallBanner from '../components/Shared/IncomingCallBanner.jsx';
import ConfirmProvider from '../components/Shared/ConfirmProvider.jsx';
import PWAInstallBanner from '../components/common/PWAInstallBanner.jsx';
import SWUpdateBanner from '../components/common/SWUpdateBanner.jsx';
import { RouteProgressBar } from '../components/Navigation/RouteProgressBar.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import BrandBootCanvas from '../components/Shared/BrandBootCanvas.jsx';
import { initAppBackgroundPrefetch } from '../utils/routePrefetcher.js';

const AppBootFallback = () => {
  const { isDark } = useTheme();
  return (
    <BrandBootCanvas isDark={isDark} label="Loading application">
      <RouteProgressBar isAnimating={true} />
    </BrandBootCanvas>
  );
};

/**
 * System initialization manager
 */
const SystemInitializer = ({ onReady = () => {} }) => {
  useEffect(() => {
    let cancelled = false;
    let deferredTimer = null;
    let prefetchTimer = null;

    const initialize = async () => {
      try {
        console.info('🚀 Starting Arvdoul system initialization...');

        // Stage 1: Load essential auth + crash capture first without saturating network/CPU
        await Promise.allSettled([
          import('../services/authService.js'),
          import('../services/crashReportingService.js'),
        ]);

        if (cancelled) return;

        // Stage 2: Yield so SplashScreen paints & animates smoothly on slower devices (e.g., Termux)
        deferredTimer = setTimeout(() => {
          if (cancelled) return;

          import('../services/userService.js').catch(() => {});
          import('../services/storageService.js').catch(() => {});

          import('../firebase/firebase.js')
            .then(({ initializeFirebase }) => initializeFirebase())
            .catch((error) => {
              console.warn('⚠️ Background Firebase init:', error?.message);
            });

          (async () => {
            try {
              const { featureFlagService } = await import('../services/featureFlagService.js');
              await featureFlagService.init();
              const { getFirestoreInstance } = await import('../firebase/firebase.js');
              const firestore = await getFirestoreInstance();
              await featureFlagService.attachFirestoreOverrides(firestore);
            } catch (error) {
              console.warn('⚠️ Feature flags init failed (defaults active):', error?.message);
            }
          })();

          (async () => {
            try {
              const { rumService } = await import('../services/rumService.js');
              rumService.attachToMetrics();
            } catch (error) {
              console.warn('⚠️ RUM init failed:', error?.message);
            }
          })();

          (async () => {
            try {
              const { syncQueue } = await import('../offline/syncEngine.js');
              const uid =
                typeof window !== 'undefined'
                  ? window._arvdoul_auth?.currentUser?.uid || null
                  : null;
              if (uid) {
                syncQueue({ ownerUid: uid }).catch((e) => {
                  console.warn('Startup queue drain failed', e?.message);
                });
              }
            } catch (err) {
              console.warn('Offline drain wiring skipped:', err?.message);
            }
          })();
        }, 450);

        // Stage 3: Delay heavy multi-screen prefetching until splash hand-off has settled
        prefetchTimer = setTimeout(() => {
          if (!cancelled) {
            initAppBackgroundPrefetch();
          }
        }, 3200);

        console.info('✅ System initialization scheduled');
        onReady();
      } catch (error) {
        console.error('❌ System initialization error:', error);
        onReady();
      }
    };

    initialize();

    return () => {
      cancelled = true;
      if (deferredTimer) clearTimeout(deferredTimer);
      if (prefetchTimer) clearTimeout(prefetchTimer);
    };
  }, [onReady]);

  return null;
};

/**
 * Main App Bootstrap Component
 */
export default function AppBootstrap() {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <GlobalErrorBoundary>
          {/* System initializer (invisible background tasks). It reports
              completion through an optional callback; AppBootstrap has nothing
              to do on ready, so it passes none rather than a dead no-op. */}
          <SystemInitializer />
          
          {/* Main application renders immediately without blocking screens */}
          <BrowserRouter>
            <AuthProvider>
              {/* Promise-based confirmation primitive (replaces window.confirm);
                  must wrap every screen that calls `useConfirm()`. */}
              <ConfirmProvider>
                {/* Global motion policy: every Framer Motion animation respects
                    prefers-reduced-motion (WCAG 2.2 2.3.3). */}
                <MotionConfig reducedMotion="user">
                  <Suspense fallback={<AppBootFallback />}>
                    <AppRoutes />
                  </Suspense>
                </MotionConfig>

                {/* Global offline sync indicator */}
                <OfflineIndicator />

              {/* Incoming 1:1 call ring (subscribes to ringing calls for the callee) */}
              <IncomingCallBanner />
              
              {/* PWA Install and Update Banners */}
              <PWAInstallBanner />
              <SWUpdateBanner />
              
              {/* Toast notifications */}
              <Toaster 
                position="top-right"
                toastOptions={{
                  className: 'font-sans backdrop-blur-sm',
                  duration: 4000,
                  style: {
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(0, 0, 0, 0.1)',
                  }
                }}
                richColors
                closeButton
                expand
              />
              </ConfirmProvider>
            </AuthProvider>
          </BrowserRouter>
        </GlobalErrorBoundary>
      </ThemeProvider>
    </HelmetProvider>
  );
}