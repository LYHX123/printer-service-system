// Shared registry so the Android hardware/gesture back button can close the
// topmost open overlay (MoreSheet, then a Modal) instead of navigating the
// page — see AndroidBackHandler, which is the sole consumer of `handleBack`.
// Plain module-level state (not React context): registration is a pure
// side-effect list, nothing here needs to trigger a re-render.

interface BackHandlerEntry {
  id: string
  /** Lower runs first — MoreSheet (1) beats a Modal (2). */
  priority: number
  close: () => void
}

const handlers: BackHandlerEntry[] = []

export function registerBackHandler(id: string, priority: number, close: () => void): void {
  const existing = handlers.findIndex((h) => h.id === id)
  if (existing !== -1) handlers.splice(existing, 1)
  handlers.push({ id, priority, close })
}

export function unregisterBackHandler(id: string): void {
  const existing = handlers.findIndex((h) => h.id === id)
  if (existing !== -1) handlers.splice(existing, 1)
}

/** Closes the highest-priority open overlay, if any. Returns true if it handled the back press (caller should not also navigate). */
export function handleBack(): boolean {
  if (handlers.length === 0) return false
  const top = handlers.reduce((best, h) => (h.priority < best.priority ? h : best))
  top.close()
  return true
}
