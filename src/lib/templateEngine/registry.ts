import type ExcelJS from "exceljs"
import type { TemplateType } from "./types"

/**
 * Tracks which TemplateType a loaded workbook came from, so fillItems()
 * can look up the right item-row layout without needing a `type` argument
 * (its signature is fixed to (workbook, items) per the engine spec).
 */
const workbookTypes = new WeakMap<ExcelJS.Workbook, TemplateType>()

export function registerWorkbookType(workbook: ExcelJS.Workbook, type: TemplateType): void {
  workbookTypes.set(workbook, type)
}

export function getWorkbookType(workbook: ExcelJS.Workbook): TemplateType | undefined {
  return workbookTypes.get(workbook)
}
