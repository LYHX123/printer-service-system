import { prisma } from "@/lib/prisma"
import type {
  Quotation,
  QuotationItem,
  Customer,
  CustomerBranch,
  Equipment,
  ServiceJob,
  User,
  Company,
  QuotationStatus,
} from "@/types"

export type QuotationListItem = Pick<
  Quotation,
  "id" | "quotationNumber" | "serviceType" | "status" | "totalCost" | "createdAt" | "validUntil"
> & {
  customer: Pick<Customer, "id" | "name" | "code" | "companyName">
  equipment: Pick<Equipment, "id" | "brand" | "model" | "type"> | null
  createdBy: Pick<User, "id" | "name">
}

export async function getQuotations(
  companyId: string,
  opts?: { search?: string; status?: QuotationStatus }
): Promise<QuotationListItem[]> {
  const { search, status } = opts ?? {}
  return prisma.quotation.findMany({
    where: {
      companyId,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { quotationNumber: { contains: search, mode: "insensitive" } },
              { customer: { name: { contains: search, mode: "insensitive" } } },
              { customer: { companyName: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      quotationNumber: true,
      serviceType: true,
      status: true,
      totalCost: true,
      createdAt: true,
      validUntil: true,
      customer: { select: { id: true, name: true, code: true, companyName: true } },
      equipment: { select: { id: true, brand: true, model: true, type: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  }) as Promise<QuotationListItem[]>
}

export type QuotationDetail = Quotation & {
  customer: Pick<Customer, "id" | "name" | "code" | "companyName" | "phone" | "email">
  branch: Pick<CustomerBranch, "id" | "name" | "address"> | null
  equipment: Pick<Equipment, "id" | "brand" | "model" | "serialNumber" | "type"> | null
  createdBy: Pick<User, "id" | "name">
  items: QuotationItem[]
  convertedJob: Pick<ServiceJob, "id" | "jobNumber"> | null
}

export async function getQuotation(
  id: string,
  companyId: string
): Promise<QuotationDetail | null> {
  return prisma.quotation.findFirst({
    where: { id, companyId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          code: true,
          companyName: true,
          phone: true,
          email: true,
        },
      },
      branch: { select: { id: true, name: true, address: true } },
      equipment: {
        select: {
          id: true,
          brand: true,
          model: true,
          serialNumber: true,
          type: true,
        },
      },
      createdBy: { select: { id: true, name: true } },
      items: { orderBy: { createdAt: "asc" } },
      convertedJob: { select: { id: true, jobNumber: true } },
    },
  }) as Promise<QuotationDetail | null>
}

export type QuotationPdfData = QuotationDetail & {
  company: Pick<
    Company,
    | "id" | "name" | "address" | "phone" | "email" | "logoUrl" | "stampUrl"
    | "website" | "kraPin" | "currency" | "timezone"
  >
}

export async function getQuotationForPdf(
  id: string,
  companyId: string
): Promise<QuotationPdfData | null> {
  return prisma.quotation.findFirst({
    where: { id, companyId },
    include: {
      company: {
        select: {
          id: true, name: true, address: true, phone: true, email: true, logoUrl: true, stampUrl: true,
          website: true, kraPin: true, currency: true, timezone: true,
        },
      },
      customer: {
        select: {
          id: true,
          name: true,
          code: true,
          companyName: true,
          phone: true,
          email: true,
        },
      },
      branch: { select: { id: true, name: true, address: true } },
      equipment: {
        select: {
          id: true,
          brand: true,
          model: true,
          serialNumber: true,
          type: true,
        },
      },
      createdBy: { select: { id: true, name: true } },
      items: { orderBy: { createdAt: "asc" } },
      convertedJob: { select: { id: true, jobNumber: true } },
    },
  }) as Promise<QuotationPdfData | null>
}

export async function getQuotationForEdit(
  id: string,
  companyId: string
): Promise<(Quotation & { items: QuotationItem[] }) | null> {
  return prisma.quotation.findFirst({
    where: { id, companyId },
    include: {
      items: { orderBy: { createdAt: "asc" } },
    },
  }) as Promise<(Quotation & { items: QuotationItem[] }) | null>
}
