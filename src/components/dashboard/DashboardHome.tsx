"use client"

import Link from "next/link"
import {
  Users,
  FileText,
  Package,
  Wallet,
  Receipt,
  CheckSquare,
  UserCog,
  Settings,
  ChevronRight,
  AlertTriangle,
  Clock,
  Bell,
  type LucideIcon,
} from "lucide-react"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import type { TranslationKey } from "@/lib/i18n/translations"
import { canAccess, type Module } from "@/lib/permissions"
import { formatCurrency } from "@/lib/utils"
import type { Role } from "@/types"

interface ModuleCard {
  href: string
  module: Module
  icon: LucideIcon
  labelKey: TranslationKey
  descKey: TranslationKey
}

const MODULE_CARDS: ModuleCard[] = [
  { href: "/customers", module: "customers", icon: Users, labelKey: "customers", descKey: "customersDesc" },
  { href: "/quotations", module: "quotations", icon: FileText, labelKey: "quotations", descKey: "createAndManageQuotations" },
  { href: "/stock", module: "inventory", icon: Package, labelKey: "inventory", descKey: "stockDesc" },
  { href: "/ledger/income-expense", module: "ledger", icon: Wallet, labelKey: "ledger", descKey: "incomeExpenseBookDesc" },
  { href: "/ledger/sales", module: "ledger", icon: Receipt, labelKey: "salesLedger", descKey: "salesLedgerDesc" },
  { href: "/tasks", module: "tasks", icon: CheckSquare, labelKey: "tasks", descKey: "tasksDesc" },
  { href: "/users", module: "users", icon: UserCog, labelKey: "users", descKey: "usersDesc" },
  { href: "/settings", module: "settings", icon: Settings, labelKey: "settings", descKey: "companySettingsDesc" },
]

interface DashboardHomeProps {
  firstName: string
  role: Role
  modulePermissions: string[]
  lowStockCount: number | null
  overdueTaskCount: number | null
  activeTaskCount: number | null
  unpaidSalesBalance: number | null
}

export function DashboardHome({
  firstName,
  role,
  modulePermissions,
  lowStockCount,
  overdueTaskCount,
  activeTaskCount,
  unpaidSalesBalance,
}: DashboardHomeProps) {
  const { t } = useLanguage()

  const cards = MODULE_CARDS.filter((card) => canAccess(role, card.module, modulePermissions))
  const totalAlerts = (lowStockCount ?? 0) + (overdueTaskCount ?? 0)
  const hasAlertAccess = lowStockCount !== null || overdueTaskCount !== null

  const summaryItems: Array<{ labelKey: TranslationKey; value: string; href?: string }> = []
  if (activeTaskCount !== null) summaryItems.push({ labelKey: "activeTasksLabel", value: String(activeTaskCount), href: "/tasks" })
  if (lowStockCount !== null) summaryItems.push({ labelKey: "lowStockItemsLabel", value: String(lowStockCount) })
  if (unpaidSalesBalance !== null) summaryItems.push({ labelKey: "unpaidSalesBalanceLabel", value: formatCurrency(unpaidSalesBalance) })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {t("welcomeBack").replace("{name}", firstName)}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">{t("dashboardIntro")}</p>
      </div>

      {/* Alerts */}
      {hasAlertAccess && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Bell className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">{t("alertsLabel")}</h2>
          </div>
          {totalAlerts === 0 ? (
            <p className="text-sm text-slate-400">{t("noAlertsLabel")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {lowStockCount !== null && (
                <Link
                  href="/stock"
                  className={
                    lowStockCount > 0
                      ? "inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                      : "inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                  }
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {t("lowStockAlertsLabel")}: {lowStockCount}
                </Link>
              )}
              {overdueTaskCount !== null && (
                <Link
                  href="/tasks"
                  className={
                    overdueTaskCount > 0
                      ? "inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                      : "inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
                  }
                >
                  <Clock className="h-3.5 w-3.5" />
                  {t("overdueTaskAlertsLabel")}: {overdueTaskCount}
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Small summary strip */}
      {summaryItems.length > 0 && (
        <div className="mb-6 grid grid-cols-1 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
          {summaryItems.map((item) => {
            const content = (
              <>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{t(item.labelKey)}</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{item.value}</p>
              </>
            )
            return item.href ? (
              <Link
                key={item.labelKey}
                href={item.href}
                className="px-4 py-3 transition-colors hover:bg-slate-50"
              >
                {content}
              </Link>
            ) : (
              <div key={item.labelKey} className="px-4 py-3">
                {content}
              </div>
            )
          })}
        </div>
      )}

      {/* Module cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                <card.icon className="h-5 w-5 text-blue-600" />
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-slate-900">{t(card.labelKey)}</h3>
            <p className="mt-1 text-sm text-slate-500">{t(card.descKey)}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
