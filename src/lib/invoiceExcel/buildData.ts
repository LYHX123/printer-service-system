import { format } from "date-fns"
import { getStockType, isStockType, resolveDocumentItemNoLabel } from "@/lib/stock-types"
import type { InvoicePdfData } from "@/lib/data/invoices"
import type { PartCategory } from "@/types"

export interface InvoiceExcelItem {
  itemName: string
  description: string
  unit: string
  qty: number
  unitPrice: number
  amount: number
}

export interface InvoiceExcelData {
  customerName: string
  customerPin: string
  invoiceDate: string
  invoiceNumber: string
  subtotal: number
  vatAmount: number
  totalAmount: number
  items: InvoiceExcelItem[]
}

/**
 * The Item No / Item Name column's category label (EQUIPMENT/CONSUM/PART/
 * COMMON, see resolveDocumentItemNoLabel) for one invoice item — same
 * frozen-snapshot-then-live-part fallback chain as buildInvoiceExcelData,
 * exported so the react-pdf fallback renderer (components/pdf/InvoiceDocument.tsx)
 * shows the identical value instead of drifting to something else (e.g. the
 * part number).
 */
export function resolveInvoiceItemNoLabel(item: {
  stockCategory?: string | null
  description?: string | null
  nameSnapshot?: string | null
  part?: { name: string; category: PartCategory } | null
}): string {
  const name = item.nameSnapshot ?? item.part?.name ?? item.description ?? ""
  const snapshotStockType = item.stockCategory ?? undefined
  const stockType = (isStockType(snapshotStockType) ? snapshotStockType : null) ?? (item.part ? getStockType(item.part.category) : null)
  return (stockType ? resolveDocumentItemNoLabel(stockType) : name).toUpperCase()
}

/**
 * Maps an Invoice record to the Excel engine's data shape — the Invoice
 * equivalent of quotationExcel/buildData.ts, same ITEM_NAME/DESCRIPTION/
 * date-format rules (Invoice Excel and Quotation Excel are meant to look
 * and behave identically).
 *
 * Historical-compatibility fallback chain (per item field): the frozen
 * snapshot on InvoiceItem -> the live linked SparePart -> blank. Covers
 * FROM_QUOTATION invoices (whose items carry the Quotation's own frozen
 * snapshot forward at generation time — see generateInvoice() in
 * actions/invoices.ts) and DIRECT invoices (snapshotted straight from
 * Stock at creation time) identically; nothing here ever throws on
 * missing data, so an old Invoice predating any of these snapshot fields
 * can still export.
 */
export function buildInvoiceExcelData(invoice: InvoicePdfData): InvoiceExcelData {
  const subtotal = Number(invoice.subtotal)
  const vatAmount = Number(invoice.vatAmount)
  const totalAmount = Number(invoice.totalAmount)

  const items: InvoiceExcelItem[] = invoice.items.map((item) => {
    const brand = item.brandSnapshot ?? item.part?.brand ?? null
    const name = item.nameSnapshot ?? item.part?.name ?? item.description ?? ""
    const model = item.modelSnapshot ?? item.part?.model ?? null
    const specification = item.specificationSnapshot ?? item.part?.specification ?? null
    const unit = item.unit ?? item.part?.unit ?? ""

    // ITEM NAME shows the Stock Category abbreviation (EQUIPMENT/CONSUM/PART/
    // COMMON), not the product name — see resolveDocumentItemNoLabel.
    const itemName = resolveInvoiceItemNoLabel(item)

    return {
      itemName,
      description: [brand, name, model, specification].filter(Boolean).join(" / "),
      unit: unit.toUpperCase(),
      qty: item.quantity,
      unitPrice: Number(item.unitPrice),
      amount: Number(item.amount),
    }
  })

  return {
    customerName: invoice.customer.companyName,
    // Invoice.customerPin is its own snapshot, editable at generation time —
    // may differ from the live Customer record; falls back to the live PIN
    // only if that snapshot was never filled in.
    customerPin: invoice.customerPin || invoice.customer.pinNumber || "",
    invoiceDate: format(new Date(invoice.date), "yyyy-MM-dd"),
    invoiceNumber: invoice.invoiceNumber,
    subtotal,
    vatAmount,
    totalAmount,
    items,
  }
}
