import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft, FileText, Wallet, Scale, Download } from "lucide-react"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { hasAnyPermission, canViewInvoice } from "@/lib/permissions"
import {
  getSalesLedgerEntries,
  getCurrentMonthSalesTotal,
  getCurrentMonthSalesIncomeTotal,
  getUnpaidSalesBalance,
  getSalesLedgerMonthlyStatistics,
  getSalesLedgerYearRange,
} from "@/lib/data/ledger"
import { PageHeader } from "@/components/ui/page-header"
import { MetricCard } from "@/components/ui/metric-card"
import { Table } from "@/components/ui/table"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SalesPaymentStatusBadge } from "@/components/ui/badge"
import { T, TInput } from "@/components/ui/T"
import { SalesLedgerAddButton } from "@/components/ledger/SalesLedgerAddButton"
import { SalesLedgerActions } from "@/components/ledger/SalesLedgerActions"
import { formatCurrency } from "@/lib/utils"
import type { Role, SalesPaymentStatus } from "@/types"

const PAYMENT_STATUSES: SalesPaymentStatus[] = ["UNPAID", "PARTIAL", "PAID"]

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => format(new Date(2000, i, 1), "MMMM"))

export default async function SalesLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; customer?: string; paymentStatus?: string; status?: string; salesYear?: string; salesMonth?: string }>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  const permissions = session!.user.modulePermissions as string[]
  // Sales Ledger specifically — a Shop-Account-only user (ledger.shop.*) must not
  // reach this page just because they hold some other leaf under "ledger.".
  if (!hasAnyPermission(role, permissions, "ledger.sales.")) redirect("/dashboard")
  const companyId = session!.user.companyId as string
  // Phase 2 — Business Traceability: a row's Invoice No is only ever a
  // clickable link into Invoice Detail for a viewer who can actually see
  // that module — otherwise it's shown as plain text (never hidden — the
  // number itself isn't sensitive, only the target page's contents are).
  const canLinkToInvoice = canViewInvoice(role, permissions)

  const { from, to, customer, paymentStatus, status, salesYear, salesMonth } = await searchParams
  const validPaymentStatus = PAYMENT_STATUSES.includes(paymentStatus as SalesPaymentStatus)
    ? (paymentStatus as SalesPaymentStatus)
    : undefined
  const archived = status === "archived"

  const now = new Date()
  const { minYear, maxYear } = await getSalesLedgerYearRange(companyId)
  const requestedYear = Number(salesYear)
  const selectedYear = Number.isInteger(requestedYear) && requestedYear >= minYear && requestedYear <= maxYear ? requestedYear : maxYear
  const yearOptions = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i)

  const requestedMonth = Number(salesMonth)
  const selectedMonth = Number.isInteger(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12 ? requestedMonth : now.getMonth() + 1

  const [entries, currentMonthSales, currentMonthIncome, totalOutstandingBalance, monthlyStats] = await Promise.all([
    getSalesLedgerEntries(companyId, {
      from,
      to,
      customerName: customer || undefined,
      paymentStatus: validPaymentStatus,
      archived,
    }),
    // The three top KPI cards are always current-state, company-wide figures —
    // independent of the list filters below (from/to/customer/paymentStatus/status
    // only ever narrow the transaction table beneath them) and independent of the
    // Monthly Sales Statistics year/month filter too.
    getCurrentMonthSalesTotal(companyId),
    getCurrentMonthSalesIncomeTotal(companyId),
    getUnpaidSalesBalance(companyId),
    getSalesLedgerMonthlyStatistics(companyId, selectedYear, selectedMonth),
  ])
  const monthStat = monthlyStats[0]

  const hasFilters = Boolean(from || to || customer || paymentStatus || status)

  // Build export URL with current active filters
  const exportParams = new URLSearchParams()
  if (from) exportParams.set("from", from)
  if (to) exportParams.set("to", to)
  if (customer) exportParams.set("customer", customer)
  if (validPaymentStatus) exportParams.set("paymentStatus", validPaymentStatus)
  const exportUrl = `/api/ledger/sales/export?${exportParams.toString()}`

  return (
    <div>
      <Link href="/ledger" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        <T k="ledger" />
      </Link>

      <PageHeader
        title={<T k="salesLedger" />}
        subtitle={<T k="salesLedgerDesc" />}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <a href={exportUrl}>
              <Button type="button" variant="outline" icon={<Download className="h-4 w-4" />}>
                Export Excel
              </Button>
            </a>
            <SalesLedgerAddButton />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <MetricCard
          label={<T k="currentMonthSalesLabel" />}
          value={formatCurrency(currentMonthSales)}
          icon={<FileText className="h-5 w-5 text-blue-600" />}
        />
        <MetricCard
          label={<T k="currentMonthIncomeLabel" />}
          value={formatCurrency(currentMonthIncome)}
          icon={<Wallet className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50"
        />
        <MetricCard
          label={<T k="totalOutstandingBalanceLabel" />}
          value={formatCurrency(totalOutstandingBalance)}
          icon={<Scale className="h-5 w-5 text-orange-600" />}
          iconBg="bg-orange-50"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-slate-900"><T k="monthlySalesStatistics" /></h2>
          <form method="GET" className="flex items-center gap-2">
            {from && <input type="hidden" name="from" value={from} />}
            {to && <input type="hidden" name="to" value={to} />}
            {customer && <input type="hidden" name="customer" value={customer} />}
            {validPaymentStatus && <input type="hidden" name="paymentStatus" value={validPaymentStatus} />}
            {status && <input type="hidden" name="status" value={status} />}
            <label className="text-xs text-slate-500"><T k="monthlyStatsYearLabel" /></label>
            <Select name="salesYear" defaultValue={String(selectedYear)} className="w-24">
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <label className="text-xs text-slate-500"><T k="monthlyStatsMonthLabel" /></label>
            <Select name="salesMonth" defaultValue={String(selectedMonth)} className="w-36">
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" className="text-xs"><T k="filter" /></Button>
          </form>
        </div>

        {(() => {
          const monthStart = new Date(selectedYear, selectedMonth - 1, 1)
          const monthEnd = new Date(selectedYear, selectedMonth, 0)
          const monthHref = `/ledger/sales?from=${format(monthStart, "yyyy-MM-dd")}&to=${format(monthEnd, "yyyy-MM-dd")}`
          return (
            <div>
              <Link href={monthHref} className="mb-3 inline-block text-sm font-medium text-blue-600 hover:underline">
                {format(monthStart, "MMMM yyyy")}
              </Link>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500"><T k="monthlyStatsSalesLabel" /></p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{formatCurrency(monthStat.sales)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500"><T k="monthlyStatsCollectedLabel" /></p>
                  <p className="mt-1 text-xl font-bold text-green-700">{formatCurrency(monthStat.collected)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500"><T k="monthlyStatsBalanceLabel" /></p>
                  <p className={`mt-1 text-xl font-bold ${monthStat.balance > 0 ? "text-red-700" : "text-slate-500"}`}>{formatCurrency(monthStat.balance)}</p>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      <form method="GET" className="filter-bar flex flex-wrap items-center gap-2 mb-4">
        {salesYear && <input type="hidden" name="salesYear" value={salesYear} />}
        {salesMonth && <input type="hidden" name="salesMonth" value={salesMonth} />}
        <TInput name="customer" type="search" placeholderKey="searchSalesLedgerPlaceholder" defaultValue={customer ?? ""} className="w-56" />
        <label className="text-xs text-slate-500"><T k="fromDate" /></label>
        <Input name="from" type="date" defaultValue={from ?? ""} className="w-40" />
        <label className="text-xs text-slate-500"><T k="toDate" /></label>
        <Input name="to" type="date" defaultValue={to ?? ""} className="w-40" />
        <Select name="paymentStatus" defaultValue={validPaymentStatus ?? ""} className="w-48">
          <option value=""><T k="allPaymentStatuses" /></option>
          <option value="UNPAID"><T k="unpaid" /></option>
          <option value="PARTIAL"><T k="partial" /></option>
          <option value="PAID"><T k="paid" /></option>
        </Select>
        <Select name="status" defaultValue={status ?? ""} className="w-40">
          <option value=""><T k="statusActive" /></option>
          <option value="archived"><T k="statusArchived" /></option>
        </Select>
        <Button type="submit" variant="secondary"><T k="filter" /></Button>
        {hasFilters && (
          <Link href="/ledger/sales">
            <Button variant="ghost"><T k="clear" /></Button>
          </Link>
        )}
      </form>

      <Table
        columns={[
          {
            key: "date",
            label: <T k="date" />,
            render: (row) => <span className="text-xs text-slate-500 whitespace-nowrap">{format(new Date(row.date), "dd MMM yyyy")}</span>,
          },
          { key: "customerName", label: <T k="salesCustomerName" />, render: (row) => <span className="text-sm font-medium text-slate-900">{row.customerName}</span> },
          {
            key: "orderNo",
            label: <T k="orderNo" />,
            render: (row) => (
              <Link href={`/ledger/sales/${row.id}`} className="text-xs text-blue-600 hover:underline">
                {row.orderNo ?? row.id.slice(0, 8)}
              </Link>
            ),
          },
          {
            key: "invoiceNo",
            label: <T k="invoiceNoLabel" />,
            render: (row) =>
              row.invoice ? (
                canLinkToInvoice ? (
                  <Link href={`/quotations/invoices/${row.invoice.id}`} className="font-mono text-xs text-blue-600 hover:underline">
                    {row.invoice.invoiceNumber}
                  </Link>
                ) : (
                  <span className="font-mono text-xs text-slate-500">{row.invoice.invoiceNumber}</span>
                )
              ) : (
                <span className="text-xs text-slate-300">—</span>
              ),
          },
          {
            key: "invoiceAmount",
            label: <T k="invoiceAmount" />,
            className: "text-right",
            headerClassName: "text-right",
            render: (row) => <span className="font-medium">{formatCurrency(row.invoiceAmount)}</span>,
          },
          {
            key: "amountReceived",
            label: <T k="amountReceived" />,
            className: "text-right",
            headerClassName: "text-right",
            render: (row) => <span className="text-green-700">{formatCurrency(row.amountReceived)}</span>,
          },
          {
            key: "balance",
            label: <T k="balance" />,
            className: "text-right",
            headerClassName: "text-right",
            render: (row) => <span className={row.balance > 0 ? "text-red-700 font-medium" : "text-slate-500"}>{formatCurrency(row.balance)}</span>,
          },
          { key: "paymentStatus", label: <T k="paymentStatus" />, render: (row) => <SalesPaymentStatusBadge status={row.paymentStatus} /> },
          { key: "remark", label: <T k="remark" />, render: (row) => <span className="text-xs text-slate-500 whitespace-normal">{row.remark ?? "—"}</span> },
          {
            key: "actions",
            label: "",
            render: (row) => <SalesLedgerActions entry={row} />,
          },
        ]}
        data={entries}
        keyExtractor={(row) => row.id}
        emptyTitle={<T k="noSalesLedgerFound" />}
        emptyDescription={<T k="noSalesLedgerDesc" />}
      />
    </div>
  )
}
