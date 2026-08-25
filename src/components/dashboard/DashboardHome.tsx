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
import { useAppMode } from "@/components/platform/AppModeProvider"
import { AppModeDashboardHome } from "./AppModeDashboardHome"
import { DashboardAlertsList, DashboardRecentActivityList, type CombinedDashboardAlert } from "./DashboardAlertsAndActivity"
import { MetricCard } from "@/components/ui/metric-card"
import { formatCurrency, cn } from "@/lib/utils"
import type { LowStockAlert } from "@/lib/stock-types"
import type { OverdueTaskAlert } from "@/lib/data/tasks"
import type {
  CustomerDashboardMetrics,
  QuotationDashboardMetrics,
  InvoiceDashboardMetrics,
  DashboardActivityItem,
} from "@/lib/data/dashboard"

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

/** Max combined alerts shown on the dashboard — low stock first, then overdue tasks (most overdue first); the rest are reachable via "View all". */
const MAX_DASHBOARD_ALERTS = 5

// One shared, fixed grid for every metric section (Business/Financial/Stock/Task) — never
// auto-fit/stretch, never dynamic per card count. Mobile 1 column, tablet 2, desktop 4 —
// a section with fewer cards than a full row (Task Overview's 2, a permission-limited
// user's 2-card Business Overview, ...) simply leaves the remaining grid cells empty
// rather than stretching its cards wider, so every section's card width lines up exactly
// with every other section's, at every breakpoint.
const CARD_GRID_CLASS = "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
// Fixed card height so a 2-line label never grows a card taller than its neighbors —
// combined with MetricCard's `pinValueBottom` (label+icon on top, value pinned to the
// bottom via `mt-auto`) and `labelWrap`'s own reserved label height, every value sits at
// the same Y position across a row regardless of 1- vs 2-line labels. `overflow-hidden` is
// a safety net so a long currency value can never visually spill past its own card's
// rounded border into a neighboring card, on top of the page-level `overflow-x-hidden`
// DashboardShell's <main> already has.
const DASHBOARD_CARD_CLASS = "p-4 min-h-[120px] overflow-hidden"
const DASHBOARD_ICON_SIZE_CLASS = "h-11 w-11"
// Every plain-count card (Customers, Quotations, Stock quantities, Tasks, ...) uses this
// same size — never varies per card.
const COUNT_VALUE_CLASS = "text-2xl"
// Every currency card (Unpaid Balance, Income, Expense, Net, Shop Expense, Invoice Value)
// uses this exact same class — a single shared constant is what actually guarantees they
// can never drift to different sizes from each other. Kept as one shared responsive clamp
// (not a fixed size) — the fixed 4-column grid still narrows each card at the xl breakpoint's
// lower edge (~1280px), where the widest realistic value ("KES 1,588,920.03") needs to stay
// legible without wrapping; the clamp keeps every currency card identically sized to each
// other at any given viewport width while still fitting the narrowest column safely.
const FINANCIAL_VALUE_CLASS = "whitespace-nowrap leading-tight text-[clamp(0.875rem,1vw,1.25rem)]"

function SectionHeading({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{children}</h2>
      {action}
    </div>
  )
}

export function DashboardHome(props: DashboardHomeProps) {
  const isAppMode = useAppMode()
  if (isAppMode) return <AppModeDashboardHome {...props} />
  return <DesktopDashboardHome {...props} />
}

function DesktopDashboardHome({
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
}: DashboardHomeProps) {
  const { t } = useLanguage()

  const hasBusinessGroup = perm.customers || perm.quotations || perm.invoice
  const hasStockGroup = perm.stock
  const hasTaskGroup = perm.tasks
  // perm.shopAccount is already perm.ledger && <real shop permission> (see
  // dashboard/page.tsx) — Financial Overview as a whole always requires real
  // Ledger/Financial access, never Shop Account alone, so this is just
  // perm.ledger (kept explicit rather than `perm.ledger || perm.shopAccount`
  // so it can't be misread as "either one is enough to show this section").
  const hasFinancialGroup = perm.ledger
  const hasAlerts = perm.stock || perm.tasks
  const hasRecentGroup = recentActivity.length > 0
  const hasAnyModuleAccess = hasBusinessGroup || hasStockGroup || hasTaskGroup || hasFinancialGroup || hasAlerts || hasRecentGroup

  // Low stock first, then overdue tasks (already most-overdue-first from the data layer);
  // capped so the dashboard never grows tall from a long alert list — the rest is one
  // click away via "View all".
  const combinedAlerts: CombinedDashboardAlert[] = [
    ...(perm.stock ? lowStockAlerts.map((data) => ({ kind: "stock" as const, data })) : []),
    ...(perm.tasks ? overdueTaskAlerts.map((data) => ({ kind: "task" as const, data })) : []),
  ].slice(0, MAX_DASHBOARD_ALERTS)
  const alertsViewAllHref = perm.tasks ? "/tasks" : "/stock"

  const netThisMonth = (currentMonthIncome ?? 0) - (currentMonthExpense ?? 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t("welcomeBack").replace("{name}", firstName)}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">{t("dashboardIntro")}</p>
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
          <div className={CARD_GRID_CLASS}>
            {perm.customers && (
              <>
                <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom valueClassName={COUNT_VALUE_CLASS} labelWrap label={t("customers")} value={customerMetrics?.total ?? 0} icon={<Users className="h-5 w-5 text-blue-600" />} href="/customers" />
                <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom valueClassName={COUNT_VALUE_CLASS} labelWrap label={t("newCustomersThisMonthLabel")} value={customerMetrics?.newThisMonth ?? 0} icon={<Users className="h-5 w-5 text-blue-500" />} href="/customers" />
              </>
            )}
            {perm.quotations && (
              <>
                <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom valueClassName={COUNT_VALUE_CLASS} labelWrap label={t("quotationsThisMonthLabel")} value={quotationMetrics?.countThisMonth ?? 0} icon={<FileText className="h-5 w-5 text-indigo-600" />} iconBg="bg-indigo-50" href="/quotations" />
                <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom valueClassName={COUNT_VALUE_CLASS} labelWrap label={t("approvedQuotationsThisMonthLabel")} value={quotationMetrics?.approvedThisMonth ?? 0} icon={<FileText className="h-5 w-5 text-indigo-600" />} iconBg="bg-indigo-50" href="/quotations" />
              </>
            )}
            {perm.invoice && (
              <>
                <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom valueClassName={COUNT_VALUE_CLASS} labelWrap label={t("invoicesThisMonthLabel")} value={invoiceMetrics?.countThisMonth ?? 0} icon={<Receipt className="h-5 w-5 text-purple-600" />} iconBg="bg-purple-50" href="/invoice" />
                <MetricCard
                  className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom
                  labelWrap
                  label={t("invoiceValueThisMonthLabel")}
                  value={formatCurrency(invoiceMetrics?.valueThisMonth ?? 0)}
                  valueClassName={FINANCIAL_VALUE_CLASS}
                  icon={<Receipt className="h-5 w-5 text-purple-600" />}
                  iconBg="bg-purple-50"
                  href="/invoice"
                />
              </>
            )}
          </div>
        </section>
      )}

      {/* Group 2: Financial overview */}
      {hasFinancialGroup && (
        <section>
          <SectionHeading>{t("financialOverviewSection")}</SectionHeading>
          <div className={CARD_GRID_CLASS}>
            <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom labelWrap label={t("unpaidSalesBalanceLabel")} value={formatCurrency(unpaidSalesBalance ?? 0)} valueClassName={FINANCIAL_VALUE_CLASS} icon={<Wallet className="h-5 w-5 text-red-600" />} iconBg="bg-red-50" href="/ledger/sales" />
            <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom labelWrap label={t("currentMonthIncomeLabel")} value={formatCurrency(currentMonthIncome ?? 0)} valueClassName={FINANCIAL_VALUE_CLASS} icon={<TrendingUp className="h-5 w-5 text-green-600" />} iconBg="bg-green-50" href="/ledger/income-expense" />
            <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom labelWrap label={t("currentMonthExpenseLabel")} value={formatCurrency(currentMonthExpense ?? 0)} valueClassName={FINANCIAL_VALUE_CLASS} icon={<TrendingDown className="h-5 w-5 text-orange-600" />} iconBg="bg-orange-50" href="/ledger/income-expense" />
            <MetricCard
              className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom
              labelWrap
              label={t("netThisMonthLabel")}
              value={formatCurrency(netThisMonth)}
              valueClassName={cn(FINANCIAL_VALUE_CLASS, netThisMonth < 0 ? "text-red-600" : undefined)}
              icon={netThisMonth < 0 ? <TrendingDown className="h-5 w-5 text-red-600" /> : <TrendingUp className="h-5 w-5 text-emerald-600" />}
              iconBg={netThisMonth < 0 ? "bg-red-50" : "bg-emerald-50"}
              href="/ledger/income-expense"
            />
            {perm.shopAccount && (
              <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom labelWrap label={t("currentMonthShopExpenseLabel")} value={formatCurrency(currentMonthShopExpense ?? 0)} valueClassName={FINANCIAL_VALUE_CLASS} icon={<Store className="h-5 w-5 text-pink-600" />} iconBg="bg-pink-50" href="/ledger/shop" />
            )}
          </div>
        </section>
      )}

      {/* Group 3: Stock overview */}
      {hasStockGroup && (
        <section>
          <SectionHeading>{t("stockOverviewSection")}</SectionHeading>
          <div className={CARD_GRID_CLASS}>
            <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom valueClassName={COUNT_VALUE_CLASS} labelWrap label={t("equipmentQuantityLabel")} value={stockTotals?.EQUIPMENT ?? 0} icon={<Laptop className="h-5 w-5 text-blue-600" />} href="/stock?type=EQUIPMENT" />
            <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom valueClassName={COUNT_VALUE_CLASS} labelWrap label={t("consumptionQuantityLabel")} value={stockTotals?.CONSUMPTION ?? 0} icon={<Droplet className="h-5 w-5 text-cyan-600" />} iconBg="bg-cyan-50" href="/stock?type=CONSUMPTION" />
            <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom valueClassName={COUNT_VALUE_CLASS} labelWrap label={t("partsQuantityLabel")} value={stockTotals?.PARTS ?? 0} icon={<Wrench className="h-5 w-5 text-slate-600" />} iconBg="bg-slate-100" href="/stock?type=PARTS" />
            <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom valueClassName={COUNT_VALUE_CLASS} labelWrap label={t("commonProductQuantityLabel")} value={stockTotals?.COMMON_PRODUCT ?? 0} icon={<Package className="h-5 w-5 text-purple-600" />} iconBg="bg-purple-50" href="/stock?type=COMMON_PRODUCT" />
            <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom valueClassName={COUNT_VALUE_CLASS} labelWrap label={t("lowStockItemsLabel")} value={lowStockCount ?? 0} icon={<AlertTriangle className="h-5 w-5 text-amber-600" />} iconBg="bg-amber-50" href="/stock" />
          </div>
        </section>
      )}

      {/* Group 4: Task overview */}
      {hasTaskGroup && (
        <section>
          <SectionHeading>{t("taskOverviewSection")}</SectionHeading>
          <div className={CARD_GRID_CLASS}>
            <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom valueClassName={COUNT_VALUE_CLASS} labelWrap label={t("activeTasksLabel")} value={activeTaskCount ?? 0} icon={<CheckSquare className="h-5 w-5 text-teal-600" />} iconBg="bg-teal-50" href="/tasks" />
            <MetricCard className={DASHBOARD_CARD_CLASS} iconSizeClassName={DASHBOARD_ICON_SIZE_CLASS} pinValueBottom valueClassName={COUNT_VALUE_CLASS} labelWrap label={t("overdueTasksLabel")} value={overdueTaskCount ?? 0} icon={<Clock className="h-5 w-5 text-red-600" />} iconBg="bg-red-50" href="/tasks" />
          </div>
        </section>
      )}

      {/* Group 5: Alerts — capped to MAX_DASHBOARD_ALERTS, low stock first then most-overdue-first tasks */}
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
            <DashboardAlertsList alerts={combinedAlerts} />
          </div>
        </section>
      )}

      {/* Group 6: Recent activity — one merged, permission-gated, time-sorted feed (never per-module 0/empty placeholders) */}
      {hasRecentGroup && (
        <section>
          <SectionHeading>{t("recentActivitySection")}</SectionHeading>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <DashboardRecentActivityList items={recentActivity} />
          </div>
        </section>
      )}
    </div>
  )
}
