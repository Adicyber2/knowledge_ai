/**
 * Service Worker for AI Knowledge Vault
 * Strategy: Cache-first for app shell, Network-first for navigation
 */

const CACHE_NAME = "knowledge-vault-shell-v2";

// App shell assets to cache on install
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
];


// ---- Install: cache app shell ----
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});


// ---- Activate: clean old caches ----
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});


// ---- Fetch: serve from cache, fall back to network ----
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-HTTP(S) schemes (e.g., chrome-extension, chrome, file)
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Skip non-GET requests and API calls — let them go to network
  if (
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // Skip Vite HMR / dev server internal requests during local development
  if (
    url.pathname.includes("@vite") ||
    url.pathname.includes("@react") ||
    url.search.includes("t=")
  ) {
    return;
  }

  // For navigation requests (HTML pages): network-first, fallback to cached index.html
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/index.html")
      )
    );
    return;
  }

  // For other static assets: cache-first, fallback to network with error guard
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        // Return empty fallback response instead of throwing unhandled promise rejection
        return new Response("", { status: 408, statusText: "Offline" });
      });
    })
  );
});
