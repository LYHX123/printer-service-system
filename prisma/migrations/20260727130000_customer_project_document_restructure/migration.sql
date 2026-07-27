-- Customer -> Company + Project(CustomerBranch) + Document restructure.
-- Every statement is additive or loosens a constraint (never narrows/drops):
--   - Customer.phone becomes optional (was required; existing data unaffected)
--   - Customer/CustomerBranch gain new nullable columns
--   - CustomerDocument is a brand new table
--   - Quotation gains a nullable project link + nullable contact snapshot
-- No table, column, or row is dropped or deleted. Table/index/type creation is
-- guarded with IF NOT EXISTS; constraints (no IF NOT EXISTS support in
-- Postgres) are wrapped in DO $$ ... $$ blocks that check pg_constraint first,
-- matching this repo's existing 20260703130000_sync_task_and_invoice_modules
-- migration style.

-- ── Customer: relax phone to optional, add email/notes ──────────────────────
ALTER TABLE "Customer" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- ── CustomerBranch ("Project" in the UI): add contactEmail/notes + index ────
ALTER TABLE "CustomerBranch" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "CustomerBranch" ADD COLUMN IF NOT EXISTS "notes" TEXT;
CREATE INDEX IF NOT EXISTS "CustomerBranch_customerId_idx" ON "CustomerBranch"("customerId");

-- ── DocumentStorageProvider enum ─────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentStorageProvider') THEN
        CREATE TYPE "DocumentStorageProvider" AS ENUM ('LOCAL', 'DROPBOX');
    END IF;
END $$;

-- ── CustomerDocument ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CustomerDocument" (
    "id"               TEXT NOT NULL,
    "companyId"        TEXT NOT NULL,
    "customerId"       TEXT NOT NULL,
    "projectId"        TEXT,
    "documentType"     TEXT,
    "originalFileName" TEXT NOT NULL,
    "storageKey"       TEXT NOT NULL,
    "storageProvider"  "DocumentStorageProvider" NOT NULL DEFAULT 'LOCAL',
    "mimeType"         TEXT NOT NULL,
    "fileSize"         INTEGER NOT NULL,
    "uploadedById"     TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CustomerDocument_customerId_idx" ON "CustomerDocument"("customerId");
CREATE INDEX IF NOT EXISTS "CustomerDocument_projectId_idx" ON "CustomerDocument"("projectId");

-- ── Quotation: nullable project link + contact snapshot ─────────────────────
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "customerBranchId" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "contactName" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "contactAddress" TEXT;

-- ── Foreign keys (guarded) ────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerDocument_companyId_fkey') THEN
        ALTER TABLE "CustomerDocument"
            ADD CONSTRAINT "CustomerDocument_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerDocument_customerId_fkey') THEN
        ALTER TABLE "CustomerDocument"
            ADD CONSTRAINT "CustomerDocument_customerId_fkey"
            FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerDocument_projectId_fkey') THEN
        ALTER TABLE "CustomerDocument"
            ADD CONSTRAINT "CustomerDocument_projectId_fkey"
            FOREIGN KEY ("projectId") REFERENCES "CustomerBranch"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CustomerDocument_uploadedById_fkey') THEN
        ALTER TABLE "CustomerDocument"
            ADD CONSTRAINT "CustomerDocument_uploadedById_fkey"
            FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Quotation_customerBranchId_fkey') THEN
        ALTER TABLE "Quotation"
            ADD CONSTRAINT "Quotation_customerBranchId_fkey"
            FOREIGN KEY ("customerBranchId") REFERENCES "CustomerBranch"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
