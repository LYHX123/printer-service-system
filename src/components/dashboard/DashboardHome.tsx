"use client"

import Link from "next/link"
import {
  Users,
  FileText,
  Receipt,
  CheckSquare,
  Laptop,
  Droplet,
  Wrench,
  AlertTriangle,
  Wallet,
  TrendingUp,
  TrendingDown,
  Store,
  Clock,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { MetricCard } from "@/components/ui/metric-card"
import { QuotationStatusBadge } from "@/components/ui/badge"
import { formatCurrency, cn } from "@/lib/utils"
import type { LowStockAlert } from "@/lib/stock-types"
import type { OverdueTaskAlert } from "@/lib/data/tasks"
import type { RecentQuotation, RecentInvoice } from "@/lib/data/dashboard"
import type { ShopAccountEntryWithRelations } from "@/lib/data/shopAccount"

interface DashboardHomeProps {
  firstName: string
  permissions: {
    customers: boolean
    quotations: boolean
    invoice: boolean
    stock: boolean
    tasks: boolean
    ledger: boolean
    shopAccount: boolean
  }
  customerCount: number | null
  activeQuotationCount: number | null
  invoiceCount: number | null
  activeTaskCount: number | null
  stockTotals: { EQUIPMENT: number; CONSUMPTION: number; PARTS: number } | null
  lowStockCount: number | null
  lowStockAlerts: LowStockAlert[]
  overdueTaskAlerts: OverdueTaskAlert[]
  unpaidSalesBalance: number | null
  currentMonthIncome: number | null
  currentMonthExpense: number | null
  currentMonthShopExpense: number | null
  recentQuotations: RecentQuotation[]
  recentInvoices: RecentInvoice[]
  recentShopEntries: ShopAccountEntryWithRelations[]
}

/** Max combined alerts shown on the dashboard — low stock first, then overdue tasks (most overdue first); the rest are reachable via "View all". */
const MAX_DASHBOARD_ALERTS = 5

// Long formatted-currency values (e.g. "KES 1,588,920.03") shouldn't wrap to a second
// line and break card-height consistency — shrink smoothly with viewport width instead.
const FINANCIAL_VALUE_CLASS = "whitespace-nowrap leading-tight text-[clamp(1.25rem,1.8vw,1.875rem)]"

function SectionHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{children}</h2>
      {action}
    </div>
  )
}

export function DashboardHome({
  firstName,
  permissions: perm,
  customerCount,
  activeQuotationCount,
  invoiceCount,
  activeTaskCount,
  stockTotals,
  lowStockCount,
  lowStockAlerts,
  overdueTaskAlerts,
  unpaidSalesBalance,
  currentMonthIncome,
  currentMonthExpense,
  currentMonthShopExpense,
  recentQuotations,
  recentInvoices,
  recentShopEntries,
}: DashboardHomeProps) {
  const { t } = useLanguage()

  const hasBusinessGroup = perm.customers || perm.quotations || perm.invoice || perm.tasks
  const hasStockGroup = perm.stock
  // perm.shopAccount is already perm.ledger && <real shop permission> (see
  // dashboard/page.tsx) — Financial Overview as a whole always requires real
  // Ledger/Financial access, never Shop Account alone, so this is just
  // perm.ledger (kept explicit rather than `perm.ledger || perm.shopAccount`
  // so it can't be misread as "either one is enough to show this section").
  const hasFinancialGroup = perm.ledger
  const hasAlerts = perm.stock || perm.tasks
  const hasRecentGroup = perm.quotations || perm.invoice || perm.shopAccount
  const hasAnyModuleAccess = hasBusinessGroup || hasStockGroup || hasFinancialGroup || hasAlerts || hasRecentGroup

  // Low stock first, then overdue tasks (already most-overdue-first from the data layer);
  // capped so the dashboard never grows tall from a long alert list — the rest is one
  // click away via "View all".
  const combinedAlerts = [
    ...(perm.stock ? lowStockAlerts.map((data) => ({ kind: "stock" as const, data })) : []),
    ...(perm.tasks ? overdueTaskAlerts.map((data) => ({ kind: "task" as const, data })) : []),
  ].slice(0, MAX_DASHBOARD_ALERTS)
  const alertsViewAllHref = perm.tasks ? "/tasks" : "/stock"

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
          {t("welcomeBack").replace("{name}", firstName)}
        </h1>
        <p className="mt-0.5 text-[15px] text-slate-500">{t("dashboardIntro")}</p>
      </div>

      {!hasAnyModuleAccess && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
          {t("noDashboardInformationForPermissions")}
        </p>
      )}

      {/* Group 1: Business overview */}
      {hasBusinessGroup && (
        <section>
          <SectionHeading>{t("businessOverviewSection")}</SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {perm.customers && (
              <MetricCard label={t("customers")} value={customerCount ?? 0} icon={<Users className="h-5 w-5 text-blue-600" />} href="/customers" />
            )}
            {perm.quotations && (
              <MetricCard label={t("activeQuotationsLabel")} value={activeQuotationCount ?? 0} icon={<FileText className="h-5 w-5 text-indigo-600" />} iconBg="bg-indigo-50" href="/quotations" />
            )}
            {perm.invoice && (
              <MetricCard label={t("invoicesLabel")} value={invoiceCount ?? 0} icon={<Receipt className="h-5 w-5 text-purple-600" />} iconBg="bg-purple-50" href="/invoice" />
            )}
            {perm.tasks && (
              <MetricCard label={t("activeTasksLabel")} value={activeTaskCount ?? 0} icon={<CheckSquare className="h-5 w-5 text-teal-600" />} iconBg="bg-teal-50" href="/tasks" />
            )}
          </div>
        </section>
      )}

      {/* Group 2: Stock overview */}
      {hasStockGroup && (
        <section>
          <SectionHeading>{t("stockOverviewSection")}</SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label={t("equipmentQuantityLabel")} value={stockTotals?.EQUIPMENT ?? 0} icon={<Laptop className="h-5 w-5 text-blue-600" />} href="/stock?type=EQUIPMENT" />
            <MetricCard label={t("consumptionQuantityLabel")} value={stockTotals?.CONSUMPTION ?? 0} icon={<Droplet className="h-5 w-5 text-cyan-600" />} iconBg="bg-cyan-50" href="/stock?type=CONSUMPTION" />
            <MetricCard label={t("partsQuantityLabel")} value={stockTotals?.PARTS ?? 0} icon={<Wrench className="h-5 w-5 text-slate-600" />} iconBg="bg-slate-100" href="/stock?type=PARTS" />
            <MetricCard label={t("lowStockItemsLabel")} value={lowStockCount ?? 0} icon={<AlertTriangle className="h-5 w-5 text-amber-600" />} iconBg="bg-amber-50" href="/stock" />
          </div>
        </section>
      )}

      {/* Group 3: Financial overview */}
      {hasFinancialGroup && (
        <section>
          <SectionHeading>{t("financialOverviewSection")}</SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {perm.ledger && (
              <>
                <MetricCard label={t("unpaidSalesBalanceLabel")} value={formatCurrency(unpaidSalesBalance ?? 0)} valueClassName={FINANCIAL_VALUE_CLASS} icon={<Wallet className="h-5 w-5 text-red-600" />} iconBg="bg-red-50" href="/ledger/sales" />
                <MetricCard label={t("currentMonthIncomeLabel")} value={formatCurrency(currentMonthIncome ?? 0)} valueClassName={FINANCIAL_VALUE_CLASS} icon={<TrendingUp className="h-5 w-5 text-green-600" />} iconBg="bg-green-50" href="/ledger/income-expense" />
                <MetricCard label={t("currentMonthExpenseLabel")} value={formatCurrency(currentMonthExpense ?? 0)} valueClassName={FINANCIAL_VALUE_CLASS} icon={<TrendingDown className="h-5 w-5 text-orange-600" />} iconBg="bg-orange-50" href="/ledger/income-expense" />
              </>
            )}
            {perm.shopAccount && (
              <MetricCard label={t("currentMonthShopExpenseLabel")} value={formatCurrency(currentMonthShopExpense ?? 0)} valueClassName={FINANCIAL_VALUE_CLASS} icon={<Store className="h-5 w-5 text-pink-600" />} iconBg="bg-pink-50" href="/ledger/shop" />
            )}
          </div>
        </section>
      )}

      {/* Group 4: Alerts — capped to MAX_DASHBOARD_ALERTS, low stock first then most-overdue-first tasks */}
      {hasAlerts && (
        <section>
          <SectionHeading
            action={
              <Link href={alertsViewAllHref} className="text-xs text-blue-600 hover:underline">
                {t("viewAllLink")}
              </Link>
            }
          >
            {t("alertsLabel")}
          </SectionHeading>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {combinedAlerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">{t("noAlertsLabel")}</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {combinedAlerts.map((alert) =>
                  alert.kind === "stock" ? (
                    <Link
                      key={`stock-${alert.data.id}`}
                      href={`/stock/${alert.data.id}/edit`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-amber-50 transition-colors"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-sm text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{alert.data.brand ? `${alert.data.brand} — ` : ""}{alert.data.name}</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-amber-600">
                        {alert.data.isOutOfStock ? t("outOfStock") : t("lowStock")} ({alert.data.quantity})
                      </span>
                    </Link>
                  ) : (
                    <Link
                      key={`task-${alert.data.id}`}
                      href={`/tasks?taskId=${alert.data.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-red-50 transition-colors"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-sm text-red-700">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{alert.data.title}</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium text-red-600">
                        {alert.data.daysInactive}d
                      </span>
                    </Link>
                  )
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Group 5: Recent activity — Quotations + Sales side by side, Shop Account full width below */}
      {hasRecentGroup && (
        <section>
          <SectionHeading>{t("recentActivitySection")}</SectionHeading>
          <div className="space-y-4">
            {(perm.quotations || perm.invoice) && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {perm.quotations && (
                  <RecentListCard title={t("recentQuotationsLabel")} viewAllHref="/quotations" emptyLabel={t("noRecentRecords")}>
                    {recentQuotations.map((q) => (
                      <Link key={q.id} href={`/quotations/${q.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{q.quotationNumber}</p>
                          <p className="truncate text-xs text-slate-400">{q.customer.companyName}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs font-medium text-slate-600">{formatCurrency(q.totalCost)}</span>
                          <QuotationStatusBadge status={q.status} />
                        </div>
                      </Link>
                    ))}
                  </RecentListCard>
                )}

                {perm.invoice && (
                  <RecentListCard title={t("recentSalesLabel")} viewAllHref="/invoice" emptyLabel={t("noRecentRecords")}>
                    {recentInvoices.map((inv) => (
                      <Link key={inv.id} href={`/quotations/invoices/${inv.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{inv.invoiceNumber}</p>
                          <p className="truncate text-xs text-slate-400">{inv.customer.companyName}</p>
                        </div>
                        <span className="shrink-0 text-xs font-medium text-slate-600">{formatCurrency(inv.totalAmount)}</span>
                      </Link>
                    ))}
                  </RecentListCard>
                )}
              </div>
            )}

            {perm.shopAccount && (
              <RecentListCard title={t("recentShopEntriesLabel")} viewAllHref="/ledger/shop" emptyLabel={t("noRecentRecords")} minHeight>
                {recentShopEntries.map((entry) => (
                  <Link key={entry.id} href="/ledger/shop" className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{entry.description}</p>
                      <p className="truncate text-xs text-slate-400">{entry.category.name}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-medium ${entry.type === "INCOME" ? "text-green-700" : "text-red-700"}`}>
                      {entry.type === "INCOME" ? "+" : "-"}{formatCurrency(entry.amount)}
                    </span>
                  </Link>
                ))}
              </RecentListCard>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function RecentListCard({
  title,
  viewAllHref,
  emptyLabel,
  /** Gives the empty state a deliberate, modest min-height (~120px) instead of
   * collapsing to a thin strip — used for cards that render full-width (e.g.
   * Shop Account), where a bare one-line empty state looks unbalanced. */
  minHeight = false,
  children,
}: {
  title: string
  viewAllHref: string
  emptyLabel: string
  minHeight?: boolean
  children: React.ReactNode
}) {
  const { t } = useLanguage()
  const isEmpty = Array.isArray(children) ? children.length === 0 : !children

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <Link href={viewAllHref} className="text-xs text-blue-600 hover:underline">
          {t("viewAllLink")}
        </Link>
      </div>
      {isEmpty ? (
        <div className={cn("flex items-center justify-center px-4 py-6", minHeight && "min-h-[120px]")}>
          <p className="text-center text-sm text-slate-400">{emptyLabel}</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-50">{children}</div>
      )}
    </div>
  )
}
