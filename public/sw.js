// Office Hub Printer Service — basic PWA service worker.
// Scope: app-shell caching + offline fallback only. No push, no background sync.
const CACHE_VERSION = "office-hub-v1"

const APP_SHELL = [
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // API routes: never intercepted. Always network-only so auth, quotations,
  // invoices, stock, tasks, etc. always get a live request/response.
  if (url.pathname.startsWith("/api/")) return

  // Page navigations: network-first so users always see the latest page,
  // falling back to a cached copy or the offline page when unreachable.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
          return response
        })
        .catch(async () => {
          const cached = await caches.match(request)
          return cached || (await caches.match("/offline.html"))
        })
    )
    return
  }

  // Hashed static assets and app icons: cache-first, refreshed in the background.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            const copy = response.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
            return response
          })
          .catch(() => cached)
        return cached || networkFetch
      })
    )
    return
  }

  // Everything else: network-first with cache fallback, nothing guaranteed cached.
  event.respondWith(fetch(request).catch(() => caches.match(request)))
})
