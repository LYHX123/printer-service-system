import { readFile } from "fs/promises"
import { prisma } from "@/lib/prisma"
import { getInvoiceForPdf } from "@/lib/data/invoices"
import {
  getDropboxConnectionStatus,
  ensureInvoiceMonthFolders,
  buildInvoiceFileName,
  uploadInvoiceDocumentToDropbox,
  DropboxError,
} from "@/lib/dropbox"
import { generateInvoiceExcel } from "./generate"
import { generateInvoicePdf, PdfConversionUnavailableError } from "./generatePdf"
import type { InvoicePdfData } from "@/lib/data/invoices"

export interface InvoiceDropboxSyncResult {
  synced: ("PDF" | "XLSX")[]
  /** Set when syncing was never attempted (Dropbox not connected) — not an error, just nothing to do yet. */
  skippedReason?: string
  errors: string[]
}

type Preconditions = { invoice: InvoicePdfData; folderPath: string } | { skippedReason: string }

async function checkPreconditions(invoiceId: string, companyId: string): Promise<Preconditions> {
  const dropboxStatus = await getDropboxConnectionStatus(companyId)
  if (!dropboxStatus.configured || !dropboxStatus.connected) {
    return { skippedReason: "Dropbox is not connected." }
  }

  const invoice = await getInvoiceForPdf(invoiceId, companyId)
  if (!invoice) {
    return { skippedReason: "Invoice not found." }
  }

  // Unlike Quotation/Customer, an Invoice's Dropbox location depends only on
  // its own Date (Year/Month) — no Customer Short Name involved at all.
  const year = invoice.date.getFullYear()
  const month = invoice.date.getMonth() + 1
  let folderPath: string
  try {
    const folders = await ensureInvoiceMonthFolders(companyId, year, month)
    folderPath = folders.monthInvoicePath
  } catch (error) {
    return { skippedReason: error instanceof DropboxError ? error.message : "Failed to prepare the Invoice Dropbox folder." }
  }

  return { invoice, folderPath }
}

async function generateExcelBufferSafe(invoice: InvoicePdfData, errors: string[]): Promise<Buffer | null> {
  try {
    const excelPath = await generateInvoiceExcel(invoice)
    return await readFile(excelPath)
  } catch (error) {
    console.error(`[invoice ${invoice.id}] Excel generation failed:`, error)
    errors.push(`Excel generation failed: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

/**
 * The official PDF is *only* ever the Excel-to-PDF conversion (LibreOffice)
 * of the Excel just generated above — never the old react-pdf renderer
 * (that one stays as-is, but only as the ad-hoc "Download PDF" button's own
 * fallback for un-synced invoices — see the .../documents/[fileType] route).
 * If LibreOffice isn't installed/conversion fails, this returns null and
 * records the real reason; the caller simply doesn't sync a PDF for this
 * attempt (the XLSX still syncs on its own).
 */
async function generatePdfBufferFromExcel(invoice: InvoicePdfData, errors: string[]): Promise<Buffer | null> {
  try {
    const pdfPath = await generateInvoicePdf(invoice)
    return await readFile(pdfPath)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    if (error instanceof PdfConversionUnavailableError) {
      console.warn(`[invoice ${invoice.id}] Excel-to-PDF conversion unavailable:`, reason)
    } else {
      console.error(`[invoice ${invoice.id}] Excel-to-PDF conversion failed:`, reason)
    }
    errors.push(`PDF conversion failed: ${reason}`)
    return null
  }
}

interface SyncOneFileParams {
  companyId: string
  invoiceId: string
  folderPath: string
  invoiceNumber: string
  fileType: "PDF" | "XLSX"
  extension: string
  buffer: Buffer
  mimeType: string
  errors: string[]
}

/**
 * Upload and DB-save are two separate try/catches, same reasoning as
 * quotationExcel/dropboxSync.ts's syncOneFile: an upload failure and a save
 * failure are different classes of problem, and both should reach server
 * logs with the real exception rather than being collapsed into one
 * generic message.
 */
async function syncOneFile(params: SyncOneFileParams): Promise<boolean> {
  const { companyId, invoiceId, folderPath, invoiceNumber, fileType, extension, buffer, mimeType, errors } = params
  const fileName = buildInvoiceFileName(invoiceNumber, extension)

  let path: string
  try {
    ;({ path } = await uploadInvoiceDocumentToDropbox(companyId, folderPath, fileName, buffer))
  } catch (error) {
    const detail = error instanceof DropboxError ? error.message : error instanceof Error ? error.message : String(error)
    console.error(`[invoice ${invoiceId}] ${fileType} Dropbox upload failed:`, error)
    errors.push(`${fileType} Dropbox upload failed: ${detail}`)
    return false
  }

  try {
    await prisma.invoiceDocument.upsert({
      where: { invoiceId_fileType: { invoiceId, fileType } },
      create: { companyId, invoiceId, fileType, storageKey: path, storageProvider: "DROPBOX", mimeType, fileSize: buffer.length },
      update: { storageKey: path, storageProvider: "DROPBOX", mimeType, fileSize: buffer.length },
    })
    return true
  } catch (error) {
    // The file is already sitting in Dropbox at `path` — only the DB record
    // failed. Left as-is: the next sync attempt re-uploads to the same
    // deterministic path (overwrite) and will succeed in saving the record
    // once the DB issue clears.
    console.error(`[invoice ${invoiceId}] ${fileType} InvoiceDocument DB save failed (file uploaded to Dropbox at ${path}):`, error)
    errors.push(`${fileType} saved to Dropbox but the database record failed to save: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

/**
 * Generates an Invoice's official PDF + Excel (reusing the exact same
 * generation functions as the "Download PDF/Excel" buttons) and
 * best-effort uploads each to Dropbox under Invoice/{Year}/{Month}/{Month
 * Invoice}/{InvoiceNumber}.{ext}, upserting the matching (invoiceId,
 * fileType) row. Called after generateInvoice/createDirectInvoice commit,
 * and again after updateInvoice (no versioning — an edit just re-syncs the
 * same file in place).
 *
 * Safe to call repeatedly (auto or manual "Sync to Dropbox" retry): each
 * file type always upserts the same row and re-uploads to the same
 * deterministic path. Never throws — failures are reported in `errors` so
 * the caller can log/toast without ever undoing the Invoice record.
 */
export async function syncInvoiceToDropbox(invoiceId: string, companyId: string): Promise<InvoiceDropboxSyncResult> {
  const pre = await checkPreconditions(invoiceId, companyId)
  if ("skippedReason" in pre) {
    return { synced: [], skippedReason: pre.skippedReason, errors: [] }
  }
  const { invoice, folderPath } = pre

  const synced: ("PDF" | "XLSX")[] = []
  const errors: string[] = []
  const common = { companyId, invoiceId, folderPath, invoiceNumber: invoice.invoiceNumber, errors }

  const excelBuffer = await generateExcelBufferSafe(invoice, errors)
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

  // Only attempted once the Excel exists — the PDF is a conversion OF it.
  const pdfBuffer = excelBuffer ? await generatePdfBufferFromExcel(invoice, errors) : null
  if (pdfBuffer) {
    const ok = await syncOneFile({ ...common, fileType: "PDF", extension: "pdf", buffer: pdfBuffer, mimeType: "application/pdf" })
    if (ok) synced.push("PDF")
  }

  return { synced, errors }
}
