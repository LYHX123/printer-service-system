"use client"

import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface CollapsibleProps {
  header: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}

/** Simple disclosure widget — parent-level checkbox lives in `header`, this only owns the expand/collapse chevron. */
export function Collapsible({ header, children, defaultOpen = false, className }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white", className)}>
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label={open ? "Collapse" : "Expand"}
          aria-expanded={open}
        >
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open ? "" : "-rotate-90")} />
        </button>
        <div className="flex-1 min-w-0">{header}</div>
      </div>
      {open && (
        <div className="border-t border-slate-100 pl-7 pr-2 py-2 space-y-1.5">
          {children}
        </div>
      )}
    </div>
  )
}
