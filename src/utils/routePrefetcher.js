// src/utils/routePrefetcher.js
// Ultra-performance background route and data prefetcher.
// Pre-loads code chunks and critical stores into memory during idle frames,
// making bottom-nav and tab navigation feel INSTANTANEOUS with zero suspense flickers.

const prefetchedModules = new Set();

/**
 * Prefetch an array of dynamic import loaders safely during idle frames
 */
export const prefetchRoutesIdle = (importFns = []) => {
  if (typeof window === 'undefined') return;

  const runPrefetch = () => {
    importFns.forEach((fn, index) => {
      // Stagger imports to avoid network congestion
      setTimeout(() => {
        try {
          fn().then(() => {
            prefetchedModules.add(index);
          }).catch(() => {
            // Non-critical, ignore
          });
        } catch (_) {}
      }, index * 120);
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => runPrefetch(), { timeout: 2500 });
  } else {
    setTimeout(runPrefetch, 600);
  }
};

/**
 * Initiates prefetching of the primary user-facing screens
 */
export const initAppBackgroundPrefetch = () => {
  prefetchRoutesIdle([
    () => import('../screens/VideosScreen.jsx'),
    () => import('../screens/HomeScreen.jsx'),
    () => import('../screens/ReelsScreen.jsx'),
    () => import('../screens/Profile/ProfileMyScreen.jsx'),
    () => import('../screens/NotificationsScreen.jsx'),
    () => import('../screens/MessagingScreen.jsx'),
    () => import('../screens/ChatScreen.jsx'),
    () => import('../screens/SearchScreen.jsx'),
    () => import('../screens/CreatePost.jsx'),
    () => import('../screens/Marketplace/MarketplaceScreen.jsx'),
    () => import('../screens/Polls/PollsScreen.jsx'),
    () => import('../screens/Sounds/SoundsScreen.jsx'),
    () => import('../screens/AIStudio/AIStudioScreen.jsx'),
  ]);
};

export default initAppBackgroundPrefetch;
