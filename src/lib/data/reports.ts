import { prisma } from "@/lib/prisma"
import type {
  ServiceJob,
  Customer,
  CustomerBranch,
  Equipment,
  User,
  Company,
  MeterReading,
  JobPhoto,
  RepairReport,
  JobPart,
} from "@/types"

export type ReportData = ServiceJob & {
  company: Pick<
    Company,
    | "id" | "name" | "address" | "phone" | "email" | "logoUrl" | "stampUrl"
    | "website" | "kraPin" | "vatPercent" | "currency" | "timezone"
  >
  customer: Pick<Customer, "id" | "name" | "code" | "companyName" | "phone" | "email" | "address">
  branch: Pick<CustomerBranch, "id" | "name" | "address" | "phone"> | null
  equipment: Pick<
    Equipment,
    "id" | "brand" | "model" | "serialNumber" | "assetNumber" | "type" | "warrantyExpiry"
  >
  assignedTo: Pick<User, "id" | "name" | "email" | "signatureUrl">
  meterReadings: MeterReading[]
  photos: JobPhoto[]
  report: (RepairReport & { parts: JobPart[] }) | null
}

export async function getJobForReport(
  id: string,
  companyId: string
): Promise<ReportData | null> {
  return prisma.serviceJob.findFirst({
    where: { id, companyId },
    include: {
      company: {
        select: {
          id: true, name: true, address: true, phone: true, email: true, logoUrl: true, stampUrl: true,
          website: true, kraPin: true, vatPercent: true, currency: true, timezone: true,
        },
      },
      customer: {
        select: { id: true, name: true, code: true, companyName: true, phone: true, email: true, address: true },
      },
      branch: { select: { id: true, name: true, address: true, phone: true } },
      equipment: {
        select: { id: true, brand: true, model: true, serialNumber: true, assetNumber: true, type: true, warrantyExpiry: true },
      },
      assignedTo: { select: { id: true, name: true, email: true, signatureUrl: true } },
      meterReadings: { orderBy: { readingDate: "desc" } },
      photos: { orderBy: { createdAt: "desc" } },
      report: { include: { parts: true } },
    },
  }) as Promise<ReportData | null>
}
