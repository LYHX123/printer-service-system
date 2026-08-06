-- DropForeignKey
ALTER TABLE "InvoiceDocument" DROP CONSTRAINT "InvoiceDocument_invoiceId_fkey";

-- AddForeignKey
ALTER TABLE "InvoiceDocument" ADD CONSTRAINT "InvoiceDocument_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
