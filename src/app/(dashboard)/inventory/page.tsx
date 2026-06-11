import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus, Search } from "lucide-react"
import { auth } from "@/lib/auth"
import { canAccess, canManageInventory } from "@/lib/permissions"
import { getSpareParts, getStockLevel } from "@/lib/data/inventory"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { T, TInput } from "@/components/ui/T"
import { Table } from "@/components/ui/table"
import { PartCategoryBadge, StockLevelBadge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { PART_CATEGORY_LABELS } from "@/types"
import type { PartCategory, Role } from "@/types"
import type { StockLevel } from "@/lib/data/inventory"

const CATEGORIES = Object.keys(PART_CATEGORY_LABELS) as PartCategory[]
const STOCK_LEVELS: { value: StockLevel; labelKey: "inStock" | "lowStock" | "outOfStock" }[] = [
  { value: "in_stock", labelKey: "inStock" },
  { value: "low", labelKey: "lowStock" },
  { value: "out", labelKey: "outOfStock" },
]

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string; stockLevel?: string }>
}) {
  const session = await auth()
  if (!canAccess(session!.user.role as Role, "inventory")) redirect("/dashboard")
  const canEdit = canManageInventory(session!.user.role as Role)
  const companyId = session!.user.companyId as string

  const { search = "", category, stockLevel } = await searchParams

  const validCategory = category && CATEGORIES.includes(category as PartCategory)
    ? (category as PartCategory)
    : undefined
  const validStockLevel = STOCK_LEVELS.some((s) => s.value === stockLevel)
    ? (stockLevel as StockLevel)
    : undefined

  const parts = await getSpareParts(companyId, {
    search: search || undefined,
    category: validCategory,
    stockLevel: validStockLevel,
  })

  return (
    <div>
      <PageHeader
        title={<T k="inventory" />}
        subtitle={<>{parts.length} <T k="parts" /> <T k="inCatalog" /></>}
        actions={
          <div className="flex gap-2">
            <Link href="/inventory/reports">
              <Button variant="secondary"><T k="reports" /></Button>
            </Link>
            {canEdit && (
              <Link href="/inventory/new">
                <Button icon={<Plus className="h-4 w-4" />}><T k="addPart" /></Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2 mb-4">
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
        <Select name="category" defaultValue={category ?? ""} className="w-48">
          <option value=""><T k="allCategories" /></option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{PART_CATEGORY_LABELS[c]}</option>
          ))}
        </Select>
        <Select name="stockLevel" defaultValue={stockLevel ?? ""} className="w-44">
          <option value=""><T k="allStockLevels" /></option>
          {STOCK_LEVELS.map((s) => (
            <option key={s.value} value={s.value}><T k={s.labelKey} /></option>
          ))}
        </Select>
        <Button type="submit" variant="secondary"><T k="filter" /></Button>
        {(search || category || stockLevel) && (
          <Link href="/inventory">
            <Button variant="ghost"><T k="clear" /></Button>
          </Link>
        )}
      </form>

      <Table
        columns={[
          {
            key: "partNumber",
            label: <T k="partNumber" />,
            render: (row) => (
              <Link href={`/inventory/${row.id}`} className="font-mono text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">
                {row.partNumber}
              </Link>
            ),
          },
          {
            key: "name",
            label: <T k="name" />,
            render: (row) => (
              <div>
                <Link href={`/inventory/${row.id}`} className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">
                  {row.name}
                </Link>
                {row.brand && <p className="text-xs text-slate-400 mt-0.5">{row.brand}</p>}
              </div>
            ),
          },
          {
            key: "category",
            label: <T k="category" />,
            render: (row) => <PartCategoryBadge category={row.category} />,
          },
          {
            key: "supplier",
            label: <T k="supplier" />,
            render: (row) => <span className="text-sm text-slate-600">{row.supplier ?? "—"}</span>,
          },
          {
            key: "unitCost",
            label: <T k="unitCost" />,
            className: "text-right",
            headerClassName: "text-right",
            render: (row) => formatCurrency(Number(row.unitCost)),
          },
          {
            key: "sellingPrice",
            label: <T k="sellingPrice" />,
            className: "text-right",
            headerClassName: "text-right",
            render: (row) => formatCurrency(Number(row.sellingPrice)),
          },
          {
            key: "quantity",
            label: <T k="quantity" />,
            className: "text-right",
            headerClassName: "text-right",
            render: (row) => (
              <span className="font-mono font-semibold">{row.stock?.quantity ?? 0}</span>
            ),
          },
          {
            key: "minQty",
            label: <T k="minQty" />,
            className: "text-right",
            headerClassName: "text-right",
            render: (row) => <span className="font-mono text-slate-500">{row.reorderLevel}</span>,
          },
          {
            key: "location",
            label: <T k="location" />,
            render: (row) => <span className="text-sm text-slate-600">{row.stock?.location ?? "—"}</span>,
          },
          {
            key: "status",
            label: <T k="status" />,
            render: (row) => (
              <StockLevelBadge level={getStockLevel(row.stock?.quantity ?? 0, row.reorderLevel)} />
            ),
          },
        ]}
        data={parts}
        keyExtractor={(row) => row.id}
        emptyTitle={<T k="noPartsFound" />}
        emptyDescription={
          search || category || stockLevel
            ? <T k="tryAdjustingFilters" />
            : <T k="addFirstPart" />
        }
      />
    </div>
  )
}
