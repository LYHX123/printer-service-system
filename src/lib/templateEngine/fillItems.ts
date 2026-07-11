import type ExcelJS from "exceljs"
import { TEMPLATE_CONFIG } from "./config"
import { TemplateEngineError } from "./errors"
import { getWorkbookType } from "./registry"
import type { TemplateItem } from "./types"

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Fills the item table of a loaded template with an unlimited number of
 * rows, preserving the template's formatting (fonts, borders, fills,
 * number formats) on every row it touches or creates.
 *
 * Must be called on a workbook returned by loadTemplate() — that call
 * records which document type the workbook is, since this function's
 * signature intentionally has no `type` argument.
 *
 * Call this before replaceVariables() so footer placeholders ({{subtotal}},
 * {{vat}}, {{grand_total}}, ...) land in their final row positions before
 * substitution runs.
 */
export function fillItems(workbook: ExcelJS.Workbook, items: TemplateItem[]): void {
  const type = getWorkbookType(workbook)
  if (!type) {
    throw new TemplateEngineError(
      "fillItems() received a workbook that was not created by loadTemplate()."
    )
  }

  const config = TEMPLATE_CONFIG[type]
  const worksheet = workbook.worksheets[config.sheetIndex]
  if (!worksheet) {
    throw new TemplateEngineError(`Worksheet not found for template type "${type}".`)
  }

  const { itemColumns } = config
  const reservedCount = config.itemsLastRow - config.itemsFirstRow + 1

  if (items.length > reservedCount) {
    const extra = items.length - reservedCount
    worksheet.duplicateRow(config.itemsLastRow, extra, true)
  }

  const rowCount = Math.max(items.length, reservedCount)

  for (let i = 0; i < rowCount; i++) {
    const rowNumber = config.itemsFirstRow + i
    const item = items[i]

    try {
      const row = worksheet.getRow(rowNumber)

      if (item) {
        row.getCell(itemColumns.no).value = i + 1
        row.getCell(itemColumns.itemName).value = item.itemName || null
        row.getCell(itemColumns.description).value = item.description || null
        row.getCell(itemColumns.unit).value = item.unit || null
        row.getCell(itemColumns.qty).value = item.qty
        row.getCell(itemColumns.unitPrice).value = item.unitPrice
        row.getCell(itemColumns.amount).value = round2(item.qty * item.unitPrice)
      } else {
        for (const col of Object.values(itemColumns)) {
          row.getCell(col).value = null
        }
      }
    } catch (error) {
      console.warn(`[templateEngine] Skipped item row ${rowNumber}:`, error)
    }
  }
}
