import { format } from "date-fns"
import { getStockType, isStockType, resolveDocumentItemNoLabel } from "@/lib/stock-types"
import type { StockType } from "@/lib/stock-types"
import type { DeliveryPdfData } from "@/lib/data/deliveries"

export interface DeliveryExcelItem {
  /** The Delivery Note's "ITEM NO." column — the Stock item's category, not a sequence number. See stockTypeToDeliveryItemCode. */
  itemNo: string
  description: string
  unit: string
  qty: number
}

/**
 * The Delivery Note's "ITEM NO." column shows the Stock item's CATEGORY
 * abbreviation (EQUIPMENT/CONSUM/PART/COMMON) — now the same shared mapping
 * Invoice and Quotation Excel/PDF use (see resolveDocumentItemNoLabel). The
 * "No." column (plain 1, 2, 3…) is separate — see generate.ts's NO_COLUMN.
 */
function stockTypeToDeliveryItemCode(stockType: StockType): string {
  return resolveDocumentItemNoLabel(stockType)
}

export interface DeliveryExcelData {
  customerName: string
  deliveryDate: string
  deliveryNumber: string
  items: DeliveryExcelItem[]
}

/**
 * Maps a Delivery record to the Excel engine's data shape. Item Description
 * is always Brand + Name (never the Stock Category, unlike Invoice/Quotation
 * Excel's ITEM_NAME) — per the Delivery Note template's own {{BRAND}}
 * {{NAME}} placeholder pair — and never carries a price; Delivery is a pure
 * inventory-movement document.
 *
 * Historical-compatibility fallback chain (per item field), same rationale
 * as invoiceExcel/buildData.ts: the frozen snapshot on DeliveryItem -> the
 * live linked SparePart -> blank.
 */
export function buildDeliveryExcelData(delivery: DeliveryPdfData): DeliveryExcelData {
  const items: DeliveryExcelItem[] = delivery.items.map((item) => {
    const brand = item.brandSnapshot ?? item.part?.brand ?? null
    const name = item.nameSnapshot ?? item.part?.name ?? item.description ?? ""
    const unit = item.unitSnapshot ?? item.part?.unit ?? ""

    // Same fallback chain as brand/name/unit: the frozen snapshot taken at
    // delivery time, then the live linked SparePart's current category.
    const snapshotStockType = item.stockCategory ?? undefined
    const stockType = (isStockType(snapshotStockType) ? snapshotStockType : null) ?? (item.part ? getStockType(item.part.category) : null)

    return {
      itemNo: stockType ? stockTypeToDeliveryItemCode(stockType) : "",
      description: [brand, name].filter(Boolean).join(" "),
      unit,
      qty: item.quantity,
    }
  })

  return {
    customerName: delivery.customer.companyName,
    deliveryDate: format(new Date(delivery.deliveryDate), "yyyy-MM-dd"),
    deliveryNumber: delivery.deliveryNumber,
    items,
  }
}
