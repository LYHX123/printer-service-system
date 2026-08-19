-- CreateEnum
CREATE TYPE "DeliveryFileType" AS ENUM ('PDF', 'XLSX');

-- AlterEnum
ALTER TYPE "InvoiceSource" ADD VALUE 'FROM_DELIVERY';

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "deliveryNumber" TEXT NOT NULL,
    "deliverySortNumber" INTEGER,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerBranchId" TEXT,
    "quotationId" TEXT,
    "reference" TEXT,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "invoiceId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryItem" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "brandSnapshot" TEXT,
    "nameSnapshot" TEXT,
    "modelSnapshot" TEXT,
    "specificationSnapshot" TEXT,
    "unitSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryDocument" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "fileType" "DeliveryFileType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageProvider" "DocumentStorageProvider" NOT NULL DEFAULT 'LOCAL',
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_deliveryNumber_key" ON "Delivery"("deliveryNumber");

-- CreateIndex
CREATE INDEX "Delivery_customerId_idx" ON "Delivery"("customerId");

-- CreateIndex
CREATE INDEX "Delivery_quotationId_idx" ON "Delivery"("quotationId");

-- CreateIndex
CREATE INDEX "Delivery_invoiceId_idx" ON "Delivery"("invoiceId");

-- CreateIndex
CREATE INDEX "DeliveryDocument_deliveryId_idx" ON "DeliveryDocument"("deliveryId");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryDocument_deliveryId_fileType_key" ON "DeliveryDocument"("deliveryId", "fileType");

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_customerBranchId_fkey" FOREIGN KEY ("customerBranchId") REFERENCES "CustomerBranch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryItem" ADD CONSTRAINT "DeliveryItem_partId_fkey" FOREIGN KEY ("partId") REFERENCES "SparePart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryDocument" ADD CONSTRAINT "DeliveryDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryDocument" ADD CONSTRAINT "DeliveryDocument_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

