import { getDropboxApiContext } from "./client"
import { ensureDropboxFolder } from "./folders"
import { getInvoiceMonthName, getInvoiceMonthPath, getInvoiceYearPath } from "./invoiceFolder"
import { getInvoiceBasePath } from "./paths"
import { DropboxFolderError } from "./errors"

/**
 * Defense-in-depth guard against path traversal via a Customer Short Name or
 * a Delivery No — both end up as Dropbox path/file-name segments. Mirrors
 * assertSafeInvoicePathSegment/assertSafeQuotationPathSegment exactly, but
 * deliberately not shared with them — each Dropbox area guards its own path
 * construction independently, so a future change to one can never
 * accidentally affect another.
 */
export function assertSafeDeliveryPathSegment(label: string, value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new DropboxFolderError(`${label} is empty — cannot build a Dropbox path.`)
  }
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    throw new DropboxFolderError(`${label} "${value}" contains characters that are not allowed in a Dropbox path.`)
  }
  return trimmed
}

/**
 * Delivery Notes live alongside the Invoice and ETR folders, under the same
 * Invoice/{Year}/{Month} tree — `Invoice/{Year}/{Month}/{Month} Delivery
 * Note` — reusing getInvoiceMonthPath/getInvoiceMonthName exactly (never a
 * separate top-level "Delivery" folder). Year/Month are always derived from
 * the Delivery's own deliveryDate, never from when it happens to be synced.
 */
export function getMonthDeliveryNotePath(year: number, month: number): string {
  return `${getInvoiceMonthPath(year, month)}/${getInvoiceMonthName(month)} Delivery Note`
}

/** "{DeliveryNo}-{ShortName}{.ext}" — e.g. "DL00025-ABC.xlsx". Both values are re-validated here, never trusted as pre-sanitized. */
export function buildDeliveryFileName(deliveryNumber: string, shortName: string, extension: string): string {
  const safeNumber = assertSafeDeliveryPathSegment("Delivery No", deliveryNumber)
  const safeShortName = assertSafeDeliveryPathSegment("Short Name", shortName)
  const ext = extension.startsWith(".") ? extension : `.${extension}`
  return `${safeNumber}-${safeShortName}${ext}`
}

/**
 * Ensures the Invoice/{Year}/{Month}/{Month Delivery Note} chain exists,
 * creating whatever's missing — same self-healing, idempotent pattern as
 * ensureInvoiceMonthFolders. Only ever called from the manual "Sync to
 * Dropbox" action (never on Delivery creation) — see deliveryExcel/dropboxSync.ts.
 */
export async function ensureDeliveryNoteMonthFolder(companyId: string, year: number, month: number): Promise<string> {
  const { accessToken, pathRootNamespaceId } = await getDropboxApiContext(companyId)

  await ensureDropboxFolder(accessToken, getInvoiceBasePath(), pathRootNamespaceId)
  await ensureDropboxFolder(accessToken, getInvoiceYearPath(year), pathRootNamespaceId)
  await ensureDropboxFolder(accessToken, getInvoiceMonthPath(year, month), pathRootNamespaceId)

  const monthDeliveryNotePath = getMonthDeliveryNotePath(year, month)
  await ensureDropboxFolder(accessToken, monthDeliveryNotePath, pathRootNamespaceId)

  return monthDeliveryNotePath
}
