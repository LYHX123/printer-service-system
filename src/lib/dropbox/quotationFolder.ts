import { getDropboxApiContext } from "./client"
import { ensureDropboxFolder } from "./folders"
import { getQuotationBasePath } from "./paths"
import { DropboxFolderError } from "./errors"

/**
 * Defense-in-depth guard against path traversal via a Customer's Short Name
 * or a Quotation No — both end up as Dropbox path/file-name segments. The
 * primary check for Short Name lives in src/lib/schemas.ts (Customer form);
 * this re-checks at the point a Dropbox path is actually built, and is the
 * only check for Quotation No (which has no equivalent form-level guard).
 * Deliberately does not touch/duplicate Customer Dropbox's own
 * src/lib/dropbox/customerFolder.ts.
 */
export function assertSafeQuotationPathSegment(label: string, value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new DropboxFolderError(`${label} is empty — cannot build a Dropbox path.`)
  }
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    throw new DropboxFolderError(`${label} "${value}" contains characters that are not allowed in a Dropbox path.`)
  }
  return trimmed
}

/** `{DROPBOX_ROOT_PATH}/Quotation/{ShortName}` — one folder per customer, shared by every quotation they have. */
export function getQuotationCustomerFolderPath(shortName: string): string {
  return `${getQuotationBasePath()}/${assertSafeQuotationPathSegment("Short Name", shortName)}`
}

/** Relative path shown in the UI — never the absolute root/Team Folder prefix. */
export function getQuotationCustomerFolderDisplayPath(shortName: string): string {
  return `Quotation/${assertSafeQuotationPathSegment("Short Name", shortName)}`
}

/**
 * Ensures Quotation/{ShortName} exists, creating it if missing (idempotent —
 * see ensureDropboxFolder's path/conflict handling). Every quotation for the
 * same customer reuses this same folder — never a new one per quotation.
 * Never touches anything above Quotation/ — that's ensureDropboxRootStructure's
 * job (Settings page "Initialize Folders").
 */
export async function ensureQuotationCustomerFolder(companyId: string, shortName: string): Promise<string> {
  const path = getQuotationCustomerFolderPath(shortName)
  const { accessToken, pathRootNamespaceId } = await getDropboxApiContext(companyId)
  await ensureDropboxFolder(accessToken, path, pathRootNamespaceId)
  return path
}

/**
 * "{QuotationNo}-{ShortName}-V{version}{.ext}" — e.g. "QT202608-001-CRBC-V1.pdf".
 * Both business values are re-validated here (never trusted as pre-sanitized)
 * since this is the one place they become a Dropbox file name.
 */
export function buildQuotationVersionFileName(
  quotationNumber: string,
  shortName: string,
  version: number,
  extension: string
): string {
  const safeNumber = assertSafeQuotationPathSegment("Quotation No", quotationNumber)
  const safeShortName = assertSafeQuotationPathSegment("Short Name", shortName)
  const ext = extension.startsWith(".") ? extension : `.${extension}`
  return `${safeNumber}-${safeShortName}-V${version}${ext}`
}

/**
 * "{QuotationNo}-{ShortName}-FINAL{.ext}" — the Approve-time snapshot, a
 * distinct file from any numbered version (never overwrites V1/V2/V3...).
 */
export function buildQuotationFinalFileName(quotationNumber: string, shortName: string, extension: string): string {
  const safeNumber = assertSafeQuotationPathSegment("Quotation No", quotationNumber)
  const safeShortName = assertSafeQuotationPathSegment("Short Name", shortName)
  const ext = extension.startsWith(".") ? extension : `.${extension}`
  return `${safeNumber}-${safeShortName}-FINAL${ext}`
}
