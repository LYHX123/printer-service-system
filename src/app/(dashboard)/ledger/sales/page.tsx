import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft, FileText, Wallet, Scale, Download, Calendar } from "lucide-react"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { hasAnyPermission, canViewInvoice, canEditLedgerEntryPerm, canDeleteLedgerEntryPerm } from "@/lib/permissions"
import {
  getSalesLedgerEntries,
  getCurrentMonthSalesTotal,
  getCurrentMonthSalesIncomeTotal,
  getUnpaidSalesBalance,
  getSalesLedgerMonthlyStatistics,
  getSalesLedgerYearRange,
} from "@/lib/data/ledger"
import { isCapacitorAppRequest } from "@/lib/platform/app-mode"
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
import { AppStatCard } from "@/components/app-ui/AppStatCard"
import { AppDetailSection } from "@/components/app-ui/AppDetailSection"
import { AppDetailRow } from "@/components/app-ui/AppDetailRow"
import { AppCard } from "@/components/app-ui/AppCard"
import { AppEmptyState } from "@/components/app-ui/AppEmptyState"
import { AppListMeta } from "@/components/app-ui/AppListMeta"
import { AppMoneyValue } from "@/components/app-ui/AppMoneyValue"
import { formatCurrency } from "@/lib/utils"
import { resolveSalesLedgerInvoiceNo } from "@/lib/ledger-utils"
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
  const canEdit = canEditLedgerEntryPerm(role, permissions, "sales")
  const canDelete = canDeleteLedgerEntryPerm(role, permissions, "sales")

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

  const monthStart = new Date(selectedYear, selectedMonth - 1, 1)
  const monthEnd = new Date(selectedYear, selectedMonth, 0)
  const monthHref = `/ledger/sales?from=${format(monthStart, "yyyy-MM-dd")}&to=${format(monthEnd, "yyyy-MM-dd")}`

  const isAppMode = await isCapacitorAppRequest()

  if (isAppMode) {
    return (
      <div className="space-y-4">
        <Link href="/ledger" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 active:text-slate-800">
          <ChevronLeft className="h-4 w-4" />
          <T k="ledger" />
        </Link>

        <div className="grid grid-cols-2 gap-2.5">
          <AppStatCard label={<T k="currentMonthSalesLabel" />} value={formatCurrency(currentMonthSales)} valueClassName="text-sm" icon={<FileText className="h-4 w-4 text-blue-600" />} />
          <AppStatCard label={<T k="currentMonthIncomeLabel" />} value={formatCurrency(currentMonthIncome)} valueClassName="text-sm" icon={<Wallet className="h-4 w-4 text-green-600" />} iconBg="bg-green-50" />
        </div>
        <AppStatCard label={<T k="totalOutstandingBalanceLabel" />} value={formatCurrency(totalOutstandingBalance)} valueClassName="text-sm" icon={<Scale className="h-4 w-4 text-orange-600" />} iconBg="bg-orange-50" />

        <AppDetailSection title={<T k="monthlySalesStatistics" />}>
          <Link href={monthHref} className="mb-2 inline-block text-sm font-medium text-blue-600">
            {format(monthStart, "MMMM yyyy")}
          </Link>
          <AppDetailRow label={<T k="monthlyStatsSalesLabel" />} value={formatCurrency(monthStat.sales)} />
          <AppDetailRow label={<T k="monthlyStatsCollectedLabel" />} value={<span className="text-green-700">{formatCurrency(monthStat.collected)}</span>} />
          <AppDetailRow
            label={<T k="monthlyStatsBalanceLabel" />}
            value={<span className={monthStat.balance > 0 ? "text-red-700" : undefined}>{formatCurrency(monthStat.balance)}</span>}
          />
          <form method="GET" className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            {from && <input type="hidden" name="from" value={from} />}
            {to && <input type="hidden" name="to" value={to} />}
            {customer && <input type="hidden" name="customer" value={customer} />}
            {validPaymentStatus && <input type="hidden" name="paymentStatus" value={validPaymentStatus} />}
            {status && <input type="hidden" name="status" value={status} />}
            <Select name="salesYear" defaultValue={String(selectedYear)} className="h-10 flex-1">
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
            <Select name="salesMonth" defaultValue={String(selectedMonth)} className="h-10 flex-1">
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>{name}</option>
              ))}
            </Select>
            <Button type="submit" variant="secondary" size="sm"><T k="filter" /></Button>
          </form>
        </AppDetailSection>

        <div className="flex gap-2">
          <SalesLedgerAddButton />
          <a href={exportUrl} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="outline" size="sm" icon={<Download className="h-4 w-4" />}>
              <T k="exportExcel" />
            </Button>
          </a>
        </div>

        <form method="GET" className="space-y-2">
          {salesYear && <input type="hidden" name="salesYear" value={salesYear} />}
          {salesMonth && <input type="hidden" name="salesMonth" value={salesMonth} />}
          <TInput name="customer" type="search" defaultValue={customer ?? ""} className="h-11" />
          <div className="grid grid-cols-2 gap-2">
            <Input name="from" type="date" defaultValue={from ?? ""} className="h-11" />
            <Input name="to" type="date" defaultValue={to ?? ""} className="h-11" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select name="paymentStatus" defaultValue={validPaymentStatus ?? ""} className="h-11">
              <option value=""><T k="allPaymentStatuses" /></option>
              <option value="UNPAID"><T k="unpaid" /></option>
              <option value="PARTIAL"><T k="partial" /></option>
              <option value="PAID"><T k="paid" /></option>
            </Select>
            <Select name="status" defaultValue={status ?? ""} className="h-11">
              <option value=""><T k="statusActive" /></option>
              <option value="archived"><T k="statusArchived" /></option>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" size="sm" className="flex-1"><T k="filter" /></Button>
            {hasFilters && (
              <Link href="/ledger/sales" className="flex-1">
                <Button variant="ghost" size="sm" className="w-full"><T k="clear" /></Button>
              </Link>
            )}
          </div>
        </form>

        {entries.length === 0 ? (
          <AppEmptyState icon={<FileText className="h-8 w-8" />} title={<T k="noSalesLedgerFound" />} description={<T k="noSalesLedgerDesc" />} />
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <AppCard
                key={entry.id}
                href={`/ledger/sales/${entry.id}`}
                trailing={<SalesLedgerActions entry={entry} canEdit={canEdit} canDelete={canDelete} variant="menu" />}
              >
                <div className="flex items-center justify-between gap-2">
                  <AppListMeta icon={<Calendar />}>{format(new Date(entry.date), "dd MMM yyyy")}</AppListMeta>
                  <SalesPaymentStatusBadge status={entry.paymentStatus} />
                </div>
                <p className="mt-1 truncate text-[14px] font-semibold text-slate-900">{entry.customerName}</p>
                <p className="truncate text-xs text-slate-500 font-mono">{resolveSalesLedgerInvoiceNo(entry) ?? "—"}</p>
                <div className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-500">
                    <T k="amountReceived" />: <AppMoneyValue amount={entry.amountReceived} className="text-xs text-green-700" />
                  </span>
                  <AppMoneyValue amount={entry.balance} className={entry.balance > 0 ? "text-sm text-red-700" : "text-sm text-slate-500"} />
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
      <Link href="/ledger" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        <T k="ledger" />
      </Link>

      <PageHeader
        title={<T k="salesLedger" />}
        subtitle={<T k="salesLedgerDesc" />}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Desktop only (this branch runs after the isAppMode early-return above) —
                no target="_blank" needed: DownloadGuard, which is what actually needs
                it, never mounts on desktop. */}
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
        <TInput name="customer" type="search" defaultValue={customer ?? ""} className="w-56" />
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
                <span className="font-mono text-xs text-slate-500">{resolveSalesLedgerInvoiceNo(row) ?? "—"}</span>
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
            render: (row) => <SalesLedgerActions entry={row} canEdit={canEdit} canDelete={canDelete} />,
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
