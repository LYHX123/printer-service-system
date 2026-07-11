import { execFile } from "child_process"
import { promisify } from "util"
import path from "path"
import { access } from "fs/promises"
import { generateExcel } from "./generateExcel"
import { TemplateEngineError } from "./errors"
import type { GenerateExcelData, TemplateType } from "./types"

const execFileAsync = promisify(execFile)

/** Thrown when there is no working LibreOffice install to convert Excel to PDF. */
export class PdfConversionUnavailableError extends TemplateEngineError {
  constructor(
    message = "Excel-to-PDF conversion is not available in this environment. Using old PDF fallback."
  ) {
    super(message)
    this.name = "PdfConversionUnavailableError"
  }
}

const LIBREOFFICE_CANDIDATES =
  process.platform === "win32"
    ? [
        "soffice",
        "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
        "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
      ]
    : ["soffice", "libreoffice"]

let cachedBinary: string | null | undefined

async function findLibreOffice(): Promise<string | null> {
  if (cachedBinary !== undefined) return cachedBinary

  for (const candidate of LIBREOFFICE_CANDIDATES) {
    try {
      if (path.isAbsolute(candidate)) {
        await access(candidate)
      } else {
        await execFileAsync(candidate, ["--version"], { timeout: 5000 })
      }
      cachedBinary = candidate
      return cachedBinary
    } catch {
      // try next candidate
    }
  }

  cachedBinary = null
  return null
}

/**
 * Generates a PDF for the given document type by rendering it through
 * generateExcel() and converting the result with a local LibreOffice
 * install (headless). Throws PdfConversionUnavailableError when no
 * LibreOffice binary can be found or the conversion itself fails — callers
 * should catch this and fall back to the old PDF generator.
 */
export async function generatePdf(type: TemplateType, data: GenerateExcelData): Promise<string> {
  const binary = await findLibreOffice()
  if (!binary) {
    throw new PdfConversionUnavailableError()
  }

  const excelPath = await generateExcel(type, data)
  const outDir = path.dirname(excelPath)

  try {
    await execFileAsync(
      binary,
      ["--headless", "--convert-to", "pdf", "--outdir", outDir, excelPath],
      { timeout: 60000 }
    )
  } catch (error) {
    throw new PdfConversionUnavailableError(
      `Excel-to-PDF conversion failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  const pdfPath = excelPath.replace(/\.xlsx$/i, ".pdf")
  try {
    await access(pdfPath)
  } catch {
    throw new PdfConversionUnavailableError(
      "Excel-to-PDF conversion did not produce an output file."
    )
  }

  return pdfPath
}
