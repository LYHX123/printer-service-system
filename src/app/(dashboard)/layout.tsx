import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardShell } from "@/components/layout/DashboardShell"
import { canAccess } from "@/lib/permissions"
import { getLowStockAlerts } from "@/lib/data/inventory"
import { LowStockNotification } from "@/components/inventory/LowStockNotification"
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

  const lowStockAlerts = canAccess(user.role, "inventory", user.modulePermissions)
    ? await getLowStockAlerts(user.companyId)
    : []

  return (
    <>
      <DashboardShell user={user}>{children}</DashboardShell>
      <LowStockNotification alerts={lowStockAlerts} />
    </>
  )
}
