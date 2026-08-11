const CACHE_VERSION = "banco-mundo-pwa-0.5.2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const CORE_FILES = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png"
];

async function cacheCurrentAppShell() {
  const cache = await caches.open(STATIC_CACHE);
  await cache.addAll(CORE_FILES);
  const response = await fetch("/", { cache: "reload" });
  if (!response.ok) throw new Error("Falha ao preparar a interface offline.");
  await cache.put("/", response.clone());
  const html = await response.text();
  const paths = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map((match) => new URL(match[1], self.location.origin))
    .filter((url) => url.origin === self.location.origin)
    .map((url) => `${url.pathname}${url.search}`)
    .filter((path) => !path.startsWith("/api/") && path !== "/");
  await Promise.all([...new Set(paths)].map(async (path) => {
    try { await cache.add(path); } catch { /* recurso opcional */ }
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheCurrentAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("banco-mundo-pwa-") && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put("/", copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/")) || caches.match("/offline.html"))
    );
    return;
  }

  if (["script", "style", "image", "font", "manifest"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
        return cached || network;
      })
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
