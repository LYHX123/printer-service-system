import { getDropboxApiContext, dropboxApiFetch, dropboxContentUpload } from "./client"
import { DropboxApiError } from "./errors"

/**
 * Uploads an Invoice's generated PDF/Excel to Dropbox at
 * {folderPath}/{fileName}, in "overwrite" mode — the caller (invoiceExcel/
 * dropboxSync.ts) is responsible for ensuring `folderPath` exists first
 * (see ensureInvoiceMonthFolders) and for building `fileName` (see
 * buildInvoiceFileName). No versioning here: re-syncing the same invoice
 * always overwrites the same file in place.
 */
export async function uploadInvoiceDocumentToDropbox(
  companyId: string,
  folderPath: string,
  fileName: string,
  content: Buffer
): Promise<{ path: string }> {
  const path = `${folderPath}/${fileName}`
  const { accessToken, pathRootNamespaceId } = await getDropboxApiContext(companyId)
  await dropboxContentUpload(accessToken, path, content, pathRootNamespaceId ?? undefined)
  return { path }
}

/**
 * Deletes an Invoice document file from Dropbox (used for ETR replace/
 * delete — the PDF/XLSX sync path never deletes, only overwrites in place).
 * If the file was already removed by hand in Dropbox (path_lookup/
 * not_found), this is treated as success, matching
 * deleteCustomerDocumentFromDropbox: a Dropbox hiccup or stale state must
 * never block the caller's DB cleanup.
 */
export async function deleteInvoiceDocumentFromDropbox(companyId: string, path: string): Promise<void> {
  const { accessToken, pathRootNamespaceId } = await getDropboxApiContext(companyId)
  try {
    await dropboxApiFetch(accessToken, "/files/delete_v2", { path }, pathRootNamespaceId ?? undefined)
  } catch (error) {
    if (error instanceof DropboxApiError && error.errorTag?.startsWith("path_lookup/not_found")) {
      return
    }
    throw error
  }
}

interface GetTemporaryLinkResponse {
  link: string
}

/**
 * Mints a short-lived (Dropbox default: ~4 hours) direct-download link for
 * viewing/downloading an Invoice document. Always minted fresh per request
 * — never cached/stored.
 */
export async function getInvoiceDocumentTemporaryLink(companyId: string, path: string): Promise<string> {
  const { accessToken, pathRootNamespaceId } = await getDropboxApiContext(companyId)
  const result = await dropboxApiFetch<GetTemporaryLinkResponse>(
    accessToken,
    "/files/get_temporary_link",
    { path },
    pathRootNamespaceId ?? undefined
  )
  return result.link
}
