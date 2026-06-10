import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { canManageInventory } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { InventoryForm } from "@/components/inventory/InventoryForm"
import type { Role } from "@/types"

export default async function NewSparePartPage() {
  const session = await auth()
  if (!canManageInventory(session!.user.role as Role)) redirect("/inventory")

  return (
    <div>
      <Link href="/inventory" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Back to Inventory
      </Link>
      <PageHeader title="Add Spare Part" subtitle="Register a new part in the inventory catalog." />
      <InventoryForm />
    </div>
  )
}
