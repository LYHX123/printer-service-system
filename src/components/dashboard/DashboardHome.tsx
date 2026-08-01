"use client"

import Link from "next/link"
import { format } from "date-fns"
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
  Bell,
  Clock,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { MetricCard } from "@/components/ui/metric-card"
import { QuotationStatusBadge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils"
import type { LowStockAlert } from "@/lib/stock-types"
import type { OverdueTaskAlert } from "@/lib/data/tasks"
import type { RecentQuotation, RecentInvoice, RecentTask } from "@/lib/data/dashboard"
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
  recentTasks: RecentTask[]
  recentShopEntries: ShopAccountEntryWithRelations[]
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">{children}</h2>
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
  recentTasks,
  recentShopEntries,
}: DashboardHomeProps) {
  const { t } = useLanguage()

  const hasBusinessGroup = perm.customers || perm.quotations || perm.invoice || perm.tasks
  const hasStockGroup = perm.stock
  const hasFinancialGroup = perm.ledger || perm.shopAccount
  const hasAlerts = perm.stock || perm.tasks
  const hasRecentGroup = perm.quotations || perm.invoice || perm.tasks || perm.shopAccount
  const totalAlertCount = (lowStockAlerts?.length ?? 0) + (overdueTaskAlerts?.length ?? 0)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-slate-900">
          {t("welcomeBack").replace("{name}", firstName)}
        </h1>
        <p className="mt-0.5 text-[15px] text-slate-500">{t("dashboardIntro")}</p>
      </div>

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
                <MetricCard label={t("unpaidSalesBalanceLabel")} value={formatCurrency(unpaidSalesBalance ?? 0)} icon={<Wallet className="h-5 w-5 text-red-600" />} iconBg="bg-red-50" href="/ledger/sales" />
                <MetricCard label={t("currentMonthIncomeLabel")} value={formatCurrency(currentMonthIncome ?? 0)} icon={<TrendingUp className="h-5 w-5 text-green-600" />} iconBg="bg-green-50" href="/ledger/income-expense" />
                <MetricCard label={t("currentMonthExpenseLabel")} value={formatCurrency(currentMonthExpense ?? 0)} icon={<TrendingDown className="h-5 w-5 text-orange-600" />} iconBg="bg-orange-50" href="/ledger/income-expense" />
              </>
            )}
            {perm.shopAccount && (
              <MetricCard label={t("currentMonthShopExpenseLabel")} value={formatCurrency(currentMonthShopExpense ?? 0)} icon={<Store className="h-5 w-5 text-pink-600" />} iconBg="bg-pink-50" href="/ledger/shop" />
            )}
          </div>
        </section>
      )}

      {/* Group 4: Alerts */}
      {hasAlerts && (
        <section>
          <SectionHeading>{t("alertsLabel")}</SectionHeading>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2">
              <Bell className="h-4 w-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900">{t("alertsLabel")}</h3>
            </div>
            {totalAlertCount === 0 ? (
              <p className="text-sm text-slate-400">{t("noAlertsLabel")}</p>
            ) : (
              <div className="space-y-1.5">
                {perm.stock && lowStockAlerts.map((alert) => (
                  <Link
                    key={`stock-${alert.id}`}
                    href={`/stock/${alert.id}/edit`}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-amber-50 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      {alert.brand ? `${alert.brand} — ` : ""}{alert.name}
                    </span>
                    <span className="text-xs font-medium text-amber-600">
                      {alert.isOutOfStock ? t("outOfStock") : t("lowStock")} ({alert.quantity})
                    </span>
                  </Link>
                ))}
                {perm.tasks && overdueTaskAlerts.map((alert) => (
                  <Link
                    key={`task-${alert.id}`}
                    href={`/tasks?taskId=${alert.id}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-red-50 transition-colors"
                  >
                    <span className="flex items-center gap-2 text-red-700">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      {alert.title}
                    </span>
                    <span className="text-xs font-medium text-red-600">
                      {alert.daysInactive}d
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Group 5: Recent records */}
      {hasRecentGroup && (
        <section>
          <SectionHeading>{t("dashboard")}</SectionHeading>
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

            {perm.tasks && (
              <RecentListCard title={t("recentTasksLabel")} viewAllHref="/tasks" emptyLabel={t("noRecentRecords")}>
                {recentTasks.map((task) => (
                  <Link key={task.id} href={`/tasks?taskId=${task.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors">
                    <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
                    <span className={`shrink-0 text-xs font-medium ${task.status === "ACTIVE" ? "text-blue-600" : "text-slate-400"}`}>
                      {format(new Date(task.createdAt), "dd MMM")}
                    </span>
                  </Link>
                ))}
              </RecentListCard>
            )}

            {perm.shopAccount && (
              <RecentListCard title={t("recentShopEntriesLabel")} viewAllHref="/ledger/shop" emptyLabel={t("noRecentRecords")}>
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
  children,
}: {
  title: string
  viewAllHref: string
  emptyLabel: string
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
        <p className="px-4 py-6 text-center text-sm text-slate-400">{emptyLabel}</p>
      ) : (
        <div className="divide-y divide-slate-50">{children}</div>
      )}
    </div>
  )
}
