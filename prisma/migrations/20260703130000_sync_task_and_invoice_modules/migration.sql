-- Catch-up migration: captures schema drift applied to dev via `prisma db push`
-- since the last tracked migration (20260625210000_add_user_security_and_profile),
-- namely the Task module, TaskStepImage, SalesLedgerEntry.customerId, User.username,
-- and the Invoice / InvoiceItem tables.
--
-- Every statement is written to be safe to run against a production database whose
-- exact current state is not fully known: table/column/index creation is guarded with
-- IF NOT EXISTS, and constraints (which Postgres does not support IF NOT EXISTS for)
-- are wrapped in DO blocks that check pg_constraint / pg_type first. Nothing in this
-- file drops a table, drops a column, or deletes data.

-- ── Enum: TaskStatus ────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskStatus') THEN
        CREATE TYPE "TaskStatus" AS ENUM ('ACTIVE', 'COMPLETED');
    END IF;
END $$;

-- ── User: add username, relax email to nullable ────────────────────────────────
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- ── SalesLedgerEntry: add customerId ────────────────────────────────────────────
ALTER TABLE "SalesLedgerEntry" ADD COLUMN IF NOT EXISTS "customerId" TEXT;

-- ── Task module ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Task" (
    "id"          TEXT NOT NULL,
    "companyId"   TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "status"      "TaskStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TaskParticipant" (
    "id"     TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TaskParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TaskStep" (
    "id"          TEXT NOT NULL,
    "taskId"      TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "order"       INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TaskStepImage" (
    "id"           TEXT NOT NULL,
    "stepId"       TEXT NOT NULL,
    "url"          TEXT NOT NULL,
    "filename"     TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskStepImage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaskParticipant_taskId_userId_key" ON "TaskParticipant"("taskId", "userId");

-- ── Invoice module ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id"            TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "companyId"     TEXT NOT NULL,
    "quotationId"   TEXT NOT NULL,
    "customerId"    TEXT NOT NULL,
    "customerPin"   TEXT,
    "date"          TIMESTAMP(3) NOT NULL,
    "subtotal"      DECIMAL(12,2) NOT NULL,
    "vatPercent"    DECIMAL(5,2) NOT NULL,
    "vatAmount"     DECIMAL(12,2) NOT NULL,
    "totalAmount"   DECIMAL(12,2) NOT NULL,
    "receivedBy"    TEXT,
    "createdById"   TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InvoiceItem" (
    "id"          TEXT NOT NULL,
    "invoiceId"   TEXT NOT NULL,
    "partId"      TEXT,
    "description" TEXT NOT NULL,
    "unit"        TEXT,
    "quantity"    INTEGER NOT NULL,
    "unitPrice"   DECIMAL(10,2) NOT NULL,
    "amount"      DECIMAL(10,2) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- ── Foreign keys (guarded — Postgres has no ADD CONSTRAINT IF NOT EXISTS) ────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesLedgerEntry_customerId_fkey') THEN
        ALTER TABLE "SalesLedgerEntry"
            ADD CONSTRAINT "SalesLedgerEntry_customerId_fkey"
            FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Task_companyId_fkey') THEN
        ALTER TABLE "Task"
            ADD CONSTRAINT "Task_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Task_createdById_fkey') THEN
        ALTER TABLE "Task"
            ADD CONSTRAINT "Task_createdById_fkey"
            FOREIGN KEY ("createdById") REFERENCES "User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TaskParticipant_taskId_fkey') THEN
        ALTER TABLE "TaskParticipant"
            ADD CONSTRAINT "TaskParticipant_taskId_fkey"
            FOREIGN KEY ("taskId") REFERENCES "Task"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TaskParticipant_userId_fkey') THEN
        ALTER TABLE "TaskParticipant"
            ADD CONSTRAINT "TaskParticipant_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TaskStep_taskId_fkey') THEN
        ALTER TABLE "TaskStep"
            ADD CONSTRAINT "TaskStep_taskId_fkey"
            FOREIGN KEY ("taskId") REFERENCES "Task"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TaskStep_createdById_fkey') THEN
        ALTER TABLE "TaskStep"
            ADD CONSTRAINT "TaskStep_createdById_fkey"
            FOREIGN KEY ("createdById") REFERENCES "User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TaskStepImage_stepId_fkey') THEN
        ALTER TABLE "TaskStepImage"
            ADD CONSTRAINT "TaskStepImage_stepId_fkey"
            FOREIGN KEY ("stepId") REFERENCES "TaskStep"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TaskStepImage_uploadedById_fkey') THEN
        ALTER TABLE "TaskStepImage"
            ADD CONSTRAINT "TaskStepImage_uploadedById_fkey"
            FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_companyId_fkey') THEN
        ALTER TABLE "Invoice"
            ADD CONSTRAINT "Invoice_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_quotationId_fkey') THEN
        ALTER TABLE "Invoice"
            ADD CONSTRAINT "Invoice_quotationId_fkey"
            FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_customerId_fkey') THEN
        ALTER TABLE "Invoice"
            ADD CONSTRAINT "Invoice_customerId_fkey"
            FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_createdById_fkey') THEN
        ALTER TABLE "Invoice"
            ADD CONSTRAINT "Invoice_createdById_fkey"
            FOREIGN KEY ("createdById") REFERENCES "User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceItem_invoiceId_fkey') THEN
        ALTER TABLE "InvoiceItem"
            ADD CONSTRAINT "InvoiceItem_invoiceId_fkey"
            FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceItem_partId_fkey') THEN
        ALTER TABLE "InvoiceItem"
            ADD CONSTRAINT "InvoiceItem_partId_fkey"
            FOREIGN KEY ("partId") REFERENCES "SparePart"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
