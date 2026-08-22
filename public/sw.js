/* ARVDOUL Service Worker — production PWA
 *
 * v2 (2026-08): hardened fetch strategy.
 *
 * CRITICAL FIX: v1 cache-first'd EVERY same-origin GET — including unversioned
 * dev-mode module URLs (under /src/) and non-hashed scripts. When source
 * files are rewritten or removed (e.g. seedPosts.js deletion), the SW kept
 * serving the stale cached modules, so every lazy route failed with
 * "Failed to fetch dynamically imported module". v2 only ever caches:
 *   1. navigation responses (network-first, app-shell fallback), and
 *   2. versioned production static assets (/assets/ hashed bundles) and
 *      the small precache list (icons/logos/manifest).
 * Everything else (dev modules, HMR, APIs) passes through untouched.
 */

const CACHE_NAME = 'arvdoul-v2';
const PRECACHE_URLS = ['/', '/index.html', '/manifest.json', '/icons/icon.png', '/logo/logo-light.png', '/logo/logo-dark.png', '/assets/default-profile.png'];

// File extensions safe for cache-first (versioned bundles + static media).
const STATIC_EXT_RE = /\.(?:js|css|png|jpe?g|gif|webp|svg|avif|woff2?|ttf|otf|eot|ico|mp4|webm|mp3|m4a|ogg|wasm|json)$/i;

/** True only for URLs that are safe to serve cache-first: production hashed
 *  bundles (/assets/<name>-<hash>.js|css) or precached static media. */
function isVersionedStatic(url) {
  const { pathname } = url;
  // Vite/Rollup production build output lives under /assets/ with hashed names.
  if (pathname.startsWith('/assets/')) return STATIC_EXT_RE.test(pathname);
  // Dev-server URLs and any unversioned source path are NEVER cached.
  if (pathname.startsWith('/src/')) return false;
  if (pathname.startsWith('/@vite') || pathname.startsWith('/@id') || pathname.startsWith('/@fs')) return false;
  if (pathname.startsWith('/node_modules/')) return false;
  // Precached static media (icons, logos, manifest, default assets).
  return PRECACHE_URLS.includes(pathname) && STATIC_EXT_RE.test(pathname);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // cross-origin (CDN/Stripe/Firestore) passes through

  // Navigations: network-first with cached index.html fallback (offline shell).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Versioned static assets: cache-first, then network + background cache update.
  if (isVersionedStatic(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else (dev-mode modules, HMR, API calls, unversioned scripts):
  // let the browser handle it — never intercept, never cache.
});

/* ================= FCM PUSH NOTIFICATIONS ================= */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { title: 'Arvdoul', body: event.data ? event.data.text() : 'New notification' };
  }

  const title = data.notification?.title || data.title || 'Arvdoul';
  const options = {
    body: data.notification?.body || data.body || 'You have a new notification',
    icon: data.notification?.icon || '/icons/icon.png',
    badge: '/icons/icon.png',
    data: {
      url: data.notification?.click_action || data.click_action || data.url || '/notifications',
      ...(data.data || {}),
    },
    tag: data.tag || null,
    renotify: !!data.renotify,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url).catch(() => client.focus());
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
