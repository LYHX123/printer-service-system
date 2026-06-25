-- AlterTable
-- QuotationItem was originally created (out-of-band, no tracked migration) before items were
-- linked to stock. Commit 4da785d added `partId`/`part` to the Prisma schema and was applied to
-- dev via `db push`, but the resulting column/constraint were never added to production.
ALTER TABLE "QuotationItem" ALTER COLUMN "description" DROP NOT NULL;
ALTER TABLE "QuotationItem" ADD COLUMN     "partId" TEXT;

-- AddForeignKey
ALTER TABLE "QuotationItem" ADD CONSTRAINT "QuotationItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "SparePart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
