-- Customer Short Name (Dropbox Phase 1) — plain nullable free text, no
-- backfill, no uniqueness constraint. Reserved for future Dropbox/Quotation
-- file naming (e.g. QT00455-CSCEC-V1.xlsx); not sanitized or used anywhere
-- yet this round.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "shortName" TEXT;

-- Dropbox Connection (Dropbox Phase 1) — one OAuth connection per Company.
-- Only the encrypted refresh token is stored; the App Secret and any
-- short-lived access token never touch the database.
CREATE TABLE IF NOT EXISTS "DropboxConnection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'dropbox',
    "accountId" TEXT,
    "accountName" TEXT,
    "accountEmail" TEXT,
    "encryptedRefreshToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "DropboxConnection_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
    ALTER TABLE "DropboxConnection" ADD CONSTRAINT "DropboxConnection_companyId_key" UNIQUE ("companyId");
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "DropboxConnection" ADD CONSTRAINT "DropboxConnection_companyId_fkey"
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "DropboxConnection" ADD CONSTRAINT "DropboxConnection_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
