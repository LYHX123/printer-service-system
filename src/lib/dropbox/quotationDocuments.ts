import { getDropboxApiContext, dropboxApiFetch, dropboxContentUpload } from "./client"
import { ensureQuotationCustomerFolder } from "./quotationFolder"

/**
 * Uploads a Quotation's generated PDF/Excel to Dropbox, ensuring
 * Quotation/{ShortName} exists first (auto-recreates it if it was deleted
 * by hand — see ensureQuotationCustomerFolder). Writes to
 * {folder}/{fileName} in "overwrite" mode — the caller builds `fileName`
 * (see buildQuotationVersionFileName / buildQuotationFinalFileName) so this
 * function has no opinion on version vs. FINAL naming; it only ever
 * overwrites the exact path it's given, so a repeat sync of the *same*
 * fileName replaces that one file in place — a different fileName (a new
 * version, or FINAL) always lands at a brand new path, never touching an
 * older version's file.
 */
export async function uploadQuotationDocumentToDropbox(
  companyId: string,
  shortName: string,
  fileName: string,
  content: Buffer
): Promise<{ path: string }> {
  const folderPath = await ensureQuotationCustomerFolder(companyId, shortName)
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
 * viewing/downloading a Quotation document. Always minted fresh per request
 * — never cached/stored.
 */
export async function getQuotationDocumentTemporaryLink(companyId: string, path: string): Promise<string> {
  const { accessToken, pathRootNamespaceId } = await getDropboxApiContext(companyId)
  const result = await dropboxApiFetch<GetTemporaryLinkResponse>(
    accessToken,
    "/files/get_temporary_link",
    { path },
    pathRootNamespaceId ?? undefined
  )
  return result.link
}
