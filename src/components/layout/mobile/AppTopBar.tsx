"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { getPageTitle } from "@/lib/page-title"
import { isStockType, STOCK_TYPE_TRANSLATION_KEYS } from "@/lib/stock-types"

const TASK_DETAIL_PATH = /^\/tasks\/[0-9a-f-]{20,}$/i

// Lightweight App-mode top bar: page title only. No breadcrumb trail (the
// bottom nav + More sheet are the primary navigation surface on phone) and
// no logout icon — logout lives in MoreSheet's account section instead, so
// this bar stays page-focused. Respects the Android status bar safe area via
// env(safe-area-inset-top) — same convention the desktop Topbar already uses.
export function AppTopBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useLanguage()

  // Stock's four categories (Equipment/Consumption/Parts/Common Product) all
  // share the single /stock route, distinguished only by a ?type= query
  // param — getPageTitle only looks at the pathname, so without this the top
  // bar would just say "Stock" for every category instead of the specific one.
  const stockType = pathname === "/stock" ? searchParams.get("type") ?? undefined : undefined

  const title = isStockType(stockType)
    ? t(STOCK_TYPE_TRANSLATION_KEYS[stockType])
    : TASK_DETAIL_PATH.test(pathname)
      ? t("taskDetailTitle")
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
    </header>
  )
}
