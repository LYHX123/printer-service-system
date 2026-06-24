import { prisma } from "@/lib/prisma"
import type { Equipment } from "@/types"

/** All equipment for company — lightweight, for dropdowns */
export async function getAllEquipmentForCompany(
  companyId: string
): Promise<Pick<Equipment, "id" | "brand" | "model" | "serialNumber" | "type" | "customerId">[]> {
  return prisma.equipment.findMany({
    where: { companyId },
    select: {
      id: true,
      brand: true,
      model: true,
      serialNumber: true,
      type: true,
      customerId: true,
    },
    orderBy: { brand: "asc" },
  })
}
