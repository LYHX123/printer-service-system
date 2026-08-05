import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft, Download } from "lucide-react"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { canAccess, getViewableStockBuckets } from "@/lib/permissions"
import { getStockMovements } from "@/lib/data/inventory"
import { PageHeader } from "@/components/ui/page-header"
import { Table } from "@/components/ui/table"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { TransactionTypeBadge } from "@/components/ui/badge"
import { TInput } from "@/components/ui/T"
import { TRANSACTION_TYPE_LABELS } from "@/types"
import type { TransactionType, Role } from "@/types"
import { STOCK_TYPES, CATEGORIES_FOR_STOCK_TYPE, STOCK_TYPE_LABELS, getStockType, isStockType, stockTypeToBucket } from "@/lib/stock-types"

const TRANSACTION_TYPES = Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; type?: string; search?: string; date?: string }>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  const permissions = session!.user.modulePermissions
  if (!canAccess(role, "inventory", permissions)) redirect("/dashboard")
  const companyId = session!.user.companyId as string

  // Never leak movements from a bucket the caller can't view — a stock.equipment.view-only
  // user must not see Consumption/Parts history just because "inventory" access exists.
  const viewableBuckets = getViewableStockBuckets(role, permissions)
  const viewableTypes = STOCK_TYPES.filter((st) => viewableBuckets.includes(stockTypeToBucket(st)))
  if (viewableTypes.length === 0) redirect("/dashboard")

  const { category, type, search = "", date } = await searchParams
  const requestedType = isStockType(category) ? category : undefined
  const stockType = requestedType && viewableTypes.includes(requestedType) ? requestedType : undefined
  const validType = TRANSACTION_TYPES.includes(type as TransactionType) ? (type as TransactionType) : undefined
  // Plain text field (not a native date input) so the placeholder can be translated — validate the
  // expected YYYY-MM-DD shape before using it as a filter; anything else is treated as no filter.
  const validDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined

  const movements = await getStockMovements(companyId, {
    type: validType,
    from: validDate,
    to: validDate,
    search: search || undefined,
    categories: stockType ? CATEGORIES_FOR_STOCK_TYPE[stockType] : viewableTypes.flatMap((st) => CATEGORIES_FOR_STOCK_TYPE[st]),
  })

  const exportParams = new URLSearchParams()
  if (category) exportParams.set("category", category)
  if (type) exportParams.set("type", type)
  if (search) exportParams.set("search", search)
  if (validDate) exportParams.set("date", validDate)

  return (
    <div>
      <Link href="/stock" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Stock
      </Link>

      <PageHeader
        title="Stock Movements"
        subtitle="Full history of stock in, out, returns, damage and adjustments."
        actions={
          <a href={`/api/stock/movements/pdf?${exportParams.toString()}`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" icon={<Download className="h-4 w-4" />}>Export PDF</Button>
          </a>
        }
      />

      <form method="GET" className="flex flex-wrap gap-2 mb-4">
        <Input name="search" type="search" placeholder="Search item name or part number…" defaultValue={search} className="w-56" />
        <Select name="category" defaultValue={stockType ?? ""} className="w-44">
          <option value="">All Stock Categories</option>
          {viewableTypes.map((st) => (
            <option key={st} value={st}>{STOCK_TYPE_LABELS[st]}</option>
          ))}
        </Select>
        <Select name="type" defaultValue={validType ?? ""} className="w-44">
          <option value="">All Movement Types</option>
          {TRANSACTION_TYPES.map((t) => (
            <option key={t} value={t}>{TRANSACTION_TYPE_LABELS[t]}</option>
          ))}
        </Select>
        <TInput
          name="date"
          type="text"
          inputMode="numeric"
          placeholderKey="selectDate"
          defaultValue={date ?? ""}
          maxLength={10}
          className="w-44"
        />
        <Button type="submit" variant="secondary">Filter</Button>
        {(category || type || search || date) && (
          <Link href="/stock/movements">
            <Button variant="ghost">Clear</Button>
          </Link>
        )}
      </form>

      <Table
        columns={[
          {
            key: "createdAt",
            label: "Date",
            render: (row) => (
              <span className="text-xs text-slate-500 whitespace-nowrap">{format(new Date(row.createdAt), "dd MMM yyyy")}</span>
            ),
          },
          {
            key: "category",
            label: "Stock Category",
            render: (row) => (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {STOCK_TYPE_LABELS[getStockType(row.part.category)]}
              </span>
            ),
          },
          {
            key: "part",
            label: "Stock Item",
            render: (row) => (
              <Link href={`/stock/${row.part.id}/edit`} className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">
                {row.part.name}
                <span className="block font-mono text-xs text-slate-400">{row.part.partNumber}</span>
              </Link>
            ),
          },
          { key: "type", label: "Movement Type", render: (row) => <TransactionTypeBadge type={row.type} /> },
          {
            key: "quantity",
            label: "Quantity",
            className: "text-right",
            headerClassName: "text-right",
            render: (row) => (
              <span className={`font-mono ${row.quantity < 0 ? "text-red-600" : row.quantity > 0 ? "text-green-700" : "text-slate-500"}`}>
                {row.quantity > 0 ? "+" : ""}{row.quantity} {row.part.unit ?? ""}
              </span>
            ),
          },
          { key: "reference", label: "Reference No", render: (row) => <span className="text-xs text-slate-500">{row.reference ?? "—"}</span> },
          {
            key: "remark",
            label: "Remark",
            render: (row) => <span className="text-xs text-slate-500 whitespace-normal">{row.remark ?? "—"}</span>,
          },
          { key: "performedBy", label: "Created By", render: (row) => <span className="text-xs text-slate-500">{row.performedBy.name}</span> },
        ]}
        data={movements}
        keyExtractor={(row) => row.id}
        emptyTitle="No stock movements found"
        emptyDescription="Movements recorded from the Stock list will show up here."
      />
    </div>
  )
}
