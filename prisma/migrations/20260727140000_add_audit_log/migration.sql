-- Minimal, append-only activity log used by the Customer/Project/Document and
-- Quotation customer-linkage changes. Purely additive: new table only.

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id"            TEXT NOT NULL,
    "companyId"     TEXT NOT NULL,
    "entityType"    TEXT NOT NULL,
    "entityId"      TEXT NOT NULL,
    "action"        TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "metadata"      JSONB,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_companyId_entityType_entityId_idx"
  ON "AuditLog"("companyId", "entityType", "entityId");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_companyId_fkey') THEN
        ALTER TABLE "AuditLog"
            ADD CONSTRAINT "AuditLog_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "Company"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_performedById_fkey') THEN
        ALTER TABLE "AuditLog"
            ADD CONSTRAINT "AuditLog_performedById_fkey"
            FOREIGN KEY ("performedById") REFERENCES "User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
