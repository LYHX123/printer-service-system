import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface AppListMetaProps {
  icon?: ReactNode
  children: ReactNode
  className?: string
}

// Small "icon + text" metadata line — the same shape (date row, brand row,
// participant row, ...) repeats across every mobile list card (Stock, Tasks,
// Quotations, Delivery, Invoice), so it's defined once here instead of
// re-typing the same flex/gap/text classes on every card.
export function AppListMeta({ icon, children, className }: AppListMetaProps) {
  return (
    <div className={cn("flex items-center gap-1 text-xs text-slate-500", className)}>
      {icon && <span className="shrink-0 [&>svg]:h-3 [&>svg]:w-3">{icon}</span>}
      <span className="truncate">{children}</span>
    </div>
  )
}
