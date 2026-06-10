import { prisma } from "@/lib/prisma"
import type { Company } from "@/types"

export type CompanySettings = Pick<
  Company,
  | "id"
  | "name"
  | "code"
  | "address"
  | "phone"
  | "email"
  | "website"
  | "kraPin"
  | "vatPercent"
  | "currency"
  | "timezone"
  | "logoUrl"
  | "stampUrl"
>

export async function getCompanySettings(companyId: string): Promise<CompanySettings | null> {
  return prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      code: true,
      address: true,
      phone: true,
      email: true,
      website: true,
      kraPin: true,
      vatPercent: true,
      currency: true,
      timezone: true,
      logoUrl: true,
      stampUrl: true,
    },
  })
}
