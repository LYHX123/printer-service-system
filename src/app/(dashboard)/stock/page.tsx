import Link from "next/link"
import Image from "next/image"
import { redirect } from "next/navigation"
import { ChevronLeft, ChevronRight, Plus, Search, Laptop, Droplet, Wrench, Package, ImageOff, ArrowLeftRight, Download } from "lucide-react"
import { auth } from "@/lib/auth"
import { canAccess, canViewStock, canCreateStock, canEditStock, canAdjustStock, canDeleteStock } from "@/lib/permissions"
import { getSpareParts, getStockTypeCounts, getEffectiveStockLevel } from "@/lib/data/inventory"
import { stockTypeToBucket } from "@/lib/stock-types"
import { isCapacitorAppRequest } from "@/lib/platform/app-mode"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { T, TInput } from "@/components/ui/T"
import { Table } from "@/components/ui/table"
import { StockLevelBadge } from "@/components/ui/badge"
import { SparePartActions } from "@/components/inventory/SparePartActions"
import { AppCard } from "@/components/app-ui/AppCard"
import { AppEmptyState } from "@/components/app-ui/AppEmptyState"
import { AppSearchField } from "@/components/app-ui/AppSearchField"
import {
  STOCK_TYPES,
  CATEGORIES_FOR_STOCK_TYPE,
  STOCK_TYPE_TRANSLATION_KEYS,
  ADD_ITEM_TRANSLATION_KEYS,
  EMPTY_STATE_TRANSLATION_KEYS,
  stockColumnClass,
  isStockType,
  stockCountTranslationKey,
} from "@/lib/stock-types"
import type { StockType } from "@/lib/stock-types"
import type { Role } from "@/types"
import type { LucideIcon } from "lucide-react"

const STOCK_TYPE_ICONS: Record<StockType, LucideIcon> = {
  EQUIPMENT: Laptop,
  CONSUMPTION: Droplet,
  PARTS: Wrench,
  COMMON_PRODUCT: Package,
}

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; type?: string }>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  const permissions = session!.user.modulePermissions
  if (!canAccess(role, "inventory", permissions)) redirect("/dashboard")
  const companyId = session!.user.companyId as string

  const { search = "", type } = await searchParams
  const stockType = isStockType(type) ? type : undefined

  if (!stockType) {
    const viewableTypes = STOCK_TYPES.filter((st) => canViewStock(role, permissions, stockTypeToBucket(st)))
    if (viewableTypes.length === 0) redirect("/dashboard")
    const counts = await getStockTypeCounts(companyId)
    const isAppMode = await isCapacitorAppRequest()

    if (isAppMode) {
      return (
        <div className="space-y-4">
          <Link
            href="/stock/movements"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 active:text-slate-800"
          >
            <ArrowLeftRight className="h-4 w-4" />
            Movement History
          </Link>
          <div className="space-y-2">
            {viewableTypes.map((st) => {
              const Icon = STOCK_TYPE_ICONS[st]
              return (
                <AppCard key={st} href={`/stock?type=${st}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                      <Icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-slate-900">
                        <T k={STOCK_TYPE_TRANSLATION_KEYS[st]} />
                      </p>
                      <p className="text-xs text-slate-500">
                        {counts[st]} <T k={stockCountTranslationKey(st, counts[st])} />
                      </p>
                    </div>
                  </div>
                </AppCard>
              )
            })}
          </div>
        </div>
      )
    }

    return (
      <div>
        <PageHeader
          title={<T k="inventory" />}
          actions={
            <Link href="/stock/movements">
              <Button variant="outline" icon={<ArrowLeftRight className="h-4 w-4" />}>Movement History</Button>
            </Link>
          }
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {viewableTypes.map((st) => {
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
                <h3 className="mt-4 text-base font-semibold text-slate-900"><T k={STOCK_TYPE_TRANSLATION_KEYS[st]} /></h3>
                <p className="mt-1 text-sm text-slate-500">
                  {counts[st]} <T k={stockCountTranslationKey(st, counts[st])} />
                </p>
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  if (!canViewStock(role, permissions, stockTypeToBucket(stockType))) redirect("/stock")
  const bucket = stockTypeToBucket(stockType)
  const canAddNew = canCreateStock(role, permissions, bucket)
  // Row actions (edit/move/archive) share one control in SparePartActions —
  // shown if the user has any write capability on this bucket; each
  // individual action is still independently enforced server-side.
  const canEdit =
    canCreateStock(role, permissions, bucket) ||
    canEditStock(role, permissions, bucket) ||
    canAdjustStock(role, permissions, bucket) ||
    canDeleteStock(role, permissions, bucket)

  const parts = await getSpareParts(companyId, {
    search: search || undefined,
    categories: CATEGORIES_FOR_STOCK_TYPE[stockType],
  })
  const isAppMode = await isCapacitorAppRequest()

  if (isAppMode) {
    return (
      <div className="space-y-4">
        <Link href="/stock" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 active:text-slate-800">
          <ChevronLeft className="h-4 w-4" />
          <T k="inventory" />
        </Link>

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {parts.length} <T k={stockCountTranslationKey(stockType, parts.length)} />
          </p>
        </div>

        {canAddNew && (
          <Link href={`/stock/new?type=${stockType}`}>
            <Button icon={<Plus className="h-4 w-4" />} size="sm" className="w-full">
              <T k={ADD_ITEM_TRANSLATION_KEYS[stockType]} />
            </Button>
          </Link>
        )}

        <a href={`/api/stock/export?type=${stockType}`} className="block">
          <Button variant="outline" icon={<Download className="h-4 w-4" />} size="sm" className="w-full">
            <T k="exportExcel" />
          </Button>
        </a>

        <form method="GET" className="flex gap-2">
          <input type="hidden" name="type" value={stockType} />
          <div className="flex-1">
            <AppSearchField name="search" defaultValue={search} />
          </div>
          <button
            type="submit"
            aria-label="Search"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-500 transition-colors active:bg-slate-50"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>

        {parts.length === 0 ? (
          <AppEmptyState
            icon={<Package className="h-8 w-8" />}
            title={<T k={EMPTY_STATE_TRANSLATION_KEYS[stockType].title} />}
            description={search ? <T k="tryAdjustingFilters" /> : <T k={EMPTY_STATE_TRANSLATION_KEYS[stockType].description} />}
          />
        ) : (
          <div className="space-y-2">
            {parts.map((part) => (
              <AppCard
                key={part.id}
                href={`/stock/${part.id}/edit`}
                trailing={
                  canEdit ? (
                    <SparePartActions
                      variant="menu"
                      partId={part.id}
                      partName={part.name}
                      unit={part.unit}
                      currentQuantity={part.stock?.quantity ?? 0}
                      isActive={part.isActive}
                      canEdit={canEdit}
                    />
                  ) : undefined
                }
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                    {part.imageUrl ? (
                      <Image src={part.imageUrl} alt={part.name} width={40} height={40} className="h-full w-full object-cover" unoptimized />
                    ) : (
                      <ImageOff className="h-4 w-4 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-slate-900">
                      {part.brand ? `${part.brand} ` : ""}
                      {part.name}
                    </p>
                    {part.model && <p className="truncate text-xs text-slate-500">Model: {part.model}</p>}
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        Stock: <span className="font-mono font-semibold text-slate-700">{part.stock?.quantity ?? 0}</span>
                        {part.unit ? ` ${part.unit}` : ""}
                      </span>
                      <StockLevelBadge level={getEffectiveStockLevel(part.category, part.stock?.quantity ?? 0)} />
                    </div>
                  </div>
                </div>
              </AppCard>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <Link href="/stock" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        <T k="inventory" />
      </Link>

      <PageHeader
        title={<T k={STOCK_TYPE_TRANSLATION_KEYS[stockType]} />}
        subtitle={<>{parts.length} <T k={stockCountTranslationKey(stockType, parts.length)} /></>}
        actions={
          <div className="flex flex-wrap gap-2">
            <a href={`/api/stock/export?type=${stockType}`}>
              <Button variant="outline" icon={<Download className="h-4 w-4" />}><T k="exportExcel" /></Button>
            </a>
            {canAddNew && (
              <Link href={`/stock/new?type=${stockType}`}>
                <Button icon={<Plus className="h-4 w-4" />}><T k={ADD_ITEM_TRANSLATION_KEYS[stockType]} /></Button>
              </Link>
            )}
          </div>
        }
      />

      <form method="GET" className="filter-bar flex flex-wrap gap-2 mb-4">
        <input type="hidden" name="type" value={stockType} />
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <TInput
            name="search"
            type="search"
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
        tableClassName="table-fixed w-full min-w-[1150px]"
        columns={[
          {
            key: "image",
            label: <T k="picture" />,
            className: stockColumnClass("picture"),
            headerClassName: stockColumnClass("picture"),
            render: (row) => (
              <div className="mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                {row.imageUrl ? (
                  <Image src={row.imageUrl} alt={row.name} width={48} height={48} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <ImageOff className="h-5 w-5 text-slate-300" />
                )}
              </div>
            ),
          },
          {
            key: "brand",
            label: <T k="brand" />,
            className: stockColumnClass("brand"),
            headerClassName: stockColumnClass("brand"),
            render: (row) => <span className="text-sm text-slate-600">{row.brand ?? "—"}</span>,
          },
          {
            key: "name",
            label: <T k="name" />,
            className: stockColumnClass("name"),
            headerClassName: stockColumnClass("name"),
            render: (row) => <span className="text-sm font-medium text-slate-900">{row.name}</span>,
          },
          {
            key: "model",
            label: <T k="model" />,
            className: stockColumnClass("model"),
            headerClassName: stockColumnClass("model"),
            render: (row) => <span className="text-sm text-slate-600">{row.model ?? "—"}</span>,
          },
          {
            key: "specification",
            label: <T k="specification" />,
            className: stockColumnClass("specification"),
            headerClassName: stockColumnClass("specification"),
            render: (row) => (
              <span
                className="block text-xs text-slate-500 line-clamp-2 max-w-full whitespace-pre-line"
                title={row.specification ?? undefined}
              >
                {row.specification ?? "—"}
              </span>
            ),
          },
          {
            key: "unit",
            label: <T k="unit" />,
            className: stockColumnClass("unit"),
            headerClassName: stockColumnClass("unit"),
            render: (row) => <span className="text-sm text-slate-600">{row.unit ?? "—"}</span>,
          },
          {
            key: "quantity",
            label: <T k="quantity" />,
            className: stockColumnClass("quantity"),
            headerClassName: stockColumnClass("quantity"),
            render: (row) => <span className="font-mono font-semibold">{row.stock?.quantity ?? 0}</span>,
          },
          {
            key: "status",
            label: <T k="status" />,
            className: stockColumnClass("status"),
            headerClassName: stockColumnClass("status"),
            render: (row) => (
              <StockLevelBadge level={getEffectiveStockLevel(row.category, row.stock?.quantity ?? 0)} />
            ),
          },
          {
            key: "actions",
            label: <T k="actions" />,
            className: stockColumnClass("actions"),
            headerClassName: stockColumnClass("actions"),
            render: (row) => (
              <div className="flex justify-center">
                <SparePartActions
                  partId={row.id}
                  partName={row.name}
                  unit={row.unit}
                  currentQuantity={row.stock?.quantity ?? 0}
                  isActive={row.isActive}
                  canEdit={canEdit}
                />
              </div>
            ),
          },
        ]}
        data={parts}
        keyExtractor={(row) => row.id}
        emptyTitle={<T k={EMPTY_STATE_TRANSLATION_KEYS[stockType].title} />}
        emptyDescription={search ? <T k="tryAdjustingFilters" /> : <T k={EMPTY_STATE_TRANSLATION_KEYS[stockType].description} />}
      />
    </div>
  )
}
