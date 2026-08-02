import { mkdir } from "fs/promises"
import path from "path"
import ExcelJS from "exceljs"
import {
  findPlaceholderCell,
  findColumnForTokenInRow,
  replacePlaceholder,
  calculateRequiredRowHeight,
  planProductRows,
  insertExtraProductRows,
} from "@/lib/excelTemplate"
import { buildInvoiceExcelData } from "./buildData"
import { InvoiceExcelError } from "./errors"
import type { InvoicePdfData } from "@/lib/data/invoices"

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "invoice", "invoice template.xlsx")
const OUTPUT_DIR = path.join(process.cwd(), "storage", "generated", "invoice")
const MIN_PRODUCT_ROWS = 10

function slugify(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "")
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

interface ProductColumns {
  no: number
  itemName: number
  description: number
  unit: number
  qty: number
  unitPrice: number
  amount: number
}

function findProductColumns(sheet: ExcelJS.Worksheet, templateRow: number): ProductColumns {
  const tokens: Record<keyof ProductColumns, string> = {
    no: "{{ITEM_NO}}",
    itemName: "{{ITEM_NAME}}",
    description: "{{DESCRIPTION}}",
    unit: "{{UNIT}}",
    qty: "{{QTY}}",
    unitPrice: "{{UNIT_PRICE}}",
    amount: "{{AMOUNT}}",
  }

  const columns = {} as ProductColumns
  for (const key of Object.keys(tokens) as (keyof ProductColumns)[]) {
    const col = findColumnForTokenInRow(sheet, templateRow, tokens[key])
    if (col === null) {
      throw new InvoiceExcelError(`Invoice Excel template row ${templateRow} is missing the ${tokens[key]} placeholder.`)
    }
    columns[key] = col
  }
  return columns
}

/**
 * Generates the Invoice Excel document from the formal template
 * (templates/invoice/invoice template.xlsx) — the Invoice equivalent of
 * quotationExcel/generate.ts, sharing the same placeholder-search and
 * dynamic-row-insertion engine (src/lib/excelTemplate) so the two stay
 * behaviorally in sync. The only real difference is this template has no
 * SAMPLE/picture column.
 *
 * Nothing about the template's row layout is hardcoded: the product
 * template row, its columns, and the Subtotal/VAT/Total cells are all
 * located by searching for their {{TOKEN}} text at generation time.
 */
export async function generateInvoiceExcel(invoice: InvoicePdfData): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.readFile(TEMPLATE_PATH)
  } catch (error) {
    throw new InvoiceExcelError(
      `Invoice Excel template not found or unreadable: ${TEMPLATE_PATH} (${error instanceof Error ? error.message : String(error)})`
    )
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    throw new InvoiceExcelError("Invoice Excel template has no worksheet.")
  }

  const data = buildInvoiceExcelData(invoice)

  // 1. Header placeholders — safe to replace before any row math, since
  //    they live above the product table and are unaffected by it.
  replacePlaceholder(sheet, "{{CUSTOMER_NAME}}", data.customerName)
  replacePlaceholder(sheet, "{{CUSTOMER_PIN}}", data.customerPin)
  replacePlaceholder(sheet, "{{INVOICE_DATE}}", data.invoiceDate)
  replacePlaceholder(sheet, "{{INVOICE_NO}}", data.invoiceNumber)

  // 2. Locate the product template row, its reserved area, and the final
  //    row count — shared with the Quotation Excel engine.
  const layout = planProductRows(sheet, "{{ITEM_NO}}", "{{SUBTOTAL}}", data.items.length, MIN_PRODUCT_ROWS)
  const { templateRow, finalRowCount } = layout
  const columns = findProductColumns(sheet, templateRow)
  const columnCount = Math.max(...Object.values(columns))

  // 3. Insert extra rows if there are more items than the template
  //    reserves — shifts NOTE/Subtotal/VAT/Total (and their merges) down.
  insertExtraProductRows(sheet, layout, columnCount)

  // 4. Re-locate the footer placeholders AFTER any row insertion — never
  //    trust the pre-insertion row numbers once rows have shifted.
  const subtotalLoc = findPlaceholderCell(sheet, "{{SUBTOTAL}}")
  const vatLoc = findPlaceholderCell(sheet, "{{VAT_AMOUNT}}")
  const totalLoc = findPlaceholderCell(sheet, "{{TOTAL_AMOUNT}}")
  if (!subtotalLoc || !vatLoc || !totalLoc) {
    throw new InvoiceExcelError("Invoice Excel template is missing one of {{SUBTOTAL}} / {{VAT_AMOUNT}} / {{TOTAL_AMOUNT}} after row insertion.")
  }

  // 5. Compute the single uniform row height: the max requirement across
  //    every product row (real items AND blank padding rows). No picture
  //    column on this template, so there's no picture-height contribution.
  const itemNameColWidth = Number(sheet.getColumn(columns.itemName).width ?? 16)
  const descriptionColWidth = Number(sheet.getColumn(columns.description).width ?? 22)

  let uniformHeight = 0
  for (let i = 0; i < finalRowCount; i++) {
    const item = data.items[i]
    const required = calculateRequiredRowHeight({
      itemName: item?.itemName ?? "",
      description: item?.description ?? "",
      itemNameColWidth,
      descriptionColWidth,
      hasPicture: false,
    })
    uniformHeight = Math.max(uniformHeight, required)
  }
  for (let i = 0; i < finalRowCount; i++) {
    sheet.getRow(templateRow + i).height = uniformHeight
  }

  // 6. Fill item rows (numeric fields as real numbers, never strings) and
  //    clear blank padding rows.
  for (let i = 0; i < finalRowCount; i++) {
    const rowNumber = templateRow + i
    const row = sheet.getRow(rowNumber)
    const item = data.items[i]

    if (item) {
      row.getCell(columns.no).value = i + 1
      row.getCell(columns.itemName).value = item.itemName || null
      row.getCell(columns.description).value = item.description || null
      row.getCell(columns.unit).value = item.unit || null
      row.getCell(columns.qty).value = item.qty
      row.getCell(columns.unitPrice).value = round2(item.unitPrice)
      row.getCell(columns.amount).value = round2(item.amount)
    } else {
      row.getCell(columns.no).value = null
      row.getCell(columns.itemName).value = null
      row.getCell(columns.description).value = null
      row.getCell(columns.unit).value = null
      row.getCell(columns.qty).value = null
      row.getCell(columns.unitPrice).value = null
      row.getCell(columns.amount).value = null
    }
  }

  // 7. Footer totals — real numeric cells, using the template's existing
  //    number format (already baked into the cell's style). Read straight
  //    from the Invoice record — never re-derived from a hardcoded VAT rate.
  replacePlaceholder(sheet, "{{SUBTOTAL}}", round2(data.subtotal))
  replacePlaceholder(sheet, "{{VAT_AMOUNT}}", round2(data.vatAmount))
  replacePlaceholder(sheet, "{{TOTAL_AMOUNT}}", round2(data.totalAmount))

  await mkdir(OUTPUT_DIR, { recursive: true })
  const fileName = `${slugify(data.invoiceNumber) || invoice.id}.xlsx`
  const outputPath = path.join(OUTPUT_DIR, fileName)
  await workbook.xlsx.writeFile(outputPath)

  return outputPath
}
