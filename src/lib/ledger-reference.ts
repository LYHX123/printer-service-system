/**
 * Sales Ledger `orderNo` is free text — sometimes a copied Invoice number
 * (`INV{YYYY}{MM}-{NNN}`), sometimes blank, sometimes arbitrary. To sort
 * "newest reference first" without doing numeric-unsafe string sorting on
 * a mixed-format column, every row gets a precomputed (referenceYear,
 * referenceSequence) pair. Rows that can't be parsed are left as (null,
 * null) and sort last — never guessed.
 */

const INVOICE_STYLE = /^INV(\d{4})(\d{2})-(\d+)$/i
const TRAILING_DIGITS = /(\d+)\s*$/
const MAX_SEQUENCE_DIGITS = 9

export interface ParsedSalesReference {
  referenceYear: number | null
  referenceSequence: number | null
}

export function parseSalesReference(
  orderNo: string | null | undefined,
  fallbackDate: Date
): ParsedSalesReference {
  const trimmed = orderNo?.trim()
  if (!trimmed) return { referenceYear: null, referenceSequence: null }

  const invoiceMatch = trimmed.match(INVOICE_STYLE)
  if (invoiceMatch) {
    return {
      referenceYear: Number(invoiceMatch[1]),
      referenceSequence: Number(invoiceMatch[3]),
    }
  }

  const trailingMatch = trimmed.match(TRAILING_DIGITS)
  if (trailingMatch && trailingMatch[1].length <= MAX_SEQUENCE_DIGITS) {
    return {
      referenceYear: fallbackDate.getFullYear(),
      referenceSequence: Number(trailingMatch[1]),
    }
  }

  return { referenceYear: null, referenceSequence: null }
}
