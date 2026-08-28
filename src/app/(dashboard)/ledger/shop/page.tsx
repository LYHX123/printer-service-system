import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft, TrendingUp, TrendingDown, Scale, Download, Calendar, Wallet } from "lucide-react"
import { format } from "date-fns"
import { auth } from "@/lib/auth"
import { hasAnyPermission, canCreateLedgerEntryPerm, canEditLedgerEntryPerm, canDeleteLedgerEntryPerm } from "@/lib/permissions"
import {
  getShopAccountEntries,
  getShopAccountCategories,
  getShopAccountTotals,
  getShopAccountContributors,
} from "@/lib/data/shopAccount"
import { isCapacitorAppRequest } from "@/lib/platform/app-mode"
import { PageHeader } from "@/components/ui/page-header"
import { MetricCard } from "@/components/ui/metric-card"
import { Table } from "@/components/ui/table"
import { Select } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { LedgerEntryTypeBadge, PaymentMethodLabel } from "@/components/ui/badge"
import { T } from "@/components/ui/T"
import { ShopAccountAddButtons } from "@/components/ledger/ShopAccountAddButtons"
import { ShopAccountEntryActions } from "@/components/ledger/ShopAccountEntryActions"
import { AppStatCard } from "@/components/app-ui/AppStatCard"
import { AppCard } from "@/components/app-ui/AppCard"
import { AppEmptyState } from "@/components/app-ui/AppEmptyState"
import { AppListMeta } from "@/components/app-ui/AppListMeta"
import { AppMoneyValue } from "@/components/app-ui/AppMoneyValue"
import { formatCurrency } from "@/lib/utils"
import type { LedgerEntryType, LedgerPaymentMethod, Role } from "@/types"

const TYPES: LedgerEntryType[] = ["INCOME", "EXPENSE"]
const METHODS: LedgerPaymentMethod[] = ["CASH", "MPESA", "BANK_TRANSFER", "CARD", "CHEQUE", "OTHER"]

export default async function ShopAccountPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string
    to?: string
    type?: string
    categoryId?: string
    paymentMethod?: string
    createdById?: string
    search?: string
  }>
}) {
  const session = await auth()
  const role = session!.user.role as Role
  const permissions = session!.user.modulePermissions
  if (!hasAnyPermission(role, permissions, "ledger.shop.")) redirect("/dashboard")
  const companyId = session!.user.companyId as string

  const canCreate = canCreateLedgerEntryPerm(role, permissions, "shop")
  const canEdit = canEditLedgerEntryPerm(role, permissions, "shop")
  const canDelete = canDeleteLedgerEntryPerm(role, permissions, "shop")

  const { from, to, type, categoryId, paymentMethod, createdById, search } = await searchParams
  const validType = TYPES.includes(type as LedgerEntryType) ? (type as LedgerEntryType) : undefined
  const validMethod = METHODS.includes(paymentMethod as LedgerPaymentMethod) ? (paymentMethod as LedgerPaymentMethod) : undefined

  const filters = { from, to, type: validType, categoryId, paymentMethod: validMethod, createdById, search }

  const [entries, categories, totals, contributors] = await Promise.all([
    getShopAccountEntries(companyId, filters),
    getShopAccountCategories(companyId),
    getShopAccountTotals(companyId, filters),
    getShopAccountContributors(companyId),
  ])

  const hasFilters = Boolean(from || to || type || categoryId || paymentMethod || createdById || search)

  const exportParams = new URLSearchParams()
  if (from) exportParams.set("from", from)
  if (to) exportParams.set("to", to)
  if (validType) exportParams.set("type", validType)
  if (categoryId) exportParams.set("categoryId", categoryId)
  if (validMethod) exportParams.set("paymentMethod", validMethod)
  if (createdById) exportParams.set("createdById", createdById)
  if (search) exportParams.set("search", search)
  const exportUrl = `/api/ledger/shop/export?${exportParams.toString()}`

  const isAppMode = await isCapacitorAppRequest()

  if (isAppMode) {
    return (
      <div className="space-y-4">
        <Link href="/ledger" className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 active:text-slate-800">
          <ChevronLeft className="h-4 w-4" />
          <T k="ledger" />
        </Link>

        <div className="grid grid-cols-2 gap-2.5">
          <AppStatCard label={<T k="totalIncome" />} value={formatCurrency(totals.totalIncome)} valueClassName="text-sm" icon={<TrendingUp className="h-4 w-4 text-green-600" />} iconBg="bg-green-50" />
          <AppStatCard label={<T k="totalExpense" />} value={formatCurrency(totals.totalExpense)} valueClassName="text-sm" icon={<TrendingDown className="h-4 w-4 text-red-600" />} iconBg="bg-red-50" />
        </div>
        <AppStatCard label={<T k="balance" />} value={formatCurrency(totals.balance)} valueClassName="text-sm" icon={<Scale className="h-4 w-4 text-blue-600" />} />

        <div className="flex flex-wrap gap-2">
          {canCreate && <ShopAccountAddButtons categories={categories} />}
          <a href={exportUrl} target="_blank" rel="noopener noreferrer">
            <Button type="button" variant="outline" size="sm" icon={<Download className="h-4 w-4" />}>
              <T k="exportExcel" />
            </Button>
          </a>
        </div>

        <form method="GET" className="space-y-2">
          <Input name="search" type="text" defaultValue={search ?? ""} className="h-11" />
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
          <div className="grid grid-cols-2 gap-2">
            <Select name="paymentMethod" defaultValue={validMethod ?? ""} className="h-11">
              <option value=""><T k="paymentOrReceivingMethod" /></option>
              {METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </Select>
            <Select name="createdById" defaultValue={createdById ?? ""} className="h-11">
              <option value=""><T k="createdBy" /></option>
              {contributors.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" size="sm" className="flex-1"><T k="filter" /></Button>
            {hasFilters && (
              <Link href="/ledger/shop" className="flex-1">
                <Button variant="ghost" size="sm" className="w-full"><T k="clear" /></Button>
              </Link>
            )}
          </div>
        </form>

        {entries.length === 0 ? (
          <AppEmptyState icon={<Wallet className="h-8 w-8" />} title={<T k="noShopAccountEntriesFound" />} description={<T k="noShopAccountEntriesDesc" />} />
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <AppCard
                key={entry.id}
                trailing={canEdit || canDelete ? <ShopAccountEntryActions entry={entry} categories={categories} canEdit={canEdit} canDelete={canDelete} variant="menu" /> : undefined}
              >
                <div className="flex items-center justify-between gap-2">
                  <AppListMeta icon={<Calendar />}>{format(new Date(entry.date), "dd MMM yyyy")}</AppListMeta>
                  <LedgerEntryTypeBadge type={entry.type} />
                </div>
                <p className="mt-1 truncate text-[14px] font-semibold text-slate-900">{entry.category.name}</p>
                <p className="truncate text-xs text-slate-500">{entry.description}</p>
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
        title={<T k="shopAccount" />}
        subtitle={<T k="shopAccountDesc" />}
        actions={
          <div className="flex items-center gap-2">
            {/* Desktop only (this branch runs after the isAppMode early-return above) —
                no target="_blank" needed: DownloadGuard, which is what actually needs
                it, never mounts on desktop. */}
            <a href={exportUrl}>
              <Button type="button" variant="outline" icon={<Download className="h-4 w-4" />}>
                <T k="exportExcel" />
              </Button>
            </a>
            {canCreate && <ShopAccountAddButtons categories={categories} />}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <MetricCard label={<T k="totalIncome" />} value={formatCurrency(totals.totalIncome)} icon={<TrendingUp className="h-5 w-5 text-green-600" />} iconBg="bg-green-50" />
        <MetricCard label={<T k="totalExpense" />} value={formatCurrency(totals.totalExpense)} icon={<TrendingDown className="h-5 w-5 text-red-600" />} iconBg="bg-red-50" />
        <MetricCard label={<T k="balance" />} value={formatCurrency(totals.balance)} icon={<Scale className="h-5 w-5 text-blue-600" />} />
      </div>

      <form method="GET" className="filter-bar flex flex-wrap items-center gap-2 mb-4">
        <label className="text-xs text-slate-500 shrink-0"><T k="fromDate" /></label>
        <Input name="from" type="date" defaultValue={from ?? ""} className="w-32" />
        <label className="text-xs text-slate-500 shrink-0"><T k="toDate" /></label>
        <Input name="to" type="date" defaultValue={to ?? ""} className="w-32" />
        <Select name="type" defaultValue={validType ?? ""} className="w-28">
          <option value=""><T k="allTypes" /></option>
          <option value="INCOME"><T k="income" /></option>
          <option value="EXPENSE"><T k="expense" /></option>
        </Select>
        <Select name="categoryId" defaultValue={categoryId ?? ""} className="w-36">
          <option value=""><T k="allCategories" /></option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select name="paymentMethod" defaultValue={validMethod ?? ""} className="w-36">
          <option value=""><T k="paymentOrReceivingMethod" /></option>
          {METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </Select>
        <Select name="createdById" defaultValue={createdById ?? ""} className="w-36">
          <option value=""><T k="createdBy" /></option>
          {contributors.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Input name="search" type="text" defaultValue={search ?? ""} className="w-36" />
        <Button type="submit" variant="secondary"><T k="filter" /></Button>
        {hasFilters && (
          <Link href="/ledger/shop">
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
            key: "description",
            label: <T k="description" />,
            className: "whitespace-normal max-w-xs",
            render: (row) => (
              <span className="block max-w-xs text-sm text-slate-700 line-clamp-2" title={row.description}>
                {row.description}
              </span>
            ),
          },
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
          { key: "createdBy", label: <T k="createdBy" />, render: (row) => <span className="text-xs text-slate-500">{row.createdBy.name}</span> },
          {
            key: "actions",
            label: "",
            headerClassName: "text-right w-[170px]",
            className: "text-right w-[170px]",
            render: (row) => <ShopAccountEntryActions entry={row} categories={categories} canEdit={canEdit} canDelete={canDelete} />,
          },
        ]}
        data={entries}
        keyExtractor={(row) => row.id}
        emptyTitle={<T k="noShopAccountEntriesFound" />}
        emptyDescription={<T k="noShopAccountEntriesDesc" />}
      />
    </div>
  )
}
