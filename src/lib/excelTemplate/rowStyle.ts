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

/**
 * General-purpose version of the estimate above `calculateRequiredRowHeight`
 * specializes for product rows — the raw "how tall must this wrapped text
 * be" primitive, unclamped, reusable for any other wrapped text block (e.g.
 * the Customer info cell). Callers apply their own min/max as needed.
 */
export function estimateWrappedTextHeight(text: string, columnWidth: number): number {
  return estimateLines(text, columnWidth) * LINE_HEIGHT_PT + ROW_VERTICAL_PADDING_PT
}

/** Caps how much a merged text block is ever allowed to grow beyond its
 * template default — long content should stay fully visible, but one
 * pathological value (e.g. an absurdly long customer name) must not blow
 * out the page layout. */
const MAX_BLOCK_EXTRA_HEIGHT = 150

/**
 * Grows a fixed-height merged cell just enough for `text` to fully display
 * when wrapped at `columnWidth`, and never shrinks it below whatever the
 * template already has — ExcelJS/LibreOffice don't auto-expand a row that
 * already has an explicit height, so without this a long Customer name (or
 * similar) can render clipped. `masterAddress` is the merge's top-left cell
 * (e.g. "D3"); the merge's actual row/column span is looked up from the
 * sheet itself (never assumed), so this works for a single cell too — it
 * just falls back to that one row/column. All the extra height is added to
 * the LAST row of the span, which in this template's own convention is
 * already the row reserved for overflow (its template height is the
 * tallest of the block).
 */
export function growMergedBlockForText(sheet: ExcelJS.Worksheet, masterAddress: string, text: string): void {
  const masterCell = sheet.getCell(masterAddress)
  const mergeRange = (sheet.model.merges as string[]).find((m) => m.startsWith(`${masterAddress}:`))

  // ExcelJS's own type declarations claim Cell.row/.col are strings (an
  // upstream inaccuracy — @excelTemplate/index.d.ts's `Address` interface),
  // but the runtime value is always numeric; `Number(...)` reconciles the
  // two without changing behavior.
  let endRow = Number(masterCell.row)
  let endCol = Number(masterCell.col)
  if (mergeRange) {
    const endAddress = mergeRange.split(":")[1]
    const endCell = sheet.getCell(endAddress)
    endRow = Number(endCell.row)
    endCol = Number(endCell.col)
  }
  const startRow = Number(masterCell.row)
  const startCol = Number(masterCell.col)

  let columnWidth = 0
  for (let c = startCol; c <= endCol; c++) columnWidth += Number(sheet.getColumn(c).width ?? 9)

  const defaultHeight = sheet.properties.defaultRowHeight || 15
  let currentTotal = 0
  for (let r = startRow; r <= endRow; r++) currentTotal += sheet.getRow(r).height || defaultHeight

  const required = estimateWrappedTextHeight(text, columnWidth)
  if (required <= currentTotal) return

  const extra = Math.min(required - currentTotal, MAX_BLOCK_EXTRA_HEIGHT)
  const lastRow = sheet.getRow(endRow)
  lastRow.height = (lastRow.height || defaultHeight) + extra
}
