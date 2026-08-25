import type { ReactNode } from "react"
import { AppSectionLabel } from "./AppSectionLabel"

interface AppDetailSectionProps {
  title?: ReactNode
  action?: ReactNode
  children: ReactNode
}

// White card wrapper for a group of related detail rows/content — the single
// grouping primitive App-mode detail pages (Quotation/Delivery/Invoice/
// Customer/User/...) use instead of desktop's wide bordered panels.
export function AppDetailSection({ title, action, children }: AppDetailSectionProps) {
  return (
    <section>
      {title && (
        <div className="mb-2 flex items-center justify-between">
          <AppSectionLabel>{title}</AppSectionLabel>
          {action}
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white p-4">{children}</div>
    </section>
  )
}
