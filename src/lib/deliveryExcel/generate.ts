import { mkdir } from "fs/promises"
import path from "path"
import ExcelJS from "exceljs"
import {
  findPlaceholderCell,
  findColumnForTokenInRow,
  replacePlaceholder,
  calculateRequiredRowHeight,
  growMergedBlockForText,
  planProductRows,
  insertExtraProductRows,
} from "@/lib/excelTemplate"
import { buildDeliveryExcelData } from "./buildData"
import { DeliveryExcelError } from "./errors"
import type { DeliveryPdfData } from "@/lib/data/deliveries"

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "delivery note", "delivery note template.xlsx")
const OUTPUT_DIR = path.join(process.cwd(), "storage", "generated", "delivery")
const MIN_PRODUCT_ROWS = 10

// The template's leftmost "No." column carries no {{}} placeholder of its
// own (it sits immediately left of the "ITEM NO" column, which does) — see
// the "Delivery Item Row Rule" spec: "No. should be generated automatically
// ... Do not use a template placeholder for No." Always column 1 per the
// template's fixed layout, so unlike every other column here it's not
// located by searching for a token.
const NO_COLUMN = 1

function slugify(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "")
}

interface ProductColumns {
  itemNo: number
  description: number
  unit: number
  qty: number
}

function findProductColumns(sheet: ExcelJS.Worksheet, templateRow: number): ProductColumns {
  const tokens: Record<keyof ProductColumns, string> = {
    itemNo: "{{ITEM_NO}}",
    description: "{{BRAND}}",
    unit: "{{UNIT}}",
    qty: "{{QTY}}",
  }

  const columns = {} as ProductColumns
  for (const key of Object.keys(tokens) as (keyof ProductColumns)[]) {
    const col = findColumnForTokenInRow(sheet, templateRow, tokens[key])
    if (col === null) {
      throw new DeliveryExcelError(`Delivery Note Excel template row ${templateRow} is missing the ${tokens[key]} placeholder.`)
    }
    columns[key] = col
  }
  return columns
}

/**
 * Generates the Delivery Note Excel document from the formal template
 * (templates/delivery note/delivery note template.xlsx), reusing the same
 * placeholder-search and dynamic-row-insertion engine (src/lib/excelTemplate)
 * as Invoice/Quotation Excel. No SUBTOTAL/VAT/TOTAL footer — a Delivery Note
 * carries no price at all — so the reserved product area's lower boundary is
 * anchored on the "RECEIVED BY:" section instead of a {{}} token.
 *
 * Nothing about the template's row layout is hardcoded (besides the "No."
 * column — see NO_COLUMN above): the product template row, its columns, and
 * the header placeholders are all located by searching for their {{TOKEN}}
 * text at generation time.
 */
export async function generateDeliveryExcel(delivery: DeliveryPdfData): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.readFile(TEMPLATE_PATH)
  } catch (error) {
    throw new DeliveryExcelError(
      `Delivery Note Excel template not found or unreadable: ${TEMPLATE_PATH} (${error instanceof Error ? error.message : String(error)})`
    )
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    throw new DeliveryExcelError("Delivery Note Excel template has no worksheet.")
  }

  const data = buildDeliveryExcelData(delivery)

  // 1. Header placeholders — safe to replace before any row math, since they
  //    live above the product table. The Customer name cell is located
  //    BEFORE its token is replaced (the search relies on the literal
  //    "{{TOKEN}}" text still being there), so its merged block can be grown
  //    afterwards if the real value is long enough to need more than the
  //    template's fixed height. Same mechanism as invoiceExcel/generate.ts.
  const customerNameLoc = findPlaceholderCell(sheet, "{{CUSTOMER_NAME}}")
  replacePlaceholder(sheet, "{{CUSTOMER_NAME}}", data.customerName)
  replacePlaceholder(sheet, "{{DELIVERY_DATE}}", data.deliveryDate)
  replacePlaceholder(sheet, "{{DELIVERY_NO}}", data.deliveryNumber)

  if (customerNameLoc) {
    const finalText = sheet.getCell(customerNameLoc.address).value
    if (typeof finalText === "string") growMergedBlockForText(sheet, customerNameLoc.address, finalText)
  }

  // 2. Locate the product template row, its reserved area, and the final row
  //    count. "RECEIVED BY:" (plain text, not a {{}} token) marks the row
  //    just below the reserved product area — see planProductRows, which
  //    only needs *some* distinctive text to search for.
  const layout = planProductRows(sheet, "{{ITEM_NO}}", "RECEIVED BY:", data.items.length, MIN_PRODUCT_ROWS)
  const { templateRow, finalRowCount } = layout
  const columns = findProductColumns(sheet, templateRow)
  const columnCount = Math.max(NO_COLUMN, ...Object.values(columns))

  // 3. Insert extra rows if there are more items than the template reserves
  //    — shifts the RECEIVED BY block (and its merges) down.
  insertExtraProductRows(sheet, layout, columnCount)

  // 4. Compute the single uniform row height: the max requirement across
  //    every product row (real items AND blank padding rows). No picture
  //    column on this template, and no separate Item Name column — the
  //    combined Brand + Name description is the only wrapped text field.
  const descriptionColWidth = Number(sheet.getColumn(columns.description).width ?? 22)

  let uniformHeight = 0
  for (let i = 0; i < finalRowCount; i++) {
    const item = data.items[i]
    const required = calculateRequiredRowHeight({
      itemName: "",
      description: item?.description ?? "",
      itemNameColWidth: descriptionColWidth,
      descriptionColWidth,
      hasPicture: false,
    })
    uniformHeight = Math.max(uniformHeight, required)
  }
  for (let i = 0; i < finalRowCount; i++) {
    sheet.getRow(templateRow + i).height = uniformHeight
  }

  // 5. Fill item rows (Qty as a real number, never a string) and clear blank
  //    padding rows. "No." is the plain 1, 2, 3... row sequence, generated in
  //    code (never copied from a template placeholder — see NO_COLUMN above
  //    and the Delivery Item Row Rule spec); "ITEM NO." is a DIFFERENT value
  //    — the Stock item's category code (EQUIPMENT/CONSUM/PART), computed in
  //    buildDeliveryExcelData. The two columns are never the same value.
  for (let i = 0; i < finalRowCount; i++) {
    const rowNumber = templateRow + i
    const row = sheet.getRow(rowNumber)
    const item = data.items[i]

    row.getCell(NO_COLUMN).value = item ? i + 1 : null
    row.getCell(columns.itemNo).value = item?.itemNo || null
    row.getCell(columns.description).value = item?.description || null
    row.getCell(columns.unit).value = item?.unit || null
    row.getCell(columns.qty).value = item ? item.qty : null
  }

  await mkdir(OUTPUT_DIR, { recursive: true })
  const fileName = `${slugify(data.deliveryNumber) || delivery.id}.xlsx`
  const outputPath = path.join(OUTPUT_DIR, fileName)
  await workbook.xlsx.writeFile(outputPath)

  return outputPath
}
