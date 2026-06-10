import { type ReactNode } from "react"
import Link from "next/link"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "./skeleton"

interface MetricCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  iconBg?: string
  trend?: {
    value: number
    label?: string
    isPositive?: boolean
  }
  href?: string
  loading?: boolean
  className?: string
}

export function MetricCard({
  label,
  value,
  icon,
  iconBg = "bg-blue-50",
  trend,
  href,
  loading = false,
  className,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className={cn("rounded-xl border border-slate-200 bg-white p-5", className)}>
        <Skeleton className="h-3 w-28 mb-4" />
        <Skeleton className="h-8 w-20 mb-3" />
        <Skeleton className="h-3 w-24" />
      </div>
    )
  }

  const content = (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-5",
        href && "hover:border-blue-300 hover:shadow-sm transition-all",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500 truncate">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          {trend && (
            <div
              className={cn(
                "mt-2 flex items-center gap-1 text-xs font-medium",
                trend.isPositive ? "text-green-600" : "text-red-600"
              )}
            >
              {trend.isPositive ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              <span>
                {trend.isPositive ? "+" : ""}
                {trend.value}%{trend.label ? ` ${trend.label}` : ""}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              "ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
              iconBg
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
}
