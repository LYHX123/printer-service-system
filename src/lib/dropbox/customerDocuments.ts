import { getDropboxApiContext, dropboxApiFetch, dropboxContentUpload } from "./client"
import { ensureCustomerFolder } from "./customerFolder"
import { DropboxApiError } from "./errors"

function sanitizeLeafFileName(name: string): string {
  // Browsers already refuse "/" and "\" in a chosen filename, but a defensive
  // strip keeps this function safe even if called with an untrusted string —
  // this is a filename, not a path, so any path separator is replaced rather
  // than allowed to introduce a new path segment.
  const cleaned = name.replace(/[/\\]/g, "-").trim()
  return cleaned || "file"
}

/**
 * Uploads a Customer Document to Dropbox, ensuring Customer/{ShortName}
 * exists first (auto-recreates it if it was deleted by hand in Dropbox —
 * see ensureCustomerFolder). Always writes to the deterministic path
 * {folder}/{originalFileName} in "overwrite" mode: uploading the same
 * filename again replaces the Dropbox file in place rather than creating a
 * second copy, matching the one-DB-row-per-filename reconciliation done by
 * the caller (see the customer documents API route).
 */
export async function uploadCustomerDocumentToDropbox(
  companyId: string,
  shortName: string,
  originalFileName: string,
  content: Buffer
): Promise<{ path: string }> {
  const folderPath = await ensureCustomerFolder(companyId, shortName)
  const path = `${folderPath}/${sanitizeLeafFileName(originalFileName)}`

  const { accessToken, pathRootNamespaceId } = await getDropboxApiContext(companyId)
  await dropboxContentUpload(accessToken, path, content, pathRootNamespaceId ?? undefined)

  return { path }
}

/**
 * Deletes a Customer Document file from Dropbox. If the file was already
 * removed by hand in Dropbox (path_lookup/not_found), this is treated as
 * success — the caller (DELETE route) always removes the DB record
 * regardless, per the "never let a Dropbox hiccup block a business
 * operation" rule that runs through this whole feature.
 */
export async function deleteCustomerDocumentFromDropbox(companyId: string, path: string): Promise<void> {
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
 * viewing/downloading a Customer Document. Always minted fresh per request
 * — never cached/stored — so the customer-documents "view/download" route
 * just redirects the browser here instead of proxying bytes through our
 * own server.
 */
export async function getCustomerDocumentTemporaryLink(companyId: string, path: string): Promise<string> {
  const { accessToken, pathRootNamespaceId } = await getDropboxApiContext(companyId)
  const result = await dropboxApiFetch<GetTemporaryLinkResponse>(
    accessToken,
    "/files/get_temporary_link",
    { path },
    pathRootNamespaceId ?? undefined
  )
  return result.link
}
