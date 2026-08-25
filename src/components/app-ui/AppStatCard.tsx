import Link from "next/link"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface AppStatCardProps {
  label: ReactNode
  value: ReactNode
  icon?: ReactNode
  iconBg?: string
  href?: string
  valueClassName?: string
}

// Compact two-column dashboard stat tile — icon + label + value in one tight
// row instead of the desktop MetricCard's tall stacked layout. Deliberately
// separate from MetricCard rather than adding more variance to it: the
// desktop card's design (label/icon on top, value pinned bottom, fixed
// min-height for row alignment) solves a different problem than this one
// does, and forcing both shapes through one component would make neither
// simple.
export function AppStatCard({ label, value, icon, iconBg = "bg-blue-50", href, valueClassName }: AppStatCardProps) {
  const classes = cn(
    "flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-colors",
    href && "active:bg-slate-50"
  )
  const content = (
    <>
      {icon && (
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", iconBg)}>{icon}</div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10.5px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className={cn("font-bold leading-tight text-slate-900", valueClassName ?? "text-lg")}>{value}</p>
      </div>
    </>
  )
  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  )
}
