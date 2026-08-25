"use client"

import { useState, type ReactNode } from "react"
import { MoreVertical } from "lucide-react"
import { cn } from "@/lib/utils"

export interface AppActionMenuItem {
  label: ReactNode
  icon?: ReactNode
  onClick: () => void
  destructive?: boolean
  disabled?: boolean
}

interface AppActionMenuProps {
  items: AppActionMenuItem[]
  ariaLabel?: string
}

// Compact "⋮" overflow menu for App-mode list cards — the mobile alternative
// to a row of small inline icon buttons (SparePartActions on desktop, etc.).
// Meant to sit as AppCard's `trailing` slot, next to (not inside) the card's
// own tap target.
export function AppActionMenu({ items, ariaLabel = "Actions" }: AppActionMenuProps) {
  const [open, setOpen] = useState(false)

  if (items.length === 0) return null

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
        className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors active:bg-slate-100"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[168px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {items.map((item, i) => (
              <button
                key={i}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false)
                  item.onClick()
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors disabled:pointer-events-none disabled:opacity-50",
                  item.destructive ? "text-red-600 active:bg-red-50" : "text-slate-700 active:bg-slate-50"
                )}
              >
                {item.icon && <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
