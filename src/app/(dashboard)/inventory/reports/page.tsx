import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft, Boxes, AlertTriangle } from "lucide-react"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import {
  getInventoryValuation,
  getLowStockParts,
  getStockMovements,
  getStockLevel,
} from "@/lib/data/inventory"
import { PageHeader } from "@/components/ui/page-header"
import { MetricCard } from "@/components/ui/metric-card"
import { Tabs } from "@/components/ui/tabs"
import { Table } from "@/components/ui/table"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { PartCategoryBadge, StockLevelBadge, TransactionTypeBadge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import { TRANSACTION_TYPE_LABELS } from "@/types"
import type { Role, TransactionType } from "@/types"
import { format } from "date-fns"

const TRANSACTION_TYPES = Object.keys(TRANSACTION_TYPE_LABELS) as TransactionType[]

export default async function InventoryReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; type?: string; from?: string; to?: string }>
}) {
  const session = await auth()
  if (!canAccess(session!.user.role as Role, "inventory")) redirect("/dashboard")
  const companyId = session!.user.companyId as string

  const { tab = "valuation", type, from, to } = await searchParams
  const activeTab = ["valuation", "low-stock", "movements"].includes(tab) ? tab : "valuation"

  return (
    <div>
      <Link href="/inventory" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        Inventory
      </Link>

      <PageHeader title="Inventory Reports" subtitle="Valuation, low stock, and stock movement reports." />

      <div className="mb-4">
        <Tabs
          tabs={[
            { id: "valuation", label: "Inventory Valuation" },
            { id: "low-stock", label: "Low Stock Report" },
            { id: "movements", label: "Stock Movement Report" },
          ]}
          activeTab={activeTab}
          pathPrefix="/inventory/reports"
        />
      </div>

      {activeTab === "valuation" && <ValuationReport companyId={companyId} />}
      {activeTab === "low-stock" && <LowStockReport companyId={companyId} />}
      {activeTab === "movements" && (
        <MovementsReport companyId={companyId} type={type} from={from} to={to} />
      )}
    </div>
  )
}

async function ValuationReport({ companyId }: { companyId: string }) {
  const { rows, totalCostValue, totalSellingValue } = await getInventoryValuation(companyId)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Total Parts" value={rows.length} icon={<Boxes className="h-5 w-5 text-blue-600" />} />
        <MetricCard label="Stock Value (at cost)" value={formatCurrency(totalCostValue)} icon={<Boxes className="h-5 w-5 text-blue-600" />} />
        <MetricCard label="Stock Value (at selling price)" value={formatCurrency(totalSellingValue)} icon={<Boxes className="h-5 w-5 text-green-600" />} />
      </div>

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
          { key: "name", label: "Name", render: (row) => <span className="text-sm text-slate-900">{row.name}</span> },
          { key: "category", label: "Category", render: (row) => <PartCategoryBadge category={row.category} /> },
          {
            key: "quantity", label: "Qty", className: "text-right", headerClassName: "text-right",
            render: (row) => <span className="font-mono">{row.quantity}</span>,
          },
          {
            key: "unitCost", label: "Unit Cost", className: "text-right", headerClassName: "text-right",
            render: (row) => formatCurrency(row.unitCost),
          },
          {
            key: "costValue", label: "Cost Value", className: "text-right", headerClassName: "text-right",
            render: (row) => <span className="font-medium">{formatCurrency(row.costValue)}</span>,
          },
          {
            key: "sellingPrice", label: "Selling Price", className: "text-right", headerClassName: "text-right",
            render: (row) => formatCurrency(row.sellingPrice),
          },
          {
            key: "sellingValue", label: "Selling Value", className: "text-right", headerClassName: "text-right",
            render: (row) => <span className="font-medium">{formatCurrency(row.sellingValue)}</span>,
          },
        ]}
        data={rows}
        keyExtractor={(row) => row.id}
        emptyTitle="No parts in inventory"
        emptyDescription="Add spare parts to see their valuation here."
      />
    </div>
  )
}

async function LowStockReport({ companyId }: { companyId: string }) {
  const parts = await getLowStockParts(companyId)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <MetricCard
          label="Parts Needing Reorder"
          value={parts.length}
          icon={<AlertTriangle className="h-5 w-5 text-orange-600" />}
          iconBg="bg-orange-50"
        />
        <MetricCard
          label="Out of Stock"
          value={parts.filter((p) => (p.stock?.quantity ?? 0) <= 0).length}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          iconBg="bg-red-50"
        />
      </div>

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
          { key: "name", label: "Name", render: (row) => <span className="text-sm text-slate-900">{row.name}</span> },
          { key: "category", label: "Category", render: (row) => <PartCategoryBadge category={row.category} /> },
          { key: "supplier", label: "Supplier", render: (row) => <span className="text-sm text-slate-600">{row.supplier ?? "—"}</span> },
          {
            key: "quantity", label: "Current Qty", className: "text-right", headerClassName: "text-right",
            render: (row) => <span className="font-mono font-semibold">{row.stock?.quantity ?? 0}</span>,
          },
          {
            key: "reorderLevel", label: "Min Qty", className: "text-right", headerClassName: "text-right",
            render: (row) => <span className="font-mono text-slate-500">{row.reorderLevel}</span>,
          },
          {
            key: "status", label: "Status",
            render: (row) => <StockLevelBadge level={getStockLevel(row.stock?.quantity ?? 0, row.reorderLevel)} />,
          },
        ]}
        data={parts}
        keyExtractor={(row) => row.id}
        emptyTitle="No low stock items"
        emptyDescription="All parts are above their minimum stock levels."
      />
    </div>
  )
}

async function MovementsReport({
  companyId,
  type,
  from,
  to,
}: {
  companyId: string
  type?: string
  from?: string
  to?: string
}) {
  const validType = TRANSACTION_TYPES.includes(type as TransactionType) ? (type as TransactionType) : undefined
  const transactions = await getStockMovements(companyId, { type: validType, from, to })

  return (
    <div className="space-y-4">
      <form method="GET" className="flex flex-wrap gap-2">
        <input type="hidden" name="tab" value="movements" />
        <Select name="type" defaultValue={type ?? ""} className="w-44">
          <option value="">All Types</option>
          {TRANSACTION_TYPES.map((t) => (
            <option key={t} value={t}>{TRANSACTION_TYPE_LABELS[t]}</option>
          ))}
        </Select>
        <Input name="from" type="date" defaultValue={from ?? ""} className="w-44" />
        <Input name="to" type="date" defaultValue={to ?? ""} className="w-44" />
        <Button type="submit" variant="secondary">Filter</Button>
        {(type || from || to) && (
          <Link href="/inventory/reports?tab=movements">
            <Button variant="ghost">Clear</Button>
          </Link>
        )}
      </form>

      <Table
        columns={[
          {
            key: "createdAt", label: "Date",
            render: (row) => <span className="text-xs text-slate-500 whitespace-nowrap">{format(new Date(row.createdAt), "dd MMM yyyy HH:mm")}</span>,
          },
          {
            key: "part", label: "Part",
            render: (row) => (
              <Link href={`/inventory/${row.part.id}`} className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">
                {row.part.name}
                <span className="block font-mono text-xs text-slate-400">{row.part.partNumber}</span>
              </Link>
            ),
          },
          { key: "type", label: "Type", render: (row) => <TransactionTypeBadge type={row.type} /> },
          {
            key: "quantity", label: "Quantity", className: "text-right", headerClassName: "text-right",
            render: (row) => (
              <span className={`font-mono ${row.quantity < 0 ? "text-red-600" : row.quantity > 0 ? "text-green-700" : "text-slate-500"}`}>
                {row.quantity > 0 ? "+" : ""}{row.quantity} {row.part.unit}
              </span>
            ),
          },
          {
            key: "unitPrice", label: "Unit Price", className: "text-right", headerClassName: "text-right",
            render: (row) => row.unitPrice != null ? formatCurrency(Number(row.unitPrice)) : "—",
          },
          { key: "reference", label: "Reference", render: (row) => <span className="text-xs text-slate-500">{row.reference ?? "—"}</span> },
          {
            key: "job", label: "Job",
            render: (row) => row.job ? (
              <Link href={`/jobs/${row.job.id}`} className="font-mono text-xs text-blue-600 hover:underline">{row.job.jobNumber}</Link>
            ) : "—",
          },
          { key: "performedBy", label: "By", render: (row) => <span className="text-xs text-slate-500">{row.performedBy.name}</span> },
        ]}
        data={transactions}
        keyExtractor={(row) => row.id}
        emptyTitle="No stock movements found"
        emptyDescription="Try adjusting your filters."
      />
    </div>
  )
}
