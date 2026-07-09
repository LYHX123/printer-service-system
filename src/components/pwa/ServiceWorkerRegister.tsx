"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return
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
