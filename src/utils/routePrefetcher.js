// src/utils/routePrefetcher.js
//
// Ultra-performance background route and data prefetcher.
// Pre-loads code chunks and critical stores into memory during idle frames and on user intent,
// making bottom-nav, desktop-rail, and CreatePost navigation feel INSTANTANEOUS with zero suspense flickers.

const prefetchedModules = new Set();
const routePrefetchPromises = new Map();
let createPostPrefetchPromise = null;
let createPostAllPrefetchPromise = null;

const ROUTE_LOADERS = [
  { key: 'home', match: (p) => p === '/' || p === '/home', load: () => import('../screens/HomeScreen.jsx') },
  { key: 'sparks', match: (p) => p === '/sparks' || p.startsWith('/videos'), load: () => import('../screens/VideosScreen.jsx') },
  { key: 'reels', match: (p) => p.startsWith('/reels'), load: () => import('../screens/ReelsScreen.jsx') },
  { key: 'messages', match: (p) => p === '/messages' || p.startsWith('/chat'), load: () => import('../screens/MessagingScreen.jsx') },
  { key: 'vibes', match: (p) => p.startsWith('/vibes') || p.startsWith('/stories'), load: () => import('../screens/StoriesScreen.jsx') },
  { key: 'notifications', match: (p) => p.startsWith('/notifications') || p.startsWith('/alerts'), load: () => import('../screens/NotificationsScreen.jsx') },
  { key: 'profile', match: (p) => p === '/profile' || p === '/profile/me', load: () => import('../screens/Profile/ProfileScreen.jsx') },
  { key: 'connections', match: (p) => p.includes('/connections') || p.includes('/followers') || p.includes('/following') || p.includes('/friends'), load: () => import('../screens/Profile/ConnectionsScreen.jsx') },
  { key: 'edit-profile', match: (p) => p.startsWith('/edit-profile') || p.startsWith('/profile/edit'), load: () => import('../screens/Profile/EditProfileScreen.jsx') },
  { key: 'coins', match: (p) => p.startsWith('/coins'), load: () => import('../screens/CoinsScreen.jsx') },
  { key: 'wallet', match: (p) => p.startsWith('/wallet'), load: () => import('../screens/Economy/WalletScreen.jsx') },
  { key: 'progress', match: (p) => p.startsWith('/progress'), load: () => import('../screens/Progression/ProgressScreen.jsx') },
  { key: 'settings', match: (p) => p.startsWith('/settings'), load: () => import('../screens/SettingsScreen.jsx') },
  { key: 'search', match: (p) => p.startsWith('/search'), load: () => import('../screens/SearchScreen.jsx') },
  { key: 'community', match: (p) => p.startsWith('/community'), load: () => import('../screens/Community/CommunityDirectoryScreen.jsx') },
  { key: 'spaces', match: (p) => p.startsWith('/spaces'), load: () => import('../screens/Spaces/SpacesScreen.jsx') },
  { key: 'rankings', match: (p) => p.startsWith('/rankings'), load: () => import('../screens/Rankings/RankingsScreen.jsx') },
  { key: 'ai-studio', match: (p) => p.startsWith('/ai-studio'), load: () => import('../screens/AIStudio/AIStudioScreen.jsx') },
  { key: 'create-post', match: (p) => p.startsWith('/create-post') || p.startsWith('/edit/'), load: () => prefetchCreatePostAll() },
];

const CREATE_POST_EDITOR_LOADERS = [
  () => import('../screens/CreatePost/CreateText'),
  () => import('../screens/CreatePost/CreateImage'),
  () => import('../screens/CreatePost/CreateVideo'),
  () => import('../screens/CreatePost/CreatePoll'),
  () => import('../screens/CreatePost/CreateQuestion'),
  () => import('../screens/CreatePost/CreateLink'),
  () => import('../screens/CreatePost/CreateAudio'),
  () => import('../screens/CreatePost/CreateEvent'),
  () => import('../screens/CreatePost/sections/ComposerControlCenter.jsx'),
  () => import('../screens/CreatePost/postPublishPipeline.js'),
];

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
 * Prefetch CreatePost along with all post type editors, Step 3 Control Center,
 * and publish pipeline so launcher -> editor -> settings swaps are instant.
 */
export const prefetchCreatePostAll = () => {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!createPostAllPrefetchPromise) {
    createPostAllPrefetchPromise = prefetchCreatePost().then(() => {
      Promise.allSettled(CREATE_POST_EDITOR_LOADERS.map((loader) => loader())).catch(() => {});
    });
  }
  return createPostAllPrefetchPromise;
};

/**
 * Prefetch the module backing any internal route path on pointer/touch/focus intent.
 */
export const prefetchRoute = (path) => {
  if (typeof window === 'undefined' || typeof path !== 'string' || !path) {
    return Promise.resolve();
  }
  const cleanPath = path.split('?')[0].split('#')[0].toLowerCase();
  const entry = ROUTE_LOADERS.find((item) => item.match(cleanPath));
  if (!entry) return Promise.resolve();

  const existing = routePrefetchPromises.get(entry.key);
  if (existing) return existing;

  const p = Promise.resolve()
    .then(() => entry.load())
    .then(() => {
      prefetchedModules.add(entry.key);
    })
    .catch((err) => {
      routePrefetchPromises.delete(entry.key);
      console.warn(`Route prefetch failed (${entry.key}):`, err?.message);
    });
  routePrefetchPromises.set(entry.key, p);
  return p;
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
      }, index * 45);
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => runPrefetch(), { timeout: 900 });
  } else {
    setTimeout(runPrefetch, 180);
  }
};

/**
 * Initiates prefetching of the primary user-facing screens
 */
export const initAppBackgroundPrefetch = () => {
  prefetchRoutesIdle([
    () => import('../screens/HomeScreen.jsx'),
    () => prefetchCreatePostAll(),
    () => import('../screens/VideosScreen.jsx'),
    () => import('../screens/Profile/ProfileScreen.jsx'),
    () => import('../screens/Profile/ProfileMyScreen.jsx'),
    () => import('../screens/Profile/ConnectionsScreen.jsx'),
    () => import('../screens/MessagingScreen.jsx'),
    () => import('../screens/NotificationsScreen.jsx'),
    () => import('../screens/StoriesScreen.jsx'),
    () => import('../screens/ReelsScreen.jsx'),
    () => import('../screens/CoinsScreen.jsx'),
    () => import('../screens/Economy/WalletScreen.jsx'),
    () => import('../screens/Progression/ProgressScreen.jsx'),
    () => import('../screens/Profile/EditProfileScreen.jsx'),
    () => import('../screens/ChatScreen.jsx'),
    () => import('../screens/SearchScreen.jsx'),
    () => import('../screens/SettingsScreen.jsx'),
    () => import('../screens/Profile/HighlightsScreen.jsx'),
  ]);
};

export default initAppBackgroundPrefetch;
