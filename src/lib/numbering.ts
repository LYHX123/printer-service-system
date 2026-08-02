/**
 * Shared helper for the manual business-number fields (Quotation.quotationNumber,
 * Invoice.invoiceNumber) and their paired natural-sort integer columns
 * (quotationSortNumber/invoiceSortNumber). Mirrors the same trailing-digit-run
 * extraction used by the migration backfill in
 * prisma/migrations/20260801120000_invoice_salesledger_receipt_refactor/migration.sql
 * (Postgres `substring(value from '(\d+)$')`), so newly created rows sort
 * consistently with historically backfilled ones.
 *
 * Returns null when the value has no trailing digit run at all (e.g. a number
 * with no digits) — callers store null in that case, and list queries fall back
 * to `createdAt DESC` for those rows via `nulls: "last"` ordering.
 */
export function extractTrailingNumber(value: string): number | null {
  const match = value.match(/(\d+)$/)
  if (!match) return null
  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) ? parsed : null
}

/** Trims and uppercases a user-entered business number (Quotation/Invoice) for consistent, case-insensitive-safe storage and comparison. */
export function normalizeBusinessNumber(value: string): string {
  return value.trim().toUpperCase()
}
