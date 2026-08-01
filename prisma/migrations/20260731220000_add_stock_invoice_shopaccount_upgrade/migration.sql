-- Feature upgrade: unified Stock fields, Invoice status/stock-deduction workflow,
-- Quotation/Invoice item snapshots, and the new Shop Account module.
--
-- Written by hand (not via `prisma migrate dev`) because this project's migration
-- history has a pre-existing gap: QuotationItem was originally created out-of-band
-- via `db push` (see migration 20260625080000's own comment), so the shadow database
-- that `migrate dev` replays from scratch cannot recreate it and fails before this
-- migration can even be diffed. The SQL below was generated with
-- `prisma migrate diff --from-config-datasource ... --to-schema ...` against the
-- REAL dev database (not the shadow db), so it reflects an accurate, additive diff.
-- This migration is applied directly, then marked applied via
-- `prisma migrate resolve --applied`, so `prisma migrate deploy` on any other
-- environment will treat it identically to a normally-generated migration.
-- All changes are additive (new nullable columns / new tables); no existing data
-- is dropped, reset, or made NOT NULL without a backfill first.

-- ─── Enums ─────────────────────────────────────────────────────────────────

CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

ALTER TYPE "LedgerPaymentMethod" ADD VALUE IF NOT EXISTS 'CARD';
ALTER TYPE "LedgerPaymentMethod" ADD VALUE IF NOT EXISTS 'OTHER';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'REVERSAL';

-- ─── Stock: unified Brand/Name/Model/Specification/Quantity/Picture fields ──
-- partNumber/unit/unitCost/sellingPrice/reorderLevel/description/supplier/
-- compatibleWith/category/imageUrl are all KEPT (still read by Quotation,
-- Invoice, PurchaseOrder and low-stock logic) — only the Stock create/edit
-- FORM stops exposing them; see InventoryForm.tsx.

ALTER TABLE "SparePart" ADD COLUMN IF NOT EXISTS "model" TEXT;
ALTER TABLE "SparePart" ADD COLUMN IF NOT EXISTS "specification" TEXT;

-- Backfill: fold existing description/compatibleWith/supplier text into the
-- new specification field so nothing entered previously is lost, per the
-- user's explicit migration rule. Only rows where specification is still
-- null are touched (idempotent / safe to re-run).
UPDATE "SparePart"
SET "specification" = NULLIF(
  TRIM(BOTH E'\n' FROM CONCAT_WS(
    E'\n',
    "description",
    CASE WHEN "compatibleWith" IS NOT NULL AND "compatibleWith" <> '' THEN 'Compatible with: ' || "compatibleWith" ELSE NULL END,
    CASE WHEN "supplier" IS NOT NULL AND "supplier" <> '' THEN 'Supplier: ' || "supplier" ELSE NULL END
  )),
  ''
)
WHERE "specification" IS NULL;

-- ─── Stock Movement: extend InventoryTransaction ────────────────────────────

ALTER TABLE "InventoryTransaction" ADD COLUMN IF NOT EXISTS "quantityBefore" INTEGER;
ALTER TABLE "InventoryTransaction" ADD COLUMN IF NOT EXISTS "quantityAfter" INTEGER;
ALTER TABLE "InventoryTransaction" ADD COLUMN IF NOT EXISTS "referenceType" TEXT;

-- Backfill quantityBefore/After for existing rows via a running-balance
-- window function per part (ordered chronologically) — this IS fully
-- derivable from existing quantity deltas, so no value is left guessed.
WITH ordered AS (
  SELECT
    "id",
    SUM("quantity") OVER (PARTITION BY "partId" ORDER BY "createdAt", "id" ROWS UNBOUNDED PRECEDING) AS running_after
  FROM "InventoryTransaction"
)
UPDATE "InventoryTransaction" it
SET
  "quantityAfter" = ordered.running_after,
  "quantityBefore" = ordered.running_after - it."quantity"
FROM ordered
WHERE it."id" = ordered."id" AND it."quantityAfter" IS NULL;

UPDATE "InventoryTransaction"
SET "referenceType" = 'INITIAL_MIGRATION'
WHERE "referenceType" IS NULL;

-- ─── Quotation / Invoice item snapshots ─────────────────────────────────────

ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "stockCategory" TEXT;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "brandSnapshot" TEXT;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "nameSnapshot" TEXT;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "modelSnapshot" TEXT;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "specificationSnapshot" TEXT;

UPDATE "QuotationItem" qi
SET
  "stockCategory" = sp."category"::TEXT,
  "brandSnapshot" = sp."brand",
  "nameSnapshot" = sp."name",
  "modelSnapshot" = sp."model",
  "specificationSnapshot" = sp."specification"
FROM "SparePart" sp
WHERE qi."partId" = sp."id" AND qi."stockCategory" IS NULL;

ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "stockCategory" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "brandSnapshot" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "nameSnapshot" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "modelSnapshot" TEXT;
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "specificationSnapshot" TEXT;

UPDATE "InvoiceItem" ii
SET
  "stockCategory" = sp."category"::TEXT,
  "brandSnapshot" = sp."brand",
  "nameSnapshot" = sp."name",
  "modelSnapshot" = sp."model",
  "specificationSnapshot" = sp."specification"
FROM "SparePart" sp
WHERE ii."partId" = sp."id" AND ii."stockCategory" IS NULL;

-- ─── Invoice: status + confirm/cancel workflow ──────────────────────────────
-- Existing invoices are backfilled to CONFIRMED (they already represent
-- finalized documents in current business use) but WITHOUT any retroactive
-- InventoryTransaction rows — deducting stock now for invoices that were
-- never linked to inventory movement in the first place would incorrectly
-- reduce current stock quantities. Only invoices confirmed going forward
-- (via the new confirmInvoice() service function) actually move stock.

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "status" "InvoiceStatus" NOT NULL DEFAULT 'CONFIRMED';
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "confirmedById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "cancelledById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

-- ─── Shop Account module (new, independent from Ledger) ─────────────────────

CREATE TABLE IF NOT EXISTS "ShopAccountCategory" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopAccountCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ShopAccountEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payee" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentMethod" "LedgerPaymentMethod" NOT NULL,
    "attachmentUrl" TEXT,
    "attachmentFileName" TEXT,
    "attachmentMimeType" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopAccountEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopAccountCategory_companyId_type_name_key" ON "ShopAccountCategory"("companyId", "type", "name");

DO $$ BEGIN
  ALTER TABLE "ShopAccountCategory" ADD CONSTRAINT "ShopAccountCategory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ShopAccountEntry" ADD CONSTRAINT "ShopAccountEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ShopAccountEntry" ADD CONSTRAINT "ShopAccountEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ShopAccountCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ShopAccountEntry" ADD CONSTRAINT "ShopAccountEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed the 10 default Shop Account categories (per company) from the spec.
-- isActive/admin-extensible afterwards — not hardcoded as enum values.
INSERT INTO "ShopAccountCategory" ("id", "companyId", "type", "name")
SELECT gen_random_uuid()::TEXT, c."id", cat.type::"LedgerEntryType", cat.name
FROM "Company" c
CROSS JOIN (VALUES
  ('EXPENSE', 'Stock Purchase'),
  ('EXPENSE', 'Transport'),
  ('EXPENSE', 'Delivery'),
  ('EXPENSE', 'Repair Tools'),
  ('EXPENSE', 'Office Expense'),
  ('EXPENSE', 'Utilities'),
  ('EXPENSE', 'Rent'),
  ('EXPENSE', 'Staff Expense'),
  ('EXPENSE', 'Miscellaneous'),
  ('INCOME', 'Other Income')
) AS cat(type, name)
ON CONFLICT ("companyId", "type", "name") DO NOTHING;
