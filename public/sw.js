/* ARVDOUL Service Worker — production PWA
 * Network-first for navigations (fresh app), cache-first for static assets.
 * The app is a SPA: fall back to index.html for any navigation.
 */
const CACHE_NAME = 'arvdoul-v1';
const PRECACHE_URLS = ['/', '/index.html', '/manifest.json', '/icons/icon.png', '/logo/logo-light.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
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
  if (url.origin !== self.location.origin) return; // let cross-origin (CDN/Stripe) pass through

  // Navigations: network-first with index.html fallback (offline shell).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Static assets: cache-first, then network + cache update.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
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

