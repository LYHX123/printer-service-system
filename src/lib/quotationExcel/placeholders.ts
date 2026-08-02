import type ExcelJS from "exceljs"

export interface PlaceholderLocation {
  row: number
  col: number
  address: string
}

interface RichTextRun {
  text: string
  font?: unknown
}

function isRichText(value: unknown): value is { richText: RichTextRun[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { richText?: unknown }).richText)
  )
}

function cellText(cell: ExcelJS.Cell): string | null {
  const value = cell.value
  if (typeof value === "string") return value
  if (isRichText(value)) return value.richText.map((run) => run.text).join("")
  return null
}

/**
 * Scans the whole sheet for the first cell whose text contains `token`
 * (e.g. "{{ITEM_NO}}"). This is how the engine finds the product template
 * row, the SAMPLE/picture column, and the Subtotal/VAT/Total cells —
 * nothing is ever assumed to sit at a fixed row/column.
 */
export function findPlaceholderCell(sheet: ExcelJS.Worksheet, token: string): PlaceholderLocation | null {
  let found: PlaceholderLocation | null = null
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (found) return
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      if (found) return
      const text = cellText(cell)
      if (text && text.includes(token)) {
        found = { row: rowNumber, col: colNumber, address: cell.address }
      }
    })
  })
  return found
}

/** Same search, scoped to a single row — used to locate each column within the product template row. */
export function findColumnForTokenInRow(sheet: ExcelJS.Worksheet, rowNumber: number, token: string): number | null {
  const row = sheet.getRow(rowNumber)
  let found: number | null = null
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (found) return
    const text = cellText(cell)
    if (text && text.includes(token)) found = colNumber
  })
  return found
}

/**
 * Replaces every occurrence of `token` across the whole sheet with `value`.
 * Re-scans by content every call, so it naturally finds placeholders at
 * their CURRENT position — safe to call after rows have been inserted and
 * the footer has physically shifted down.
 *
 * - A cell whose entire trimmed content is exactly the token gets the raw
 *   value assigned directly (numbers stay numbers, so Excel can still
 *   compute with them and the cell's existing number format still applies).
 * - A cell with the token mixed into other text (plain string or rich
 *   text run) gets a substring replacement, preserving surrounding text
 *   and — for rich text — each run's original font.
 */
export function replacePlaceholder(sheet: ExcelJS.Worksheet, token: string, value: string | number | null): void {
  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      const raw = cell.value

      if (typeof raw === "string") {
        if (!raw.includes(token)) return
        if (raw.trim() === token) {
          cell.value = value === null ? null : value
        } else {
          cell.value = raw.split(token).join(value === null ? "" : String(value))
        }
        return
      }

      if (isRichText(raw)) {
        let changed = false
        const richText = raw.richText.map((run) => {
          if (!run.text.includes(token)) return run
          changed = true
          return { ...run, text: run.text.split(token).join(value === null ? "" : String(value)) }
        })
        if (changed) cell.value = { richText } as ExcelJS.CellRichTextValue
      }
    })
  })
}
