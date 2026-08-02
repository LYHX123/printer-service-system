import type ExcelJS from "exceljs"

/**
 * Copies one row's per-cell style (font, alignment, border, fill, number
 * format, protection) onto another row, column by column. Used to guarantee
 * every product row — including ones inserted beyond the template's
 * original 10 — is visually indistinguishable from the template's row 7,
 * regardless of what ExcelJS's own row-duplication happened to carry over.
 */
export function copyRowStyle(sheet: ExcelJS.Worksheet, sourceRowNumber: number, targetRowNumber: number, columnCount: number): void {
  const sourceRow = sheet.getRow(sourceRowNumber)
  const targetRow = sheet.getRow(targetRowNumber)

  for (let col = 1; col <= columnCount; col++) {
    const sourceCell = sourceRow.getCell(col)
    const targetCell = targetRow.getCell(col)
    targetCell.font = sourceCell.font
    targetCell.alignment = sourceCell.alignment
    targetCell.border = sourceCell.border
    targetCell.fill = sourceCell.fill
    targetCell.numFmt = sourceCell.numFmt
    targetCell.protection = sourceCell.protection
  }
}

const MIN_ROW_HEIGHT = 60
const MAX_ROW_HEIGHT = 120
const PICTURE_MIN_HEIGHT = 90
const LINE_HEIGHT_PT = 16
const ROW_VERTICAL_PADDING_PT = 20
/** Rough characters-per-Excel-width-unit for Times New Roman at the template's font size. */
const CHAR_WIDTH_FACTOR = 1.05

function estimateLines(text: string, columnWidth: number): number {
  if (!text) return 1
  const charsPerLine = Math.max(8, Math.floor(columnWidth * CHAR_WIDTH_FACTOR))
  return text
    .split("\n")
    .reduce((total, paragraph) => total + Math.max(1, Math.ceil(paragraph.length / charsPerLine)), 0)
}

/**
 * Estimates the row height (in points) needed to fully display one product
 * row's Item Name + Description text (wrap-text aware, based on the actual
 * template column widths) and, if the row has a picture, a sane minimum for
 * the image to render at a legible size. Callers take the MAX of this
 * across every product row (including blanks) and apply that single value
 * uniformly — see generateQuotationExcel().
 */
export function calculateRequiredRowHeight(params: {
  itemName: string
  description: string
  itemNameColWidth: number
  descriptionColWidth: number
  hasPicture: boolean
}): number {
  const nameLines = estimateLines(params.itemName, params.itemNameColWidth)
  const descLines = estimateLines(params.description, params.descriptionColWidth)
  const maxLines = Math.max(nameLines, descLines)

  let height = maxLines * LINE_HEIGHT_PT + ROW_VERTICAL_PADDING_PT
  if (params.hasPicture) height = Math.max(height, PICTURE_MIN_HEIGHT)

  return Math.min(MAX_ROW_HEIGHT, Math.max(MIN_ROW_HEIGHT, height))
}
