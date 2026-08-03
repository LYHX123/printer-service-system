-- Quotation Dropbox Phase 2 — Adjust/Version/Approve/FINAL support.
--
-- Quotation.currentVersion: which Dropbox document version a quotation is
-- currently on. Starts at 1 (existing rows get 1 by the column default,
-- matching "they're all effectively V1" — no historical version files exist
-- for them yet, which is fine; the next Adjust on an old quotation will
-- correctly produce V2).
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "currentVersion" INTEGER NOT NULL DEFAULT 1;

-- QuotationDocument.isFinal: separates the Approve-time snapshot
-- ("QTxxxxx-SHORTNAME-FINAL.ext") from the numbered V1/V2/V3... rows —
-- never modeled as a version number (see schema.prisma comment). The old
-- 3-column unique constraint is replaced with a 4-column one that also
-- includes isFinal, so a FINAL row and its "approved from" version row can
-- coexist without colliding.
ALTER TABLE "QuotationDocument" ADD COLUMN IF NOT EXISTS "isFinal" BOOLEAN NOT NULL DEFAULT false;

DROP INDEX IF EXISTS "QuotationDocument_quotationId_fileType_version_key";

CREATE UNIQUE INDEX IF NOT EXISTS "QuotationDocument_quotationId_fileType_version_isFinal_key"
  ON "QuotationDocument"("quotationId", "fileType", "version", "isFinal");
