"use client"

import { useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Capacitor, type PluginListenerHandle } from "@capacitor/core"
import { App } from "@capacitor/app"
import { handleBack } from "@/lib/platform/back-handler-stack"
import { MOBILE_PRIMARY_HREFS } from "@/lib/nav-items"

/**
 * Fixed-parent "detail" routes whose on-screen "< Back" link always returns
 * to the same list page. Hardware back mirrors that exact destination
 * instead of following real browser history — history can point somewhere
 * else entirely (a bottom-nav tab switch that replaced an entry, a deep
 * link, a redirect), which is exactly the Task Detail inconsistency Phase
 * 7.2 found. Each pattern is anchored to exactly one dynamic segment past
 * the parent so it never matches that module's list/new/edit routes.
 * Create/Edit pages are intentionally NOT covered here — they keep existing
 * history-based back behavior (audited in Phase 7.2 Final Fix, no reported
 * issue with those).
 */
const DETAIL_BACK_TARGETS: { pattern: RegExp; parent: string }[] = [
  { pattern: /^\/customers\/(?!new$)[^/]+$/, parent: "/customers" },
  { pattern: /^\/tasks\/(?!new$)[^/]+$/, parent: "/tasks" },
  { pattern: /^\/quotations\/invoices\/(?!new$)[^/]+$/, parent: "/quotations/invoices" },
  { pattern: /^\/quotations\/(?!new$|invoices$)[^/]+$/, parent: "/quotations" },
  { pattern: /^\/delivery\/(?!new$)[^/]+$/, parent: "/delivery" },
]

function getDetailParent(pathname: string): string | undefined {
  return DETAIL_BACK_TARGETS.find((d) => d.pattern.test(pathname))?.parent
}

/**
 * App-mode-only. Takes over the Android hardware/gesture back button (via
 * @capacitor/app's `backButton` event — registering any listener for it
 * fully replaces Capacitor's native default WebView-history handling, so
 * this is now the single source of truth for what back does).
 *
 * Priority order:
 * 1. MoreSheet open       -> close it, stay on the page
 * 2. A Modal open         -> close the topmost one, stay on the page
 * 3. Fixed-parent detail page (Customer/Task/Quotation/Delivery/Invoice
 *    Detail) -> that page's own fixed parent list, same as its on-screen
 *    "< Back" link.
 * 4. Other page (edit/create/etc) -> real browser history back (same as
 *    the page's own "< Back" link would do).
 * 5. Top-level bottom-nav page (Dashboard/Customers/Stock/Tasks)
 *    -> not Dashboard: go to Dashboard
 *    -> already Dashboard: fall through to normal Android behavior
 *       (history back if any, else exit) — same as if no listener existed.
 *
 * Mounted once in DashboardShell's app-mode branch, which persists across
 * client-side navigations, so the listener is registered exactly once for
 * the life of the app shell (cleaned up on unmount, never re-registered).
 */
export function AndroidBackHandler() {
  const router = useRouter()
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let cancelled = false
    let handle: PluginListenerHandle | undefined

    function onBackButton({ canGoBack }: { canGoBack: boolean }) {
      if (handleBack()) return

      const current = pathnameRef.current

      if (MOBILE_PRIMARY_HREFS.includes(current)) {
        if (current !== "/dashboard") {
          router.replace("/dashboard")
        } else if (canGoBack) {
          window.history.back()
        } else {
          App.exitApp().catch(() => {})
        }
        return
      }

      const detailParent = getDetailParent(current)
      if (detailParent) {
        router.push(detailParent)
        return
      }

      if (canGoBack) {
        window.history.back()
      } else {
        router.replace("/dashboard")
      }
    }

    // The native bridge's plugin registry can still be finishing its own
    // startup the instant this effect first runs (this fires very early in
    // hydration) — addListener() rejects in that narrow window rather than
    // queuing. One short-delayed retry covers it without masking a real,
    // persistent failure (which would then just leave back-button handling
    // as native default, not crash anything).
    function register(attempt: number) {
      App.addListener("backButton", onBackButton)
        .then((h) => {
          if (cancelled) h.remove()
          else handle = h
        })
        .catch(() => {
          if (!cancelled && attempt === 0) setTimeout(() => register(1), 500)
        })
    }
    register(0)

    return () => {
      cancelled = true
      handle?.remove()
    }
    // Intentionally register once for the app shell's lifetime — pathname is
    // read via ref so the listener never needs to be torn down/re-added on
    // navigation (that would risk exactly the double-registration Phase 7.2
    // explicitly warns against).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
