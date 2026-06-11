const VAPID_PUBLIC_KEY = "BMrAW5LQ8VwjrILPDpsnq98IodkFOoA0p7eUJV0uXN6UdXX83MNVlb9fXpXbZR30rIv5IFKYqs_QjFoKh9KlpvQ";
const CACHE_NAME = "oficioya-v3";
const SHELL = ["/icon-192.png", "/icon-512.png", "/manifest.json"];

// INSTALL — solo cachea assets estáticos, NO rutas de la app
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

// ACTIVATE — limpia cachés viejas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// FETCH — network first siempre, caché solo para iconos/imágenes
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Supabase y APIs externas — nunca interceptar
  if (url.origin !== location.origin) return;

  // Rutas de la app (HTML) — siempre network, nunca caché
  if (url.pathname === '/' || !url.pathname.includes('.')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Assets estáticos (imágenes, iconos) — caché first
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|ico|webp)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        return cached || fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Todo lo demás — network first sin caché
  e.respondWith(fetch(e.request));
});

// PUSH
self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'oficioya';
  const options = {
    body: data.body || 'Nueva notificación',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    requireInteraction: true,
    tag: 'oficioya-notif',
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// NOTIFICATION CLICK
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) return client.navigate(targetUrl);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
