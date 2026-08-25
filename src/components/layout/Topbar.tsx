"use client"

import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Menu, LogOut, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { RoleBadge } from "@/components/ui/badge"
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { getBreadcrumbs, getPageTitle } from "@/lib/page-title"
import type { Role } from "@/types"

// ─── User avatar ──────────────────────────────────────────────────────────────

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shrink-0">
      {initials}
    </div>
  )
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

interface TopbarUser {
  name?: string | null
  position?: string | null
  role: Role
}

interface TopbarProps {
  user: TopbarUser
  onMenuClick: () => void
}

export function Topbar({ user, onMenuClick }: TopbarProps) {
  const pathname = usePathname()
  const { t } = useLanguage()
  const crumbs = getBreadcrumbs(pathname, t)
  const currentPage = getPageTitle(pathname, t)

  async function handleSignOut() {
    await signOut({ callbackUrl: "/login" })
  }

  return (
    <header className="flex min-h-[68px] shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 pt-[env(safe-area-inset-top)] print:hidden">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors lg:hidden"
        aria-label="Open sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumb */}
      <div className="flex-1 min-w-0">
        <nav aria-label="Breadcrumb" className="hidden sm:block">
          <ol className="flex items-center gap-1 text-sm text-slate-400">
            {crumbs.map((crumb, i) => (
              <li key={crumb.href} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                <span
                  className={cn(
                    i === crumbs.length - 1
                      ? "font-medium text-slate-600"
                      : "hover:text-slate-600"
                  )}
                >
                  {crumb.label}
                </span>
              </li>
            ))}
          </ol>
        </nav>
        <p className="truncate text-[15px] font-semibold text-slate-900 leading-tight">
          {currentPage}
        </p>
      </div>

      {/* Right: language switcher + user info + sign out */}
      <div className="flex items-center gap-3 shrink-0">
        <LanguageSwitcher />
        <div className="hidden sm:flex items-center gap-2">
          <UserAvatar name={user.name ?? "U"} />
          <div className="hidden md:block">
            <p className="text-[15px] font-medium text-slate-900 leading-tight">
              {user.name}
            </p>
            {user.position && (
              <p className="text-xs text-slate-500 leading-tight">{user.position}</p>
            )}
          </div>
          <RoleBadge role={user.role} className="text-[13px]" />
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title={t("logout")}
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">{t("logout")}</span>
        </button>
      </div>
    </header>
  )
}
