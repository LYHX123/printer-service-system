import { getDropboxApiContext } from "./client"
import { ensureDropboxFolder } from "./folders"
import { getCustomerBasePath } from "./paths"
import { DropboxFolderError } from "./errors"

/**
 * Defense-in-depth guard against path traversal via a Customer's Short Name.
 * The primary check lives in the Zod schema (src/lib/schemas.ts) so a bad
 * value is rejected at input time with a friendly message — this re-checks
 * at the point a Dropbox path is actually built, so it also catches any
 * legacy Short Name saved before that validation existed.
 */
export function assertSafeShortName(shortName: string): string {
  const trimmed = shortName.trim()
  if (!trimmed) {
    throw new DropboxFolderError("Customer has no Short Name — cannot build a Dropbox folder path.")
  }
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) {
    throw new DropboxFolderError(`Short Name "${shortName}" contains characters that are not allowed in a folder name.`)
  }
  return trimmed
}

/** `{DROPBOX_ROOT_PATH}/Customer/{ShortName}` — the one and only folder this feature ever writes under. */
export function getCustomerFolderPath(shortName: string): string {
  return `${getCustomerBasePath()}/${assertSafeShortName(shortName)}`
}

/** Relative path shown in the UI — never the absolute root/Team Folder prefix. */
export function getCustomerFolderDisplayPath(shortName: string): string {
  return `Customer/${assertSafeShortName(shortName)}`
}

/**
 * Ensures Customer/{ShortName} exists for this customer, creating it if
 * missing (idempotent — see ensureDropboxFolder's path/conflict handling).
 * Called before every upload so a folder deleted by hand in Dropbox is
 * transparently recreated rather than surfacing as "folder not found".
 * Never touches anything above Customer/ — that's ensureDropboxRootStructure's
 * job (Settings page "Initialize Folders").
 */
export async function ensureCustomerFolder(companyId: string, shortName: string): Promise<string> {
  const path = getCustomerFolderPath(shortName)
  const { accessToken, pathRootNamespaceId } = await getDropboxApiContext(companyId)
  await ensureDropboxFolder(accessToken, path, pathRootNamespaceId)
  return path
}
