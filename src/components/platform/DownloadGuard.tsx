"use client"

import { useEffect } from "react"
import { Capacitor } from "@capacitor/core"
import { useToast } from "@/components/ui/toast"
import { useLanguage } from "@/lib/i18n/LanguageContext"

/**
 * App-mode-only. Every `target="_blank"` link in this app is a same-origin
 * document/export route (Quotation/Delivery/Invoice PDF & Excel, customer
 * documents, Dropbox-synced files — audited in Phase 7.2), never a real
 * external page. In the bare Android WebView, clicking one of these when the
 * route errors (stale Dropbox reference, network failure) navigates the
 * whole app away to a raw JSON/error response — there's no tab boundary to
 * contain it like on desktop. This intercepts that click, confirms the
 * response is actually OK first, and only then lets the real navigation
 * through (so MainActivity's DownloadListener still does the actual file
 * download exactly as before) — otherwise it stays on the current page and
 * shows a toast instead.
 */
export function DownloadGuard() {
  const toast = useToast()
  const { language } = useLanguage()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    function handleClick(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[target="_blank"]') as HTMLAnchorElement | null
      if (!anchor || !anchor.href) return

      event.preventDefault()
      event.stopPropagation()

      fetch(anchor.href)
        .then((res) => {
          if (res.ok) {
            window.location.href = anchor.href
          } else {
            toast.error(
              language === "zh"
                ? "文件暂时无法下载，请稍后重试"
                : "Unable to download file. Please try again."
            )
          }
        })
        .catch(() => {
          toast.error(
            language === "zh"
              ? "文件暂时无法下载，请稍后重试"
              : "Unable to download file. Please try again."
          )
        })
    }

    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [toast, language])

  return null
}
