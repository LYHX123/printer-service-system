"use client"

import Link from "next/link"
import { AlertTriangle, Clock, FileText, Receipt, CheckSquare, BookOpen, Store, Package } from "lucide-react"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { formatCurrency, cn } from "@/lib/utils"
import type { LowStockAlert } from "@/lib/stock-types"
import type { OverdueTaskAlert } from "@/lib/data/tasks"
import type { DashboardActivityItem, DashboardActivityKind } from "@/lib/data/dashboard"
import type { TranslationKey } from "@/lib/i18n/translations"

// Shared list bodies for the Dashboard's Alerts and Recent Activity sections —
// used by both the desktop and App-mode DashboardHome, which wrap these in
// their own section heading treatment. Kept here so the row markup (and any
// future fix to it) never has to be made twice.

export type CombinedDashboardAlert =
  | { kind: "stock"; data: LowStockAlert }
  | { kind: "task"; data: OverdueTaskAlert }

export function DashboardAlertsList({ alerts }: { alerts: CombinedDashboardAlert[] }) {
  const { t } = useLanguage()

  if (alerts.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-slate-400">{t("noAlertsLabel")}</p>
  }

  return (
    <div className="divide-y divide-slate-50">
      {alerts.map((alert) =>
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
            <span className="shrink-0 text-xs font-medium text-red-600">{alert.data.daysInactive}d</span>
          </Link>
        )
      )}
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

export function DashboardRecentActivityList({ items }: { items: DashboardActivityItem[] }) {
  const { t } = useLanguage()

  return (
    <div className="divide-y divide-slate-50">
      {items.map((item) => {
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
  )
}
