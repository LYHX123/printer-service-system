"use client"

import { useState, type ReactNode } from "react"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { ToastProvider } from "@/components/ui/toast"
import type { Role } from "@/types"

interface ShellUser {
  id: string
  name?: string | null
  email?: string | null
  role: Role
  companyId: string
}

interface DashboardShellProps {
  children: ReactNode
  user: ShellUser
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <ToastProvider>
      <div className="flex h-screen overflow-hidden bg-slate-50 print:h-auto print:overflow-visible print:bg-white">
        <Sidebar
          role={user.role}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex flex-1 flex-col overflow-hidden min-w-0 print:overflow-visible">
          <Topbar
            user={{ name: user.name, email: user.email, role: user.role }}
            onMenuClick={() => setSidebarOpen(true)}
          />
          <main className="flex-1 overflow-y-auto p-6 print:overflow-visible print:p-0">{children}</main>
        </div>
      </div>
    </ToastProvider>
  )
}
