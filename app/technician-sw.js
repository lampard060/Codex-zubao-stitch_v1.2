const CACHE_NAME = "zubao-technician-v15";
const APP_SHELL = [
  "./technician-home.html",
  "./technician-earnings.html",
  "./technician-profile.html",
  "./technician-membership-history.html",
  "./technician-join-shop.html",
  "./login.html",
  "./styles.css",
  "./technician-redesign.css",
  "./js/icon-fallback-inline.js",
  "./js/main.js",
  "./js/pages/technician-home.js",
  "./js/pages/technician-earnings.js",
  "./js/pages/technician-profile.js",
  "./js/pages/technician-membership-history.js",
  "./js/pages/technician-join-shop.js",
  "./js/utils/branding.js",
  "./technician.webmanifest",
  "./zubao-tech-icon.png",
  "./assets/brand/zubao-logo-full.png",
  "./assets/brand/zubao-logo-symbol.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const shouldPreferNetwork = ["document", "script", "style"].includes(request.destination);

  event.respondWith(
    fetch(request).then((response) => {
      if (!response || response.status !== 200 || response.type !== "basic") {
        return response;
      }
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    }).catch(() => {
      return caches.match(request).then((cached) => {
        if (cached) return cached;
        if (request.destination === "document") {
          return caches.match("./technician-home.html");
        }
        return caches.match("./styles.css");
      });
    }).then((response) => {
      if (response || shouldPreferNetwork) return response;
      return caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return networkResponse;
        });
      });
    })
  );
});
