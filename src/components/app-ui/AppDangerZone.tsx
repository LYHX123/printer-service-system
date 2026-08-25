"use client"

import type { ReactNode } from "react"

interface AppDangerZoneProps {
  label: ReactNode
  onClick: () => void
  disabled?: boolean
  icon?: ReactNode
}

// The one bottom-of-page destructive action on a mobile detail page (Delete
// task/quotation/delivery/invoice/user/...) — visually separated (its own
// spacing, red outline, never grouped with primary/secondary actions) so it
// can't be triggered by a mis-tap the way a row of equal-weight buttons could.
export function AppDangerZone({ label, onClick, disabled, icon }: AppDangerZoneProps) {
  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 text-sm font-medium text-red-600 transition-colors active:bg-red-50 disabled:pointer-events-none disabled:opacity-50"
      >
        {icon}
        {label}
      </button>
    </div>
  )
}
