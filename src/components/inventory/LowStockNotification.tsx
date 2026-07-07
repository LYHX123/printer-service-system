"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, ChevronRight, Clock, X } from "lucide-react"
import { format } from "date-fns"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { STOCK_TYPE_LABELS } from "@/lib/stock-types"
import type { LowStockAlert } from "@/lib/stock-types"
import type { OverdueTaskAlert } from "@/lib/data/tasks"

interface AlertsNotificationProps {
  lowStockAlerts: LowStockAlert[]
  overdueTaskAlerts: OverdueTaskAlert[]
}

export function AlertsNotification({ lowStockAlerts, overdueTaskAlerts }: AlertsNotificationProps) {
  const [dismissed, setDismissed] = useState(false)
  const { t, language } = useLanguage()

  const hasLowStock = lowStockAlerts.length > 0
  const hasOverdue = overdueTaskAlerts.length > 0
  const total = lowStockAlerts.length + overdueTaskAlerts.length

  if (dismissed || total === 0) return null

  const alertsTitle = language === "zh"
    ? `提醒 (${total})`
    : `Alerts (${total})`
  const titleSingle = hasLowStock ? t("lowStockAlertsLabel") : t("overdueTaskAlertsLabel")
  const title = hasLowStock && hasOverdue ? alertsTitle : titleSingle

  const showBothSectionHeaders = hasLowStock && hasOverdue

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-50 w-80 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-amber-900">{title}</h3>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="text-amber-500 transition-colors hover:text-amber-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {/* ── Low Stock Section ── */}
        {hasLowStock && (
          <>
            {showBothSectionHeaders && (
              <div className="bg-orange-50 border-b border-orange-100 px-4 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-600">
                  {t("lowStockAlertsLabel")} ({lowStockAlerts.length})
                </span>
              </div>
            )}
            <ul className="divide-y divide-slate-100">
              {lowStockAlerts.map((alert) => (
                <li key={alert.id} className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      {STOCK_TYPE_LABELS[alert.stockType]}
                    </span>
                    <span
                      className={
                        alert.isOutOfStock
                          ? "rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700"
                          : "rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700"
                      }
                    >
                      {alert.isOutOfStock ? "Out of Stock" : "Low Stock"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-slate-900">
                    {alert.brand ? `${alert.brand} ` : ""}
                    {alert.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    Qty: <span className="font-mono">{alert.quantity}</span> / Minimum:{" "}
                    <span className="font-mono">{alert.threshold}</span>
                  </p>
                  <Link
                    href={`/stock?type=${alert.stockType}`}
                    className="mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    View Stock <ChevronRight className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* ── Overdue Tasks Section ── */}
        {hasOverdue && (
          <>
            {showBothSectionHeaders && (
              <div className="bg-red-50 border-b border-red-100 border-t border-t-slate-100 px-4 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-red-600">
                  {t("overdueTaskAlertsLabel")} ({overdueTaskAlerts.length})
                </span>
              </div>
            )}
            <ul className="divide-y divide-slate-100">
              {overdueTaskAlerts.map((task) => (
                <li key={task.id} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                      {t("taskOverdueNotice")}
                    </span>
                  </div>
                  <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
                  <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>
                      {t("lastActivityLabel")}: {format(new Date(task.lastActivityAt), "dd MMM yyyy")}
                    </span>
                    <span>·</span>
                    <span>
                      {task.daysInactive} {t("daysInactiveLabel")}
                    </span>
                  </div>
                  {task.participants.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {task.participants.map((p) => p.name).join(", ")}
                    </p>
                  )}
                  <Link
                    href="/tasks"
                    className="mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    {t("viewTask")} <ChevronRight className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
