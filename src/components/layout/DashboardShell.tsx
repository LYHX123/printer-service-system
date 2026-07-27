"use client"

import { useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { ToastProvider } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import type { Role } from "@/types"

// Routes whose content naturally fills/exceeds the viewport (sticky panels,
// tight two-column layouts) and don't need the large pb-96 most other pages
// rely on for scroll clearance above the fixed low-stock/toast notifications.
const COMPACT_BOTTOM_PADDING_ROUTES = ["/tasks"]

interface ShellUser {
  id: string
  name?: string | null
  username?: string | null
  position?: string | null
  role: Role
  companyId: string
  modulePermissions: string[]
}

interface DashboardShellProps {
  children: ReactNode
  user: ShellUser
  taskCount?: number | null
}

export function DashboardShell({ children, user, taskCount = null }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const useCompactBottomPadding = COMPACT_BOTTOM_PADDING_ROUTES.some((route) => pathname === route)

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50 pb-[env(safe-area-inset-bottom)] print:h-auto print:overflow-visible print:bg-white print:pb-0">
        <Sidebar
          role={user.role}
          modulePermissions={user.modulePermissions}
          taskCount={taskCount}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0 print:overflow-visible">
          <Topbar
            user={{ name: user.name, username: user.username, position: user.position, role: user.role }}
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
