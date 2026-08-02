import type ExcelJS from "exceljs"
import { findPlaceholderCell } from "./placeholders"
import { copyRowStyle } from "./rowStyle"
import { ExcelTemplateError } from "./errors"

export interface ProductRowLayout {
  /** Row where the item-number placeholder (e.g. {{ITEM_NO}}) was found — the first product row. */
  templateRow: number
  /** Last row of the template's originally-reserved product area (the row directly above the footer). */
  reservedLastRow: number
  /** How many rows the template originally reserves for products. */
  reservedCount: number
  /** How many product rows the generated file will actually have — max(itemCount, minRows, reservedCount). */
  finalRowCount: number
}

/**
 * Locates the product template row (via `itemNoToken`, e.g. "{{ITEM_NO}}")
 * and the template's reserved product area (everything down to the row
 * just above `footerToken`, e.g. "{{SUBTOTAL}}"), then computes how many
 * product rows the final file needs. Nothing here is a hardcoded row
 * number — both anchors are found by searching cell content, so template
 * edits (as long as the placeholders remain) never require a code change.
 */
export function planProductRows(
  sheet: ExcelJS.Worksheet,
  itemNoToken: string,
  footerToken: string,
  itemCount: number,
  minRows: number
): ProductRowLayout {
  const itemNoLoc = findPlaceholderCell(sheet, itemNoToken)
  if (!itemNoLoc) {
    throw new ExcelTemplateError(`Template is missing the ${itemNoToken} placeholder — cannot locate the product row.`)
  }
  const templateRow = itemNoLoc.row

  const footerLoc = findPlaceholderCell(sheet, footerToken)
  if (!footerLoc) {
    throw new ExcelTemplateError(`Template is missing the ${footerToken} placeholder.`)
  }
  const reservedLastRow = footerLoc.row - 1
  const reservedCount = reservedLastRow - templateRow + 1

  const finalRowCount = Math.max(itemCount, minRows, reservedCount)

  return { templateRow, reservedLastRow, reservedCount, finalRowCount }
}

/**
 * Inserts additional product rows when there are more items than the
 * template reserves. `sheet.duplicateRow(..., insertAfter: true)` both
 * copies the source row's style and shifts every row below (NOTE,
 * Subtotal/VAT/Total, and their merges) down by the same count; every
 * newly-created row's per-cell style is then forced to exactly match the
 * template row as a belt-and-braces measure, regardless of what
 * duplicateRow itself copied. No-op if there's nothing to insert.
 */
export function insertExtraProductRows(sheet: ExcelJS.Worksheet, layout: ProductRowLayout, columnCount: number): void {
  if (layout.finalRowCount <= layout.reservedCount) return

  const extra = layout.finalRowCount - layout.reservedCount
  sheet.duplicateRow(layout.reservedLastRow, extra, true)

  for (let r = layout.templateRow + 1; r < layout.templateRow + layout.finalRowCount; r++) {
    copyRowStyle(sheet, layout.templateRow, r, columnCount)
  }
}
