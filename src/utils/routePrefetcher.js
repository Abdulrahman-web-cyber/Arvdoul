// src/utils/routePrefetcher.js
//
// Ultra-performance background route and data prefetcher.
// Pre-loads code chunks and critical stores into memory during idle frames,
// making bottom-nav and tab navigation feel INSTANTANEOUS with zero suspense flickers.

const prefetchedModules = new Set();
let createPostPrefetchPromise = null;

/**
 * Eagerly prefetch the CreatePost screen chunk on user intent (hover/touch/focus)
 */
export const prefetchCreatePost = () => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!createPostPrefetchPromise) {
    createPostPrefetchPromise = import('../screens/CreatePost.jsx').catch((err) => {
      createPostPrefetchPromise = null;
      console.warn('CreatePost prefetch failed', err?.message);
    });
  }
  return createPostPrefetchPromise;
};

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
          }).catch((err) => {
            // Non-critical: a prefetch failure must not surface.
            console.warn('Route prefetch failed', err?.message);
          });
        } catch (err) {
          console.warn('Route prefetch scheduling failed', err?.message);
        }
      }, index * 50);
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => runPrefetch(), { timeout: 1200 });
  } else {
    setTimeout(runPrefetch, 250);
  }
};

/**
 * Initiates prefetching of the primary user-facing screens
 */
export const initAppBackgroundPrefetch = () => {
  prefetchRoutesIdle([
    () => import('../screens/HomeScreen.jsx'),
    () => prefetchCreatePost(),
    () => import('../screens/VideosScreen.jsx'),
    () => import('../screens/Profile/ProfileMyScreen.jsx'),
    () => import('../screens/NotificationsScreen.jsx'),
    () => import('../screens/MessagingScreen.jsx'),
    () => import('../screens/ChatScreen.jsx'),
    () => import('../screens/SearchScreen.jsx'),
    () => import('../screens/ReelsScreen.jsx'),
    () => import('../screens/Marketplace/MarketplaceScreen.jsx'),
    () => import('../screens/Polls/PollsScreen.jsx'),
    () => import('../screens/Sounds/SoundsScreen.jsx'),
    () => import('../screens/AIStudio/AIStudioScreen.jsx'),
  ]);
};

export default initAppBackgroundPrefetch;
