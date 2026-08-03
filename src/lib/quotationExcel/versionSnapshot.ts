import { prisma } from "@/lib/prisma"
import { getQuotationForPdf } from "@/lib/data/quotations"
import type { QuotationPdfData } from "@/lib/data/quotations"

export interface QuotationVersionSnapshotItem {
  id: string
  partId: string | null
  partNumber: string | null
  category: string | null
  brand: string | null
  name: string | null
  model: string | null
  specification: string | null
  unit: string | null
  description: string | null
  quantity: number
  unitPrice: number
  subtotal: number
  /** Frozen picture for this line item at the time of this version, if any — never a live, possibly-since-changed SparePart image. */
  imageUrl: string | null
}

export interface QuotationVersionSnapshotCustomer {
  id: string
  companyName: string
  shortName: string | null
  pinNumber: string | null
  name: string | null
  phone: string | null
  location: string | null
}

/**
 * Everything the Quotation Detail page needs to render one version
 * standalone, frozen at the moment that version was generated — see
 * createQuotationVersionSnapshot. Deliberately duplicates each item's
 * brand/name/model/etc. rather than just a partId, and the customer's
 * display fields rather than just a customerId: a SparePart's name/price or
 * a Customer's PIN/short name changing later must never rewrite what an
 * already-generated historical quotation shows.
 */
export interface QuotationVersionSnapshotData {
  quotationNumber: string
  quotationDate: string
  validUntil: string | null
  statusAtSnapshot: string
  vatPercent: number
  subtotal: number
  vatAmount: number
  totalCost: number
  remarks: string | null
  internalNotes: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  contactAddress: string | null
  customer: QuotationVersionSnapshotCustomer
  items: QuotationVersionSnapshotItem[]
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function buildQuotationVersionSnapshotData(quotation: QuotationPdfData): QuotationVersionSnapshotData {
  const subtotal = Number(quotation.subtotal)
  const vatPercent = Number(quotation.vatPercent)
  const totalCost = Number(quotation.totalCost)
  const vatAmount = round2((subtotal * vatPercent) / 100)

  return {
    quotationNumber: quotation.quotationNumber,
    quotationDate: quotation.createdAt.toISOString(),
    validUntil: quotation.validUntil ? quotation.validUntil.toISOString() : null,
    statusAtSnapshot: quotation.status,
    vatPercent,
    subtotal,
    vatAmount,
    totalCost,
    remarks: quotation.remarks,
    internalNotes: quotation.internalNotes,
    contactName: quotation.contactName,
    contactPhone: quotation.contactPhone,
    contactEmail: quotation.contactEmail,
    contactAddress: quotation.contactAddress,
    customer: {
      id: quotation.customer.id,
      companyName: quotation.customer.companyName,
      shortName: quotation.customer.shortName,
      pinNumber: quotation.customer.pinNumber,
      name: quotation.customer.name,
      phone: quotation.customer.phone,
      location: quotation.customer.location,
    },
    items: quotation.items.map((item) => ({
      id: item.id,
      partId: item.partId,
      partNumber: item.part?.partNumber ?? null,
      category: item.stockCategory,
      // Prefer the item's own frozen snapshot fields (set at the time it was
      // added to the quotation) over the live SparePart join — same
      // fallback direction the Excel generator already uses.
      brand: item.brandSnapshot ?? item.part?.brand ?? null,
      name: item.nameSnapshot ?? item.part?.name ?? null,
      model: item.modelSnapshot ?? item.part?.model ?? null,
      specification: item.specificationSnapshot ?? item.part?.specification ?? null,
      unit: item.unitSnapshot ?? item.part?.unit ?? null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotal),
      imageUrl: item.pictureSnapshot ?? item.part?.imageUrl ?? null,
    })),
  }
}

/**
 * Creates the immutable snapshot row for a version right after that
 * version's quotation data was committed (createQuotation for V1, Adjust's
 * updateQuotation for V2/V3/...). Best-effort by design at the call site —
 * a snapshot failure must never undo the quotation save itself; it only
 * means that one version's Historical View will show "snapshot
 * unavailable" while its Dropbox files remain fully downloadable.
 */
export async function createQuotationVersionSnapshot(
  quotationId: string,
  companyId: string,
  version: number,
  createdById: string | null
): Promise<void> {
  const quotation = await getQuotationForPdf(quotationId, companyId)
  if (!quotation) return

  const snapshot = buildQuotationVersionSnapshotData(quotation)

  await prisma.quotationVersion.upsert({
    where: { quotationId_version: { quotationId, version } },
    create: { companyId, quotationId, version, snapshot: snapshot as object, createdById },
    // A snapshot is conceptually immutable, but this stays an upsert rather
    // than a plain create so a retried createQuotationVersionSnapshot call
    // (e.g. after a transient DB error) is idempotent instead of throwing on
    // the unique constraint — it is never called again for a version once
    // that version's business data has moved on (Adjust always creates a
    // brand new version number instead).
    update: { snapshot: snapshot as object, createdById },
  })
}
