-- Invoice Dropbox Phase 1 — one row per (invoice, file type). No versioning:
-- an Invoice's official file is always "{InvoiceNumber}.{ext}" (invoiceNumber
-- is already globally unique), so a re-sync just overwrites the same
-- Dropbox path and updates this same row. Purely additive: does not touch
-- Invoice, InvoiceItem, or any Quotation-related table.

-- CreateEnum
CREATE TYPE "InvoiceFileType" AS ENUM ('PDF', 'XLSX');

-- CreateTable
CREATE TABLE "InvoiceDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "fileType" "InvoiceFileType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageProvider" "DocumentStorageProvider" NOT NULL DEFAULT 'LOCAL',
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InvoiceDocument_invoiceId_fileType_key" ON "InvoiceDocument"("invoiceId", "fileType");

CREATE INDEX "InvoiceDocument_invoiceId_idx" ON "InvoiceDocument"("invoiceId");

DO $$ BEGIN
    ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_invoiceId_fkey"
        FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
