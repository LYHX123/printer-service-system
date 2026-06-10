"use client"

import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { Menu, LogOut, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { RoleBadge } from "@/components/ui/badge"
import type { Role } from "@/types"

// ─── Breadcrumb config ────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  quotations: "Quotations",
  customers: "Customers",
  equipment: "Equipment",
  jobs: "Jobs",
  inventory: "Inventory",
  reports: "Reports",
  users: "Users",
  settings: "Settings",
}

const SUBSECTION_LABELS: Record<string, string> = {
  engineers: "Engineer Productivity",
  new: "New",
  edit: "Edit",
}

function segmentLabel(seg: string, parentSeg?: string): string {
  // Known static subsections
  if (parentSeg && SUBSECTION_LABELS[seg]) return SUBSECTION_LABELS[seg]
  // UUID-like — dynamic route (detail page)
  if (/^[0-9a-f-]{20,}$/i.test(seg)) return "Detail"
  return SECTION_LABELS[seg] ?? seg
}

function getBreadcrumbs(pathname: string): { label: string; href: string }[] {
  const crumbs: { label: string; href: string }[] = [
    { label: "Home", href: "/dashboard" },
  ]

  const segments = pathname.split("/").filter(Boolean)
  let built = ""
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    built += `/${seg}`
    const label = segmentLabel(seg, segments[i - 1])
    if (built !== "/dashboard") {
      crumbs.push({ label, href: built })
    }
  }

  return crumbs
}

function getPageTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  if (segments.length === 0) return "Dashboard"
  const last = segments[segments.length - 1]
  const parent = segments[segments.length - 2]
  return segmentLabel(last, parent)
}

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
  email?: string | null
  role: Role
}

interface TopbarProps {
  user: TopbarUser
  onMenuClick: () => void
}

export function Topbar({ user, onMenuClick }: TopbarProps) {
  const pathname = usePathname()
  const crumbs = getBreadcrumbs(pathname)
  const currentPage = getPageTitle(pathname)

  async function handleSignOut() {
    await signOut({ callbackUrl: "/login" })
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 print:hidden">
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
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1 text-xs text-slate-400">
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
        <p className="text-sm font-semibold text-slate-900 leading-tight">
          {currentPage}
        </p>
      </div>

      {/* Right: user info + sign out */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-2">
          <UserAvatar name={user.name ?? "U"} />
          <div className="hidden md:block">
            <p className="text-sm font-medium text-slate-900 leading-tight">
              {user.name}
            </p>
            <p className="text-xs text-slate-500 leading-tight">{user.email}</p>
          </div>
          <RoleBadge role={user.role} />
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
    </header>
  )
}
