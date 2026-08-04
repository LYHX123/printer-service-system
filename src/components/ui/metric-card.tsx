import { type ReactNode } from "react"
import Link from "next/link"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "./skeleton"

interface MetricCardProps {
  label: ReactNode
  value: ReactNode
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
  /** Overrides the value's default `text-3xl` sizing — for cards whose value can run long (e.g. formatted currency) and needs to stay on one line at a smaller/responsive size instead of wrapping. */
  valueClassName?: string
  /** Lets a long label wrap onto a second line instead of the default single-line ellipsis truncation — opt-in, defaults to the existing truncate behavior so every other caller is unaffected. */
  labelWrap?: boolean
  /** Overrides the icon box's default `h-10 w-10` sizing. */
  iconSizeClassName?: string
  /**
   * Restructures the card to label+icon on top, value pinned to the bottom via
   * `mt-auto` — combined with a fixed card `min-h` (passed through `className`) and
   * `labelWrap`'s reserved label height, this keeps every value sitting at the same Y
   * position in a row of cards regardless of whether an individual label wraps to one or
   * two lines. Opt-in (defaults to false, current top-clustered layout unchanged) since
   * this is a real visual change other MetricCard callers haven't asked for.
   */
  pinValueBottom?: boolean
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
  valueClassName,
  labelWrap = false,
  iconSizeClassName,
  pinValueBottom = false,
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
        pinValueBottom && "flex flex-col",
        href && "hover:border-blue-300 hover:shadow-sm transition-all",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-xs font-medium uppercase tracking-wide text-slate-500",
              labelWrap ? "min-h-[2.5rem] break-words" : "truncate"
            )}
          >
            {label}
          </p>
          {!pinValueBottom && <p className={cn("mt-2 font-bold text-slate-900", valueClassName ?? "text-3xl")}>{value}</p>}
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
              "ml-3 flex shrink-0 items-center justify-center rounded-lg",
              iconSizeClassName ?? "h-10 w-10",
              iconBg
            )}
          >
            {icon}
          </div>
        )}
      </div>
      {pinValueBottom && <p className={cn("mt-auto pt-2 font-bold text-slate-900", valueClassName ?? "text-3xl")}>{value}</p>}
    </div>
  )

  return href ? <Link href={href}>{content}</Link> : content
}
