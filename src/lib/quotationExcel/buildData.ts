import { format } from "date-fns"
import { getStockType } from "@/lib/stock-types"
import type { StockType } from "@/lib/stock-types"
import type { QuotationPdfData } from "@/lib/data/quotations"

export interface QuotationExcelItem {
  itemName: string
  description: string
  unit: string
  qty: number
  unitPrice: number
  amount: number
  /** Public-relative URL (e.g. "/uploads/...") of the picture to embed, or null for no picture. */
  pictureUrl: string | null
}

export interface QuotationExcelData {
  customerName: string
  customerPin: string
  quotationDate: string
  quotationNumber: string
  subtotal: number
  vatAmount: number
  totalAmount: number
  items: QuotationExcelItem[]
}

/** EQUIPMENT/CONSUMPTION display as-is; PARTS displays singular ("PART"), never "PARTS". */
function stockTypeToItemName(stockType: StockType): string {
  return stockType === "PARTS" ? "PART" : stockType
}

/**
 * Maps a Quotation record to the Excel engine's data shape.
 *
 * Historical-compatibility fallback chain (per item field): the frozen
 * snapshot on QuotationItem -> the live linked SparePart -> blank. This
 * covers every era of data this table has ever held — old rows have no
 * snapshot columns at all (added in this round), newer rows may still have
 * NULL snapshot fields if their SparePart was linked before snapshotting
 * existed, and rows can always fall further to a plain blank if the
 * SparePart itself was since deleted. Nothing here ever throws on missing
 * data.
 */
export function buildQuotationExcelData(quotation: QuotationPdfData): QuotationExcelData {
  const subtotal = Number(quotation.subtotal)
  const totalAmount = Number(quotation.totalCost)
  // Derived from the two stored totals rather than re-applying vatPercent,
  // so the Excel figure always ties out exactly with what's stored/shown
  // on the Quotation Detail page even if a future rounding tweak changes
  // how totalCost is computed.
  const vatAmount = totalAmount - subtotal

  const items: QuotationExcelItem[] = quotation.items.map((item) => {
    const brand = item.brandSnapshot ?? item.part?.brand ?? null
    const name = item.nameSnapshot ?? item.part?.name ?? item.description ?? ""
    const model = item.modelSnapshot ?? item.part?.model ?? null
    const specification = item.specificationSnapshot ?? item.part?.specification ?? null
    const unit = item.unitSnapshot ?? item.part?.unit ?? ""
    const pictureUrl = item.pictureSnapshot ?? item.part?.imageUrl ?? null

    // ITEM NAME shows the Stock Category (EQUIPMENT/CONSUMPTION/PART), not
    // the product name — the product name lives in DESCRIPTION instead.
    // stockCategory is a frozen snapshot (see actions/quotations.ts); if a
    // historical row predates that snapshot, fall back to the live linked
    // SparePart's category; if the SparePart itself is gone too, fall back
    // to the old free-text name so a historical Quotation can still export.
    const stockType = (item.stockCategory as StockType | null) ?? (item.part ? getStockType(item.part.category) : null)
    const itemName = (stockType ? stockTypeToItemName(stockType) : name).toUpperCase()

    return {
      itemName,
      description: [brand, name, model, specification].filter(Boolean).join(" / "),
      unit: unit.toUpperCase(),
      qty: item.quantity,
      unitPrice: Number(item.unitPrice),
      amount: Number(item.subtotal),
      pictureUrl,
    }
  })

  return {
    customerName: quotation.customer.companyName,
    customerPin: quotation.customer.pinNumber ?? "",
    quotationDate: format(new Date(quotation.createdAt), "yyyy-MM-dd"),
    quotationNumber: quotation.quotationNumber,
    subtotal,
    vatAmount,
    totalAmount,
    items,
  }
}
