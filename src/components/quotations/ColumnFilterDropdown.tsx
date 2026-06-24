"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown } from "lucide-react"

interface ColumnFilterDropdownProps {
  label: string
  allLabel: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}

export function ColumnFilterDropdown({ label, allLabel, options, value, onChange }: ColumnFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const isActive = value !== ""

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-1">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded p-0.5 transition-colors ${isActive ? "text-blue-600" : "text-slate-400 hover:text-slate-600"}`}
        aria-label={`Filter by ${label}`}
      >
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-48 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 normal-case font-normal text-slate-700 shadow-lg">
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false) }}
            className={`block w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 ${value === "" ? "font-semibold text-blue-600" : ""}`}
          >
            {allLabel}
          </button>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`block w-full truncate px-3 py-1.5 text-left text-xs hover:bg-slate-50 ${value === opt.value ? "font-semibold text-blue-600" : ""}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
