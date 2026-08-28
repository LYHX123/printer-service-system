// Office Hub Printer Service — minimal PWA service worker.
//
// Scope is deliberately narrow: cache-first for hashed/immutable static assets
// only. It NEVER intercepts page navigations or Next.js RSC / client-router
// requests — those go straight through the browser/WebView network stack.
//
// Why navigations must not be intercepted: inside the native Android app shell
// (Capacitor), a service-worker `fetch()` is re-issued from the worker's own
// network context, which does NOT carry Capacitor's appended User-Agent marker
// (`ENFBPrinterServiceApp`). A proxied navigation/RSC request therefore reaches
// the server without the marker, `isCapacitorAppRequest()` returns false, and
// the server renders the desktop UI. Letting these requests hit the network
// directly keeps the real WebView User-Agent intact.
const CACHE_VERSION = "office-hub-v2"

// Static, effectively-immutable assets safe to serve from cache. No HTML.
const PRECACHE = [
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
]

function isCacheableStatic(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json"
  )
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {})
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        // Drops every older cache, including the "office-hub-v1" cache that
        // previous versions used to store proxied (desktop-rendered) HTML.
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

  // Only hashed/static assets are served from cache. Everything else —
  // navigations, RSC requests (`?_rsc=`, Accept: text/x-component), HTML
  // documents, /api/*, /_next/image, /_next/data — is left entirely to the
  // browser/WebView so the request keeps its real headers (User-Agent,
  // cookies) and always gets a live response.
  if (!isCacheableStatic(url)) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone()
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || networkFetch
    })
  )
})
