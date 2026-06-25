import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft, FileText, Wallet, Scale } from "lucide-react"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { getSalesLedgerEntries } from "@/lib/data/ledger"
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

export default async function SalesLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; customer?: string; paymentStatus?: string; status?: string }>
}) {
  const session = await auth()
  if (!canAccess(session!.user.role as Role, "ledger")) redirect("/dashboard")
  const companyId = session!.user.companyId as string

  const { from, to, customer, paymentStatus, status } = await searchParams
  const validPaymentStatus = PAYMENT_STATUSES.includes(paymentStatus as SalesPaymentStatus)
    ? (paymentStatus as SalesPaymentStatus)
    : undefined
  const archived = status === "archived"

  const entries = await getSalesLedgerEntries(companyId, {
    from,
    to,
    customerName: customer || undefined,
    paymentStatus: validPaymentStatus,
    archived,
  })

  const totalInvoice = entries.reduce((sum, e) => sum + e.invoiceAmount, 0)
  const totalReceived = entries.reduce((sum, e) => sum + e.amountReceived, 0)
  const totalBalance = entries.reduce((sum, e) => sum + e.balance, 0)
  const hasFilters = Boolean(from || to || customer || paymentStatus || status)

  return (
    <div>
      <Link href="/ledger" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        <T k="ledger" />
      </Link>

      <PageHeader
        title={<T k="salesLedger" />}
        subtitle={<T k="salesLedgerDesc" />}
        actions={<SalesLedgerAddButton />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <MetricCard
          label={<T k="totalInvoiceAmount" />}
          value={formatCurrency(totalInvoice)}
          icon={<FileText className="h-5 w-5 text-blue-600" />}
        />
        <MetricCard
          label={<T k="totalReceived" />}
          value={formatCurrency(totalReceived)}
          icon={<Wallet className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50"
        />
        <MetricCard
          label={<T k="totalBalance" />}
          value={formatCurrency(totalBalance)}
          icon={<Scale className="h-5 w-5 text-orange-600" />}
          iconBg="bg-orange-50"
        />
      </div>

      <form method="GET" className="flex flex-wrap items-center gap-2 mb-4">
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
          { key: "orderNo", label: <T k="orderNo" />, render: (row) => <span className="text-xs text-slate-500">{row.orderNo ?? "—"}</span> },
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
