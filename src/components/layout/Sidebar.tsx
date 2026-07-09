"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  Users,
  Package,
  BookOpen,
  UserCog,
  Settings,
  Printer,
  CheckSquare,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { canAccess, type Module } from "@/lib/permissions"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import type { TranslationKey } from "@/lib/i18n/translations"
import type { Role } from "@/types"

// ─── Nav config ───────────────────────────────────────────────────────────────

interface NavItem {
  href: string
  labelKey: TranslationKey | null
  label: string
  icon: LucideIcon
  exact?: boolean
  module: Module
}

interface NavSection {
  title?: string
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { href: "/dashboard", labelKey: "dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true, module: "dashboard" },
      { href: "/quotations", labelKey: "quotations", label: "Quotations", icon: FileText, module: "quotations" },
      { href: "/customers", labelKey: "customers", label: "Customers", icon: Users, module: "customers" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/stock", labelKey: "inventory", label: "Stock", icon: Package, module: "inventory" },
      { href: "/ledger", labelKey: "ledger", label: "Ledger", icon: BookOpen, module: "ledger" },
      { href: "/tasks", labelKey: "tasks", label: "Tasks", icon: CheckSquare, module: "tasks" },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/users", labelKey: "users", label: "Users", icon: UserCog, module: "users" },
      { href: "/settings", labelKey: "settings", label: "Settings", icon: Settings, module: "settings" },
    ],
  },
]

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  role: Role
  modulePermissions: string[]
  taskCount?: number | null
  open: boolean
  onClose: () => void
}

export function Sidebar({ role, modulePermissions, taskCount = null, open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { t } = useLanguage()

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

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAV_SECTIONS.map((section) => ({
            ...section,
            items: section.items.filter((item) => canAccess(role, item.module, modulePermissions)),
          }))
            .filter((section) => section.items.length > 0)
            .map((section, si) => (
              <div key={si}>
                {section.title && (
                  <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {section.title}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {section.items
                    .map((item) => {
                      const isActive = item.exact
                        ? pathname === item.href
                        : pathname.startsWith(item.href)
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
                            <item.icon
                              className={cn(
                                "h-4 w-4 shrink-0",
                                isActive ? "text-blue-400" : "text-slate-500"
                              )}
                            />
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
                    })}
                </ul>
              </div>
            )
          )}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-800 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <p className="text-xs text-slate-600">v0.1.0 · Phase 2</p>
        </div>
      </aside>
    </>
  )
}
