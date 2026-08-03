-- Quotation Dropbox Phase 1 — one row per (quotation, file type, version).
-- This phase only ever writes version 1 ("QTxxxxx-SHORTNAME-V1.pdf/.xlsx");
-- the version column exists so a later Adjust/V2/V3 phase has somewhere to
-- record subsequent versions without another schema change, but nothing here
-- builds that workflow yet. Reuses the existing DocumentStorageProvider enum
-- (LOCAL/DROPBOX) already introduced for Customer Documents.

-- CreateEnum
CREATE TYPE "QuotationFileType" AS ENUM ('PDF', 'XLSX');

-- CreateTable
CREATE TABLE "QuotationDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "fileType" "QuotationFileType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "storageKey" TEXT NOT NULL,
    "storageProvider" "DocumentStorageProvider" NOT NULL DEFAULT 'LOCAL',
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuotationDocument_quotationId_idx" ON "QuotationDocument"("quotationId");

-- CreateIndex (uniqueness — makes re-syncing idempotent per quotation/fileType/version)
CREATE UNIQUE INDEX "QuotationDocument_quotationId_fileType_version_key"
  ON "QuotationDocument"("quotationId", "fileType", "version");

DO $$ BEGIN
    ALTER TABLE "QuotationDocument" ADD CONSTRAINT "QuotationDocument_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "QuotationDocument" ADD CONSTRAINT "QuotationDocument_quotationId_fkey"
        FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
