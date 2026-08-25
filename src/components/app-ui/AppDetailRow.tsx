import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface AppDetailRowProps {
  label: ReactNode
  value: ReactNode
  className?: string
}

// Compact label/value line — the base unit of every App-mode detail card
// (Customer info, Quotation/Delivery/Invoice header facts, User profile, ...).
export function AppDetailRow({ label, value, className }: AppDetailRowProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 py-1.5 text-sm", className)}>
      <span className="shrink-0 text-slate-500">{label}</span>
      {/* break-words: a value can be an unbroken token with no natural wrap
          point (email address, Dropbox path, long code) — without it, min-w-0
          alone still lets that token push past the row's right edge instead
          of breaking onto a second line. */}
      <span className="min-w-0 break-words text-right font-medium text-slate-900">{value}</span>
    </div>
  )
}
