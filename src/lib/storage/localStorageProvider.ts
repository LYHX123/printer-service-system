import { mkdir, writeFile, unlink } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import type { StorageProvider, SaveFileParams, SaveFileResult } from "./types"

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads")

function extensionFromFileName(fileName: string): string {
  const ext = path.extname(fileName)
  // Keep it short and predictable; drop anything that isn't a plain extension.
  return /^\.[a-zA-Z0-9]{1,10}$/.test(ext) ? ext.toLowerCase() : ""
}

export class LocalStorageProvider implements StorageProvider {
  async save({ scopePath, buffer, originalFileName }: SaveFileParams): Promise<SaveFileResult> {
    const dir = path.join(UPLOADS_ROOT, scopePath)
    await mkdir(dir, { recursive: true })

    // Never derive the on-disk name from the user-supplied original filename —
    // a randomUUID-based key avoids collisions and path-injection entirely.
    const fileName = `${randomUUID()}${extensionFromFileName(originalFileName)}`
    const storageKey = `${scopePath}/${fileName}`

    await writeFile(path.join(UPLOADS_ROOT, storageKey), buffer)

    return { storageKey, fileSize: buffer.length }
  }

  async delete(storageKey: string): Promise<void> {
    const filePath = path.join(UPLOADS_ROOT, storageKey)
    await unlink(filePath).catch(() => {})
  }

  getUrl(storageKey: string): string {
    return `/uploads/${storageKey}`
  }
}
