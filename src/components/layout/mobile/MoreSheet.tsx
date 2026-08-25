"use client"

import Link from "next/link"
import { signOut } from "next-auth/react"
import { X, LogOut } from "lucide-react"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { cn } from "@/lib/utils"
import type { NavItem } from "@/lib/nav-items"

interface MoreSheetProps {
  items: NavItem[]
  activeHref: string | undefined
  open: boolean
  onClose: () => void
}

// Secondary-module drawer for app-mode navigation — everything the bottom
// nav's 4 primary slots don't have room for (Quotations, Delivery, Invoice,
// Ledger, Users, Settings, ...), still filtered by the same permission-gated
// item list the bottom nav and desktop Sidebar both share. Also the one place
// Logout and the language switcher live in App mode, since AppTopBar no
// longer carries a logout icon.
export function MoreSheet({ items, activeHref, onClose, open }: MoreSheetProps) {
  const { t } = useLanguage()

  if (!open) return null

  async function handleLogout() {
    await signOut({ callbackUrl: "/login" })
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label={t("more")}
        className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
          <p className="text-[15px] font-semibold text-slate-900">{t("more")}</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {items.length > 0 && (
          <ul className="grid grid-cols-3 gap-1 p-3">
            {items.map((item) => {
              const isActive = item.href === activeHref
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl px-2 py-3.5 text-center transition-colors",
                      isActive ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5", isActive ? "text-blue-600" : "text-slate-500")} />
                    <span className="text-xs font-medium leading-tight">
                      {item.labelKey ? t(item.labelKey) : item.label}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {/* Account section — available to every authenticated user regardless
            of module permissions, visually separated from the module grid. */}
        <div className="border-t border-slate-100 px-3 pt-2">
          <div className="flex min-h-11 items-center justify-between rounded-xl px-3 py-2.5">
            <span className="text-sm font-medium text-slate-700">{t("language")}</span>
            <LanguageSwitcher />
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-red-600 transition-colors active:bg-red-50"
          >
            <LogOut className="h-5 w-5" />
            <span className="text-sm font-medium">{t("logout")}</span>
          </button>
        </div>
      </div>
    </>
  )
}
