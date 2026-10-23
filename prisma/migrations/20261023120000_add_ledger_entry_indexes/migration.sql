-- CreateIndex
CREATE INDEX "LedgerEntry_companyId_date_idx" ON "LedgerEntry"("companyId", "date");

-- CreateIndex
CREATE INDEX "LedgerEntry_companyId_type_idx" ON "LedgerEntry"("companyId", "type");

-- CreateIndex
CREATE INDEX "LedgerEntry_companyId_categoryId_idx" ON "LedgerEntry"("companyId", "categoryId");
