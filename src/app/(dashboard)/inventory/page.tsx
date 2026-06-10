import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus, Search } from "lucide-react"
import { auth } from "@/lib/auth"
import { canAccess, canManageInventory } from "@/lib/permissions"
import { getSpareParts, getStockLevel } from "@/lib/data/inventory"
import { PageHeader } from "@/components/ui/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Table } from "@/components/ui/table"
import { PartCategoryBadge, StockLevelBadge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { PART_CATEGORY_LABELS } from "@/types"
import type { PartCategory, Role } from "@/types"
import type { StockLevel } from "@/lib/data/inventory"

const CATEGORIES = Object.keys(PART_CATEGORY_LABELS) as PartCategory[]
const STOCK_LEVELS: { value: StockLevel; label: string }[] = [
  { value: "in_stock", label: "In Stock" },
  { value: "low", label: "Low Stock" },
  { value: "out", label: "Out of Stock" },
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
        title="Inventory"
        subtitle={`${parts.length} part${parts.length !== 1 ? "s" : ""} in catalog`}
        actions={
          <div className="flex gap-2">
            <Link href="/inventory/reports">
              <Button variant="secondary">Reports</Button>
            </Link>
            {canEdit && (
              <Link href="/inventory/new">
                <Button icon={<Plus className="h-4 w-4" />}>Add Part</Button>
              </Link>
            )}
          </div>
        }
      />

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            name="search"
            type="search"
            placeholder="Part number, name, brand…"
            defaultValue={search}
            className="pl-9"
          />
        </div>
        <Select name="category" defaultValue={category ?? ""} className="w-48">
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{PART_CATEGORY_LABELS[c]}</option>
          ))}
        </Select>
        <Select name="stockLevel" defaultValue={stockLevel ?? ""} className="w-44">
          <option value="">All Stock Levels</option>
          {STOCK_LEVELS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">Filter</Button>
        {(search || category || stockLevel) && (
          <Link href="/inventory">
            <Button variant="ghost">Clear</Button>
          </Link>
        )}
      </form>

      <Table
        columns={[
          {
            key: "partNumber",
            label: "Part #",
            render: (row) => (
              <Link href={`/inventory/${row.id}`} className="font-mono text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">
                {row.partNumber}
              </Link>
            ),
          },
          {
            key: "name",
            label: "Name",
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
            label: "Category",
            render: (row) => <PartCategoryBadge category={row.category} />,
          },
          {
            key: "supplier",
            label: "Supplier",
            render: (row) => <span className="text-sm text-slate-600">{row.supplier ?? "—"}</span>,
          },
          {
            key: "unitCost",
            label: "Unit Cost",
            className: "text-right",
            headerClassName: "text-right",
            render: (row) => formatCurrency(Number(row.unitCost)),
          },
          {
            key: "sellingPrice",
            label: "Selling Price",
            className: "text-right",
            headerClassName: "text-right",
            render: (row) => formatCurrency(Number(row.sellingPrice)),
          },
          {
            key: "quantity",
            label: "Qty",
            className: "text-right",
            headerClassName: "text-right",
            render: (row) => (
              <span className="font-mono font-semibold">{row.stock?.quantity ?? 0}</span>
            ),
          },
          {
            key: "minQty",
            label: "Min Qty",
            className: "text-right",
            headerClassName: "text-right",
            render: (row) => <span className="font-mono text-slate-500">{row.reorderLevel}</span>,
          },
          {
            key: "location",
            label: "Location",
            render: (row) => <span className="text-sm text-slate-600">{row.stock?.location ?? "—"}</span>,
          },
          {
            key: "status",
            label: "Status",
            render: (row) => (
              <StockLevelBadge level={getStockLevel(row.stock?.quantity ?? 0, row.reorderLevel)} />
            ),
          },
        ]}
        data={parts}
        keyExtractor={(row) => row.id}
        emptyTitle="No parts found"
        emptyDescription={
          search || category || stockLevel
            ? "Try adjusting your filters."
            : "Add your first spare part to start tracking inventory."
        }
      />
    </div>
  )
}
