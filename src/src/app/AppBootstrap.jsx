// src/app/AppBootstrap.jsx - ULTIMATE REFACTORED VERSION - FIXED
// 🏗️ Perfect architecture with clean imports
// ⚡ No circular dependencies, perfect chunking

import React, { Suspense, useState, useEffect, lazy } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from '../context/ThemeContext.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { Toaster } from 'sonner';

// Lazy load heavy components
const GlobalErrorBoundary = lazy(() => import('./GlobalErrorBoundary.jsx'));
const AppRoutes = lazy(() => import('../routes/AppRoutes.jsx'));

/**
 * System initialization manager
 */
const SystemInitializer = ({ onReady }) => {
  const [initializationStage, setInitializationStage] = useState('starting');
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const initialize = async () => {
      try {
        console.info('🚀 Starting Arvdoul system initialization...');
        
        // Stage 1: Load essential configurations (non-blocking)
        setInitializationStage('loading_config');
        setProgress(20);
        
        // Dynamically import essential services (non-blocking)
        await Promise.allSettled([
          import('../services/authService.js'),
          import('../services/userService.js'),
          import('../services/storageService.js')
        ]);
        
        // Stage 2: Load Firebase in background (non-critical)
        setInitializationStage('background_init');
        setProgress(60);
        
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
        
        // Stage 3: Complete
        setInitializationStage('complete');
        setProgress(100);
        
        console.info('✅ System initialization complete');
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
  const [isReady, setIsReady] = useState(false);
  const [initializationStage, setInitializationStage] = useState('starting');

  return (
    <HelmetProvider>
      <Suspense fallback={<div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950" />}>
        <GlobalErrorBoundary>
          <ThemeProvider>
            {/* System initializer (invisible) */}
            <SystemInitializer 
              onReady={() => setIsReady(true)}
            />
            
            {/* Main application - Only render when ready */}
            {isReady && (
              <BrowserRouter>
                <AuthProvider>
                  <Suspense fallback={<div className="fixed inset-0 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950" />}>
                    <AppRoutes />
                  </Suspense>
                  
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
            )}
          </ThemeProvider>
        </GlobalErrorBoundary>
      </Suspense>
    </HelmetProvider>
  );
}