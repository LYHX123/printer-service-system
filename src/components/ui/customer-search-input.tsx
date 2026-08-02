"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"

interface CustomerOption {
  id: string
  companyName: string
  name: string | null
  code: string
}

interface CustomerSearchInputProps {
  value: string
  onChange: (name: string, customerId: string) => void
  error?: string
  placeholder?: string
}

/** Type-ahead customer search against /api/customers/search — shared by SalesLedgerModal and LedgerEntryModal (Customer Receipt allocation). */
export function CustomerSearchInput({ value, onChange, error, placeholder }: CustomerSearchInputProps) {
  const [results, setResults] = useState<CustomerOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    onChange(val, "")

    if (timerRef.current) clearTimeout(timerRef.current)
    if (!val.trim()) {
      setResults([])
      setOpen(false)
      return
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/customers/search?q=${encodeURIComponent(val.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.customers ?? [])
          setOpen(true)
        }
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  function select(c: CustomerOption) {
    setResults([])
    setOpen(false)
    onChange(c.companyName, c.id)
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={handleChange}
        placeholder={placeholder ?? "Type to search customers or enter name…"}
        className={error ? "border-red-400" : ""}
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">…</span>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-baseline gap-2"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(c)}
              >
                <span className="font-medium text-slate-900">{c.companyName}</span>
                {c.name && <span className="text-xs text-slate-500">{c.name}</span>}
                <span className="text-xs text-slate-400 ml-auto">{c.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && results.length === 0 && value.trim() && (
        <div className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-sm mt-1 px-3 py-2 text-sm text-slate-400">
          No customers found — name will be saved as entered.
        </div>
      )}
    </div>
  )
}
