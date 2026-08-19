import { prisma } from "@/lib/prisma"
import { getRootPath } from "@/lib/dropbox"
import type { Delivery, DeliveryItem, Customer, CustomerBranch, Quotation, Invoice, User, Company, SparePart } from "@/types"

const DELIVERY_ITEM_PART_SELECT = {
  id: true,
  partNumber: true,
  name: true,
  brand: true,
  model: true,
  specification: true,
  unit: true,
  category: true,
} as const

type DeliveryItemPart = Pick<SparePart, "id" | "partNumber" | "name" | "brand" | "model" | "specification" | "unit" | "category">

export type DeliveryItemWithPart = DeliveryItem & { part: DeliveryItemPart | null }

export type DeliveryListItem = Pick<Delivery, "id" | "deliveryNumber" | "deliveryDate" | "createdAt"> & {
  customer: Pick<Customer, "id" | "companyName">
  customerBranch: Pick<CustomerBranch, "id" | "name"> | null
  quotation: Pick<Quotation, "id" | "quotationNumber"> | null
  invoice: Pick<Invoice, "id" | "invoiceNumber"> | null
  createdBy: Pick<User, "id" | "name">
}

export async function getDeliveries(
  companyId: string,
  opts?: { search?: string }
): Promise<DeliveryListItem[]> {
  const { search } = opts ?? {}
  const deliveries = await prisma.delivery.findMany({
    where: {
      companyId,
      ...(search
        ? {
            OR: [
              { deliveryNumber: { contains: search, mode: "insensitive" } },
              { customer: { companyName: { contains: search, mode: "insensitive" } } },
              { quotation: { quotationNumber: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      deliveryNumber: true,
      deliveryDate: true,
      createdAt: true,
      customer: { select: { id: true, companyName: true } },
      customerBranch: { select: { id: true, name: true } },
      quotation: { select: { id: true, quotationNumber: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [
      { deliverySortNumber: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  })

  return deliveries
}

/** Every Delivery created from a given Quotation — a Quotation may have several over time (no uniqueness constraint), unlike its single Invoice. */
export async function getDeliveriesForQuotation(quotationId: string, companyId: string): Promise<DeliveryListItem[]> {
  return prisma.delivery.findMany({
    where: { quotationId, companyId },
    select: {
      id: true,
      deliveryNumber: true,
      deliveryDate: true,
      createdAt: true,
      customer: { select: { id: true, companyName: true } },
      customerBranch: { select: { id: true, name: true } },
      quotation: { select: { id: true, quotationNumber: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export type DeliveryDetail = Delivery & {
  customer: Pick<Customer, "id" | "companyName" | "name" | "shortName">
  customerBranch: Pick<CustomerBranch, "id" | "name"> | null
  quotation: Pick<Quotation, "id" | "quotationNumber"> | null
  invoice: Pick<Invoice, "id" | "invoiceNumber" | "status" | "totalAmount"> | null
  createdBy: Pick<User, "id" | "name">
  items: DeliveryItemWithPart[]
}

const DELIVERY_DETAIL_INCLUDE = {
  customer: { select: { id: true, companyName: true, name: true, shortName: true } },
  customerBranch: { select: { id: true, name: true } },
  quotation: { select: { id: true, quotationNumber: true } },
  invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
  createdBy: { select: { id: true, name: true } },
  items: { orderBy: { createdAt: "asc" as const }, include: { part: { select: DELIVERY_ITEM_PART_SELECT } } },
} as const

export async function getDelivery(id: string, companyId: string): Promise<DeliveryDetail | null> {
  return prisma.delivery.findFirst({
    where: { id, companyId },
    include: DELIVERY_DETAIL_INCLUDE,
  }) as Promise<DeliveryDetail | null>
}

export type DeliveryPdfData = Delivery & {
  customer: Pick<Customer, "id" | "companyName" | "shortName">
  company: Pick<Company, "id" | "name" | "address" | "logoUrl">
  items: DeliveryItemWithPart[]
}

export async function getDeliveryForPdf(id: string, companyId: string): Promise<DeliveryPdfData | null> {
  return prisma.delivery.findFirst({
    where: { id, companyId },
    include: {
      customer: { select: { id: true, companyName: true, shortName: true } },
      company: { select: { id: true, name: true, address: true, logoUrl: true } },
      items: { orderBy: { createdAt: "asc" }, include: { part: { select: DELIVERY_ITEM_PART_SELECT } } },
    },
  }) as Promise<DeliveryPdfData | null>
}

export interface DeliveryDropboxDocumentItem {
  id: string
  fileType: "PDF" | "XLSX"
  storageProvider: "LOCAL" | "DROPBOX"
  /** Actual saved Dropbox filename (basename of storageKey) — null for LOCAL-provider rows. */
  dropboxFileName: string | null
  /** Relative display path, e.g. "Invoice/2026/August/August Delivery Note/DL00025-ABC.xlsx" — null for LOCAL-provider rows. */
  dropboxPath: string | null
  fileSize: number
  createdAt: Date
  updatedAt: Date
}

function basename(path: string): string {
  const idx = path.lastIndexOf("/")
  return idx >= 0 ? path.slice(idx + 1) : path
}

/**
 * Dropbox sync state for a Delivery's official PDF/Excel — see
 * src/lib/deliveryExcel/dropboxSync.ts. Same convention as
 * getInvoiceDropboxDocuments: the displayed path is derived from each row's
 * own (immutable) storageKey, never recomputed from the delivery's *current*
 * deliveryDate.
 */
export async function getDeliveryDropboxDocuments(deliveryId: string, companyId: string): Promise<DeliveryDropboxDocumentItem[]> {
  const rows = await prisma.deliveryDocument.findMany({
    where: { deliveryId, companyId },
    select: {
      id: true,
      fileType: true,
      storageKey: true,
      storageProvider: true,
      fileSize: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { fileType: "asc" },
  })

  const rootPrefix = `${getRootPath()}/`

  return rows.map((r) => {
    const isDropbox = r.storageProvider === "DROPBOX"
    const dropboxFileName = isDropbox ? basename(r.storageKey) : null
    const dropboxPath = isDropbox
      ? r.storageKey.startsWith(rootPrefix)
        ? r.storageKey.slice(rootPrefix.length)
        : r.storageKey
      : null

    return { ...r, dropboxFileName, dropboxPath }
  })
}
