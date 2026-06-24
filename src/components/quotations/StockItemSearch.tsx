"use client"

import { useMemo, useRef, useState } from "react"
import Image from "next/image"
import { ImageOff, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/utils"
import type { SparePartOption } from "@/lib/data/inventory"

interface StockItemSearchProps {
  spareParts: SparePartOption[]
  onSelect: (part: SparePartOption) => void
}

export function StockItemSearch({ spareParts, onSelect }: StockItemSearchProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return spareParts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.partNumber.toLowerCase().includes(q) ||
          (p.brand ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [query, spareParts])

  function handleSelect(part: SparePartOption) {
    onSelect(part)
    setQuery("")
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        type="search"
        icon={<Search className="h-4 w-4" />}
        placeholder="Search stock items by brand, name or part number…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && query.trim() && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-400">No stock items match &quot;{query}&quot;.</p>
          ) : (
            results.map((part) => (
              <button
                key={part.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(part)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                  {part.imageUrl ? (
                    <Image src={part.imageUrl} alt={part.name} width={40} height={40} className="h-full w-full object-cover" unoptimized />
                  ) : (
                    <ImageOff className="h-4 w-4 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {part.brand ? `${part.brand} — ` : ""}{part.name}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">{part.partNumber}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-medium text-slate-700">{formatCurrency(Number(part.sellingPrice))}</p>
                  <p className="text-xs text-slate-400">{part.stock?.quantity ?? 0} {part.unit} in stock</p>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
