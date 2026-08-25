import Link from "next/link"
import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface AppCardProps {
  href?: string
  onClick?: () => void
  children: ReactNode
  className?: string
  showChevron?: boolean
  /**
   * An interactive element (e.g. AppActionMenu) rendered as a sibling of the
   * tap target rather than inside it — a button nested inside the card's own
   * Link/button would be invalid HTML and would also trigger the card's own
   * navigation on every click. When set, the chevron is hidden (the trailing
   * slot is the affordance instead) and the outer element becomes a plain
   * `div` wrapping two independent tap zones side by side.
   */
  trailing?: ReactNode
}

// The one shared tappable-row surface for App-mode list content (Customers,
// Stock categories, ...) — border/radius/padding/tap-feedback defined once
// here so every mobile list card looks and behaves consistently. Content is
// entirely up to the caller; this only owns the card "shell".
export function AppCard({ href, onClick, children, className, showChevron = true, trailing }: AppCardProps) {
  const isInteractive = Boolean(href || onClick)
  const classes = cn(
    "flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors",
    isInteractive && "active:bg-slate-50",
    className
  )

  if (trailing) {
    const tapZoneClasses = cn("min-w-0 flex-1", isInteractive && "active:opacity-70 transition-opacity")
    const tapZone = href ? (
      <Link href={href} className={tapZoneClasses}>
        {children}
      </Link>
    ) : onClick ? (
      <button type="button" onClick={onClick} className={cn(tapZoneClasses, "text-left")}>
        {children}
      </button>
    ) : (
      <div className={tapZoneClasses}>{children}</div>
    )
    return (
      // items-start (not -center): trailing is usually a single-row control
      // (⋮ menu) beside content that can run to 2-3 rows — top-aligning it
      // against the first row reads better than centering it against the
      // whole card's height.
      <div className={cn("flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3", className)}>
        {tapZone}
        {trailing}
      </div>
    )
  }

  const content = (
    <>
      <div className="min-w-0 flex-1">{children}</div>
      {showChevron && isInteractive && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />}
    </>
  )

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(classes, "w-full text-left")}>
        {content}
      </button>
    )
  }
  return <div className={classes}>{content}</div>
}
