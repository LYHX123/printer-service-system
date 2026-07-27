export interface SaveFileParams {
  /** Where under the storage root to file this document, e.g. `customers/{customerId}/documents`. */
  scopePath: string
  buffer: Buffer
  /** Original filename — used only to derive an extension, never trusted as the on-disk name. */
  originalFileName: string
}

export interface SaveFileResult {
  /** Relative path from the storage root; opaque to callers, passed back into delete()/getUrl(). */
  storageKey: string
  fileSize: number
}

export interface StorageProvider {
  save(params: SaveFileParams): Promise<SaveFileResult>
  delete(storageKey: string): Promise<void>
  /** Resolves a storageKey to a URL the UI can link/download from. */
  getUrl(storageKey: string): string
}
