import { getDropboxApiContext, dropboxApiFetch, dropboxContentUpload } from "./client"

/**
 * Uploads a Delivery Note's generated PDF/Excel to Dropbox at
 * {folderPath}/{fileName}, in "overwrite" mode — the caller
 * (deliveryExcel/dropboxSync.ts) is responsible for ensuring `folderPath`
 * exists first (see ensureDeliveryNoteMonthFolder) and for building
 * `fileName` (see buildDeliveryFileName). No versioning here: re-syncing the
 * same delivery always overwrites the same file in place — same convention
 * as Invoice Dropbox.
 */
export async function uploadDeliveryDocumentToDropbox(
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
 * viewing/downloading a Delivery document. Always minted fresh per request —
 * never cached/stored.
 */
export async function getDeliveryDocumentTemporaryLink(companyId: string, path: string): Promise<string> {
  const { accessToken, pathRootNamespaceId } = await getDropboxApiContext(companyId)
  const result = await dropboxApiFetch<GetTemporaryLinkResponse>(
    accessToken,
    "/files/get_temporary_link",
    { path },
    pathRootNamespaceId ?? undefined
  )
  return result.link
}
