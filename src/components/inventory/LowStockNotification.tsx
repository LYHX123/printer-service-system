"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, ChevronRight, X } from "lucide-react"
import { STOCK_TYPE_LABELS } from "@/lib/stock-types"
import type { LowStockAlert } from "@/lib/stock-types"

export function LowStockNotification({ alerts }: { alerts: LowStockAlert[] }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || alerts.length === 0) return null

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-50 w-80 overflow-hidden rounded-xl border border-amber-200 bg-white shadow-lg"
    >
      <div className="flex items-center justify-between gap-2 border-b border-amber-100 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-amber-900">Low Stock Alert</h3>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="text-amber-500 transition-colors hover:text-amber-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
        {alerts.map((alert) => (
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
              Qty: <span className="font-mono">{alert.quantity}</span>
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
    </div>
  )
}
