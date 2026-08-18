/* ponytail: minimal offline-shell SW — network-first pages, cache-first static.
   Bump CACHE version to invalidate. */
const CACHE = "iol-v1";
const OFFLINE_URL = "/";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE_URL, "/logo.png", "/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || !req.url.startsWith(self.location.origin)) return;

  // static assets: cache-first
  if (/\.(png|jpg|jpeg|webp|svg|woff2?|css|js)$/.test(new URL(req.url).pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
    return;
  }

  // pages: network-first, offline fallback to cached shell
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(req).then((hit) => hit || caches.match(OFFLINE_URL))));
  }
});
