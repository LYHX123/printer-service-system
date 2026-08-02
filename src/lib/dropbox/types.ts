export interface DropboxTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  scope?: string
  account_id?: string
}

/**
 * Mirrors Dropbox's `common.RootInfo` (from users/get_current_account).
 * When rootNamespaceId !== homeNamespaceId, the account's home is nested
 * inside a broader namespace (a Dropbox Team Space) — content living
 * directly under that broader namespace (like a Team Folder) is invisible
 * to plain path-based calls unless the Dropbox-API-Path-Root header is
 * set to rootNamespaceId. See src/lib/dropbox/client.ts.
 */
export interface DropboxRootInfo {
  tag: string
  rootNamespaceId: string
  homeNamespaceId: string
  homePath: string | null
}

export interface DropboxAccountInfo {
  accountId: string
  displayName: string | null
  email: string | null
  rootInfo: DropboxRootInfo | null
}

export interface DropboxConnectionStatus {
  /** All required DROPBOX_* env vars are present. */
  configured: boolean
  /** A DropboxConnection row exists for this company with status CONNECTED. */
  connected: boolean
  accountId: string | null
  accountName: string | null
  accountEmail: string | null
  connectedAt: Date | null
  rootPath: string
}
