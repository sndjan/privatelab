// Service worker: makes the app installable and shows /offline when a page
// can't be loaded. Pages are never served from the cache, so signed-in data
// is always fresh; only the offline page and the icons are cached.
const CACHE = "privatelab-v3";
const PRECACHE = ["/offline", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match("/offline")));
});

// Push notifications. The server sends JSON { title, body, url }; anything
// else is shown as plain text so a malformed push still shows up.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Private Lab", {
      body: data.body || "",
      icon: "/icon-192.png",
      data: { url: data.url || "/dashboard" },
    }),
  );
});

// Tapping a notification focuses an open window on its page, or opens one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/dashboard", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url === url) ?? windows[0];
      if (open) return open.focus().then((client) => (client.url === url ? client : client.navigate(url)));
      return self.clients.openWindow(url);
    }),
  );
});
