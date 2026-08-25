"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { getVisibleNavItems, getActiveHref, MOBILE_PRIMARY_HREFS } from "@/lib/nav-items"
import { MoreSheet } from "./MoreSheet"
import type { Role } from "@/types"

interface MobileBottomNavProps {
  role: Role
  modulePermissions: string[]
  taskCount?: number | null
  taskUnread?: boolean
}

// App-mode primary navigation: top-frequency destinations as a fixed bottom
// bar, everything else one tap away in the "More" sheet — never every module
// crammed into one row. Same permission-gated NAV_ITEMS source of truth as
// the desktop Sidebar (src/lib/nav-items.ts), so a user never sees a tab here
// they couldn't already reach on desktop.
export function MobileBottomNav({ role, modulePermissions, taskCount = null, taskUnread = false }: MobileBottomNavProps) {
  const pathname = usePathname()
  const { t, language } = useLanguage()
  const [moreOpen, setMoreOpen] = useState(false)

  const visibleItems = getVisibleNavItems(role, modulePermissions)
  const primaryItems = visibleItems.filter((item) => MOBILE_PRIMARY_HREFS.includes(item.href))
  const secondaryItems = visibleItems.filter((item) => !MOBILE_PRIMARY_HREFS.includes(item.href))
  const activeHref = getActiveHref(visibleItems, pathname)

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-[#F1F5FB] pb-[env(safe-area-inset-bottom)]"
        aria-label={t("dashboard")}
      >
        {primaryItems.map((item) => {
          const isActive = item.href === activeHref
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 min-h-[52px] transition-colors",
                isActive ? "text-blue-600" : "text-slate-500"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center rounded-full px-3.5 py-0.5 transition-colors",
                  isActive && "bg-white shadow-sm"
                )}
              >
                <span className="relative inline-flex">
                  <item.icon className="h-5 w-5" />
                  {item.href === "/tasks" && !!taskCount && taskCount > 0 ? (
                    <span className="absolute -right-2.5 -top-1.5 min-w-[16px] rounded-full bg-slate-700 px-1 text-center text-[9px] font-semibold leading-4 text-white">
                      {taskCount}
                    </span>
                  ) : (
                    item.href === "/tasks" &&
                    taskUnread && (
                      <span
                        aria-label={language === "zh" ? "有未读任务" : "Unread tasks"}
                        className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-red-500"
                      />
                    )
                  )}
                </span>
              </span>
              <span className="text-[11px] font-medium leading-tight">
                {item.labelKey ? t(item.labelKey) : item.label}
              </span>
            </Link>
          )
        })}
        {secondaryItems.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 min-h-[52px] transition-colors",
              moreOpen || secondaryItems.some((i) => i.href === activeHref) ? "text-blue-600" : "text-slate-500"
            )}
            aria-label={t("more")}
          >
            <span
              className={cn(
                "flex items-center justify-center rounded-full px-3.5 py-0.5 transition-colors",
                moreOpen && "bg-white shadow-sm"
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
            </span>
            <span className="text-[11px] font-medium leading-tight">{t("more")}</span>
          </button>
        )}
      </nav>
      <MoreSheet
        items={secondaryItems}
        activeHref={activeHref}
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
      />
    </>
  )
}
