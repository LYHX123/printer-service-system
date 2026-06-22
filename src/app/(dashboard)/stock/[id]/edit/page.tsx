import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { canManageInventory } from "@/lib/permissions"
import { getSparePartForEdit } from "@/lib/data/inventory"
import { PageHeader } from "@/components/ui/page-header"
import { InventoryForm } from "@/components/inventory/InventoryForm"
import { getStockType, STOCK_TYPE_LABELS } from "@/lib/stock-types"
import type { Role } from "@/types"

export default async function EditSparePartPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!canManageInventory(session!.user.role as Role)) redirect("/stock")
  const companyId = session!.user.companyId as string

  const { id } = await params
  const part = await getSparePartForEdit(id, companyId)
  if (!part) notFound()

  const stockType = getStockType(part.category)

  return (
    <div>
      <Link href={`/stock?type=${stockType}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Back to {STOCK_TYPE_LABELS[stockType]}
      </Link>
      <PageHeader title={`Edit ${part.name}`} />
      <InventoryForm
        stockType={stockType}
        partId={part.id}
        imageUrl={part.imageUrl}
        defaultValues={{
          partNumber: part.partNumber,
          name: part.name,
          category: part.category,
          brand: part.brand ?? "",
          quantity: part.stock?.quantity ?? 0,
        }}
      />
    </div>
  )
}
