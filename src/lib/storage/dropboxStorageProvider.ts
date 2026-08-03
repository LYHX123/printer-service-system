import {
  uploadCustomerDocumentToDropbox,
  deleteCustomerDocumentFromDropbox,
} from "@/lib/dropbox"
import type { StorageProvider, SaveFileParams, SaveFileResult } from "./types"

/**
 * Customer Documents backend (Dropbox Phase 2). Bound to one company per
 * instance (see getStorageProvider) since every Dropbox call needs that
 * company's access token.
 *
 * `scopePath` is reused here as the customer's Short Name rather than a
 * disk-relative folder — the two providers resolve "where to put this file"
 * differently, but callers (the customer documents API route) pass the same
 * shape either way. `storageKey` is the full absolute Dropbox path, which
 * doubles as the natural dedupe key for the "same filename overwrites"
 * behavior the caller implements (see uploadCustomerDocumentToDropbox).
 */
export class DropboxStorageProvider implements StorageProvider {
  constructor(private companyId: string) {}

  async save({ scopePath, buffer, originalFileName }: SaveFileParams): Promise<SaveFileResult> {
    const { path } = await uploadCustomerDocumentToDropbox(this.companyId, scopePath, originalFileName, buffer)
    return { storageKey: path, fileSize: buffer.length }
  }

  async delete(storageKey: string): Promise<void> {
    await deleteCustomerDocumentFromDropbox(this.companyId, storageKey)
  }

  /**
   * Not used to build user-facing links — Dropbox temporary links must be
   * minted fresh per request (see getCustomerDocumentTemporaryLink), so
   * callers route viewing/downloading through the documents API's GET
   * handler instead of calling this. Returned only to satisfy the
   * StorageProvider contract.
   */
  getUrl(storageKey: string): string {
    return storageKey
  }
}
