-- Adds precomputed sort columns to SalesLedgerEntry so the Sales Record list
-- can order "newest reference number first" without trying to numerically
-- sort a free-text `orderNo` column at query time. Purely additive: both new
-- columns are nullable, no default, no data is touched by this migration —
-- existing rows get NULL until the backfill script
-- (scripts/backfill-sales-ledger-reference.ts) runs.

ALTER TABLE "SalesLedgerEntry" ADD COLUMN IF NOT EXISTS "referenceYear" INTEGER;
ALTER TABLE "SalesLedgerEntry" ADD COLUMN IF NOT EXISTS "referenceSequence" INTEGER;

CREATE INDEX IF NOT EXISTS "SalesLedgerEntry_companyId_referenceYear_referenceSequence_idx"
  ON "SalesLedgerEntry"("companyId", "referenceYear" DESC, "referenceSequence" DESC);
