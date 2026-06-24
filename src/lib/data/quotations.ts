import { prisma } from "@/lib/prisma"
import type {
  Quotation,
  QuotationItem,
  Customer,
  ServiceJob,
  User,
  Company,
  QuotationStatus,
  SparePart,
} from "@/types"

const QUOTATION_ITEM_PART_SELECT = {
  id: true,
  partNumber: true,
  name: true,
  brand: true,
  unit: true,
  imageUrl: true,
} as const

type QuotationItemPart = Pick<SparePart, "id" | "partNumber" | "name" | "brand" | "unit" | "imageUrl">

export type QuotationItemWithPart = QuotationItem & { part: QuotationItemPart | null }

export type QuotationListItem = Pick<
  Quotation,
  "id" | "quotationNumber" | "status" | "createdAt" | "validUntil"
> & {
  totalCost: number
  customer: Pick<Customer, "id" | "name" | "code" | "companyName">
  createdBy: Pick<User, "id" | "name">
}

export async function getQuotations(
  companyId: string,
  opts?: { search?: string; status?: QuotationStatus }
): Promise<QuotationListItem[]> {
  const { search, status } = opts ?? {}
  const quotations = await prisma.quotation.findMany({
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
      status: true,
      totalCost: true,
      createdAt: true,
      validUntil: true,
      customer: { select: { id: true, name: true, code: true, companyName: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return quotations.map((q) => ({ ...q, totalCost: Number(q.totalCost) }))
}

export type QuotationDetail = Quotation & {
  customer: Pick<Customer, "id" | "name" | "code" | "companyName" | "pinNumber" | "phone" | "location">
  createdBy: Pick<User, "id" | "name">
  items: QuotationItemWithPart[]
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
          pinNumber: true,
          phone: true,
          location: true,
        },
      },
      createdBy: { select: { id: true, name: true } },
      items: { orderBy: { createdAt: "asc" }, include: { part: { select: QUOTATION_ITEM_PART_SELECT } } },
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
          pinNumber: true,
          phone: true,
          location: true,
        },
      },
      createdBy: { select: { id: true, name: true } },
      items: { orderBy: { createdAt: "asc" }, include: { part: { select: QUOTATION_ITEM_PART_SELECT } } },
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
