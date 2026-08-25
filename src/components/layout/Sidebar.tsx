"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Printer, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { NAV_ITEMS, isNavItemVisible, getActiveHref } from "@/lib/nav-items"
import type { Role } from "@/types"

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  role: Role
  modulePermissions: string[]
  taskCount?: number | null
  /** Shows a small red unread-activity dot next to the Tasks nav label — independent of `taskCount` (the active-task count badge). */
  taskUnread?: boolean
  open: boolean
  onClose: () => void
}

export function Sidebar({ role, modulePermissions, taskCount = null, taskUnread = false, open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { t, language } = useLanguage()

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 print:hidden",
          "transition-transform duration-200 ease-in-out",
          "lg:relative lg:z-auto lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <Printer className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white leading-tight">
              Printer Service
            </p>
            <p className="text-xs text-slate-400">Management System</p>
          </div>
          {/* Mobile close */}
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation — one flat, ungrouped list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-0.5">
            {(() => {
              const visibleItems = NAV_ITEMS.filter((item) => isNavItemVisible(item, role, modulePermissions))
              const activeHref = getActiveHref(visibleItems, pathname)
              return visibleItems.map((item) => {
                const isActive = item.href === activeHref
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-blue-600/20 text-blue-400 border-l-2 border-blue-400"
                          : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                      )}
                    >
                      <span className="relative inline-flex shrink-0">
                        <item.icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-blue-400" : "text-slate-500"
                          )}
                        />
                        {item.href === "/tasks" && taskUnread && (
                          <span
                            aria-label={language === "zh" ? "有未读任务" : "Unread tasks"}
                            className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-500"
                          />
                        )}
                      </span>
                      <span className="flex-1 truncate">
                        {item.labelKey ? t(item.labelKey) : item.label}
                      </span>
                      {item.href === "/tasks" && !!taskCount && taskCount > 0 && (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-1.5 py-0.5 text-xs font-semibold leading-none",
                            isActive
                              ? "bg-blue-400/20 text-blue-300"
                              : "bg-slate-700 text-slate-300"
                          )}
                        >
                          {taskCount}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })
            })()}
          </ul>
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-800 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <p className="text-xs text-slate-600">v0.1.0 · Phase 2</p>
        </div>
      </aside>
    </>
  )
}
