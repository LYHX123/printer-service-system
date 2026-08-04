-- Invoice Dropbox Phase 2 — ETR/eTIMS tax receipt upload.
--
-- Adds ETR as a third InvoiceFileType alongside the existing PDF/XLSX.
-- Reuses InvoiceDocument as-is (no new table): the existing
-- @@unique([invoiceId, fileType]) already guarantees "at most one current
-- ETR per invoice" the same way it already does for PDF/XLSX, so uploading
-- a replacement ETR just upserts this same row.
--
-- originalFileName is new and nullable — always null for existing PDF/XLSX
-- rows (those are system-generated, so "original filename" doesn't apply)
-- and set going forward for ETR uploads, so Invoice Detail can show the
-- user's real upload name next to the standardized Dropbox name.
ALTER TYPE "InvoiceFileType" ADD VALUE IF NOT EXISTS 'ETR';

ALTER TABLE "InvoiceDocument" ADD COLUMN IF NOT EXISTS "originalFileName" TEXT;
