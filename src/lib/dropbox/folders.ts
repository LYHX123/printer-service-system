import { dropboxApiFetch, getDropboxApiContext } from "./client"
import { getPhase1Folders, getTeamFolderPath } from "./paths"
import { DropboxApiError, DropboxFolderError } from "./errors"

/**
 * Creates a Dropbox folder at `path` if it doesn't already exist.
 * Idempotent: Dropbox's create_folder_v2 returns a "path/conflict" error
 * (HTTP 409) when the folder is already there — that specific case is
 * treated as success, never as a failure, and never retried/duplicated.
 * Any other error is re-thrown as DropboxFolderError.
 */
export async function ensureDropboxFolder(accessToken: string, path: string, pathRootNamespaceId: string | null): Promise<void> {
  try {
    await dropboxApiFetch(accessToken, "/files/create_folder_v2", { path, autorename: false }, pathRootNamespaceId ?? undefined)
  } catch (error) {
    if (error instanceof DropboxApiError && error.errorTag?.startsWith("path/conflict")) {
      return // already exists — this is the expected steady state, not a failure
    }
    const detail = error instanceof DropboxApiError ? error.errorTag ?? error.message : String(error)
    throw new DropboxFolderError(`Failed to create Dropbox folder "${path}": ${detail}`)
  }
}

/**
 * Read-only check that the top-level ancestor of DROPBOX_ROOT_PATH (the
 * pre-existing Dropbox Team Folder, e.g. "/ENFB SYSTEM FILE Team Folder")
 * is actually visible/reachable under the given path root namespace.
 *
 * This exists specifically so ensureDropboxRootStructure() never calls
 * create_folder_v2 on a path whose ancestor doesn't exist — Dropbox's
 * create_folder_v2 auto-creates missing ancestors, which would otherwise
 * silently create a brand-new, wrong top-level folder instead of using
 * the real Team Folder the business actually intends. Throws
 * DropboxFolderError (never auto-creates anything) if the Team Folder is
 * not found.
 */
export async function verifyDropboxTeamFolderExists(accessToken: string, pathRootNamespaceId: string | null): Promise<void> {
  const teamFolderPath = getTeamFolderPath()
  try {
    await dropboxApiFetch(accessToken, "/files/get_metadata", { path: teamFolderPath }, pathRootNamespaceId ?? undefined)
  } catch (error) {
    if (error instanceof DropboxApiError) {
      throw new DropboxFolderError(
        `Dropbox Team Folder "${teamFolderPath}" was not found${pathRootNamespaceId ? " under the Team Space root namespace" : ""}. ` +
          `It must already exist — this system never creates it automatically. (${error.errorTag ?? error.message})`
      )
    }
    throw error
  }
}

/**
 * Ensures the Printer Service System's Dropbox root structure exists:
 *   {DROPBOX_ROOT_PATH}
 *   {DROPBOX_ROOT_PATH}/Customer
 *   {DROPBOX_ROOT_PATH}/Quotation
 *   {DROPBOX_ROOT_PATH}/Invoice
 *
 * Every path comes from src/lib/dropbox/paths.ts (never hand-written), so
 * this can only ever create folders under the Printer Service System's own
 * root — never the Insurance Management System's separate Dropbox tree,
 * and never a duplicate top-level Team Folder (see
 * verifyDropboxTeamFolderExists, called first, before anything is
 * created). The correct Dropbox-API-Path-Root namespace is derived fresh
 * from the account's own root_info on every call — see
 * getDropboxApiContext() — never hardcoded or persisted.
 *
 * Phase 1 deliberately stops at these 4 folders: no customer-name, year,
 * month, or quotation-customer subfolders are created here — those are
 * created on demand in later phases as business events actually happen.
 */
export async function ensureDropboxRootStructure(companyId: string): Promise<void> {
  const { accessToken, pathRootNamespaceId } = await getDropboxApiContext(companyId)

  await verifyDropboxTeamFolderExists(accessToken, pathRootNamespaceId)

  for (const path of getPhase1Folders()) {
    await ensureDropboxFolder(accessToken, path, pathRootNamespaceId)
  }
}
