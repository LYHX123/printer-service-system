import { mkdir } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import { loadTemplate } from "./loadTemplate"
import { replaceVariables } from "./replaceVariables"
import { fillItems } from "./fillItems"
import { OUTPUT_ROOT } from "./config"
import type { GenerateExcelData, TemplateData, TemplateType } from "./types"

function slugify(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "")
}

/**
 * Generates a finished Excel document for the given type + data and saves
 * it under storage/generated/<type>/. Returns the absolute output path.
 */
export async function generateExcel(type: TemplateType, data: GenerateExcelData): Promise<string> {
  const workbook = await loadTemplate(type)

  const { items, ...variables } = data
  if (items) {
    fillItems(workbook, items)
  }
  replaceVariables(workbook, variables as TemplateData)

  const outDir = path.join(OUTPUT_ROOT, type)
  await mkdir(outDir, { recursive: true })

  const documentNumber = variables.quotation_no ?? variables.invoice_no
  const baseName = documentNumber ? slugify(String(documentNumber)) : ""
  const fileName = `${baseName || randomUUID()}.xlsx`
  const outputPath = path.join(outDir, fileName)

  await workbook.xlsx.writeFile(outputPath)

  return outputPath
}
