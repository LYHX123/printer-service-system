import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { canCreateStock } from "@/lib/permissions"
import { PageHeader } from "@/components/ui/page-header"
import { T } from "@/components/ui/T"
import { InventoryForm } from "@/components/inventory/InventoryForm"
import { isStockType, STOCK_TYPE_LABELS, DEFAULT_CATEGORY_FOR_STOCK_TYPE, ADD_ITEM_TRANSLATION_KEYS, stockTypeToBucket } from "@/lib/stock-types"
import type { Role } from "@/types"

export default async function NewSparePartPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const session = await auth()

  const { type } = await searchParams
  if (!isStockType(type)) redirect("/stock")
  if (!canCreateStock(session!.user.role as Role, session!.user.modulePermissions, stockTypeToBucket(type))) {
    redirect("/stock")
  }

  return (
    <div>
      <Link href={`/stock?type=${type}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Back to {STOCK_TYPE_LABELS[type]}
      </Link>
      <PageHeader title={<T k={ADD_ITEM_TRANSLATION_KEYS[type]} />} />
      <InventoryForm stockType={type} defaultValues={{ category: DEFAULT_CATEGORY_FOR_STOCK_TYPE[type] }} />
    </div>
  )
}
