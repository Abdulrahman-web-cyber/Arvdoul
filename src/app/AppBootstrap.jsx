// src/app/AppBootstrap.jsx

import { Suspense, useEffect, useCallback } from "react";
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
import PWAInstallBanner from '../components/common/PWAInstallBanner.jsx';
import SWUpdateBanner from '../components/common/SWUpdateBanner.jsx';
import { initAppBackgroundPrefetch } from '../utils/routePrefetcher.js';

/**
 * System initialization manager
 */
const SystemInitializer = ({ onReady }) => {
  useEffect(() => {
    const initialize = async () => {
      try {
        console.info('🚀 Starting Arvdoul system initialization...');
        
        // Stage 1: Load essential configurations (non-blocking)
        
        // Dynamically import essential services (non-blocking)
        await Promise.allSettled([
          import('../services/authService.js'),
          import('../services/userService.js'),
          import('../services/storageService.js'),
          // Importing this module constructs the singleton, which attaches the
          // window 'error' / 'unhandledrejection' listeners. Without it, errors
          // thrown outside React's render path (event handlers, async work)
          // were never captured anywhere.
          import('../services/crashReportingService.js')
        ]);
        
        // Stage 2: Load Firebase in background (non-critical)
        
        // Initialize Firebase in background - don't block app startup
        const firebaseInit = async () => {
          try {
            const { initializeFirebase } = await import('../firebase/firebase.js');
            await initializeFirebase();
          } catch (error) {
            console.warn('⚠️ Background Firebase init:', error.message);
            // Continue anyway - auth system will handle reconnection
          }
        };
        
        // Don't await - let it run in background
        firebaseInit();

        // Feature flags: pull Firebase Remote Config in the background and
        // subscribe to the server-governed `feature_flags` overrides so a kill
        // switch applies to every signed-in user. Until either resolves (or
        // fails), the static defaults are active, so nothing blocks startup.
        const featureFlagsInit = async () => {
          try {
            const { featureFlagService } = await import('../services/featureFlagService.js');
            await featureFlagService.init();
            const { getFirestoreInstance } = await import('../firebase/firebase.js');
            const firestore = await getFirestoreInstance();
            await featureFlagService.attachFirestoreOverrides(firestore);
          } catch (error) {
            console.warn('⚠️ Feature flags init failed (defaults active):', error.message);
          }
        };
        featureFlagsInit();

        // Real User Monitoring: wire Core Web Vitals + route timings into the
        // metrics pipeline (best-effort; never blocks startup).
        const rumInit = async () => {
          try {
            const { rumService } = await import('../services/rumService.js');
            rumService.attachToMetrics();
          } catch (error) {
            console.warn('⚠️ RUM init failed:', error.message);
          }
        };
        rumInit();

        // Wire the global offline-queue drain. The op-type → service map lives
        // in the canonical sync engine (`src/offline/syncEngine.js`); this call
        // only starts the startup drain — the engine already drains on
        // reconnect. A previous inline switch here was a SECOND, divergent copy:
        // it called methods that do not exist (messagesService.getMessagesService,
        // feedService.addReaction, videoService.createReel) and competed with the
        // engine's own drain, so queued ops failed and retried forever.
        const wireOfflineDrain = async () => {
          try {
            const { syncQueue } = await import('../offline/syncEngine.js');
            const uid =
              typeof window !== 'undefined'
                ? window._arvdoul_auth?.currentUser?.uid || null
                : null;
            if (uid) syncQueue({ ownerUid: uid }).catch(() => {});
          } catch (err) {
            console.warn('Offline drain wiring skipped:', err.message);
          }
        };
        wireOfflineDrain();
        
        // Stage 3: Complete
        
        console.info('✅ System initialization complete');
        initAppBackgroundPrefetch();
        onReady();
        
      } catch (error) {
        console.error('❌ System initialization error:', error);
        onReady(); // Continue anyway - error boundaries will handle
      }
    };
    
    // Start initialization immediately
    initialize();
  }, [onReady]);
  
  return null;
};

/**
 * Main App Bootstrap Component
 */
export default function AppBootstrap() {
  const handleReady = useCallback(() => {}, []);

  return (
    <HelmetProvider>
      <ThemeProvider>
        <GlobalErrorBoundary>
          {/* System initializer (invisible background tasks) */}
          <SystemInitializer onReady={handleReady} />
          
          {/* Main application renders immediately without blocking screens */}
          <BrowserRouter>
            <AuthProvider>
              {/* Global motion policy: every Framer Motion animation respects
                  prefers-reduced-motion (WCAG 2.2 2.3.3). */}
              <MotionConfig reducedMotion="user">
                <Suspense fallback={null}>
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
            </AuthProvider>
          </BrowserRouter>
        </GlobalErrorBoundary>
      </ThemeProvider>
    </HelmetProvider>
  );
}