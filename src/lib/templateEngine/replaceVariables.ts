import type ExcelJS from "exceljs"
import type { TemplateData } from "./types"

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
const EXACT_PLACEHOLDER_RE = /^\{\{\s*([a-zA-Z0-9_]+)\s*\}\}$/

function resolveText(text: string, data: TemplateData): string {
  return text.replace(PLACEHOLDER_RE, (_match, key: string) => {
    const value = data[key]
    return value === null || value === undefined ? "" : String(value)
  })
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

/**
 * Replaces {{variable}} placeholders across every cell of the workbook.
 *
 * - A cell whose entire content is a single "{{key}}" token gets the raw
 *   data value (numbers/dates keep their type and number format).
 * - A cell with placeholders mixed into other text gets string
 *   interpolation of every token found.
 * - Rich-text cells are interpolated run-by-run, preserving each run's font.
 * - Missing keys resolve to a blank cell (exact match) or empty string
 *   (mixed text) rather than throwing.
 * - Any unexpected cell shape is skipped, never crashes the run.
 */
export function replaceVariables(workbook: ExcelJS.Workbook, data: TemplateData): void {
  workbook.eachSheet((worksheet) => {
    worksheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        try {
          const value = cell.value

          if (typeof value === "string") {
            const exactMatch = value.trim().match(EXACT_PLACEHOLDER_RE)
            if (exactMatch) {
              const key = exactMatch[1]
              const resolved = data[key]
              cell.value = resolved === null || resolved === undefined ? null : resolved
              return
            }
            if (value.includes("{{")) {
              cell.value = resolveText(value, data)
            }
            return
          }

          if (isRichText(value)) {
            value.richText = value.richText.map((run) => ({
              ...run,
              text: run.text.includes("{{") ? resolveText(run.text, data) : run.text,
            }))
            return
          }

          // Numbers, dates, formulas, hyperlinks, etc. can't contain placeholders.
        } catch (error) {
          console.warn(
            `[templateEngine] Skipped placeholder replacement for cell ${cell.address}:`,
            error
          )
        }
      })
    })
  })
}
