import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { getLowStockCount } from "@/lib/data/inventory"
import { getOverdueTaskCount, getActiveTaskCount } from "@/lib/data/tasks"
import { getUnpaidSalesBalance } from "@/lib/data/ledger"
import { DashboardHome } from "@/components/dashboard/DashboardHome"
import type { Role } from "@/types"

export default async function DashboardPage() {
  const session = await auth()
  const user = session!.user
  const role = user.role as Role
  const userId = user.id as string
  const companyId = user.companyId as string
  const modulePermissions = (user.modulePermissions as string[]) ?? []
  const firstName = user.name?.split(" ")[0] ?? ""

  const canViewInventory = canAccess(role, "inventory", modulePermissions)
  const canViewTasks = canAccess(role, "tasks", modulePermissions)
  const canViewLedger = canAccess(role, "ledger", modulePermissions)

  const [lowStockCount, overdueTaskCount, activeTaskCount, unpaidSalesBalance] = await Promise.all([
    canViewInventory ? getLowStockCount(companyId) : Promise.resolve(0),
    canViewTasks ? getOverdueTaskCount(companyId, userId, role) : Promise.resolve(0),
    canViewTasks ? getActiveTaskCount(companyId, userId, role) : Promise.resolve(0),
    canViewLedger ? getUnpaidSalesBalance(companyId) : Promise.resolve(0),
  ])

  return (
    <DashboardHome
      firstName={firstName}
      role={role}
      modulePermissions={modulePermissions}
      lowStockCount={canViewInventory ? lowStockCount : null}
      overdueTaskCount={canViewTasks ? overdueTaskCount : null}
      activeTaskCount={canViewTasks ? activeTaskCount : null}
      unpaidSalesBalance={canViewLedger ? unpaidSalesBalance : null}
    />
  )
}
