import { DropboxConfigurationError } from "./errors"

export interface DropboxEnvConfig {
  appKey: string
  appSecret: string
  redirectUri: string
  rootPath: string
  tokenEncryptionKey: string
}

const REQUIRED_VARS = [
  "DROPBOX_APP_KEY",
  "DROPBOX_APP_SECRET",
  "DROPBOX_REDIRECT_URI",
  "DROPBOX_TOKEN_ENCRYPTION_KEY",
] as const

/** Non-throwing check — safe to call from a page/component to decide what UI to show. */
export function isDropboxConfigured(): boolean {
  return REQUIRED_VARS.every((key) => Boolean(process.env[key]?.trim()))
}

/**
 * Reads and validates the Dropbox environment configuration. Throws
 * DropboxConfigurationError (never a raw "undefined" TypeError further
 * downstream) if anything required is missing — callers doing an actual
 * OAuth/API operation should call this first and let the error surface as
 * a clear message rather than a 500.
 */
export function getDropboxEnvConfig(): DropboxEnvConfig {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]?.trim())
  if (missing.length > 0) {
    throw new DropboxConfigurationError(`Dropbox is not configured. Missing: ${missing.join(", ")}`)
  }

  return {
    appKey: process.env.DROPBOX_APP_KEY!.trim(),
    appSecret: process.env.DROPBOX_APP_SECRET!.trim(),
    redirectUri: process.env.DROPBOX_REDIRECT_URI!.trim(),
    rootPath: (process.env.DROPBOX_ROOT_PATH?.trim() || "/ENFB SYSTEM FILE Team Folder/Printer Service System").replace(/\/+$/, ""),
    tokenEncryptionKey: process.env.DROPBOX_TOKEN_ENCRYPTION_KEY!.trim(),
  }
}
