"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return

    // Native ENFB Printer Service app shell (Capacitor). The PWA service worker
    // must never run here: Android WebView service workers re-issue fetches
    // from their own network context, dropping Capacitor's `ENFBPrinterServiceApp`
    // User-Agent marker — so a proxied navigation/RSC request loses app-mode
    // detection and the server renders the desktop UI. Also proactively tear
    // down any registration + caches a prior web/PWA build left controlling
    // this WebView.
    if (navigator.userAgent.includes("ENFBPrinterServiceApp")) {
      Promise.all([
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => Promise.all(regs.map((r) => r.unregister())))
          .catch(() => [] as boolean[]),
        typeof caches !== "undefined"
          ? caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {})
          : Promise.resolve(),
      ]).then(([unregistered]) => {
        // If a service worker was actually controlling this document, reload
        // once so the fresh (uncontrolled) page issues its navigation/RSC
        // requests straight through the WebView network stack. After the
        // reload there is no controller, so this does not loop.
        if (navigator.serviceWorker.controller && Array.isArray(unregistered) && unregistered.some(Boolean)) {
          window.location.reload()
        }
      })
      return
    }

    if (process.env.NODE_ENV !== "production") return
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[PWA] Service worker registered with scope:", registration.scope)
      })
      .catch((error) => {
        console.error("[PWA] Service worker registration failed:", error)
      })
  }, [])

  return null
}
