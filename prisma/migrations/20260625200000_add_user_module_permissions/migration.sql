-- AlterTable
ALTER TABLE "User" ADD COLUMN "modulePermissions" TEXT[] NOT NULL DEFAULT '{}';
