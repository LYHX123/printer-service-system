import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft, TrendingUp, TrendingDown, Scale } from "lucide-react"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { canAccess } from "@/lib/permissions"
import { getLedgerEntries, getLedgerCategories } from "@/lib/data/ledger"
import { PageHeader } from "@/components/ui/page-header"
import { MetricCard } from "@/components/ui/metric-card"
import { Table } from "@/components/ui/table"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { LedgerEntryTypeBadge, PaymentMethodLabel } from "@/components/ui/badge"
import { T } from "@/components/ui/T"
import { LedgerAddButtons } from "@/components/ledger/LedgerAddButtons"
import { LedgerEntryActions } from "@/components/ledger/LedgerEntryActions"
import { formatCurrency } from "@/lib/utils"
import type { LedgerEntryType, Role } from "@/types"

const TYPES: LedgerEntryType[] = ["INCOME", "EXPENSE"]

export default async function IncomeExpenseBookPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string; categoryId?: string; status?: string }>
}) {
  const session = await auth()
  if (!canAccess(session!.user.role as Role, "ledger")) redirect("/dashboard")
  const companyId = session!.user.companyId as string

  const { from, to, type, categoryId, status } = await searchParams
  const validType = TYPES.includes(type as LedgerEntryType) ? (type as LedgerEntryType) : undefined
  const archived = status === "archived"

  const [entries, categories] = await Promise.all([
    getLedgerEntries(companyId, { from, to, type: validType, categoryId, archived }),
    getLedgerCategories(companyId),
  ])

  const totalIncome = entries.filter((e) => e.type === "INCOME").reduce((sum, e) => sum + e.amount, 0)
  const totalExpense = entries.filter((e) => e.type === "EXPENSE").reduce((sum, e) => sum + e.amount, 0)
  const hasFilters = Boolean(from || to || type || categoryId || status)

  return (
    <div>
      <Link href="/ledger" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4">
        <ChevronLeft className="h-4 w-4" />
        <T k="ledger" />
      </Link>

      <PageHeader
        title={<T k="incomeExpenseBook" />}
        subtitle={<T k="incomeExpenseBookDesc" />}
        actions={<LedgerAddButtons categories={categories} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <MetricCard
          label={<T k="totalIncome" />}
          value={formatCurrency(totalIncome)}
          icon={<TrendingUp className="h-5 w-5 text-green-600" />}
          iconBg="bg-green-50"
        />
        <MetricCard
          label={<T k="totalExpense" />}
          value={formatCurrency(totalExpense)}
          icon={<TrendingDown className="h-5 w-5 text-red-600" />}
          iconBg="bg-red-50"
        />
        <MetricCard
          label={<T k="balance" />}
          value={formatCurrency(totalIncome - totalExpense)}
          icon={<Scale className="h-5 w-5 text-blue-600" />}
        />
      </div>

      <form method="GET" className="flex flex-wrap items-center gap-2 mb-4">
        <label className="text-xs text-slate-500"><T k="fromDate" /></label>
        <Input name="from" type="date" defaultValue={from ?? ""} className="w-40" />
        <label className="text-xs text-slate-500"><T k="toDate" /></label>
        <Input name="to" type="date" defaultValue={to ?? ""} className="w-40" />
        <Select name="type" defaultValue={validType ?? ""} className="w-44">
          <option value=""><T k="allTypes" /></option>
          <option value="INCOME"><T k="income" /></option>
          <option value="EXPENSE"><T k="expense" /></option>
        </Select>
        <Select name="categoryId" defaultValue={categoryId ?? ""} className="w-52">
          <option value=""><T k="allCategories" /></option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select name="status" defaultValue={status ?? ""} className="w-40">
          <option value=""><T k="statusActive" /></option>
          <option value="archived"><T k="statusArchived" /></option>
        </Select>
        <Button type="submit" variant="secondary"><T k="filter" /></Button>
        {hasFilters && (
          <Link href="/ledger/income-expense">
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
          { key: "type", label: <T k="type" />, render: (row) => <LedgerEntryTypeBadge type={row.type} /> },
          { key: "category", label: <T k="category" />, render: (row) => <span className="text-sm text-slate-900">{row.category.name}</span> },
          {
            key: "amount",
            label: <T k="amount" />,
            className: "text-right",
            headerClassName: "text-right",
            render: (row) => (
              <span className={`font-medium ${row.type === "INCOME" ? "text-green-700" : "text-red-700"}`}>
                {row.type === "INCOME" ? "+" : "-"}{formatCurrency(row.amount)}
              </span>
            ),
          },
          {
            key: "paymentMethod",
            label: <T k="paymentMethod" />,
            render: (row) => <span className="text-sm text-slate-600"><PaymentMethodLabel method={row.paymentMethod} /></span>,
          },
          { key: "referenceNo", label: <T k="referenceNo" />, render: (row) => <span className="text-xs text-slate-500">{row.referenceNo ?? "—"}</span> },
          { key: "remark", label: <T k="remark" />, render: (row) => <span className="text-xs text-slate-500 whitespace-normal">{row.remark ?? "—"}</span> },
          { key: "createdBy", label: <T k="createdBy" />, render: (row) => <span className="text-xs text-slate-500">{row.createdBy.name}</span> },
          {
            key: "actions",
            label: "",
            render: (row) => <LedgerEntryActions entry={row} categories={categories} />,
          },
        ]}
        data={entries}
        keyExtractor={(row) => row.id}
        emptyTitle={<T k="noLedgerEntriesFound" />}
        emptyDescription={<T k="noLedgerEntriesDesc" />}
      />
    </div>
  )
}
