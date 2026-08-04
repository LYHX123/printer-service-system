import { getDropboxApiContext, dropboxApiFetch, dropboxContentUpload } from "./client"

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
