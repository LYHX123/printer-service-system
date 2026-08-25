import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { canCreateStock } from "@/lib/permissions"
import { isCapacitorAppRequest } from "@/lib/platform/app-mode"
import { PageHeader } from "@/components/ui/page-header"
import { T } from "@/components/ui/T"
import { InventoryForm } from "@/components/inventory/InventoryForm"
import { isStockType, STOCK_TYPE_TRANSLATION_KEYS, DEFAULT_CATEGORY_FOR_STOCK_TYPE, ADD_ITEM_TRANSLATION_KEYS, stockTypeToBucket } from "@/lib/stock-types"
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

  const isAppMode = await isCapacitorAppRequest()
  const formEl = <InventoryForm stockType={type} defaultValues={{ category: DEFAULT_CATEGORY_FOR_STOCK_TYPE[type] }} />

  if (isAppMode) {
    return (
      <div className="space-y-4">
        <Link href={`/stock?type=${type}`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 active:text-slate-800">
          <ChevronLeft className="h-4 w-4" />
          <T k={STOCK_TYPE_TRANSLATION_KEYS[type]} />
        </Link>
        {formEl}
      </div>
    )
  }

  return (
    <div>
      <Link href={`/stock?type=${type}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Back to <T k={STOCK_TYPE_TRANSLATION_KEYS[type]} />
      </Link>
      <PageHeader title={<T k={ADD_ITEM_TRANSLATION_KEYS[type]} />} />
      {formEl}
    </div>
  )
}
