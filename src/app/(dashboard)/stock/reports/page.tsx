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
import { getLowStockThreshold } from "@/lib/stock-types"
import { PageHeader } from "@/components/ui/page-header"
import { MetricCard } from "@/components/ui/metric-card"
import { Tabs } from "@/components/ui/tabs"
import { Table } from "@/components/ui/table"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { T } from "@/components/ui/T"
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
      <Link href="/stock" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        <T k="inventory" />
      </Link>

      <PageHeader title={<T k="inventoryReports" />} subtitle={<T k="inventoryReportsDesc" />} />

      <div className="mb-4">
        <Tabs
          tabs={[
            { id: "valuation", label: <T k="inventoryValuation" /> },
            { id: "low-stock", label: <T k="lowStockReportTitle" /> },
            { id: "movements", label: <T k="stockMovementReport" /> },
          ]}
          activeTab={activeTab}
          pathPrefix="/stock/reports"
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
        <MetricCard label={<T k="totalParts" />} value={rows.length} icon={<Boxes className="h-5 w-5 text-blue-600" />} />
        <MetricCard label={<T k="stockValueAtCost" />} value={formatCurrency(totalCostValue)} icon={<Boxes className="h-5 w-5 text-blue-600" />} />
        <MetricCard label={<T k="stockValueAtSelling" />} value={formatCurrency(totalSellingValue)} icon={<Boxes className="h-5 w-5 text-green-600" />} />
      </div>

      <Table
        columns={[
          {
            key: "partNumber",
            label: <T k="partNumber" />,
            render: (row) => (
              <Link href={`/stock/${row.id}/edit`} className="font-mono text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">
                {row.partNumber}
              </Link>
            ),
          },
          { key: "name", label: <T k="name" />, render: (row) => <span className="text-sm text-slate-900">{row.name}</span> },
          { key: "category", label: <T k="category" />, render: (row) => <PartCategoryBadge category={row.category} /> },
          {
            key: "quantity", label: <T k="quantity" />, className: "text-right", headerClassName: "text-right",
            render: (row) => <span className="font-mono">{row.quantity}</span>,
          },
          {
            key: "unitCost", label: <T k="unitCost" />, className: "text-right", headerClassName: "text-right",
            render: (row) => formatCurrency(row.unitCost),
          },
          {
            key: "costValue", label: <T k="costValue" />, className: "text-right", headerClassName: "text-right",
            render: (row) => <span className="font-medium">{formatCurrency(row.costValue)}</span>,
          },
          {
            key: "sellingPrice", label: <T k="sellingPrice" />, className: "text-right", headerClassName: "text-right",
            render: (row) => formatCurrency(row.sellingPrice),
          },
          {
            key: "sellingValue", label: <T k="sellingValue" />, className: "text-right", headerClassName: "text-right",
            render: (row) => <span className="font-medium">{formatCurrency(row.sellingValue)}</span>,
          },
        ]}
        data={rows}
        keyExtractor={(row) => row.id}
        emptyTitle={<T k="noPartsInInventory" />}
        emptyDescription={<T k="addPartsToSeeValuation" />}
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
          label={<T k="partsNeedingReorder" />}
          value={parts.length}
          icon={<AlertTriangle className="h-5 w-5 text-orange-600" />}
          iconBg="bg-orange-50"
        />
        <MetricCard
          label={<T k="outOfStock" />}
          value={parts.filter((p) => (p.stock?.quantity ?? 0) <= 0).length}
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          iconBg="bg-red-50"
        />
      </div>

      <Table
        columns={[
          {
            key: "partNumber",
            label: <T k="partNumber" />,
            render: (row) => (
              <Link href={`/stock/${row.id}/edit`} className="font-mono text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">
                {row.partNumber}
              </Link>
            ),
          },
          { key: "name", label: <T k="name" />, render: (row) => <span className="text-sm text-slate-900">{row.name}</span> },
          { key: "category", label: <T k="category" />, render: (row) => <PartCategoryBadge category={row.category} /> },
          { key: "supplier", label: <T k="supplier" />, render: (row) => <span className="text-sm text-slate-600">{row.supplier ?? "—"}</span> },
          {
            key: "quantity", label: <T k="currentQty" />, className: "text-right", headerClassName: "text-right",
            render: (row) => <span className="font-mono font-semibold">{row.stock?.quantity ?? 0}</span>,
          },
          {
            key: "reorderLevel", label: <T k="minQty" />, className: "text-right", headerClassName: "text-right",
            render: (row) => <span className="font-mono text-slate-500">{getLowStockThreshold(row.category)}</span>,
          },
          {
            key: "status", label: <T k="status" />,
            render: (row) => <StockLevelBadge level={getStockLevel(row.stock?.quantity ?? 0, getLowStockThreshold(row.category))} />,
          },
        ]}
        data={parts}
        keyExtractor={(row) => row.id}
        emptyTitle={<T k="noLowStockItems" />}
        emptyDescription={<T k="allPartsAboveMin" />}
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
          <option value=""><T k="allTypes" /></option>
          {TRANSACTION_TYPES.map((t) => (
            <option key={t} value={t}>{TRANSACTION_TYPE_LABELS[t]}</option>
          ))}
        </Select>
        <Input name="from" type="date" defaultValue={from ?? ""} className="w-44" />
        <Input name="to" type="date" defaultValue={to ?? ""} className="w-44" />
        <Button type="submit" variant="secondary"><T k="filter" /></Button>
        {(type || from || to) && (
          <Link href="/stock/reports?tab=movements">
            <Button variant="ghost"><T k="clear" /></Button>
          </Link>
        )}
      </form>

      <Table
        columns={[
          {
            key: "createdAt", label: <T k="date" />,
            render: (row) => <span className="text-xs text-slate-500 whitespace-nowrap">{format(new Date(row.createdAt), "dd MMM yyyy HH:mm")}</span>,
          },
          {
            key: "part", label: <T k="part" />,
            render: (row) => (
              <Link href={`/stock/${row.part.id}/edit`} className="text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">
                {row.part.name}
                <span className="block font-mono text-xs text-slate-400">{row.part.partNumber}</span>
              </Link>
            ),
          },
          { key: "type", label: <T k="type" />, render: (row) => <TransactionTypeBadge type={row.type} /> },
          {
            key: "quantity", label: <T k="quantity" />, className: "text-right", headerClassName: "text-right",
            render: (row) => (
              <span className={`font-mono ${row.quantity < 0 ? "text-red-600" : row.quantity > 0 ? "text-green-700" : "text-slate-500"}`}>
                {row.quantity > 0 ? "+" : ""}{row.quantity} {row.part.unit}
              </span>
            ),
          },
          {
            key: "unitPrice", label: <T k="unitPrice" />, className: "text-right", headerClassName: "text-right",
            render: (row) => row.unitPrice != null ? formatCurrency(Number(row.unitPrice)) : "—",
          },
          { key: "reference", label: <T k="reference" />, render: (row) => <span className="text-xs text-slate-500">{row.reference ?? "—"}</span> },
          {
            key: "job", label: <T k="job" />,
            render: (row) => row.job ? (
              <Link href={`/jobs/${row.job.id}`} className="font-mono text-xs text-blue-600 hover:underline">{row.job.jobNumber}</Link>
            ) : "—",
          },
          { key: "performedBy", label: <T k="by" />, render: (row) => <span className="text-xs text-slate-500">{row.performedBy.name}</span> },
        ]}
        data={transactions}
        keyExtractor={(row) => row.id}
        emptyTitle={<T k="noStockMovementsFound" />}
        emptyDescription={<T k="tryAdjustingFilters" />}
      />
    </div>
  )
}
