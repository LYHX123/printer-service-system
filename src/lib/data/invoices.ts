import { prisma } from "@/lib/prisma"
import { getRootPath } from "@/lib/dropbox"
import type { Invoice, InvoiceItem, Customer, Quotation, User, Company, SparePart, SalesLedgerEntry } from "@/types"

const INVOICE_ITEM_PART_SELECT = {
  id: true,
  partNumber: true,
  name: true,
  brand: true,
  model: true,
  specification: true,
  unit: true,
  category: true,
} as const

type InvoiceItemPart = Pick<
  SparePart,
  "id" | "partNumber" | "name" | "brand" | "model" | "specification" | "unit" | "category"
>

export type InvoiceItemWithPart = InvoiceItem & { part: InvoiceItemPart | null }

export type InvoiceListItem = Pick<Invoice, "id" | "invoiceNumber" | "date" | "createdAt" | "status" | "source"> & {
  totalAmount: number
  customer: Pick<Customer, "id" | "companyName">
  quotation: Pick<Quotation, "id" | "quotationNumber"> | null
  createdBy: Pick<User, "id" | "name">
  salesLedgerEntry: { id: string } | null
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
      status: true,
      source: true,
      customer: { select: { id: true, companyName: true } },
      quotation: { select: { id: true, quotationNumber: true } },
      createdBy: { select: { id: true, name: true } },
      salesLedgerEntry: { select: { id: true } },
    },
    orderBy: [
      { invoiceSortNumber: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  })

  return invoices.map((inv) => ({ ...inv, totalAmount: Number(inv.totalAmount) })) as unknown as InvoiceListItem[]
}

export type InvoiceDetail = Invoice & {
  customer: Pick<Customer, "id" | "companyName" | "name" | "pinNumber">
  quotation: Pick<Quotation, "id" | "quotationNumber"> | null
  createdBy: Pick<User, "id" | "name">
  company: Pick<Company, "id" | "name" | "address" | "kraPin" | "currency">
  items: InvoiceItemWithPart[]
  salesLedgerEntry: Pick<SalesLedgerEntry, "id" | "amountReceived" | "balance" | "paymentStatus"> | null
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
      salesLedgerEntry: { select: { id: true, amountReceived: true, balance: true, paymentStatus: true } },
    },
  }) as Promise<InvoiceDetail | null>
}

export type InvoicePdfData = Invoice & {
  customer: Pick<Customer, "id" | "companyName" | "name" | "pinNumber">
  quotation: Pick<Quotation, "id" | "quotationNumber"> | null
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

export interface InvoiceDropboxDocumentItem {
  id: string
  fileType: "PDF" | "XLSX" | "ETR"
  storageProvider: "LOCAL" | "DROPBOX"
  /** Actual saved Dropbox filename (basename of storageKey) — null for LOCAL-provider rows. */
  dropboxFileName: string | null
  /** Relative display path, e.g. "Invoice/2026/August/August Invoice/INV00625.pdf" — null for LOCAL-provider rows. */
  dropboxPath: string | null
  /** The uploader's original filename — only ever set for ETR (a user upload); always null for system-generated PDF/XLSX. */
  originalFileName: string | null
  fileSize: number
  createdAt: Date
  updatedAt: Date
}

function basename(path: string): string {
  const idx = path.lastIndexOf("/")
  return idx >= 0 ? path.slice(idx + 1) : path
}

/**
 * Dropbox sync state for an Invoice's official PDF/Excel — see
 * src/lib/invoiceExcel/dropboxSync.ts. The displayed path is derived from
 * each row's own (immutable) storageKey, never recomputed from the
 * invoice's *current* Date — if the Date is edited later, an already-synced
 * file physically stays under the month it was first generated in, and this
 * must keep showing that same historical path.
 */
export async function getInvoiceDropboxDocuments(invoiceId: string, companyId: string): Promise<InvoiceDropboxDocumentItem[]> {
  const rows = await prisma.invoiceDocument.findMany({
    where: { invoiceId, companyId },
    select: {
      id: true,
      fileType: true,
      storageKey: true,
      storageProvider: true,
      originalFileName: true,
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

