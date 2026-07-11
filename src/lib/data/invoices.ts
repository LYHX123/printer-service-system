import { prisma } from "@/lib/prisma"
import { generateInvoiceNumber } from "@/lib/utils"
import type { Invoice, InvoiceItem, Customer, Quotation, User, Company, SparePart } from "@/types"

const INVOICE_ITEM_PART_SELECT = {
  id: true,
  partNumber: true,
  name: true,
  brand: true,
} as const

type InvoiceItemPart = Pick<SparePart, "id" | "partNumber" | "name" | "brand">

export type InvoiceItemWithPart = InvoiceItem & { part: InvoiceItemPart | null }

export type InvoiceListItem = Pick<Invoice, "id" | "invoiceNumber" | "date" | "createdAt"> & {
  totalAmount: number
  customer: Pick<Customer, "id" | "companyName">
  quotation: Pick<Quotation, "id" | "quotationNumber">
  createdBy: Pick<User, "id" | "name">
}

export async function getInvoices(
  companyId: string,
  opts?: { search?: string }
): Promise<InvoiceListItem[]> {
  const { search } = opts ?? {}
  const invoices = await prisma.invoice.findMany({
    where: {
      companyId,
      ...(search
        ? {
            OR: [
              { invoiceNumber: { contains: search, mode: "insensitive" } },
              { customer: { companyName: { contains: search, mode: "insensitive" } } },
              { quotation: { quotationNumber: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      invoiceNumber: true,
      date: true,
      totalAmount: true,
      createdAt: true,
      customer: { select: { id: true, companyName: true } },
      quotation: { select: { id: true, quotationNumber: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return invoices.map((inv) => ({ ...inv, totalAmount: Number(inv.totalAmount) })) as unknown as InvoiceListItem[]
}

export type InvoiceDetail = Invoice & {
  customer: Pick<Customer, "id" | "companyName" | "name" | "pinNumber">
  quotation: Pick<Quotation, "id" | "quotationNumber">
  createdBy: Pick<User, "id" | "name">
  company: Pick<Company, "id" | "name" | "address" | "kraPin" | "currency">
  items: InvoiceItemWithPart[]
}

export async function getInvoice(id: string, companyId: string): Promise<InvoiceDetail | null> {
  return prisma.invoice.findFirst({
    where: { id, companyId },
    include: {
      customer: { select: { id: true, companyName: true, name: true, pinNumber: true } },
      quotation: { select: { id: true, quotationNumber: true } },
      createdBy: { select: { id: true, name: true } },
      company: { select: { id: true, name: true, address: true, kraPin: true, currency: true } },
      items: { include: { part: { select: INVOICE_ITEM_PART_SELECT } } },
    },
  }) as Promise<InvoiceDetail | null>
}

export type InvoicePdfData = Invoice & {
  customer: Pick<Customer, "id" | "companyName" | "name" | "pinNumber">
  quotation: Pick<Quotation, "id" | "quotationNumber">
  createdBy: Pick<User, "id" | "name">
  company: Pick<Company, "id" | "name" | "address" | "kraPin" | "logoUrl" | "currency" | "timezone">
  items: InvoiceItemWithPart[]
}

export async function getInvoiceForPdf(id: string, companyId: string): Promise<InvoicePdfData | null> {
  return prisma.invoice.findFirst({
    where: { id, companyId },
    include: {
      customer: { select: { id: true, companyName: true, name: true, pinNumber: true } },
      quotation: { select: { id: true, quotationNumber: true } },
      createdBy: { select: { id: true, name: true } },
      company: {
        select: { id: true, name: true, address: true, kraPin: true, logoUrl: true, currency: true, timezone: true },
      },
      items: { include: { part: { select: INVOICE_ITEM_PART_SELECT } } },
    },
  }) as Promise<InvoicePdfData | null>
}

export async function getInvoicesForQuotation(
  quotationId: string,
  companyId: string
): Promise<(Pick<Invoice, "id" | "invoiceNumber" | "date"> & { totalAmount: number })[]> {
  const invoices = await prisma.invoice.findMany({
    where: { quotationId, companyId },
    select: { id: true, invoiceNumber: true, date: true, totalAmount: true },
    orderBy: { createdAt: "desc" },
  })
  return invoices.map((inv) => ({ ...inv, totalAmount: Number(inv.totalAmount) }))
}

/** Suggests the next invoice number for the current month; the user can still edit it before generating. */
export async function suggestInvoiceNumber(companyId: string): Promise<string> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const count = await prisma.invoice.count({
    where: { companyId, createdAt: { gte: monthStart, lt: monthEnd } },
  })
  return generateInvoiceNumber(now, count + 1)
}
