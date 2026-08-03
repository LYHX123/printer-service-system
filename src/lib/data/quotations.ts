import { prisma } from "@/lib/prisma"
import { getRootPath } from "@/lib/dropbox"
import type { QuotationVersionSnapshotData } from "@/lib/quotationExcel/versionSnapshot"
import type {
  Quotation,
  QuotationItem,
  Customer,
  ServiceJob,
  User,
  Company,
  QuotationStatus,
  SparePart,
  Invoice,
} from "@/types"

const QUOTATION_ITEM_PART_SELECT = {
  id: true,
  partNumber: true,
  name: true,
  brand: true,
  model: true,
  specification: true,
  unit: true,
  imageUrl: true,
  category: true,
} as const

type QuotationItemPart = Pick<
  SparePart,
  "id" | "partNumber" | "name" | "brand" | "model" | "specification" | "unit" | "imageUrl" | "category"
>

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
    orderBy: [
      { quotationSortNumber: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  })

  return quotations.map((q) => ({ ...q, totalCost: Number(q.totalCost) }))
}

export type QuotationDetail = Quotation & {
  customer: Pick<Customer, "id" | "name" | "code" | "companyName" | "pinNumber" | "phone" | "location" | "shortName">
  createdBy: Pick<User, "id" | "name">
  items: QuotationItemWithPart[]
  convertedJob: Pick<ServiceJob, "id" | "jobNumber"> | null
  // At most one — quotationId is @unique on Invoice.
  invoice: Pick<Invoice, "id" | "invoiceNumber" | "status" | "date" | "totalAmount"> | null
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
          shortName: true,
        },
      },
      createdBy: { select: { id: true, name: true } },
      items: { orderBy: { createdAt: "asc" }, include: { part: { select: QUOTATION_ITEM_PART_SELECT } } },
      convertedJob: { select: { id: true, jobNumber: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true, date: true, totalAmount: true } },
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
          shortName: true,
        },
      },
      createdBy: { select: { id: true, name: true } },
      items: { orderBy: { createdAt: "asc" }, include: { part: { select: QUOTATION_ITEM_PART_SELECT } } },
      convertedJob: { select: { id: true, jobNumber: true } },
    },
  }) as Promise<QuotationPdfData | null>
}

export interface QuotationDropboxDocumentItem {
  id: string
  fileType: "PDF" | "XLSX"
  version: number
  isFinal: boolean
  storageProvider: "LOCAL" | "DROPBOX"
  /** Actual saved Dropbox filename (basename of storageKey) — null for LOCAL-provider rows. */
  dropboxFileName: string | null
  /** Relative display path, e.g. "Quotation/CRBC/QT202608-001-CRBC-V1.pdf" — null for LOCAL-provider rows. */
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
 * Dropbox sync state for a Quotation's official PDF/Excel, across every
 * archived version plus the Approve-time FINAL — see
 * src/lib/quotationExcel/dropboxSync.ts. Ordered FINAL first (if it exists),
 * then version descending (newest first), matching how the Detail page's
 * "Dropbox Files" section groups and displays them.
 *
 * The displayed path is derived from each row's own (immutable) storageKey,
 * never from the customer's *current* Short Name — if a customer is later
 * renamed (e.g. CRBC -> CRBC-KE), an already-synced quotation's Dropbox file
 * physically stays under the old folder, and this must keep showing that
 * same historical path rather than a recomputed, now-wrong one.
 */
export async function getQuotationDropboxDocuments(
  quotationId: string,
  companyId: string
): Promise<QuotationDropboxDocumentItem[]> {
  const rows = await prisma.quotationDocument.findMany({
    where: { quotationId, companyId },
    select: {
      id: true,
      fileType: true,
      version: true,
      isFinal: true,
      storageKey: true,
      storageProvider: true,
      fileSize: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ isFinal: "desc" }, { version: "desc" }, { fileType: "asc" }],
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

/**
 * The immutable business-data snapshot for one version, or null if none was
 * ever saved for it — the case for quotations Adjusted before this feature
 * existed. Callers must show a clear "unavailable" message in that case,
 * never fall back to the quotation's current live data (which would
 * silently mislabel today's content as an old version).
 */
export async function getQuotationVersionSnapshot(
  quotationId: string,
  companyId: string,
  version: number
): Promise<QuotationVersionSnapshotData | null> {
  const row = await prisma.quotationVersion.findFirst({
    where: { quotationId, companyId, version },
    select: { snapshot: true },
  })
  return row ? (row.snapshot as unknown as QuotationVersionSnapshotData) : null
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
