-- Business process refactor: manual Quotation/Invoice numbering with natural sort,
-- 1 Quotation -> 1 Invoice, Invoice DIRECT source + DRAFT-by-default, explicit
-- Invoice -> Sales Ledger linkage, and Receipt Allocation (multi-invoice payment
-- allocation) for the general Ledger's Income entries.
--
-- Written by hand (not via `prisma migrate dev`), following the same convention as
-- 20260731220000_add_stock_invoice_shopaccount_upgrade: the DDL portion below was
-- generated with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
-- --script` against the REAL dev database (not the shadow db, which has a pre-existing
-- gap — see that migration's own comment), then hardened with IF NOT EXISTS / DO $$
-- EXCEPTION guards and hand-written backfill UPDATEs were added for the data-migration
-- portions Prisma cannot infer (numeric sort keys, Invoice<->SalesLedgerEntry linkage).
-- All changes are additive (new nullable columns / new table / widened nullability on
-- Invoice.quotationId); no existing data is dropped or reset.

-- ─── Enums ─────────────────────────────────────────────────────────────────

CREATE TYPE "InvoiceSource" AS ENUM ('FROM_QUOTATION', 'DIRECT');

-- ─── Invoice: optional/unique quotationId, source, sort number, DRAFT default ──
-- quotationId becomes optional+unique so a Direct invoice can have none, and a
-- Quotation can have at most one Invoice going forward (existing rows keep their
-- current quotationId value — this only widens nullability, nothing is cleared).
-- status's DEFAULT changes to DRAFT for future inserts only; existing CONFIRMED
-- rows are untouched (ALTER COLUMN SET DEFAULT never rewrites existing rows).

DO $$ BEGIN
  ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_quotationId_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "invoiceSortNumber" INTEGER,
  ADD COLUMN IF NOT EXISTS "source" "InvoiceSource" NOT NULL DEFAULT 'FROM_QUOTATION',
  ALTER COLUMN "quotationId" DROP NOT NULL,
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- ─── Quotation: sort number ──────────────────────────────────────────────────

ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "quotationSortNumber" INTEGER;

-- ─── LedgerEntry: optional customer link (for customer-receipt Income entries) ─

ALTER TABLE "LedgerEntry" ADD COLUMN IF NOT EXISTS "customerId" TEXT;

-- ─── SalesLedgerEntry: optional, unique link back to the Invoice it was created from ──

ALTER TABLE "SalesLedgerEntry" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;

-- ─── ReceiptAllocation (new): one row per receipt-to-invoice application ───────

CREATE TABLE IF NOT EXISTS "ReceiptAllocation" (
    "id" TEXT NOT NULL,
    "ledgerEntryId" TEXT NOT NULL,
    "salesLedgerEntryId" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(12,2) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptAllocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReceiptAllocation_ledgerEntryId_idx" ON "ReceiptAllocation"("ledgerEntryId");
CREATE INDEX IF NOT EXISTS "ReceiptAllocation_salesLedgerEntryId_idx" ON "ReceiptAllocation"("salesLedgerEntryId");

-- ─── Backfill: numeric sort keys from the trailing digit run of each number ────
-- Postgres ARE regex (the default flavor) supports \d as [[:digit:]]. Verified
-- manually against this project's actual data, including a non-standard legacy
-- format ("Q-2026-0001" -> 1) — substring() returns NULL (not an error) when no
-- trailing digits exist at all, which is the intended "unsortable, falls back to
-- createdAt" behavior for such rows.

UPDATE "Quotation"
SET "quotationSortNumber" = substring("quotationNumber" from '(\d+)$')::int
WHERE "quotationSortNumber" IS NULL;

UPDATE "Invoice"
SET "invoiceSortNumber" = substring("invoiceNumber" from '(\d+)$')::int
WHERE "invoiceSortNumber" IS NULL;

-- ─── Backfill: link legacy SalesLedgerEntry rows to their Invoice by exact ─────
-- orderNo = invoiceNumber match (this is exactly how generateInvoice() named the
-- orderNo when it used to auto-mirror an Invoice into the Sales Ledger). Guarded
-- with ROW_NUMBER() so that if more than one SalesLedgerEntry row happens to
-- share the same orderNo for the same Invoice (not the case in this project's
-- current data, but not provable false for other environments), only the oldest
-- is linked — the new invoiceId column is UNIQUE, so an unguarded UPDATE could
-- otherwise fail entirely for a batch that should mostly succeed.

WITH ranked AS (
  SELECT s."id" AS entry_id, i."id" AS invoice_id,
         ROW_NUMBER() OVER (PARTITION BY i."id" ORDER BY s."createdAt") AS rn
  FROM "SalesLedgerEntry" s
  JOIN "Invoice" i ON s."orderNo" = i."invoiceNumber"
  WHERE s."invoiceId" IS NULL
)
UPDATE "SalesLedgerEntry" s
SET "invoiceId" = ranked.invoice_id
FROM ranked
WHERE s."id" = ranked.entry_id AND ranked.rn = 1;

-- ─── Unique indexes (added after backfill so the guarded backfill above never ──
-- races against the constraint it's populating data for) ───────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_quotationId_key" ON "Invoice"("quotationId");
CREATE UNIQUE INDEX IF NOT EXISTS "SalesLedgerEntry_invoiceId_key" ON "SalesLedgerEntry"("invoiceId");

-- ─── Foreign keys ───────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SalesLedgerEntry" ADD CONSTRAINT "SalesLedgerEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ReceiptAllocation" ADD CONSTRAINT "ReceiptAllocation_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ReceiptAllocation" ADD CONSTRAINT "ReceiptAllocation_salesLedgerEntryId_fkey" FOREIGN KEY ("salesLedgerEntryId") REFERENCES "SalesLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ReceiptAllocation" ADD CONSTRAINT "ReceiptAllocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
