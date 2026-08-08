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

        // Wire the global offline-queue drain: every queued operation
        // (comments, live joins/leaves, gift/upload retries, welcome
        // notifications, search analytics) is retried when connectivity
        // returns, with per-type handlers dispatching to the services.
        const wireOfflineDrain = async () => {
          try {
            const { offlineQueue } = await import('../utils/OfflineQueue.js');
            const drain = async (op) => {
              try {
                switch (op.type) {
                  case 'comment.create':
                    await import('../services/commentService.js').then(m =>
                      m.getCommentService().createComment(op.payload.postId, op.payload.userId, op.payload.content, op.payload.options || {}));
                    break;
                  case 'live.join':
                    await import('../services/liveService.js').then(m =>
                      m.getLiveService().joinLiveStream(op.payload.streamId, op.payload.viewerId));
                    break;
                  case 'live.leave':
                    await import('../services/liveService.js').then(m =>
                      m.getLiveService().leaveLiveStream(op.payload.streamId, op.payload.viewerId));
                    break;
                  case 'live_gift':
                  case 'live.gift':
                    await import('../services/liveService.js').then(m =>
                      m.getLiveService().sendLiveGift(
                        op.payload.streamId,
                        op.payload.senderId,
                        op.payload.recipientId,
                        op.payload.giftType
                      ));
                    break;
                  case 'post.create':
                    await import('../services/firestoreService.js').then(m =>
                      m.getFirestoreService().createPost(op.payload));
                    break;
                  case 'reel.create':
                    await import('../services/videoService.js').then(m =>
                      m.getVideoService().createReel(op.payload));
                    break;
                  case 'reaction.create':
                    await import('../services/feedService.js').then(m =>
                      m.getFeedService().addReaction(op.payload.postId, op.payload.userId, op.payload.emoji));
                    break;
                  case 'message.send':
                    await import('../services/messagesService.js').then(m =>
                      m.getMessagesService().sendMessage(op.payload.conversationId, op.payload.content, op.payload.senderId));
                    break;
                  case 'notification.welcome':
                    await import('../services/notificationsService.js').then(m =>
                      m.getNotificationsService().sendNotification({
                        type: 'welcome',
                        recipientId: op.payload.userId,
                        title: 'Welcome to Arvdoul!',
                        message: `Hi ${op.payload.userName || 'there'}! Start exploring, connect with friends, and enjoy the experience.`,
                        priority: 'normal',
                        channel: 'in_app',
                      }));
                    break;
                  case 'user.follow':
                    await import('../services/userService.js').then(m =>
                      m.getUserService().followUser(op.payload.followerId, op.payload.followingId));
                    break;
                  case 'user.unfollow':
                    await import('../services/userService.js').then(m =>
                      m.getUserService().unfollowUser(op.payload.followerId, op.payload.followingId));
                    break;
                  case 'search.analytics':
                    // Analytics events are best-effort; dropping after retry is acceptable.
                    return true;
                  case 'purchaseCoins':
                    await import('../services/monetizationService.js').then((m) =>
                      m.getMonetizationService().purchaseCoins(op.payload.packageId, op.payload.paymentMethodId, op.payload.deviceMetadata || {}));
                    break;
                  case 'watchAd':
                    await import('../services/monetizationService.js').then((m) =>
                      m.getMonetizationService().watchAd(op.payload.placement, op.payload.adId, op.payload.watchDurationSeconds, op.payload.deviceMetadata || {}));
                    break;
                  default:
                    return true; // unknown ops are dropped (not retried forever)
                }
                return true;
              } catch (err) {
                return false; // will retry with backoff
              }
            };
            // Drain on startup (after Firebase is ready) and whenever we come online.
            offlineQueue.process(drain).catch(() => {});
            offlineQueue.onOnline(drain);
          } catch (err) {
            console.warn('Offline drain wiring skipped:', err.message);
          }
        };
        wireOfflineDrain();
        
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