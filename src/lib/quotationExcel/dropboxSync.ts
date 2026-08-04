import { readFile } from "fs/promises"
import { prisma } from "@/lib/prisma"
import { getQuotationForPdf } from "@/lib/data/quotations"
import {
  getDropboxConnectionStatus,
  uploadQuotationDocumentToDropbox,
  buildQuotationVersionFileName,
  buildQuotationFinalFileName,
  DropboxError,
} from "@/lib/dropbox"
import { generateQuotationExcel } from "./generate"
import { generateQuotationPdf, PdfConversionUnavailableError } from "./generatePdf"
import type { QuotationPdfData } from "@/lib/data/quotations"

export interface QuotationDropboxSyncResult {
  synced: ("PDF" | "XLSX")[]
  /** Set when syncing was never attempted (Dropbox not connected, or Customer has no Short Name) — not an error, just nothing to do yet. */
  skippedReason?: string
  errors: string[]
}

type Preconditions = { quotation: QuotationPdfData; shortName: string } | { skippedReason: string }

async function checkPreconditions(quotationId: string, companyId: string): Promise<Preconditions> {
  const dropboxStatus = await getDropboxConnectionStatus(companyId)
  if (!dropboxStatus.configured || !dropboxStatus.connected) {
    return { skippedReason: "Dropbox is not connected." }
  }

  const quotation = await getQuotationForPdf(quotationId, companyId)
  if (!quotation) {
    return { skippedReason: "Quotation not found." }
  }

  const shortName = quotation.customer.shortName?.trim()
  if (!shortName) {
    return { skippedReason: "Customer Short Name is required before syncing quotation to Dropbox." }
  }

  return { quotation, shortName }
}

async function generateExcelBufferSafe(quotation: QuotationPdfData, errors: string[]): Promise<Buffer | null> {
  try {
    const excelPath = await generateQuotationExcel(quotation)
    return await readFile(excelPath)
  } catch (error) {
    console.error(`[quotation ${quotation.id}] Excel generation failed:`, error)
    errors.push(`Excel generation failed: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

/**
 * The official PDF is *only* ever the Excel-to-PDF conversion (LibreOffice)
 * of the Excel just generated above — never the old react-pdf renderer.
 * If LibreOffice isn't installed/conversion fails, this returns null and
 * records the real reason; the caller simply doesn't sync a PDF for this
 * attempt (the XLSX still syncs on its own) rather than silently uploading
 * a differently-styled "fake" official PDF. See PdfConversionUnavailableError.
 */
async function generatePdfBufferFromExcel(quotation: QuotationPdfData, errors: string[]): Promise<Buffer | null> {
  try {
    const pdfPath = await generateQuotationPdf(quotation)
    return await readFile(pdfPath)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    if (error instanceof PdfConversionUnavailableError) {
      console.warn(`[quotation ${quotation.id}] Excel-to-PDF conversion unavailable:`, reason)
    } else {
      console.error(`[quotation ${quotation.id}] Excel-to-PDF conversion failed:`, reason)
    }
    errors.push(`PDF conversion failed: ${reason}`)
    return null
  }
}

interface SyncOneFileParams {
  companyId: string
  quotationId: string
  shortName: string
  quotationNumber: string
  fileType: "PDF" | "XLSX"
  extension: string
  buffer: Buffer
  mimeType: string
  version: number
  isFinal: boolean
  errors: string[]
}

/**
 * Upload and DB-save are deliberately two separate try/catches — an upload
 * failure (Dropbox unreachable, Path Root/namespace error, folder create
 * failed, ...) and a save failure (DB unreachable, constraint violation,
 * ...) are different failure classes, and section 2 of the runbook this
 * function backs asks for that distinction to survive into the error
 * message rather than being collapsed into one generic "sync failed". Both
 * branches also `console.error` immediately, so the real exception always
 * reaches server logs even if a caller only inspects `errors[0]` (or, in
 * resyncQuotationDropbox's case, forwards it straight to the client toast).
 */
async function syncOneFile(params: SyncOneFileParams): Promise<boolean> {
  const { companyId, quotationId, shortName, quotationNumber, fileType, extension, buffer, mimeType, version, isFinal, errors } = params
  const fileName = isFinal
    ? buildQuotationFinalFileName(quotationNumber, shortName, extension)
    : buildQuotationVersionFileName(quotationNumber, shortName, version, extension)
  const label = isFinal ? `${fileType} FINAL` : `${fileType} v${version}`

  let path: string
  try {
    ;({ path } = await uploadQuotationDocumentToDropbox(companyId, shortName, fileName, buffer))
  } catch (error) {
    const detail = error instanceof DropboxError ? error.message : error instanceof Error ? error.message : String(error)
    console.error(`[quotation ${quotationId}] ${label} Dropbox upload failed:`, error)
    errors.push(`${label} Dropbox upload failed: ${detail}`)
    return false
  }

  try {
    await prisma.quotationDocument.upsert({
      where: { quotationId_fileType_version_isFinal: { quotationId, fileType, version, isFinal } },
      create: {
        companyId,
        quotationId,
        fileType,
        version,
        isFinal,
        storageKey: path,
        storageProvider: "DROPBOX",
        mimeType,
        fileSize: buffer.length,
      },
      update: {
        storageKey: path,
        storageProvider: "DROPBOX",
        mimeType,
        fileSize: buffer.length,
      },
    })
    return true
  } catch (error) {
    // The file is already sitting in Dropbox at `path` at this point — only
    // the local database record failed to save. Left as-is rather than
    // attempting to delete the just-uploaded file: the next sync attempt
    // (auto or Retry) re-uploads to the exact same deterministic path
    // (overwrite) and will succeed in saving the record once the DB issue
    // clears, so nothing is lost either way.
    console.error(`[quotation ${quotationId}] ${label} QuotationDocument DB save failed (file uploaded to Dropbox at ${path}):`, error)
    errors.push(`${label} saved to Dropbox but the database record failed to save: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

async function syncQuotationDocuments(
  quotationId: string,
  companyId: string,
  version: number,
  isFinal: boolean
): Promise<QuotationDropboxSyncResult> {
  const pre = await checkPreconditions(quotationId, companyId)
  if ("skippedReason" in pre) {
    return { synced: [], skippedReason: pre.skippedReason, errors: [] }
  }
  const { quotation, shortName } = pre

  const synced: ("PDF" | "XLSX")[] = []
  const errors: string[] = []
  const common = { companyId, quotationId, shortName, quotationNumber: quotation.quotationNumber, version, isFinal, errors }

  const excelBuffer = await generateExcelBufferSafe(quotation, errors)
  if (excelBuffer) {
    const ok = await syncOneFile({
      ...common,
      fileType: "XLSX",
      extension: "xlsx",
      buffer: excelBuffer,
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
    if (ok) synced.push("XLSX")
  }

  // Only attempted once the Excel exists — the PDF is a conversion OF it,
  // never an independent render.
  const pdfBuffer = excelBuffer ? await generatePdfBufferFromExcel(quotation, errors) : null
  if (pdfBuffer) {
    const ok = await syncOneFile({ ...common, fileType: "PDF", extension: "pdf", buffer: pdfBuffer, mimeType: "application/pdf" })
    if (ok) synced.push("PDF")
  }

  return { synced, errors }
}

/**
 * Generates a Quotation's official PDF + Excel for the given version
 * (reusing the exact same generation functions as the "Download PDF/Excel"
 * buttons) and best-effort uploads each to Dropbox, upserting the matching
 * (quotationId, fileType, version, isFinal=false) row. Called with version=1
 * right after createQuotation, and with the freshly-incremented
 * Quotation.currentVersion right after an Adjust save.
 *
 * Safe to call more than once for the *same* version (e.g. a manual "Retry
 * Sync" after a prior failure, or a partial success where XLSX synced but
 * PDF didn't): each file type upserts the same row rather than inserting a
 * duplicate, and re-uploads to the exact same deterministic path — so a
 * retry only ever re-syncs the current version, never advances it. Never
 * throws; failures are reported in `errors` so the caller can log/toast
 * without ever undoing the Quotation record or any local file.
 */
export async function syncQuotationVersionToDropbox(
  quotationId: string,
  companyId: string,
  version: number
): Promise<QuotationDropboxSyncResult> {
  return syncQuotationDocuments(quotationId, companyId, version, false)
}

/**
 * Approve-time snapshot: generates a FINAL Excel/PDF from the quotation's
 * *current* live data (which, since no version keeps its own frozen copy of
 * QuotationItem rows, is exactly the same data the given `approvedFromVersion`
 * was generated from — as long as no further Adjust happened in between) and
 * uploads it as "QTxxxxx-SHORTNAME-FINAL.ext", a file distinct from any
 * numbered version. Never overwrites V1/V2/V3... — see buildQuotationFinalFileName.
 */
export async function syncQuotationFinalToDropbox(
  quotationId: string,
  companyId: string,
  approvedFromVersion: number
): Promise<QuotationDropboxSyncResult> {
  return syncQuotationDocuments(quotationId, companyId, approvedFromVersion, true)
}
