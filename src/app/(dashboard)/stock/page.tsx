import Link from "next/link"
import Image from "next/image"
import { redirect } from "next/navigation"
import { ChevronLeft, ChevronRight, Plus, Search, Laptop, Droplet, Wrench, ImageOff } from "lucide-react"
import { auth } from "@/lib/auth"
import { canAccess, canManageInventory } from "@/lib/permissions"
import { getSpareParts, getStockTypeCounts } from "@/lib/data/inventory"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { T, TInput } from "@/components/ui/T"
import { Table } from "@/components/ui/table"
import {
  STOCK_TYPES,
  CATEGORIES_FOR_STOCK_TYPE,
  STOCK_TYPE_LABELS,
  isStockType,
  itemNameTranslationKey,
} from "@/lib/stock-types"
import type { StockType } from "@/lib/stock-types"
import type { Role } from "@/types"
import type { LucideIcon } from "lucide-react"

const STOCK_TYPE_ICONS: Record<StockType, LucideIcon> = {
  EQUIPMENT: Laptop,
  CONSUMPTION: Droplet,
  PARTS: Wrench,
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; type?: string }>
}) {
  const session = await auth()
  if (!canAccess(session!.user.role as Role, "inventory")) redirect("/dashboard")
  const canEdit = canManageInventory(session!.user.role as Role)
  const companyId = session!.user.companyId as string

  const { search = "", type } = await searchParams
  const stockType = isStockType(type) ? type : undefined

  if (!stockType) {
    const counts = await getStockTypeCounts(companyId)
    return (
      <div>
        <PageHeader title={<T k="inventory" />} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STOCK_TYPES.map((st) => {
            const Icon = STOCK_TYPE_ICONS[st]
            return (
              <Link
                key={st}
                href={`/stock?type=${st}`}
                className="group rounded-xl border border-slate-200 bg-white p-6 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                    <Icon className="h-5 w-5 text-blue-600" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{STOCK_TYPE_LABELS[st]}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {counts[st]} <T k="parts" />
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  const itemNameKey = itemNameTranslationKey(stockType)
  const parts = await getSpareParts(companyId, {
    search: search || undefined,
    categories: CATEGORIES_FOR_STOCK_TYPE[stockType],
  })

  return (
    <div>
      <Link href="/stock" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        <T k="inventory" />
      </Link>

      <PageHeader
        title={STOCK_TYPE_LABELS[stockType]}
        subtitle={<>{parts.length} <T k="parts" /></>}
        actions={
          canEdit && (
            <Link href={`/stock/new?type=${stockType}`}>
              <Button icon={<Plus className="h-4 w-4" />}><T k="addPart" /></Button>
            </Link>
          )
        }
      />

      <form method="GET" className="flex flex-wrap gap-2 mb-4">
        <input type="hidden" name="type" value={stockType} />
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <TInput
            name="search"
            type="search"
            placeholderKey="searchPartsPlaceholder"
            defaultValue={search}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary"><T k="filter" /></Button>
        {search && (
          <Link href={`/stock?type=${stockType}`}>
            <Button variant="ghost"><T k="clear" /></Button>
          </Link>
        )}
      </form>

      <Table
        columns={[
          {
            key: "image",
            label: "",
            render: (row) => (
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                {row.imageUrl ? (
                  <Image src={row.imageUrl} alt={row.name} width={40} height={40} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <ImageOff className="h-4 w-4 text-slate-300" />
                )}
              </div>
            ),
          },
          {
            key: "name",
            label: <T k={itemNameKey} />,
            render: (row) => (
              <Link href={`/stock/${row.id}`} className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">
                {row.name}
              </Link>
            ),
          },
          {
            key: "brand",
            label: <T k="brand" />,
            render: (row) => <span className="text-sm text-slate-600">{row.brand ?? "—"}</span>,
          },
          {
            key: "quantity",
            label: <T k="quantity" />,
            className: "text-right",
            headerClassName: "text-right",
            render: (row) => <span className="font-mono font-semibold">{row.stock?.quantity ?? 0}</span>,
          },
        ]}
        data={parts}
        keyExtractor={(row) => row.id}
        emptyTitle={<T k="noPartsFound" />}
        emptyDescription={search ? <T k="tryAdjustingFilters" /> : <T k="addFirstPart" />}
      />
    </div>
  )
}
