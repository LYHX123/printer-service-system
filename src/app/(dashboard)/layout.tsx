import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/layout/DashboardShell"
import { canAccess } from "@/lib/permissions"
import { getLowStockAlerts } from "@/lib/data/inventory"
import { getOverdueTasks, getActiveTaskCount } from "@/lib/data/tasks"
import { AlertsNotification } from "@/components/inventory/LowStockNotification"
import type { Role } from "@/types"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = {
    id: session.user.id as string,
    name: session.user.name,
    username: (session.user as { username?: string }).username ?? null,
    position: (session.user as { position?: string | null }).position ?? null,
    role: session.user.role as Role,
    companyId: session.user.companyId as string,
    modulePermissions: (session.user.modulePermissions as string[]) ?? [],
  }

  const canViewTasks = canAccess(user.role, "tasks", user.modulePermissions)

  const [lowStockAlerts, overdueTaskAlerts, activeTaskCount] = await Promise.all([
    canAccess(user.role, "inventory", user.modulePermissions)
      ? getLowStockAlerts(user.companyId)
      : Promise.resolve([]),
    canViewTasks
      ? getOverdueTasks(user.companyId, user.id, user.role)
      : Promise.resolve([]),
    canViewTasks
      ? getActiveTaskCount(user.companyId, user.id, user.role)
      : Promise.resolve(null),
  ])

  return (
    <>
      <DashboardShell user={user} taskCount={activeTaskCount}>{children}</DashboardShell>
      <AlertsNotification
        lowStockAlerts={lowStockAlerts}
        overdueTaskAlerts={overdueTaskAlerts}
      />
    </>
  )
}
