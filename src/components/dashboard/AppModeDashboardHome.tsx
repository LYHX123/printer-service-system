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
  Package,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { AppStatCard } from "@/components/app-ui/AppStatCard"
import { AppSectionLabel } from "@/components/app-ui/AppSectionLabel"
import { DashboardAlertsList, DashboardRecentActivityList, type CombinedDashboardAlert } from "./DashboardAlertsAndActivity"
import { formatCurrency, cn } from "@/lib/utils"
import type { LowStockAlert } from "@/lib/stock-types"
import type { OverdueTaskAlert } from "@/lib/data/tasks"
import type {
  CustomerDashboardMetrics,
  QuotationDashboardMetrics,
  InvoiceDashboardMetrics,
  DashboardActivityItem,
} from "@/lib/data/dashboard"

interface AppModeDashboardHomeProps {
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
  customerMetrics: CustomerDashboardMetrics | null
  quotationMetrics: QuotationDashboardMetrics | null
  invoiceMetrics: InvoiceDashboardMetrics | null
  activeTaskCount: number | null
  overdueTaskCount: number | null
  stockTotals: { EQUIPMENT: number; CONSUMPTION: number; PARTS: number; COMMON_PRODUCT: number } | null
  lowStockCount: number | null
  lowStockAlerts: LowStockAlert[]
  overdueTaskAlerts: OverdueTaskAlert[]
  unpaidSalesBalance: number | null
  currentMonthIncome: number | null
  currentMonthExpense: number | null
  currentMonthShopExpense: number | null
  recentActivity: DashboardActivityItem[]
}

const MAX_DASHBOARD_ALERTS = 5
// Two tappable stat tiles per row — the compact phone equivalent of the
// desktop's 4-wide MetricCard grid. Same underlying data/permissions, only
// the presentation is different (no query or calculation changes here).
const STAT_GRID = "grid grid-cols-2 gap-2.5"
const STAT_ICON_CLASS = "h-4 w-4"
const STAT_VALUE_CURRENCY_CLASS = "text-sm"

export function AppModeDashboardHome({
  firstName,
  permissions: perm,
  customerMetrics,
  quotationMetrics,
  invoiceMetrics,
  activeTaskCount,
  overdueTaskCount,
  stockTotals,
  lowStockCount,
  lowStockAlerts,
  overdueTaskAlerts,
  unpaidSalesBalance,
  currentMonthIncome,
  currentMonthExpense,
  currentMonthShopExpense,
  recentActivity,
}: AppModeDashboardHomeProps) {
  const { t } = useLanguage()

  const hasBusinessGroup = perm.customers || perm.quotations || perm.invoice
  const hasStockGroup = perm.stock
  const hasTaskGroup = perm.tasks
  const hasFinancialGroup = perm.ledger
  const hasAlerts = perm.stock || perm.tasks
  const hasRecentGroup = recentActivity.length > 0
  const hasAnyModuleAccess = hasBusinessGroup || hasStockGroup || hasTaskGroup || hasFinancialGroup || hasAlerts || hasRecentGroup

  const combinedAlerts: CombinedDashboardAlert[] = [
    ...(perm.stock ? lowStockAlerts.map((data) => ({ kind: "stock" as const, data })) : []),
    ...(perm.tasks ? overdueTaskAlerts.map((data) => ({ kind: "task" as const, data })) : []),
  ].slice(0, MAX_DASHBOARD_ALERTS)
  const alertsViewAllHref = perm.tasks ? "/tasks" : "/stock"

  const netThisMonth = (currentMonthIncome ?? 0) - (currentMonthExpense ?? 0)

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold tracking-tight text-slate-900">
        {t("welcomeBack").replace("{name}", firstName)}
      </h1>

      {!hasAnyModuleAccess && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-400">
          {t("noDashboardInformationForPermissions")}
        </p>
      )}

      {hasBusinessGroup && (
        <section>
          <AppSectionLabel>{t("businessOverviewSection")}</AppSectionLabel>
          <div className={STAT_GRID}>
            {perm.customers && (
              <>
                <AppStatCard label={t("customers")} value={customerMetrics?.total ?? 0} icon={<Users className={cn(STAT_ICON_CLASS, "text-blue-600")} />} href="/customers" />
                <AppStatCard label={t("newCustomersThisMonthLabel")} value={customerMetrics?.newThisMonth ?? 0} icon={<Users className={cn(STAT_ICON_CLASS, "text-blue-500")} />} href="/customers" />
              </>
            )}
            {perm.quotations && (
              <>
                <AppStatCard label={t("quotationsThisMonthLabel")} value={quotationMetrics?.countThisMonth ?? 0} icon={<FileText className={cn(STAT_ICON_CLASS, "text-indigo-600")} />} iconBg="bg-indigo-50" href="/quotations" />
                <AppStatCard label={t("approvedQuotationsThisMonthLabel")} value={quotationMetrics?.approvedThisMonth ?? 0} icon={<FileText className={cn(STAT_ICON_CLASS, "text-indigo-600")} />} iconBg="bg-indigo-50" href="/quotations" />
              </>
            )}
            {perm.invoice && (
              <>
                <AppStatCard label={t("invoicesThisMonthLabel")} value={invoiceMetrics?.countThisMonth ?? 0} icon={<Receipt className={cn(STAT_ICON_CLASS, "text-purple-600")} />} iconBg="bg-purple-50" href="/invoice" />
                <AppStatCard
                  label={t("invoiceValueThisMonthLabel")}
                  value={formatCurrency(invoiceMetrics?.valueThisMonth ?? 0)}
                  valueClassName={STAT_VALUE_CURRENCY_CLASS}
                  icon={<Receipt className={cn(STAT_ICON_CLASS, "text-purple-600")} />}
                  iconBg="bg-purple-50"
                  href="/invoice"
                />
              </>
            )}
          </div>
        </section>
      )}

      {hasFinancialGroup && (
        <section>
          <AppSectionLabel>{t("financialOverviewSection")}</AppSectionLabel>
          <div className={STAT_GRID}>
            <AppStatCard label={t("unpaidSalesBalanceLabel")} value={formatCurrency(unpaidSalesBalance ?? 0)} valueClassName={STAT_VALUE_CURRENCY_CLASS} icon={<Wallet className={cn(STAT_ICON_CLASS, "text-red-600")} />} iconBg="bg-red-50" href="/ledger/sales" />
            <AppStatCard label={t("currentMonthIncomeLabel")} value={formatCurrency(currentMonthIncome ?? 0)} valueClassName={STAT_VALUE_CURRENCY_CLASS} icon={<TrendingUp className={cn(STAT_ICON_CLASS, "text-green-600")} />} iconBg="bg-green-50" href="/ledger/income-expense" />
            <AppStatCard label={t("currentMonthExpenseLabel")} value={formatCurrency(currentMonthExpense ?? 0)} valueClassName={STAT_VALUE_CURRENCY_CLASS} icon={<TrendingDown className={cn(STAT_ICON_CLASS, "text-orange-600")} />} iconBg="bg-orange-50" href="/ledger/income-expense" />
            <AppStatCard
              label={t("netThisMonthLabel")}
              value={formatCurrency(netThisMonth)}
              valueClassName={cn(STAT_VALUE_CURRENCY_CLASS, netThisMonth < 0 ? "text-red-600" : undefined)}
              icon={netThisMonth < 0 ? <TrendingDown className={cn(STAT_ICON_CLASS, "text-red-600")} /> : <TrendingUp className={cn(STAT_ICON_CLASS, "text-emerald-600")} />}
              iconBg={netThisMonth < 0 ? "bg-red-50" : "bg-emerald-50"}
              href="/ledger/income-expense"
            />
            {perm.shopAccount && (
              <AppStatCard label={t("currentMonthShopExpenseLabel")} value={formatCurrency(currentMonthShopExpense ?? 0)} valueClassName={STAT_VALUE_CURRENCY_CLASS} icon={<Store className={cn(STAT_ICON_CLASS, "text-pink-600")} />} iconBg="bg-pink-50" href="/ledger/shop" />
            )}
          </div>
        </section>
      )}

      {hasStockGroup && (
        <section>
          <AppSectionLabel>{t("stockOverviewSection")}</AppSectionLabel>
          <div className={STAT_GRID}>
            <AppStatCard label={t("equipmentQuantityLabel")} value={stockTotals?.EQUIPMENT ?? 0} icon={<Laptop className={cn(STAT_ICON_CLASS, "text-blue-600")} />} href="/stock?type=EQUIPMENT" />
            <AppStatCard label={t("consumptionQuantityLabel")} value={stockTotals?.CONSUMPTION ?? 0} icon={<Droplet className={cn(STAT_ICON_CLASS, "text-cyan-600")} />} iconBg="bg-cyan-50" href="/stock?type=CONSUMPTION" />
            <AppStatCard label={t("partsQuantityLabel")} value={stockTotals?.PARTS ?? 0} icon={<Wrench className={cn(STAT_ICON_CLASS, "text-slate-600")} />} iconBg="bg-slate-100" href="/stock?type=PARTS" />
            <AppStatCard label={t("commonProductQuantityLabel")} value={stockTotals?.COMMON_PRODUCT ?? 0} icon={<Package className={cn(STAT_ICON_CLASS, "text-purple-600")} />} iconBg="bg-purple-50" href="/stock?type=COMMON_PRODUCT" />
            <AppStatCard label={t("lowStockItemsLabel")} value={lowStockCount ?? 0} icon={<AlertTriangle className={cn(STAT_ICON_CLASS, "text-amber-600")} />} iconBg="bg-amber-50" href="/stock" />
          </div>
        </section>
      )}

      {hasTaskGroup && (
        <section>
          <AppSectionLabel>{t("taskOverviewSection")}</AppSectionLabel>
          <div className={STAT_GRID}>
            <AppStatCard label={t("activeTasksLabel")} value={activeTaskCount ?? 0} icon={<CheckSquare className={cn(STAT_ICON_CLASS, "text-teal-600")} />} iconBg="bg-teal-50" href="/tasks" />
            <AppStatCard label={t("overdueTasksLabel")} value={overdueTaskCount ?? 0} icon={<Clock className={cn(STAT_ICON_CLASS, "text-red-600")} />} iconBg="bg-red-50" href="/tasks" />
          </div>
        </section>
      )}

      {hasAlerts && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <AppSectionLabel>{t("alertsLabel")}</AppSectionLabel>
            <Link href={alertsViewAllHref} className="text-xs text-blue-600">
              {t("viewAllLink")}
            </Link>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <DashboardAlertsList alerts={combinedAlerts} />
          </div>
        </section>
      )}

      {hasRecentGroup && (
        <section>
          <AppSectionLabel>{t("recentActivitySection")}</AppSectionLabel>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <DashboardRecentActivityList items={recentActivity} />
          </div>
        </section>
      )}
    </div>
  )
}
