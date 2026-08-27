"use client"

import { createContext, useCallback, useContext, useState, type ReactNode } from "react"

interface AlertsPanelContextValue {
  /** Same lowStockAlerts.length + overdueTaskAlerts.length the (dashboard)
   * layout already passes to AlertsNotification — never recalculated here. */
  alertCount: number
  isOpen: boolean
  openPanel: () => void
  closePanel: () => void
}

const AlertsPanelContext = createContext<AlertsPanelContextValue | null>(null)

/**
 * Connects AppTopBar's notification bell to the one AlertsNotification
 * overlay mounted in the (dashboard) layout — they're siblings there, not
 * parent/child, so this is the smallest shared layer between them.
 *
 * `dismissed` reproduces AlertsNotification's original single-boolean
 * behavior exactly: starts false, so the panel auto-opens whenever there are
 * alerts and reactively reopens if the alert count rises later (e.g. after a
 * router refresh), for as long as the user hasn't explicitly closed it this
 * session — closing only ever means "hide for now," never touches alert
 * data. `forceOpenEmpty` is the one new bit the bell needs: tapping it with
 * zero active alerts must still open the panel (to show its empty state),
 * which `alertCount > 0` alone can't do.
 */
export function AlertsPanelProvider({ alertCount, children }: { alertCount: number; children: ReactNode }) {
  const [dismissed, setDismissed] = useState(false)
  const [forceOpenEmpty, setForceOpenEmpty] = useState(false)

  const openPanel = useCallback(() => {
    setDismissed(false)
    setForceOpenEmpty(true)
  }, [])
  const closePanel = useCallback(() => {
    setDismissed(true)
    setForceOpenEmpty(false)
  }, [])

  const isOpen = !dismissed && (alertCount > 0 || forceOpenEmpty)

  return (
    <AlertsPanelContext.Provider value={{ alertCount, isOpen, openPanel, closePanel }}>
      {children}
    </AlertsPanelContext.Provider>
  )
}

export function useAlertsPanel(): AlertsPanelContextValue {
  const ctx = useContext(AlertsPanelContext)
  if (!ctx) throw new Error("useAlertsPanel must be used within an AlertsPanelProvider")
  return ctx
}
