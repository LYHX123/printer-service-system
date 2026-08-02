import { getDropboxEnvConfig } from "./env"

/**
 * Central path helper — every Dropbox path the Printer Service System ever
 * touches must be derived from here, never hand-written as a raw string in
 * business code. This is what guarantees the system can only ever read/write
 * under its own root and never the Insurance Management System's Dropbox
 * tree (a completely separate subtree under the same shared account).
 */
export function getRootPath(): string {
  return getDropboxEnvConfig().rootPath
}

/**
 * The top-level ancestor folder DROPBOX_ROOT_PATH lives under — e.g.
 * "/ENFB SYSTEM FILE Team Folder" for a root path of
 * "/ENFB SYSTEM FILE Team Folder/Printer Service System". This folder is
 * expected to already exist (it's a pre-existing Dropbox Team Folder, not
 * something this system ever creates) — see ensureDropboxRootStructure(),
 * which verifies it via a read-only get_metadata before creating anything,
 * specifically to avoid auto-creating a wrong duplicate top-level folder.
 */
export function getTeamFolderPath(): string {
  const firstSegment = getRootPath().split("/").filter(Boolean)[0]
  return `/${firstSegment}`
}

export function getCustomerBasePath(): string {
  return `${getRootPath()}/Customer`
}

export function getQuotationBasePath(): string {
  return `${getRootPath()}/Quotation`
}

export function getInvoiceBasePath(): string {
  return `${getRootPath()}/Invoice`
}

/** The fixed set of top-level folders Phase 1 initialization must ensure exist. */
export function getPhase1Folders(): string[] {
  return [getRootPath(), getCustomerBasePath(), getQuotationBasePath(), getInvoiceBasePath()]
}
