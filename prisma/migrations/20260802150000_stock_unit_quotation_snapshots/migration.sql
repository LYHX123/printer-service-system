-- Stock Unit field becomes nullable free text (was a required String with an
-- implicit "pcs" default baked into app code only). Relaxing a NOT NULL
-- constraint never touches existing row data — historical rows keep whatever
-- value they already had ("pcs" for most, since that was the old code default).
ALTER TABLE "SparePart" ALTER COLUMN "unit" DROP NOT NULL;

-- QuotationItem: two new snapshot fields, following the exact pattern of the
-- existing brandSnapshot/nameSnapshot/modelSnapshot/specificationSnapshot
-- fields — frozen at quotation-save time so later edits to the SparePart
-- record (or its picture) never change the wording/image of a quotation that
-- already quoted it. Purely additive, nullable, no backfill: existing
-- QuotationItem rows simply have both new columns as NULL, and the Quotation
-- Excel generator falls back to the live SparePart record for those.
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "unitSnapshot" TEXT;
ALTER TABLE "QuotationItem" ADD COLUMN IF NOT EXISTS "pictureSnapshot" TEXT;
