import type { FocusEvent } from "react"

/**
 * Selects an input's entire current value on focus, so a default placeholder
 * value (e.g. Quantity defaulting to 1, Unit Price defaulting to 0) is
 * overwritten by simply typing — no Backspace/Delete/Ctrl+A needed first.
 * Shared by QuotationForm and DirectInvoiceForm's Quantity/Unit Price fields
 * (both forms are reused for create AND edit, so this covers all four flows).
 */
export function selectOnFocus(e: FocusEvent<HTMLInputElement>) {
  e.currentTarget.select()
}
