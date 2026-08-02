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

/**
 * The public-facing origin the browser should ever be redirected to after
 * OAuth — derived from DROPBOX_REDIRECT_URI, never from an incoming
 * request's own URL. Behind Docker/Caddy in production, `request.url` (and
 * `request.nextUrl.origin`) reflect the address the Next.js process itself
 * is bound to inside the container (e.g. http://0.0.0.0:3000), not the
 * public domain the user's browser actually talked to — using that as a
 * redirect target sends the browser somewhere it can never reach.
 * DROPBOX_REDIRECT_URI is operator-configured server-side config that
 * already correctly names the public origin for each environment
 * (http://localhost:3000 locally, https://service.enfbgroup.com in
 * production), so it's the correct — and only — source of truth here.
 */
export function getDropboxPublicOrigin(): string {
  const { redirectUri } = getDropboxEnvConfig()

  let parsed: URL
  try {
    parsed = new URL(redirectUri)
  } catch {
    throw new DropboxConfigurationError(`DROPBOX_REDIRECT_URI is not a valid absolute URL: "${redirectUri}"`)
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new DropboxConfigurationError(`DROPBOX_REDIRECT_URI must be an http(s) URL, got "${redirectUri}"`)
  }

  return parsed.origin
}
