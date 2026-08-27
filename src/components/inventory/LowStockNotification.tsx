"use client"

import { useEffect } from "react"
import Link from "next/link"
import { AlertTriangle, ChevronRight, Clock, X } from "lucide-react"
import { format } from "date-fns"
import { useLanguage } from "@/lib/i18n/LanguageContext"
import { useAppMode } from "@/components/platform/AppModeProvider"
import { useAlertsPanel } from "@/components/platform/AlertsPanelProvider"
import { cn } from "@/lib/utils"
import { registerBackHandler, unregisterBackHandler } from "@/lib/platform/back-handler-stack"
import { STOCK_TYPE_LABELS } from "@/lib/stock-types"
import type { LowStockAlert } from "@/lib/stock-types"
import type { OverdueTaskAlert } from "@/lib/data/tasks"

interface AlertsNotificationProps {
  lowStockAlerts: LowStockAlert[]
  overdueTaskAlerts: OverdueTaskAlert[]
}

// Row renderers shared by the desktop floating card and the App-mode bottom
// sheet — only spacing/text-size differs (via `compact`), the data shown and
// the business logic behind it (thresholds, out-of-stock/overdue detection,
// links) is identical either way.

function LowStockAlertRow({
  alert,
  compact,
  onNavigate,
}: {
  alert: LowStockAlert
  compact?: boolean
  /** Closes the panel first (app-mode only — see AlertsNotification) so the
   * full-screen bottom sheet doesn't linger on top of the page just
   * navigated to. Undefined on desktop, where this floating card doesn't
   * cover the destination page the same way. */
  onNavigate?: () => void
}) {
  return (
    <li className={compact ? "px-3.5 py-2" : "px-4 py-3"}>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "rounded-full bg-slate-100 font-medium uppercase tracking-wide text-slate-500",
            compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
          )}
        >
          {STOCK_TYPE_LABELS[alert.stockType]}
        </span>
        <span
          className={cn(
            "rounded-full font-medium",
            compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]",
            alert.isOutOfStock ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
          )}
        >
          {alert.isOutOfStock ? "Out of Stock" : "Low Stock"}
        </span>
      </div>
      <p className={cn("truncate font-medium text-slate-900", compact ? "mt-0.5 text-[13px]" : "mt-1 text-sm")}>
        {alert.brand ? `${alert.brand} ` : ""}
        {alert.name}
      </p>
      <p className={cn("text-slate-500", compact ? "text-[11px]" : "text-xs")}>
        Qty: <span className="font-mono">{alert.quantity}</span> / Minimum:{" "}
        <span className="font-mono">{alert.threshold}</span>
      </p>
      <Link
        href={`/stock?type=${alert.stockType}`}
        onClick={onNavigate}
        className={cn(
          "inline-flex items-center gap-0.5 font-medium text-blue-600 hover:text-blue-700",
          compact ? "mt-0.5 text-[11px]" : "mt-1 text-xs"
        )}
      >
        View Stock <ChevronRight className="h-3 w-3" />
      </Link>
    </li>
  )
}

function OverdueTaskAlertRow({
  task,
  compact,
  t,
  onNavigate,
}: {
  task: OverdueTaskAlert
  compact?: boolean
  t: (key: "taskOverdueNotice" | "lastActivityLabel" | "daysInactiveLabel" | "viewTask") => string
  onNavigate?: () => void
}) {
  return (
    <li className={compact ? "px-3.5 py-2" : "px-4 py-3"}>
      <div className={cn("flex items-center gap-2", compact ? "mb-0.5" : "mb-1")}>
        <span
          className={cn(
            "rounded-full bg-red-100 font-medium text-red-700",
            compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
          )}
        >
          {t("taskOverdueNotice")}
        </span>
      </div>
      <p className={cn("truncate font-medium text-slate-900", compact ? "text-[13px]" : "text-sm")}>{task.title}</p>
      <div className={cn("flex items-center gap-1 text-slate-500", compact ? "mt-0.5 text-[11px]" : "mt-0.5 text-xs")}>
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
        <p className={cn("truncate text-slate-400", compact ? "mt-0.5 text-[11px]" : "mt-0.5 text-xs")}>
          {task.participants.map((p) => p.name).join(", ")}
        </p>
      )}
      <Link
        href="/tasks"
        onClick={onNavigate}
        className={cn(
          "inline-flex items-center gap-0.5 font-medium text-blue-600 hover:text-blue-700",
          compact ? "mt-0.5 text-[11px]" : "mt-1 text-xs"
        )}
      >
        {t("viewTask")} <ChevronRight className="h-3 w-3" />
      </Link>
    </li>
  )
}

export function AlertsNotification({ lowStockAlerts, overdueTaskAlerts }: AlertsNotificationProps) {
  const { t, language } = useLanguage()
  const isAppMode = useAppMode()
  const { isOpen, closePanel } = useAlertsPanel()

  const hasLowStock = lowStockAlerts.length > 0
  const hasOverdue = overdueTaskAlerts.length > 0
  const total = lowStockAlerts.length + overdueTaskAlerts.length

  // Same priority tier as a Modal in the Android back-button stack (see
  // AndroidBackHandler) — this is a full-screen overlay too, just not built
  // on the shared Modal component (it also renders on desktop, where Modal
  // semantics/sizing don't apply). Desktop never opens this with isOpen=true
  // unless there are actual alerts (nothing on desktop calls the bell's
  // openPanel), so gating on isAppMode here keeps desktop's registration
  // behavior exactly as it was before the shared panel state existed.
  useEffect(() => {
    if (!isAppMode || !isOpen) return
    registerBackHandler("alerts-notification", 2, closePanel)
    return () => unregisterBackHandler("alerts-notification")
  }, [isAppMode, isOpen, closePanel])

  if (!isOpen) return null

  const alertsTitle = language === "zh"
    ? `提醒 (${total})`
    : `Alerts (${total})`
  const titleSingle = hasLowStock ? t("lowStockAlertsLabel") : t("overdueTaskAlertsLabel")
  // total === 0 is only reachable via the bell's "open anyway" (forceOpenEmpty)
  // — desktop has no bell, so it can never hit this branch.
  const title = total === 0 ? t("notifications") : hasLowStock && hasOverdue ? alertsTitle : titleSingle

  const showBothSectionHeaders = hasLowStock && hasOverdue

  if (isAppMode) {
    // Modal-style bottom sheet — same convention MoreSheet already uses
    // (backdrop z-40, sheet z-50), so it deliberately sits above the fixed
    // bottom nav rather than being obscured by it. Natural height up to
    // ~48dvh; beyond that only the alert list itself scrolls, not the page.
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/50" onClick={closePanel} aria-hidden />
        <div
          role="alert"
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[48dvh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-lg pb-[env(safe-area-inset-bottom)]"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 py-1 pl-4 pr-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-semibold text-amber-900">{title}</h3>
            </div>
            <button
              onClick={closePanel}
              aria-label="Dismiss"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-amber-500 transition-colors active:bg-amber-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* min-h-0: without it a flex-1 child keeps its content's intrinsic
           * min-height, so a long alert list overflows the sheet's
           * overflow-hidden box (clipping the last row's link) instead of
           * scrolling inside it. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {total === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">{t("noAlertsLabel")}</p>
            )}
            {hasLowStock && (
              <>
                {showBothSectionHeaders && (
                  <div className="bg-orange-50 border-b border-orange-100 px-3.5 py-1">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-orange-600">
                      {t("lowStockAlertsLabel")} ({lowStockAlerts.length})
                    </span>
                  </div>
                )}
                <ul className="divide-y divide-slate-100">
                  {lowStockAlerts.map((alert) => (
                    <LowStockAlertRow key={alert.id} alert={alert} compact onNavigate={closePanel} />
                  ))}
                </ul>
              </>
            )}

            {hasOverdue && (
              <>
                {showBothSectionHeaders && (
                  <div className="bg-red-50 border-b border-red-100 border-t border-t-slate-100 px-3.5 py-1">
                    <span className="text-[9px] font-semibold uppercase tracking-wide text-red-600">
                      {t("overdueTaskAlertsLabel")} ({overdueTaskAlerts.length})
                    </span>
                  </div>
                )}
                <ul className="divide-y divide-slate-100">
                  {overdueTaskAlerts.map((task) => (
                    <OverdueTaskAlertRow key={task.id} task={task} t={t} compact onNavigate={closePanel} />
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <div
      role="alert"
      className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 w-[calc(100vw-2rem)] max-w-80 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-amber-900">{title}</h3>
        </div>
        <button
          onClick={closePanel}
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
                <LowStockAlertRow key={alert.id} alert={alert} />
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
                <OverdueTaskAlertRow key={task.id} task={task} t={t} />
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
