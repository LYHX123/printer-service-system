import { readFile } from "fs/promises"
import { prisma } from "@/lib/prisma"
import { getDeliveryForPdf } from "@/lib/data/deliveries"
import {
  getDropboxConnectionStatus,
  ensureDeliveryNoteMonthFolder,
  buildDeliveryFileName,
  uploadDeliveryDocumentToDropbox,
  DropboxError,
} from "@/lib/dropbox"
import { generateDeliveryExcel } from "./generate"
import { generateDeliveryPdf, PdfConversionUnavailableError } from "./generatePdf"
import type { DeliveryPdfData } from "@/lib/data/deliveries"

export interface DeliveryDropboxSyncResult {
  synced: ("PDF" | "XLSX")[]
  /** Set when syncing was never attempted (Dropbox not connected, or the customer has no Short Name yet) — not an error, just nothing to do yet. */
  skippedReason?: string
  errors: string[]
}

type Preconditions = { delivery: DeliveryPdfData; folderPath: string; shortName: string } | { skippedReason: string }

async function checkPreconditions(deliveryId: string, companyId: string): Promise<Preconditions> {
  const dropboxStatus = await getDropboxConnectionStatus(companyId)
  if (!dropboxStatus.configured || !dropboxStatus.connected) {
    return { skippedReason: "Dropbox is not connected." }
  }

  const delivery = await getDeliveryForPdf(deliveryId, companyId)
  if (!delivery) {
    return { skippedReason: "Delivery not found." }
  }

  // Same precondition as Quotation Dropbox — the filename is
  // "{DeliveryNo}-{ShortName}.ext", so there is nothing safe to upload until
  // the customer has one set.
  const shortName = delivery.customer.shortName?.trim()
  if (!shortName) {
    return { skippedReason: "Customer has no Short Name set — required for Dropbox file naming." }
  }

  // Year/Month are always derived from the Delivery's own deliveryDate
  // (the delivery note's business date), never from when it happens to be
  // synced — matches Invoice Dropbox's own "Date, never sync time" rule.
  const year = delivery.deliveryDate.getFullYear()
  const month = delivery.deliveryDate.getMonth() + 1
  let folderPath: string
  try {
    folderPath = await ensureDeliveryNoteMonthFolder(companyId, year, month)
  } catch (error) {
    return { skippedReason: error instanceof DropboxError ? error.message : "Failed to prepare the Delivery Note Dropbox folder." }
  }

  return { delivery, folderPath, shortName }
}

async function generateExcelBufferSafe(delivery: DeliveryPdfData, errors: string[]): Promise<Buffer | null> {
  try {
    const excelPath = await generateDeliveryExcel(delivery)
    return await readFile(excelPath)
  } catch (error) {
    console.error(`[delivery ${delivery.id}] Excel generation failed:`, error)
    errors.push(`Excel generation failed: ${error instanceof Error ? error.message : String(error)}`)
    return null
  }
}

async function generatePdfBufferFromExcel(delivery: DeliveryPdfData, errors: string[]): Promise<Buffer | null> {
  try {
    const pdfPath = await generateDeliveryPdf(delivery)
    return await readFile(pdfPath)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    if (error instanceof PdfConversionUnavailableError) {
      console.warn(`[delivery ${delivery.id}] Excel-to-PDF conversion unavailable:`, reason)
    } else {
      console.error(`[delivery ${delivery.id}] Excel-to-PDF conversion failed:`, reason)
    }
    errors.push(`PDF conversion failed: ${reason}`)
    return null
  }
}

interface SyncOneFileParams {
  companyId: string
  deliveryId: string
  folderPath: string
  deliveryNumber: string
  shortName: string
  fileType: "PDF" | "XLSX"
  extension: string
  buffer: Buffer
  mimeType: string
  errors: string[]
}

async function syncOneFile(params: SyncOneFileParams): Promise<boolean> {
  const { companyId, deliveryId, folderPath, deliveryNumber, shortName, fileType, extension, buffer, mimeType, errors } = params
  const fileName = buildDeliveryFileName(deliveryNumber, shortName, extension)

  let path: string
  try {
    ;({ path } = await uploadDeliveryDocumentToDropbox(companyId, folderPath, fileName, buffer))
  } catch (error) {
    const detail = error instanceof DropboxError ? error.message : error instanceof Error ? error.message : String(error)
    console.error(`[delivery ${deliveryId}] ${fileType} Dropbox upload failed:`, error)
    errors.push(`${fileType} Dropbox upload failed: ${detail}`)
    return false
  }

  try {
    await prisma.deliveryDocument.upsert({
      where: { deliveryId_fileType: { deliveryId, fileType } },
      create: { companyId, deliveryId, fileType, storageKey: path, storageProvider: "DROPBOX", mimeType, fileSize: buffer.length },
      update: { storageKey: path, storageProvider: "DROPBOX", mimeType, fileSize: buffer.length },
    })
    return true
  } catch (error) {
    console.error(`[delivery ${deliveryId}] ${fileType} DeliveryDocument DB save failed (file uploaded to Dropbox at ${path}):`, error)
    errors.push(`${fileType} saved to Dropbox but the database record failed to save: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

/**
 * Generates a Delivery's official PDF + Excel (reusing the exact same
 * generation functions as the "Download PDF/Excel" buttons) and best-effort
 * uploads each to Dropbox under Invoice/{Year}/{Month}/{Month Delivery
 * Note}/{DeliveryNumber}-{ShortName}.{ext}, upserting the matching
 * (deliveryId, fileType) row.
 *
 * Deliberately NEVER called automatically on Delivery create/edit — this is
 * the manual "Sync to Dropbox" action's only entry point (see
 * resyncDeliveryDropbox in src/lib/actions/deliveries.ts). Safe to call
 * repeatedly: each file type always upserts the same row and re-uploads to
 * the same deterministic path, so a retry can never create a duplicate file.
 */
export async function syncDeliveryToDropbox(deliveryId: string, companyId: string): Promise<DeliveryDropboxSyncResult> {
  const pre = await checkPreconditions(deliveryId, companyId)
  if ("skippedReason" in pre) {
    return { synced: [], skippedReason: pre.skippedReason, errors: [] }
  }
  const { delivery, folderPath, shortName } = pre

  const synced: ("PDF" | "XLSX")[] = []
  const errors: string[] = []
  const common = { companyId, deliveryId, folderPath, deliveryNumber: delivery.deliveryNumber, shortName, errors }

  const excelBuffer = await generateExcelBufferSafe(delivery, errors)
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

  const pdfBuffer = excelBuffer ? await generatePdfBufferFromExcel(delivery, errors) : null
  if (pdfBuffer) {
    const ok = await syncOneFile({ ...common, fileType: "PDF", extension: "pdf", buffer: pdfBuffer, mimeType: "application/pdf" })
    if (ok) synced.push("PDF")
  }

  return { synced, errors }
}
