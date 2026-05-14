// OfficioYa Service Worker
const CACHE = "oficioya-v1";
const ASSETS = ["/", "/index.html"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});

// Push notifications
self.addEventListener("push", e => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || "OfficioYa", {
      body: data.body || "Tienes un nuevo mensaje",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: [200, 100, 200],
      data: data.url || "/",
      actions: [{ action: "open", title: "Ver mensaje" }]
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data || "/"));
});
