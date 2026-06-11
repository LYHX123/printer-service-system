import Link from "next/link"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import {
  FileText,
  ClipboardList,
  Boxes,
  AlertTriangle,
  ArrowLeftRight,
  TrendingUp,
  Download,
} from "lucide-react"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { getCustomerOptions } from "@/lib/data/customers"
import { getEngineers } from "@/lib/data/jobs"
import {
  getReportsOverview,
  getRepairReportList,
  getQuotationReportList,
} from "@/lib/data/analytics"
import { getInventoryValuation, getLowStockCount } from "@/lib/data/inventory"
import { PageHeader } from "@/components/ui/page-header"
import { MetricCard } from "@/components/ui/metric-card"
import { Tabs } from "@/components/ui/tabs"
import { Table } from "@/components/ui/table"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { StatusBadge, QuotationStatusBadge } from "@/components/ui/badge"
import { T } from "@/components/ui/T"
import { formatCurrency } from "@/lib/utils"
import {
  JOB_STATUS_LABELS,
  QUOTATION_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
} from "@/types"
import type { JobStatus, QuotationStatus, Role } from "@/types"

const JOB_STATUSES = Object.keys(JOB_STATUS_LABELS) as JobStatus[]
const QUOTATION_STATUSES = Object.keys(QUOTATION_STATUS_LABELS) as QuotationStatus[]

interface ReportsSearchParams {
  tab?: string
  from?: string
  to?: string
  customerId?: string
  engineerId?: string
  status?: string
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<ReportsSearchParams>
}) {
  const session = await auth()
  if (!canAccess(session!.user.role as Role, "reports")) redirect("/dashboard")
  const companyId = session!.user.companyId as string

  const params = await searchParams
  const { tab = "overview", from, to, customerId, engineerId, status } = params
  const activeTab = ["overview", "repair-reports", "quotations"].includes(tab) ? tab : "overview"

  return (
    <div>
      <PageHeader
        title={<T k="reports" />}
        subtitle={<T k="reportsDesc" />}
      />

      <div className="mb-4">
        <Tabs
          tabs={[
            { id: "overview", label: <T k="overview" /> },
            { id: "repair-reports", label: <T k="repairReports" /> },
            { id: "quotations", label: <T k="quotations" /> },
          ]}
          activeTab={activeTab}
          pathPrefix="/reports"
        />
      </div>

      {activeTab === "overview" && <OverviewTab companyId={companyId} />}
      {activeTab === "repair-reports" && (
        <RepairReportsTab
          companyId={companyId}
          filters={{ from, to, customerId, engineerId, status }}
        />
      )}
      {activeTab === "quotations" && (
        <QuotationsTab
          companyId={companyId}
          filters={{ from, to, customerId, engineerId, status }}
        />
      )}
    </div>
  )
}

async function OverviewTab({ companyId }: { companyId: string }) {
  const [overview, valuation, lowStockCount] = await Promise.all([
    getReportsOverview(companyId),
    getInventoryValuation(companyId),
    getLowStockCount(companyId),
  ])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label={<T k="totalJobs" />}
          value={overview.jobCount}
          icon={<ClipboardList className="h-5 w-5 text-blue-600" />}
        />
        <MetricCard
          label={<T k="completedJobs" />}
          value={overview.deliveredCount}
          icon={<ClipboardList className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50"
        />
        <MetricCard
          label={<T k="repairReports" />}
          value={overview.repairReportCount}
          icon={<FileText className="h-5 w-5 text-indigo-600" />}
          iconBg="bg-indigo-50"
        />
        <MetricCard
          label={<T k="quotations" />}
          value={overview.quotationCount}
          icon={<FileText className="h-5 w-5 text-purple-600" />}
          iconBg="bg-purple-50"
        />
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900"><T k="inventoryReports" /></h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            label={<T k="inventoryValuationCost" />}
            value={formatCurrency(valuation.totalCostValue)}
            icon={<Boxes className="h-5 w-5 text-blue-600" />}
            href="/inventory/reports?tab=valuation"
          />
          <MetricCard
            label={<T k="lowStockItems" />}
            value={lowStockCount}
            icon={<AlertTriangle className="h-5 w-5 text-orange-600" />}
            iconBg="bg-orange-50"
            href="/inventory/reports?tab=low-stock"
          />
          <MetricCard
            label={<T k="stockMovements" />}
            value={<T k="viewReport" />}
            icon={<ArrowLeftRight className="h-5 w-5 text-slate-600" />}
            iconBg="bg-slate-100"
            href="/inventory/reports?tab=movements"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-900"><T k="productivity" /></h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            label={<T k="engineerProductivity" />}
            value={<T k="viewReport" />}
            icon={<TrendingUp className="h-5 w-5 text-blue-600" />}
            href="/reports/engineers"
          />
        </div>
      </div>
    </div>
  )
}

async function RepairReportsTab({
  companyId,
  filters,
}: {
  companyId: string
  filters: { from?: string; to?: string; customerId?: string; engineerId?: string; status?: string }
}) {
  const { from, to, customerId, engineerId, status } = filters
  const validStatus = JOB_STATUSES.includes(status as JobStatus) ? status : undefined

  const [reports, customers, engineers] = await Promise.all([
    getRepairReportList(companyId, { from, to, customerId, engineerId, status: validStatus }),
    getCustomerOptions(companyId),
    getEngineers(companyId),
  ])

  const csvParams = new URLSearchParams()
  if (from) csvParams.set("from", from)
  if (to) csvParams.set("to", to)
  if (customerId) csvParams.set("customerId", customerId)
  if (engineerId) csvParams.set("engineerId", engineerId)
  if (validStatus) csvParams.set("status", validStatus)

  const hasFilters = Boolean(from || to || customerId || engineerId || status)

  return (
    <div className="space-y-4">
      <form method="GET" className="flex flex-wrap gap-2">
        <input type="hidden" name="tab" value="repair-reports" />
        <Input name="from" type="date" defaultValue={from ?? ""} className="w-44" aria-label="From date" />
        <Input name="to" type="date" defaultValue={to ?? ""} className="w-44" aria-label="To date" />
        <Select name="customerId" defaultValue={customerId ?? ""} className="w-52">
          <option value=""><T k="allCustomers" /></option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
          ))}
        </Select>
        <Select name="engineerId" defaultValue={engineerId ?? ""} className="w-52">
          <option value=""><T k="allEngineers" /></option>
          {engineers.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </Select>
        <Select name="status" defaultValue={validStatus ?? ""} className="w-52">
          <option value=""><T k="allStatuses" /></option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>
          ))}
        </Select>
        <Button type="submit" variant="secondary"><T k="filter" /></Button>
        {hasFilters && (
          <Link href="/reports?tab=repair-reports">
            <Button variant="ghost"><T k="clear" /></Button>
          </Link>
        )}
        <a href={`/api/reports/repair-reports/csv?${csvParams.toString()}`}>
          <Button type="button" variant="outline" icon={<Download className="h-3.5 w-3.5" />}>
            <T k="exportCsv" />
          </Button>
        </a>
      </form>

      <Table
        columns={[
          {
            key: "jobNumber",
            label: <T k="jobNumber" />,
            render: (row) => (
              <Link href={`/jobs/${row.jobId}/report`} className="font-mono text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">
                {row.jobNumber}
              </Link>
            ),
          },
          { key: "customer", label: <T k="customer" />, render: (row) => <span className="text-sm text-slate-900">{row.customer.name}</span> },
          { key: "engineer", label: <T k="engineer" />, render: (row) => <span className="text-sm text-slate-600">{row.assignedTo.name}</span> },
          { key: "serviceType", label: <T k="serviceType" />, render: (row) => <span className="text-sm text-slate-600">{SERVICE_TYPE_LABELS[row.serviceType]}</span> },
          { key: "status", label: <T k="status" />, render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "createdAt", label: <T k="reportDate" />,
            render: (row) => <span className="text-xs text-slate-500 whitespace-nowrap">{format(new Date(row.createdAt), "dd MMM yyyy")}</span>,
          },
          {
            key: "totalCost", label: <T k="totalCost" />, className: "text-right", headerClassName: "text-right",
            render: (row) => <span className="font-medium">{formatCurrency(row.totalCost)}</span>,
          },
          {
            key: "pdf", label: "",
            render: (row) => (
              <a href={`/api/jobs/${row.jobId}/report/pdf`} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="ghost" size="sm" icon={<Download className="h-3.5 w-3.5" />}>
                  <T k="pdf" />
                </Button>
              </a>
            ),
          },
        ]}
        data={reports}
        keyExtractor={(row) => row.id}
        emptyTitle={<T k="noRepairReportsFound" />}
        emptyDescription={<T k="noRepairReportsDesc" />}
      />
    </div>
  )
}

async function QuotationsTab({
  companyId,
  filters,
}: {
  companyId: string
  filters: { from?: string; to?: string; customerId?: string; engineerId?: string; status?: string }
}) {
  const { from, to, customerId, engineerId, status } = filters
  const validStatus = QUOTATION_STATUSES.includes(status as QuotationStatus) ? status : undefined

  const [quotations, customers, engineers] = await Promise.all([
    getQuotationReportList(companyId, { from, to, customerId, engineerId, status: validStatus }),
    getCustomerOptions(companyId),
    getEngineers(companyId),
  ])

  const csvParams = new URLSearchParams()
  if (from) csvParams.set("from", from)
  if (to) csvParams.set("to", to)
  if (customerId) csvParams.set("customerId", customerId)
  if (engineerId) csvParams.set("engineerId", engineerId)
  if (validStatus) csvParams.set("status", validStatus)

  const hasFilters = Boolean(from || to || customerId || engineerId || status)

  return (
    <div className="space-y-4">
      <form method="GET" className="flex flex-wrap gap-2">
        <input type="hidden" name="tab" value="quotations" />
        <Input name="from" type="date" defaultValue={from ?? ""} className="w-44" aria-label="From date" />
        <Input name="to" type="date" defaultValue={to ?? ""} className="w-44" aria-label="To date" />
        <Select name="customerId" defaultValue={customerId ?? ""} className="w-52">
          <option value=""><T k="allCustomers" /></option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
          ))}
        </Select>
        <Select name="engineerId" defaultValue={engineerId ?? ""} className="w-52">
          <option value=""><T k="allStaff" /></option>
          {engineers.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </Select>
        <Select name="status" defaultValue={validStatus ?? ""} className="w-52">
          <option value=""><T k="allStatuses" /></option>
          {QUOTATION_STATUSES.map((s) => (
            <option key={s} value={s}>{QUOTATION_STATUS_LABELS[s]}</option>
          ))}
        </Select>
        <Button type="submit" variant="secondary"><T k="filter" /></Button>
        {hasFilters && (
          <Link href="/reports?tab=quotations">
            <Button variant="ghost"><T k="clear" /></Button>
          </Link>
        )}
        <a href={`/api/reports/quotations/csv?${csvParams.toString()}`}>
          <Button type="button" variant="outline" icon={<Download className="h-3.5 w-3.5" />}>
            <T k="exportCsv" />
          </Button>
        </a>
      </form>

      <Table
        columns={[
          {
            key: "quotationNumber",
            label: <T k="quotationNumber" />,
            render: (row) => (
              <Link href={`/quotations/${row.id}`} className="font-mono text-sm font-medium text-slate-900 hover:text-blue-600 transition-colors">
                {row.quotationNumber}
              </Link>
            ),
          },
          { key: "customer", label: <T k="customer" />, render: (row) => <span className="text-sm text-slate-900">{row.customer.name}</span> },
          { key: "createdBy", label: <T k="createdBy" />, render: (row) => <span className="text-sm text-slate-600">{row.createdBy.name}</span> },
          { key: "serviceType", label: <T k="serviceType" />, render: (row) => <span className="text-sm text-slate-600">{SERVICE_TYPE_LABELS[row.serviceType]}</span> },
          { key: "status", label: <T k="status" />, render: (row) => <QuotationStatusBadge status={row.status} /> },
          {
            key: "createdAt", label: <T k="date" />,
            render: (row) => <span className="text-xs text-slate-500 whitespace-nowrap">{format(new Date(row.createdAt), "dd MMM yyyy")}</span>,
          },
          {
            key: "totalCost", label: <T k="totalCost" />, className: "text-right", headerClassName: "text-right",
            render: (row) => <span className="font-medium">{formatCurrency(Number(row.totalCost))}</span>,
          },
          {
            key: "pdf", label: "",
            render: (row) => (
              <a href={`/api/quotations/${row.id}/pdf`} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="ghost" size="sm" icon={<Download className="h-3.5 w-3.5" />}>
                  <T k="pdf" />
                </Button>
              </a>
            ),
          },
        ]}
        data={quotations}
        keyExtractor={(row) => row.id}
        emptyTitle={<T k="noQuotationsFoundReport" />}
        emptyDescription={<T k="noQuotationsReportsDesc" />}
      />
    </div>
  )
}
