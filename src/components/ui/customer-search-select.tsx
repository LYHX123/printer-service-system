"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface CustomerSearchOption {
  id: string
  companyName: string
  shortName?: string | null
}

interface CustomerSearchSelectProps {
  customers: CustomerSearchOption[]
  /** Selected customer's id — the only thing the form actually saves. */
  value: string
  onChange: (customerId: string) => void
  disabled?: boolean
  placeholder?: string
  error?: string
  id?: string
  /** How many customers to show before the user types anything. */
  initialResultCount?: number
}

function formatLabel(customer: CustomerSearchOption) {
  return customer.companyName
}

/**
 * Searchable customer combobox: type to filter by company name or short name
 * (case-insensitive), pick a result with mouse/keyboard, and the field always
 * displays the selected customer's name while the form only ever holds its id.
 * Free-typed text that doesn't match a result is never treated as a selection.
 */
export function CustomerSearchSelect({
  customers,
  value,
  onChange,
  disabled,
  placeholder,
  error,
  id,
  initialResultCount = 8,
}: CustomerSearchSelectProps) {
  const selected = useMemo(() => customers.find((c) => c.id === value) ?? null, [customers, value])

  const [query, setQuery] = useState(() => (selected ? formatLabel(selected) : ""))
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Tracks the last id *this component* pushed via onChange, so the sync
  // effect below can tell "value changed because the parent reset/loaded a
  // different record" apart from "value changed because we just called
  // onChange ourselves" — otherwise re-syncing on every value change would
  // stomp the text the user is actively typing right after it clears the
  // previous selection.
  const lastEmitted = useRef(value)

  function emit(customerId: string) {
    lastEmitted.current = customerId
    onChange(customerId)
  }

  useEffect(() => {
    if (value === lastEmitted.current) return
    lastEmitted.current = value
    setQuery(selected ? formatLabel(selected) : "")
  }, [value, selected])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery(selected ? formatLabel(selected) : "")
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [selected])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return customers.slice(0, initialResultCount)
    return customers.filter(
      (c) => c.companyName.toLowerCase().includes(q) || (c.shortName ?? "").toLowerCase().includes(q)
    )
  }, [customers, query, initialResultCount])

  function selectCustomer(customer: CustomerSearchOption) {
    setQuery(formatLabel(customer))
    setOpen(false)
    emit(customer.id)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    setOpen(true)
    setHighlightedIndex(0)
    // Typed text no longer corresponds to the previous selection — a
    // customerId must come from picking a result, never from free text.
    if (value) emit("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true)
      return
    }
    if (!open) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const customer = results[highlightedIndex]
      if (customer) selectCustomer(customer)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      setQuery(selected ? formatLabel(selected) : "")
    }
  }

  function handleBlur() {
    // Selecting an option uses onMouseDown+preventDefault (below), so a real
    // blur here means the user clicked/tabbed away without picking a result
    // — revert to the last valid selection rather than keep free-typed text.
    setOpen(false)
    setQuery(selected ? formatLabel(selected) : "")
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        id={id}
        value={query}
        onChange={handleInputChange}
        onFocus={(e) => {
          setOpen(true)
          e.target.select()
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Search customer…"}
        error={error}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && !disabled && (
        results.length > 0 ? (
          <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {results.map((c, index) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => selectCustomer(c)}
                  className={cn(
                    "flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm transition-colors",
                    index === highlightedIndex ? "bg-blue-50" : "hover:bg-slate-50"
                  )}
                >
                  <span className="font-medium text-slate-900">{c.companyName}</span>
                  {c.shortName && <span className="text-xs text-slate-500">{c.shortName}</span>}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 shadow-sm">
            {query.trim() ? "No matching customers found." : "No customers available."}
          </div>
        )
      )}
    </div>
  )
}
