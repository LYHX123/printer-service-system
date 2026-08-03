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

// A PATH-based lookup has to actually launch the binary once to confirm it
// works (see below) — LibreOffice's first launch on a given machine/profile
// can take several seconds (observed ~6-7s on a fresh Windows profile), so
// this needs real headroom rather than a tight timeout that would
// misreport a perfectly good install as "unavailable".
const PATH_CANDIDATE_PROBE_TIMEOUT_MS = 15000

let cachedBinary: string | null | undefined

/**
 * Detection order:
 *   1. LIBREOFFICE_BINARY_PATH env var, if set — an explicit operator
 *      override always wins, no probing needed (the path is trusted as-is;
 *      if it's wrong, the actual conversion call below will fail loudly
 *      rather than silently falling through to autodetection).
 *   2. Bare "soffice"/"libreoffice" on PATH — probed with --version.
 *   3. Well-known absolute install paths (Windows) — checked with a plain
 *      file-existence check (access), not executed, since actually running
 *      the binary just to detect it is the slow part above.
 */
async function findLibreOffice(): Promise<string | null> {
  if (cachedBinary !== undefined) return cachedBinary

  const explicit = process.env.LIBREOFFICE_BINARY_PATH?.trim()
  if (explicit) {
    cachedBinary = explicit
    return cachedBinary
  }

  for (const candidate of LIBREOFFICE_CANDIDATES) {
    try {
      if (path.isAbsolute(candidate)) {
        await access(candidate)
      } else {
        await execFileAsync(candidate, ["--version"], { timeout: PATH_CANDIDATE_PROBE_TIMEOUT_MS })
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
 * Converts an already-generated .xlsx file to PDF via a local headless
 * LibreOffice install. Shared by generatePdf() below (Invoice's own
 * Excel-Template-Engine path) and by the dedicated Quotation Excel engine's
 * PDF route, so both document types get identical Excel-to-PDF rendering
 * without duplicating the LibreOffice lookup/invocation logic.
 */
export async function convertExcelToPdf(excelPath: string): Promise<string> {
  const binary = await findLibreOffice()
  if (!binary) {
    throw new PdfConversionUnavailableError()
  }

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

/**
 * Generates a PDF for the given document type by rendering it through
 * generateExcel() and converting the result with a local LibreOffice
 * install (headless). Throws PdfConversionUnavailableError when no
 * LibreOffice binary can be found or the conversion itself fails — callers
 * should catch this and fall back to the old PDF generator.
 */
export async function generatePdf(type: TemplateType, data: GenerateExcelData): Promise<string> {
  const excelPath = await generateExcel(type, data)
  return convertExcelToPdf(excelPath)
}
