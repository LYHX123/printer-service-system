import { access } from "fs/promises"
import ExcelJS from "exceljs"
import { TEMPLATE_CONFIG } from "./config"
import { TemplateEngineError } from "./errors"
import { registerWorkbookType } from "./registry"
import type { TemplateType } from "./types"

/**
 * Loads the Excel template for a given document type.
 * Supported types are declared in TEMPLATE_CONFIG — add an entry there to
 * support a new document type without changing this function.
 */
export async function loadTemplate(type: TemplateType): Promise<ExcelJS.Workbook> {
  const config = TEMPLATE_CONFIG[type]
  if (!config) {
    throw new TemplateEngineError(`Unsupported template type: "${type}".`)
  }

  try {
    await access(config.templatePath)
  } catch {
    throw new TemplateEngineError(
      `Excel template not found: ${config.templatePath}`
    )
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.readFile(config.templatePath)
  } catch (error) {
    throw new TemplateEngineError(
      `Failed to read Excel template "${config.templatePath}": ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }

  registerWorkbookType(workbook, type)
  return workbook
}
