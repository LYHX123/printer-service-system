"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { Bell } from "lucide-react"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { useAlertsPanel } from "@/components/platform/AlertsPanelProvider"
import { getPageTitle } from "@/lib/page-title"
import { isStockType, STOCK_TYPE_TRANSLATION_KEYS } from "@/lib/stock-types"
import type { TranslationKey } from "@/lib/i18n/translations"

// Dynamic detail routes (`/module/[id]`) — getPageTitle can't tell these
// apart by pathname alone (every UUID-like last segment falls through to a
// generic "Detail"), so each module that has its own dedicated app-mode
// detail screen gets an explicit, translated title here instead.
const DETAIL_TITLE_ROUTES: { pattern: RegExp; key: TranslationKey }[] = [
  { pattern: /^\/tasks\/[0-9a-f-]{20,}$/i, key: "taskDetailTitle" },
  { pattern: /^\/customers\/[0-9a-f-]{20,}$/i, key: "customerDetailTitle" },
  { pattern: /^\/quotations\/invoices\/[0-9a-f-]{20,}$/i, key: "invoiceDetailTitle" },
  { pattern: /^\/quotations\/[0-9a-f-]{20,}$/i, key: "quotationDetailTitle" },
  { pattern: /^\/delivery\/[0-9a-f-]{20,}$/i, key: "deliveryDetailTitle" },
]

// Lightweight App-mode top bar: page title plus a notification bell. No
// breadcrumb trail (the bottom nav + More sheet are the primary navigation
// surface on phone) and no logout icon — logout lives in MoreSheet's account
// section instead, so this bar stays page-focused. Respects the Android
// status bar safe area via env(safe-area-inset-top) — same convention the
// desktop Topbar already uses.
export function AppTopBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const { alertCount, openPanel } = useAlertsPanel()

  // Stock's four categories (Equipment/Consumption/Parts/Common Product) all
  // share the single /stock route, distinguished only by a ?type= query
  // param — getPageTitle only looks at the pathname, so without this the top
  // bar would just say "Stock" for every category instead of the specific one.
  const stockType = pathname === "/stock" ? searchParams.get("type") ?? undefined : undefined

  const detailRoute = DETAIL_TITLE_ROUTES.find((r) => r.pattern.test(pathname))

  const title = isStockType(stockType)
    ? t(STOCK_TYPE_TRANSLATION_KEYS[stockType])
    : detailRoute
      ? t(detailRoute.key)
      : getPageTitle(pathname, t)

  return (
    <header
      // `min-h` (not a fixed `h-`) so this can grow to fit the safe-area
      // inset without squeezing content — the header was previously a fixed
      // height with only the raw inset as padding, which pushed content
      // flush against the status bar on devices with little room to spare.
      // The +7px is deliberate breathing room ON TOP of the real inset, not
      // a replacement for it — this is the one place that adds it, so no
      // app-mode page needs its own top padding.
      className="flex min-h-12 shrink-0 items-center gap-3 border-b border-slate-200 bg-[#F1F5FB] px-4 pb-1.5 pt-[calc(env(safe-area-inset-top)+7px)]"
    >
      <p className="flex-1 truncate text-[21px] font-bold text-slate-900">{title}</p>
      <button
        type="button"
        onClick={openPanel}
        aria-label={t("notifications")}
        title={t("notifications")}
        // h-11 w-11 (44px) touch target around a visually smaller 20px icon —
        // badge is absolutely positioned so it never pushes the button's own
        // size/layout around, whatever the count's digit width ends up being.
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors active:bg-slate-200"
      >
        <Bell className="h-5 w-5" />
        {alertCount > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
            {alertCount > 9 ? "9+" : alertCount}
          </span>
        )}
      </button>
    </header>
  )
}
