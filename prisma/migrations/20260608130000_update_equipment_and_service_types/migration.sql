-- EquipmentType: replace printer-specific values with business equipment categories
ALTER TYPE "EquipmentType" RENAME TO "EquipmentType_old";
CREATE TYPE "EquipmentType" AS ENUM ('PRINTER', 'COPIER', 'LAPTOP', 'DESKTOP_COMPUTER', 'PROJECTOR', 'CCTV_SYSTEM', 'OTHER');
ALTER TABLE "Equipment" ALTER COLUMN "type" TYPE "EquipmentType" USING "type"::text::"EquipmentType";
DROP TYPE "EquipmentType_old";

-- ServiceType: add UPGRADE for hardware upgrade jobs (RAM, SSD, etc.)
ALTER TYPE "ServiceType" ADD VALUE IF NOT EXISTS 'UPGRADE';
