import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft, TrendingUp, TrendingDown, Scale, Download, Wallet, Calendar } from "lucide-react"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { hasAnyPermission, canAllocateReceipt } from "@/lib/permissions"
import { getLedgerEntries, getLedgerCategories, getLedgerMonthStats } from "@/lib/data/ledger"
import { isCapacitorAppRequest } from "@/lib/platform/app-mode"
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
import { AppStatCard } from "@/components/app-ui/AppStatCard"
import { AppCard } from "@/components/app-ui/AppCard"
import { AppEmptyState } from "@/components/app-ui/AppEmptyState"
import { AppListMeta } from "@/components/app-ui/AppListMeta"
import { AppMoneyValue } from "@/components/app-ui/AppMoneyValue"
import { formatCurrency } from "@/lib/utils"
import type { LedgerEntryType, Role } from "@/types"

const TYPES: LedgerEntryType[] = ["INCOME", "EXPENSE"]

export default async function IncomeExpenseBookPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; type?: string; categoryId?: string; search?: string }>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  const permissions = session!.user.modulePermissions as string[]
  // General Ledger specifically — a Shop-Account-only user must not reach this
  // page just because they hold some other leaf under "ledger.".
  if (!hasAnyPermission(role, permissions, "ledger.general.")) redirect("/dashboard")
  const companyId = session!.user.companyId as string
  const canAllocate = canAllocateReceipt(role, permissions)

  const { from, to, type, categoryId, search } = await searchParams
  const validType = TYPES.includes(type as LedgerEntryType) ? (type as LedgerEntryType) : undefined

  const [entries, categories, monthStats] = await Promise.all([
    getLedgerEntries(companyId, { from, to, type: validType, categoryId, search }),
    getLedgerCategories(companyId),
    getLedgerMonthStats(companyId),
  ])

  const hasFilters = Boolean(from || to || type || categoryId || search)

  // Build export URL with current active filters
  const exportParams = new URLSearchParams()
  if (from) exportParams.set("from", from)
  if (to) exportParams.set("to", to)
  if (validType) exportParams.set("type", validType)
  if (categoryId) exportParams.set("categoryId", categoryId)
  if (search) exportParams.set("search", search)
  const exportUrl = `/api/ledger/export?${exportParams.toString()}`

  const paymentMethodColumnLabel =
    validType === "INCOME" ? <T k="receivingMethod" /> : validType === "EXPENSE" ? <T k="paymentMethod" /> : <T k="paymentOrReceivingMethod" />

  const isAppMode = await isCapacitorAppRequest()

  if (isAppMode) {
    return (
      <div className="space-y-4">
        <Link href="/ledger" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 active:text-slate-800">
          <ChevronLeft className="h-4 w-4" />
          <T k="ledger" />
        </Link>

        <div className="grid grid-cols-2 gap-2.5">
          <AppStatCard label={<T k="totalIncome" />} value={formatCurrency(monthStats.income)} valueClassName="text-sm" icon={<TrendingUp className="h-4 w-4 text-green-600" />} iconBg="bg-green-50" />
          <AppStatCard label={<T k="totalExpense" />} value={formatCurrency(monthStats.expense)} valueClassName="text-sm" icon={<TrendingDown className="h-4 w-4 text-red-600" />} iconBg="bg-red-50" />
        </div>
        <AppStatCard label={<T k="balance" />} value={formatCurrency(monthStats.income - monthStats.expense)} valueClassName="text-sm" icon={<Scale className="h-4 w-4 text-blue-600" />} />

        <LedgerAddButtons categories={categories} canAllocate={canAllocate} />

        <form method="GET" className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input name="from" type="date" defaultValue={from ?? ""} className="h-11" />
            <Input name="to" type="date" defaultValue={to ?? ""} className="h-11" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select name="type" defaultValue={validType ?? ""} className="h-11">
              <option value=""><T k="allTypes" /></option>
              <option value="INCOME"><T k="income" /></option>
              <option value="EXPENSE"><T k="expense" /></option>
            </Select>
            <Select name="categoryId" defaultValue={categoryId ?? ""} className="h-11">
              <option value=""><T k="allCategories" /></option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" size="sm" className="flex-1"><T k="filter" /></Button>
            {hasFilters && (
              <Link href="/ledger/income-expense" className="flex-1">
                <Button variant="ghost" size="sm" className="w-full"><T k="clear" /></Button>
              </Link>
            )}
          </div>
        </form>

        {entries.length === 0 ? (
          <AppEmptyState icon={<Wallet className="h-8 w-8" />} title={<T k="noLedgerEntriesFound" />} description={<T k="noLedgerEntriesDesc" />} />
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <AppCard
                key={entry.id}
                trailing={<LedgerEntryActions entry={entry} categories={categories} canAllocate={canAllocate} variant="menu" />}
              >
                <div className="flex items-center justify-between gap-2">
                  <AppListMeta icon={<Calendar />}>{format(new Date(entry.date), "dd MMM yyyy")}</AppListMeta>
                  <LedgerEntryTypeBadge type={entry.type} />
                </div>
                <p className="mt-1 truncate text-[14px] font-semibold text-slate-900">{entry.category.name}</p>
                {entry.remark && <p className="truncate text-xs text-slate-500">{entry.remark}</p>}
                <AppMoneyValue amount={entry.amount} sign={entry.type === "INCOME" ? "+" : "-"} className="mt-0.5 text-sm" />
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
        title={<T k="incomeExpenseBook" />}
        subtitle={<T k="incomeExpenseBookDesc" />}
        actions={<LedgerAddButtons categories={categories} canAllocate={canAllocate} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <div>
          <MetricCard
            label={<T k="totalIncome" />}
            value={formatCurrency(monthStats.income)}
            icon={<TrendingUp className="h-5 w-5 text-green-600" />}
            iconBg="bg-green-50"
          />
          <p className="mt-1.5 text-center text-xs text-slate-400"><T k="currentMonth" /></p>
        </div>
        <div>
          <MetricCard
            label={<T k="totalExpense" />}
            value={formatCurrency(monthStats.expense)}
            icon={<TrendingDown className="h-5 w-5 text-red-600" />}
            iconBg="bg-red-50"
          />
          <p className="mt-1.5 text-center text-xs text-slate-400"><T k="currentMonth" /></p>
        </div>
        <div>
          <MetricCard
            label={<T k="balance" />}
            value={formatCurrency(monthStats.income - monthStats.expense)}
            icon={<Scale className="h-5 w-5 text-blue-600" />}
          />
          <p className="mt-1.5 text-center text-xs text-slate-400"><T k="currentMonth" /></p>
        </div>
      </div>

      <form method="GET" className="filter-bar flex flex-wrap items-center gap-2 mb-4">
        <label className="text-xs text-slate-500"><T k="fromDate" /></label>
        <Input name="from" type="date" defaultValue={from ?? ""} className="w-40" />
        <label className="text-xs text-slate-500"><T k="toDate" /></label>
        <Input name="to" type="date" defaultValue={to ?? ""} className="w-40" />
        <Select name="type" defaultValue={validType ?? ""} className="w-40">
          <option value=""><T k="allTypes" /></option>
          <option value="INCOME"><T k="income" /></option>
          <option value="EXPENSE"><T k="expense" /></option>
        </Select>
        <Select name="categoryId" defaultValue={categoryId ?? ""} className="w-48">
          <option value=""><T k="allCategories" /></option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Input
          name="search"
          type="text"
          defaultValue={search ?? ""}
          placeholder="Search income or expense..."
          className="w-56"
        />
        <Button type="submit" variant="secondary"><T k="filter" /></Button>
        {hasFilters && (
          <Link href="/ledger/income-expense">
            <Button variant="ghost"><T k="clear" /></Button>
          </Link>
        )}
        {/* Desktop only (this branch runs after the isAppMode early-return above,
            which has no export link at all) — no target="_blank" needed: nothing
            here ever runs in app mode for DownloadGuard to protect. */}
        <a href={exportUrl}>
          <Button type="button" variant="outline" icon={<Download className="h-4 w-4" />}>
            Export Excel
          </Button>
        </a>
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
            label: paymentMethodColumnLabel,
            render: (row) => <span className="text-sm text-slate-600"><PaymentMethodLabel method={row.paymentMethod} /></span>,
          },
          { key: "remark", label: <T k="remark" />, render: (row) => <span className="text-xs text-slate-500 whitespace-normal">{row.remark ?? "—"}</span> },
          { key: "createdBy", label: <T k="createdBy" />, render: (row) => <span className="text-xs text-slate-500">{row.createdBy.name}</span> },
          {
            key: "actions",
            label: "",
            render: (row) => <LedgerEntryActions entry={row} categories={categories} canAllocate={canAllocate} />,
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
