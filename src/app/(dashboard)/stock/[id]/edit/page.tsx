import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { canEditStock } from "@/lib/permissions"
import { getSparePartForEdit } from "@/lib/data/inventory"
import { isCapacitorAppRequest } from "@/lib/platform/app-mode"
import { PageHeader } from "@/components/ui/page-header"
import { T } from "@/components/ui/T"
import { InventoryForm } from "@/components/inventory/InventoryForm"
import { getStockType, STOCK_TYPE_TRANSLATION_KEYS, stockTypeToBucket } from "@/lib/stock-types"
import type { Role } from "@/types"

export default async function EditSparePartPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const companyId = session!.user.companyId as string

  const { id } = await params
  const part = await getSparePartForEdit(id, companyId)
  if (!part) notFound()

  const stockType = getStockType(part.category)
  if (!canEditStock(session!.user.role as Role, session!.user.modulePermissions, stockTypeToBucket(stockType))) {
    redirect("/stock")
  }

  const isAppMode = await isCapacitorAppRequest()
  const formEl = (
    <InventoryForm
      stockType={stockType}
      partId={part.id}
      imageUrl={part.imageUrl}
      defaultValues={{
        name: part.name,
        model: part.model ?? "",
        specification: part.specification ?? "",
        category: part.category,
        brand: part.brand ?? "",
        quantity: part.stock?.quantity ?? 0,
      }}
    />
  )

  if (isAppMode) {
    return (
      <div className="space-y-4">
        <Link href={`/stock?type=${stockType}`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 active:text-slate-800">
          <ChevronLeft className="h-4 w-4" />
          <T k={STOCK_TYPE_TRANSLATION_KEYS[stockType]} />
        </Link>
        {formEl}
      </div>
    )
  }

  return (
    <div>
      <Link href={`/stock?type=${stockType}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Back to <T k={STOCK_TYPE_TRANSLATION_KEYS[stockType]} />
      </Link>
      <PageHeader title={`Edit ${part.name}`} />
      {formEl}
    </div>
  )
}
