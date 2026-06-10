import { redirect } from "next/navigation"
import { Package } from "lucide-react"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import type { Role } from "@/types"

export default async function InventoryPage() {
  const session = await auth()
  if (!canAccess(session!.user.role as Role, "inventory")) redirect("/dashboard")

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Manage spare parts, stock levels, and purchase orders."
      />
      <div className="rounded-xl border border-slate-200 bg-white">
        <EmptyState
          icon={<Package className="h-7 w-7" />}
          title="Inventory management coming in Phase 5"
          description="Track toner cartridges, drum units, spare parts, and all consumables. Set reorder levels and manage purchase orders."
        />
      </div>
    </div>
  )
}
