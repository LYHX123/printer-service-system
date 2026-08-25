"use client"

import { createContext, useContext, type ReactNode } from "react"

const AppModeContext = createContext<boolean | null>(null)

/**
 * Makes the server-determined app-mode flag (see src/lib/platform/app-mode.ts)
 * available to Client Components without them re-detecting it themselves —
 * the value is fixed for the lifetime of the request/page load, so a single
 * server-computed boolean threaded through context avoids any client/server
 * mismatch.
 */
export function AppModeProvider({ isAppMode, children }: { isAppMode: boolean; children: ReactNode }) {
  return <AppModeContext.Provider value={isAppMode}>{children}</AppModeContext.Provider>
}

export function useAppMode(): boolean {
  const ctx = useContext(AppModeContext)
  if (ctx === null) throw new Error("useAppMode must be used within an AppModeProvider")
  return ctx
}
