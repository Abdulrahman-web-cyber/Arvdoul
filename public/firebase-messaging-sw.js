/* Firebase Messaging Service Worker for background push notifications */
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
