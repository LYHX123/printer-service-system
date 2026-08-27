"use client"

import { useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { AppTopBar } from "./mobile/AppTopBar"
import { MobileBottomNav } from "./mobile/MobileBottomNav"
import { ToastProvider } from "@/components/ui/toast"
import { useAppMode } from "@/components/platform/AppModeProvider"
import { AndroidBackHandler } from "@/components/platform/AndroidBackHandler"
import { DownloadGuard } from "@/components/platform/DownloadGuard"
import { cn } from "@/lib/utils"
import type { Role } from "@/types"

// Routes whose content naturally fills/exceeds the viewport (sticky panels,
// tight two-column layouts) and don't need the large pb-96 most other pages
// rely on for scroll clearance above the fixed low-stock/toast notifications.
const COMPACT_BOTTOM_PADDING_ROUTES = ["/tasks"]

// Extra bottom clearance so page content never sits under the fixed app-mode
// bottom nav bar (its own height plus the device's safe-area-bottom).
const APP_MODE_NAV_CLEARANCE = "pb-[calc(4.5rem+env(safe-area-inset-bottom))]"

interface ShellUser {
  id: string
  name?: string | null
  position?: string | null
  role: Role
  companyId: string
  modulePermissions: string[]
}

interface DashboardShellProps {
  children: ReactNode
  user: ShellUser
  taskCount?: number | null
  taskUnread?: boolean
}

export function DashboardShell({ children, user, taskCount = null, taskUnread = false }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const isAppMode = useAppMode()
  const useCompactBottomPadding = COMPACT_BOTTOM_PADDING_ROUTES.some((route) => pathname === route)

  if (isAppMode) {
    return (
      <ToastProvider>
        <AndroidBackHandler />
        <DownloadGuard />
        <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
          <AppTopBar />
          <main
            className={cn(
              // overscroll-contain: main's content naturally extends well
              // beyond its own clipped box (that's just how overflow-y-auto
              // scrolling works), and that unclipped extent leaks into
              // document.documentElement.scrollHeight, giving the outer
              // page phantom scroll room that's never visible in normal use.
              // Without this, dragging past main's own scroll end chains the
              // gesture onto that phantom outer scroll — the page then
              // scrolls into genuinely empty space before the fixed bottom
              // nav. This stops the chain at main; its own scrolling is
              // unaffected either way.
              "flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-4",
              useCompactBottomPadding ? "pb-6" : "pb-24",
              APP_MODE_NAV_CLEARANCE
            )}
          >
            {children}
          </main>
          <MobileBottomNav
            role={user.role}
            modulePermissions={user.modulePermissions}
            taskCount={taskCount}
            taskUnread={taskUnread}
          />
        </div>
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50 pb-[env(safe-area-inset-bottom)] print:h-auto print:overflow-visible print:bg-white print:pb-0">
        <Sidebar
          role={user.role}
          modulePermissions={user.modulePermissions}
          taskCount={taskCount}
          taskUnread={taskUnread}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0 print:overflow-visible">
          <Topbar
            user={{ name: user.name, position: user.position, role: user.role }}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <main
            className={cn(
              "flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 print:overflow-visible print:p-0",
              useCompactBottomPadding ? "pb-6 sm:pb-8" : "pb-96 sm:pb-96"
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
