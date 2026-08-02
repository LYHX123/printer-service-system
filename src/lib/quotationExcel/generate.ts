import { mkdir } from "fs/promises"
import path from "path"
import ExcelJS from "exceljs"
import { findPlaceholderCell, findColumnForTokenInRow, replacePlaceholder } from "./placeholders"
import { copyRowStyle, calculateRequiredRowHeight } from "./rowStyle"
import { loadProductImage, insertProductPicture } from "./picture"
import { buildQuotationExcelData } from "./buildData"
import { QuotationExcelError } from "./errors"
import type { QuotationPdfData } from "@/lib/data/quotations"

const TEMPLATE_PATH = path.join(process.cwd(), "templates", "quotation", "quotation template.xlsx")
const OUTPUT_DIR = path.join(process.cwd(), "storage", "generated", "quotation")
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
  picture: number
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
    picture: "{{PICTURE}}",
  }

  const columns = {} as ProductColumns
  for (const key of Object.keys(tokens) as (keyof ProductColumns)[]) {
    const col = findColumnForTokenInRow(sheet, templateRow, tokens[key])
    if (col === null) {
      throw new QuotationExcelError(`Quotation Excel template row ${templateRow} is missing the ${tokens[key]} placeholder.`)
    }
    columns[key] = col
  }
  return columns
}

/**
 * Generates the Quotation Excel document from the formal template
 * (templates/quotation/quotation template.xlsx), filling every dynamic
 * placeholder in place while leaving the template's logo, borders, fonts,
 * colors, merges, NOTE/terms text, and page setup completely untouched.
 *
 * Nothing about the template's row layout is hardcoded: the product
 * template row, its columns, and the Subtotal/VAT/Total cells are all
 * located by searching for their {{TOKEN}} text at generation time, so a
 * future template edit (as long as the placeholders remain) never requires
 * a code change here.
 */
export async function generateQuotationExcel(quotation: QuotationPdfData): Promise<string> {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.readFile(TEMPLATE_PATH)
  } catch (error) {
    throw new QuotationExcelError(
      `Quotation Excel template not found or unreadable: ${TEMPLATE_PATH} (${error instanceof Error ? error.message : String(error)})`
    )
  }

  const sheet = workbook.worksheets[0]
  if (!sheet) {
    throw new QuotationExcelError("Quotation Excel template has no worksheet.")
  }

  const data = buildQuotationExcelData(quotation)

  // 1. Header placeholders — safe to replace before any row math, since
  //    they live above the product table and are unaffected by it.
  replacePlaceholder(sheet, "{{CUSTOMER_NAME}}", data.customerName)
  replacePlaceholder(sheet, "{{CUSTOMER_PIN}}", data.customerPin)
  replacePlaceholder(sheet, "{{QUOTATION_DATE}}", data.quotationDate)
  replacePlaceholder(sheet, "{{QUOTATION_NUMBER}}", data.quotationNumber)

  // 2. Locate the product template row + its columns dynamically.
  const itemNoLoc = findPlaceholderCell(sheet, "{{ITEM_NO}}")
  if (!itemNoLoc) {
    throw new QuotationExcelError("Quotation Excel template is missing the {{ITEM_NO}} placeholder — cannot locate the product row.")
  }
  const templateRow = itemNoLoc.row
  const columns = findProductColumns(sheet, templateRow)
  const columnCount = Math.max(...Object.values(columns))

  // 3. The reserved product area runs from the template row down to the row
  //    just above {{SUBTOTAL}} — derived from a placeholder search, not a
  //    hardcoded row count, so it stays correct even if the template's
  //    blank-row padding is ever changed.
  const subtotalLocBefore = findPlaceholderCell(sheet, "{{SUBTOTAL}}")
  if (!subtotalLocBefore) {
    throw new QuotationExcelError("Quotation Excel template is missing the {{SUBTOTAL}} placeholder.")
  }
  const reservedLastRow = subtotalLocBefore.row - 1
  const reservedCount = reservedLastRow - templateRow + 1

  const finalRowCount = Math.max(data.items.length, MIN_PRODUCT_ROWS, reservedCount)

  // 4. Insert extra rows if there are more items than the template reserves.
  //    duplicateRow(..., insertAfter: true) both copies the source row's
  //    style AND shifts every row below (NOTE, Subtotal, VAT, Total, and
  //    their merges) down by the same count.
  if (finalRowCount > reservedCount) {
    const extra = finalRowCount - reservedCount
    sheet.duplicateRow(reservedLastRow, extra, true)
    // Belt-and-braces: force every product row's per-cell style to exactly
    // match the template row, regardless of what duplicateRow copied.
    for (let r = templateRow + 1; r < templateRow + finalRowCount; r++) {
      copyRowStyle(sheet, templateRow, r, columnCount)
    }
  }

  // 5. Re-locate the footer placeholders AFTER any row insertion — never
  //    trust the pre-insertion row numbers once rows have shifted.
  const subtotalLoc = findPlaceholderCell(sheet, "{{SUBTOTAL}}")
  const vatLoc = findPlaceholderCell(sheet, "{{VAT_AMOUNT}}")
  const totalLoc = findPlaceholderCell(sheet, "{{TOTAL_AMOUNT}}")
  if (!subtotalLoc || !vatLoc || !totalLoc) {
    throw new QuotationExcelError("Quotation Excel template is missing one of {{SUBTOTAL}} / {{VAT_AMOUNT}} / {{TOTAL_AMOUNT}} after row insertion.")
  }

  // 6. Compute the single uniform row height: the max requirement across
  //    every product row (real items AND blank padding rows), each with its
  //    own picture-presence check.
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
      hasPicture: Boolean(item?.pictureUrl),
    })
    uniformHeight = Math.max(uniformHeight, required)
  }
  for (let i = 0; i < finalRowCount; i++) {
    sheet.getRow(templateRow + i).height = uniformHeight
  }

  // 7. Fill item rows (numeric fields as real numbers, never strings) and
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
    // The SAMPLE cell's {{PICTURE}} text is always cleared here — an embedded
    // image (if any) is a separate floating drawing layered on top in step 8,
    // never the cell's own text content. Rows with no picture must end up
    // completely empty, never showing the literal placeholder.
    row.getCell(columns.picture).value = null
  }

  // 8. Pictures — embedded, never as literal placeholder text or a broken
  //    link; a row with no picture is left completely empty.
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i]
    if (!item.pictureUrl) continue
    const image = await loadProductImage(item.pictureUrl)
    if (!image) continue
    insertProductPicture(workbook, sheet, templateRow + i, columns.picture, image, uniformHeight)
  }

  // 9. Footer totals — real numeric cells, using the template's existing
  //    number format (already baked into the cell's style).
  replacePlaceholder(sheet, "{{SUBTOTAL}}", round2(data.subtotal))
  replacePlaceholder(sheet, "{{VAT_AMOUNT}}", round2(data.vatAmount))
  replacePlaceholder(sheet, "{{TOTAL_AMOUNT}}", round2(data.totalAmount))

  await mkdir(OUTPUT_DIR, { recursive: true })
  const fileName = `${slugify(data.quotationNumber) || quotation.id}.xlsx`
  const outputPath = path.join(OUTPUT_DIR, fileName)
  await workbook.xlsx.writeFile(outputPath)

  return outputPath
}
