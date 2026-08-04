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
  BookOpen,
  Package,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { MetricCard } from "@/components/ui/metric-card"
import { formatCurrency, cn } from "@/lib/utils"
import type { LowStockAlert } from "@/lib/stock-types"
import type { OverdueTaskAlert } from "@/lib/data/tasks"
import type {
  CustomerDashboardMetrics,
  QuotationDashboardMetrics,
  InvoiceDashboardMetrics,
  DashboardActivityItem,
  DashboardActivityKind,
} from "@/lib/data/dashboard"
import type { TranslationKey } from "@/lib/i18n/translations"

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
  stockTotals: { EQUIPMENT: number; CONSUMPTION: number; PARTS: number } | null
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

const ACTIVITY_KIND_CONFIG: Record<DashboardActivityKind, { icon: React.ComponentType<{ className?: string }>; labelKey: TranslationKey; color: string }> = {
  quotation: { icon: FileText, labelKey: "quotations", color: "text-indigo-600" },
  invoice: { icon: Receipt, labelKey: "invoice", color: "text-purple-600" },
  task: { icon: CheckSquare, labelKey: "tasks", color: "text-teal-600" },
  ledger: { icon: BookOpen, labelKey: "ledger", color: "text-green-700" },
  shopAccount: { icon: Store, labelKey: "shopAccount", color: "text-pink-600" },
  stock: { icon: Package, labelKey: "inventory", color: "text-slate-600" },
}

export function DashboardHome({
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
  const combinedAlerts = [
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

      {/* Group 6: Recent activity — one merged, permission-gated, time-sorted feed (never per-module 0/empty placeholders) */}
      {hasRecentGroup && (
        <section>
          <SectionHeading>{t("recentActivitySection")}</SectionHeading>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-50">
            {recentActivity.map((item) => {
              const config = ACTIVITY_KIND_CONFIG[item.kind]
              const Icon = config.icon
              return (
                <Link
                  key={`${item.kind}-${item.id}`}
                  href={item.href}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Icon className={cn("h-4 w-4 shrink-0", config.color)} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                      <p className="truncate text-xs text-slate-400">
                        {t(config.labelKey)} · {item.subtitle}
                      </p>
                    </div>
                  </div>
                  {item.amount !== null && (
                    <span
                      className={cn(
                        "shrink-0 text-xs font-medium",
                        item.amountSign === "+" ? "text-green-700" : item.amountSign === "-" ? "text-red-700" : "text-slate-600"
                      )}
                    >
                      {item.amountSign ?? ""}
                      {item.amountIsCurrency ? formatCurrency(item.amount) : item.amount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
