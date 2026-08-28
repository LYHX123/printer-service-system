import ExcelJS from "exceljs"
import { format } from "date-fns"
import {
  STOCK_TYPE_LABELS,
  isLowStockEligible,
  LOW_STOCK_THRESHOLDS,
  type StockType,
} from "@/lib/stock-types"
import type { SparePartListItem } from "@/lib/data/inventory"

/**
 * Full, human-readable Stock-Type name used in the management Excel exports —
 * intentionally the complete word (EQUIPMENT / CONSUMPTION / PARTS /
 * COMMON PRODUCT), never the CONSUM / COMMON abbreviations reserved for the
 * outward-facing Quotation / Delivery / Invoice ITEM NO. column.
 */
export function stockTypeExcelName(stockType: StockType): string {
  return STOCK_TYPE_LABELS[stockType].toUpperCase()
}

/** `Equipment-Stock-20260828.xlsx`, `Common-Product-Stock-20260828.xlsx`, … */
export function stockExcelFileName(stockType: StockType, now: Date = new Date()): string {
  const slug = STOCK_TYPE_LABELS[stockType].replace(/\s+/g, "-")
  return `${slug}-Stock-${format(now, "yyyyMMdd")}.xlsx`
}

interface StockColumn {
  header: string
  width: number
  style?: Partial<ExcelJS.Style>
}

/**
 * Builds a business-formatted .xlsx for one Stock Type: bold frozen header row,
 * number-formatted quantity / price columns, wrapped Specification, sensible
 * column widths. Read-only — it only renders the rows it is handed.
 *
 * Low Stock Threshold is included only for the stock types that participate in
 * low-stock evaluation (Equipment / Consumption / Parts); Common Product, which
 * is excluded from low-stock entirely, omits that column.
 */
export async function generateStockExcel(
  stockType: StockType,
  parts: SparePartListItem[]
): Promise<Buffer> {
  const showThreshold = isLowStockEligible(stockType)
  const threshold = LOW_STOCK_THRESHOLDS[stockType]

  const columns: StockColumn[] = [
    { header: "No.", width: 6 },
    { header: "Part No.", width: 18 },
    { header: "Stock Type", width: 18 },
    { header: "Brand", width: 16 },
    { header: "Item Name", width: 30 },
    { header: "Model", width: 18 },
    { header: "Specification", width: 40, style: { alignment: { wrapText: true, vertical: "top" } } },
    { header: "Unit", width: 10 },
    { header: "Quantity", width: 12, style: { numFmt: "#,##0" } },
    { header: "Purchase Price", width: 16, style: { numFmt: "#,##0.00" } },
    { header: "Selling Price", width: 16, style: { numFmt: "#,##0.00" } },
    ...(showThreshold
      ? [{ header: "Low Stock Threshold", width: 20, style: { numFmt: "#,##0" } } as StockColumn]
      : []),
    { header: "Created Date", width: 14, style: { numFmt: "yyyy-mm-dd" } },
    { header: "Updated Date", width: 14, style: { numFmt: "yyyy-mm-dd" } },
  ]

  const workbook = new ExcelJS.Workbook()
  workbook.created = new Date()
  const sheet = workbook.addWorksheet(stockTypeExcelName(stockType), {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  sheet.columns = columns.map((c) => ({ header: c.header, width: c.width, style: c.style }))

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true }
  headerRow.alignment = { vertical: "middle" }

  parts.forEach((part, index) => {
    sheet.addRow([
      index + 1,
      part.partNumber,
      stockTypeExcelName(stockType),
      part.brand ?? "",
      part.name,
      part.model ?? "",
      part.specification ?? "",
      part.unit ?? "",
      part.stock?.quantity ?? 0,
      Number(part.unitCost),
      Number(part.sellingPrice),
      ...(showThreshold ? [threshold] : []),
      part.createdAt,
      part.updatedAt,
    ])
  })

  const arrayBuffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(arrayBuffer)
}
