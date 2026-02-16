const APP_SHELL_CACHE = "mbox-viewer-app-shell-v4";
const RUNTIME_CACHE = "mbox-viewer-runtime-v1";
const APP_SHELL_ASSETS = [
  "/",
  "/viewer",
  "/offline",
  "/manifest.webmanifest",
  "/icon-180.png",
  "/icon-192.png",
  "/icon-512.png",
];

function createOfflineResponse() {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Offline</title>
  </head>
  <body>
    <main>
      <h1>You are offline</h1>
      <p>No cached fallback page is available right now.</p>
    </main>
  </body>
</html>`,
    {
      status: 503,
      statusText: "Service Unavailable",
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) {
            return cached;
          }
          const offlineFallback = await caches.match("/offline");
          if (offlineFallback) {
            return offlineFallback;
          }
          const viewerFallback = await caches.match("/viewer");
          if (viewerFallback) {
            return viewerFallback;
          }
          return createOfflineResponse();
        })
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js");

  if (!isStaticAsset) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkPromise = fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => cached);

      return cached || networkPromise;
    })
  );
});
