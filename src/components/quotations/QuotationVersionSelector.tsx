"use client"

import { useRouter } from "next/navigation"
import { Select } from "@/components/ui/select"

interface QuotationVersionSelectorProps {
  quotationId: string
  currentVersion: number
  hasFinal: boolean
  /** "final" or the version number currently being viewed (matches the page's own viewMode resolution). */
  value: "final" | number
}

/**
 * Navigates via query params (?version=N / ?view=final) rather than local
 * state, so the viewed version survives a page refresh/shared link — see
 * the Quotation Detail page's viewMode resolution.
 */
export function QuotationVersionSelector({ quotationId, currentVersion, hasFinal, value }: QuotationVersionSelectorProps) {
  const router = useRouter()

  function handleChange(next: string) {
    if (next === "final") router.push(`/quotations/${quotationId}?view=final`)
    else router.push(`/quotations/${quotationId}?version=${next}`)
  }

  const selectValue = value === "final" ? "final" : String(value)

  return (
    <Select
      value={selectValue}
      onChange={(e) => handleChange(e.target.value)}
      className="w-auto min-w-[10rem] py-1.5 text-xs"
    >
      {hasFinal && <option value="final">FINAL — Approved</option>}
      {Array.from({ length: currentVersion }, (_, i) => currentVersion - i).map((v) => (
        <option key={v} value={v}>
          {v === currentVersion ? `Version ${v} — Current` : `Version ${v}`}
        </option>
      ))}
    </Select>
  )
}
