/**
 * Sales Ledger `orderNo` is free text — sometimes a copied Invoice number
 * (`INV{YYYY}{MM}-{NNN}`, or variants like `INV-{YYYY}{MM}-{NNN}` /
 * `INV/{YYYY}{MM}/{NNN}`), sometimes blank, sometimes arbitrary. To sort
 * "newest reference first" without doing numeric-unsafe string sorting on
 * a mixed-format column, every row gets a precomputed (referenceYear,
 * referenceSequence) pair. Rows that can't be parsed are left as (null,
 * null) and sort last — never guessed.
 *
 * IMPORTANT: `referenceYear` does NOT store a plain 4-digit calendar year.
 * It stores a sortable "period" as `year * 100 + month` (e.g. July 2026 →
 * 202607). A plain calendar year would make `INV202606-999` (June, seq 999)
 * outrank `INV202607-010` (July, seq 10) once tie-broken by sequence, since
 * both would show the same year with month discarded. Folding month into
 * this field — instead of adding a new column — keeps the fix additive: no
 * migration, `referenceYear DESC` alone is enough to order by period first.
 */

// Matches INV{YYYY}{MM}-{NNN} with an optional separator ("-" or "/", or
// none) between "INV" and the digits, and a required one between the
// YYYYMM block and the sequence: INV202607-001, INV-202607-001,
// INV/202607/001, INV202607/001, etc.
const INVOICE_STYLE = /^INV[/-]?(\d{4})(\d{2})[/-](\d+)$/i
const TRAILING_DIGITS = /(\d+)\s*$/
const MAX_SEQUENCE_DIGITS = 9

export interface ParsedSalesReference {
  /** Sortable year+month period (YYYYMM), or null if unparseable. */
  referenceYear: number | null
  referenceSequence: number | null
}

function toPeriod(year: number, month: number): number {
  return year * 100 + month
}

export function parseSalesReference(
  orderNo: string | null | undefined,
  fallbackDate: Date
): ParsedSalesReference {
  const trimmed = orderNo?.trim()
  if (!trimmed) return { referenceYear: null, referenceSequence: null }

  const invoiceMatch = trimmed.match(INVOICE_STYLE)
  if (invoiceMatch) {
    const year = Number(invoiceMatch[1])
    const month = Number(invoiceMatch[2])
    if (month >= 1 && month <= 12) {
      return { referenceYear: toPeriod(year, month), referenceSequence: Number(invoiceMatch[3]) }
    }
    // "YYYY{MM}" block didn't hold a real month (e.g. INV202699-001) — fall
    // through to the generic trailing-digit handling below rather than
    // trusting a bogus period.
  }

  const trailingMatch = trimmed.match(TRAILING_DIGITS)
  if (trailingMatch && trailingMatch[1].length <= MAX_SEQUENCE_DIGITS) {
    return {
      referenceYear: toPeriod(fallbackDate.getFullYear(), fallbackDate.getMonth() + 1),
      referenceSequence: Number(trailingMatch[1]),
    }
  }

  return { referenceYear: null, referenceSequence: null }
}
