import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { canManageInventory } from "@/lib/permissions"
import { getSparePartForEdit } from "@/lib/data/inventory"
import { PageHeader } from "@/components/ui/page-header"
import { InventoryForm } from "@/components/inventory/InventoryForm"
import type { Role } from "@/types"

export default async function EditSparePartPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!canManageInventory(session!.user.role as Role)) redirect("/inventory")
  const companyId = session!.user.companyId as string

  const { id } = await params
  const part = await getSparePartForEdit(id, companyId)
  if (!part) notFound()

  return (
    <div>
      <Link href={`/inventory/${id}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Back to Part
      </Link>
      <PageHeader title="Edit Spare Part" subtitle={`Update details for ${part.name}`} />
      <InventoryForm
        partId={part.id}
        defaultValues={{
          partNumber: part.partNumber,
          name: part.name,
          description: part.description ?? "",
          category: part.category,
          brand: part.brand ?? "",
          supplier: part.supplier ?? "",
          compatibleWith: part.compatibleWith ?? "",
          unit: part.unit,
          unitCost: Number(part.unitCost),
          sellingPrice: Number(part.sellingPrice),
          reorderLevel: part.reorderLevel,
          location: part.stock?.location ?? "",
          quantity: part.stock?.quantity ?? 0,
        }}
      />
    </div>
  )
}
