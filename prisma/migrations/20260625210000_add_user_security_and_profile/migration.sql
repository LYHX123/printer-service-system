-- AlterTable: login security fields
ALTER TABLE "User" ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil"         TIMESTAMP(3);

-- AlterTable: optional profile fields
ALTER TABLE "User" ADD COLUMN "phone"      TEXT;
ALTER TABLE "User" ADD COLUMN "department" TEXT;
ALTER TABLE "User" ADD COLUMN "position"   TEXT;
