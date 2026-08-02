-- Adds Invoice.remarks (nullable free-text) — needed for the Direct Invoice creation
-- form (spec: Customer / Invoice Number / Invoice Date / Items / Remarks), which has
-- no Quotation to inherit remarks from the way FROM_QUOTATION invoices do. Purely
-- additive, no backfill needed (existing rows simply have remarks = NULL).

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "remarks" TEXT;
