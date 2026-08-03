import { LocalStorageProvider } from "./localStorageProvider"
import { DropboxStorageProvider } from "./dropboxStorageProvider"
import type { StorageProvider } from "./types"
import type { DocumentStorageProvider } from "@/generated/prisma/client"

const localProvider = new LocalStorageProvider()

/**
 * `companyId` is required for DROPBOX (every Dropbox call needs that
 * company's access token) and ignored for LOCAL — existing LOCAL call sites
 * never need to pass it.
 */
export function getStorageProvider(provider: DocumentStorageProvider, companyId?: string): StorageProvider {
  switch (provider) {
    case "LOCAL":
      return localProvider
    case "DROPBOX":
      if (!companyId) throw new Error("companyId is required to use the Dropbox storage provider")
      return new DropboxStorageProvider(companyId)
  }
}

export type { StorageProvider } from "./types"
