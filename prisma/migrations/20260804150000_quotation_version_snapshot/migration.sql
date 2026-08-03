-- Quotation Version Snapshot — the immutable business-data snapshot that
-- QuotationDocument's V1/V2/V3 files were actually generated from. Purely
-- additive: does not touch Quotation, QuotationItem, or QuotationDocument
-- at all. Existing V1/V2 quotations created before this migration have no
-- row here (see the "historical data unavailable" handling in
-- src/lib/data/quotations.ts) — their Dropbox files are untouched and
-- remain downloadable; only their *business-data view* falls back to a
-- clear "unavailable" message instead of ever showing today's live data
-- mislabeled as an old version.
CREATE TABLE "QuotationVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "QuotationVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuotationVersion_quotationId_version_key" ON "QuotationVersion"("quotationId", "version");

CREATE INDEX "QuotationVersion_quotationId_idx" ON "QuotationVersion"("quotationId");

DO $$ BEGIN
    ALTER TABLE "QuotationVersion" ADD CONSTRAINT "QuotationVersion_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "QuotationVersion" ADD CONSTRAINT "QuotationVersion_quotationId_fkey"
        FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "QuotationVersion" ADD CONSTRAINT "QuotationVersion_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
