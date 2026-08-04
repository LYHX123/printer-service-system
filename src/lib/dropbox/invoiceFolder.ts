import { getDropboxApiContext } from "./client"
import { ensureDropboxFolder } from "./folders"
import { getInvoiceBasePath } from "./paths"
import { DropboxFolderError } from "./errors"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

/** `month` is 1-12 (calendar month, matching Date#getMonth()+1) — never 0-11. */
export function getInvoiceMonthName(month: number): string {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new DropboxFolderError(`Invalid invoice month: ${month}`)
  }
  return MONTH_NAMES[month - 1]
}

/**
 * Defense-in-depth guard against path traversal via an Invoice No — the
 * primary check lives in the Zod schema layer for other Dropbox-backed
 * documents; Invoice numbers have no equivalent form-level guard yet, so
 * this is the only check for them. Mirrors
 * src/lib/dropbox/quotationFolder.ts's assertSafeQuotationPathSegment
 * exactly, but deliberately not shared with it or with Customer Dropbox's
 * own copy — each Dropbox area guards its own path construction
 * independently, so a future change to one can never accidentally affect
 * another.
 */
export function assertSafeInvoicePathSegment(label: string, value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new DropboxFolderError(`${label} is empty — cannot build a Dropbox path.`)
  }
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    throw new DropboxFolderError(`${label} "${value}" contains characters that are not allowed in a Dropbox path.`)
  }
  return trimmed
}

export function getInvoiceYearPath(year: number): string {
  return `${getInvoiceBasePath()}/${assertSafeInvoicePathSegment("Invoice year", String(year))}`
}

export function getInvoiceMonthPath(year: number, month: number): string {
  return `${getInvoiceYearPath(year)}/${getInvoiceMonthName(month)}`
}

/** `Invoice/{Year}/{Month}/{Month} Invoice` — where the invoice's own XLSX/PDF live. */
export function getMonthInvoicePath(year: number, month: number): string {
  return `${getInvoiceMonthPath(year, month)}/${getInvoiceMonthName(month)} Invoice`
}

/** `Invoice/{Year}/{Month}/{Month} ETR` — reserved for the next phase (ETR upload); created now so it's ready. */
export function getMonthEtrPath(year: number, month: number): string {
  return `${getInvoiceMonthPath(year, month)}/${getInvoiceMonthName(month)} ETR`
}

export function buildInvoiceFileName(invoiceNumber: string, extension: string): string {
  const safeNumber = assertSafeInvoicePathSegment("Invoice No", invoiceNumber)
  const ext = extension.startsWith(".") ? extension : `.${extension}`
  return `${safeNumber}${ext}`
}

/** "{InvoiceNo}-ETR.{ext}" — always this fixed basename, whatever extension the uploaded file actually has (never forced/converted to PDF). */
export function buildInvoiceEtrFileName(invoiceNumber: string, extension: string): string {
  const safeNumber = assertSafeInvoicePathSegment("Invoice No", invoiceNumber)
  const ext = extension.startsWith(".") ? extension : `.${extension}`
  return `${safeNumber}-ETR${ext}`
}

/**
 * Ensures the full Invoice/{Year}/{Month}/{Month Invoice,Month ETR} chain
 * exists, creating whatever's missing — including the top-level Invoice/
 * folder itself, in case it was never initialized or was deleted by hand.
 * Each level is ensured individually (rather than relying on Dropbox to
 * auto-create missing intermediate folders from one deep create_folder_v2
 * call, which isn't a behavior this codebase depends on anywhere else) so
 * this is idempotent and self-healing the same way ensureCustomerFolder /
 * ensureQuotationCustomerFolder are: call it every time a file is about to
 * be uploaded, and a folder deleted by hand gets transparently recreated.
 */
export async function ensureInvoiceMonthFolders(
  companyId: string,
  year: number,
  month: number
): Promise<{ monthInvoicePath: string; monthEtrPath: string }> {
  const { accessToken, pathRootNamespaceId } = await getDropboxApiContext(companyId)

  await ensureDropboxFolder(accessToken, getInvoiceBasePath(), pathRootNamespaceId)
  await ensureDropboxFolder(accessToken, getInvoiceYearPath(year), pathRootNamespaceId)
  await ensureDropboxFolder(accessToken, getInvoiceMonthPath(year, month), pathRootNamespaceId)

  const monthInvoicePath = getMonthInvoicePath(year, month)
  const monthEtrPath = getMonthEtrPath(year, month)
  await ensureDropboxFolder(accessToken, monthInvoicePath, pathRootNamespaceId)
  await ensureDropboxFolder(accessToken, monthEtrPath, pathRootNamespaceId)

  return { monthInvoicePath, monthEtrPath }
}
