import { LocalStorageProvider } from "./localStorageProvider"
import type { StorageProvider } from "./types"
import type { DocumentStorageProvider } from "@/generated/prisma/client"

const localProvider = new LocalStorageProvider()

/**
 * Only LOCAL is implemented today. A future DROPBOX provider slots in here —
 * callers (Customer document routes/UI) never need to change, since they only
 * ever go through this factory + the StorageProvider interface.
 */
export function getStorageProvider(provider: DocumentStorageProvider): StorageProvider {
  switch (provider) {
    case "LOCAL":
      return localProvider
    case "DROPBOX":
      throw new Error("Dropbox storage provider is not implemented yet")
  }
}

export type { StorageProvider } from "./types"
