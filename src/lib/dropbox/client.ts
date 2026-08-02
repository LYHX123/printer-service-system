import { getStoredRefreshToken } from "./connection"
import { refreshAccessToken } from "./oauth"
import { DropboxNotConnectedError, DropboxApiError } from "./errors"
import type { DropboxAccountInfo, DropboxRootInfo } from "./types"

const API_ROOT = "https://api.dropboxapi.com/2"

/**
 * Mints a fresh short-lived access token from the company's stored refresh
 * token. Called on demand for every Dropbox API operation — access tokens
 * are never cached/persisted, only the refresh token is (encrypted).
 */
export async function getDropboxAccessToken(companyId: string): Promise<string> {
  const refreshToken = await getStoredRefreshToken(companyId)
  if (!refreshToken) {
    throw new DropboxNotConnectedError()
  }
  const token = await refreshAccessToken(refreshToken)
  return token.access_token
}

/**
 * Generic helper for Dropbox's RPC-style API endpoints (JSON in, JSON out).
 * Never logs the access token; on failure, surfaces the HTTP status and
 * Dropbox's error tag/summary only.
 *
 * `pathRootNamespaceId`, when given, sets the Dropbox-API-Path-Root header
 * so path-based calls (get_metadata, list_folder, create_folder_v2, ...)
 * resolve against that namespace instead of the token's default home
 * namespace — required to reach content that lives directly under a
 * Dropbox Team Space root (like a Team Folder) rather than under the
 * user's own personal home folder. See getDropboxApiContext().
 */
export async function dropboxApiFetch<T>(
  accessToken: string,
  endpoint: string,
  body: unknown,
  pathRootNamespaceId?: string
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  }
  if (pathRootNamespaceId) {
    headers["Dropbox-API-Path-Root"] = JSON.stringify({ ".tag": "root", root: pathRootNamespaceId })
  }

  let response: Response
  try {
    response = await fetch(`${API_ROOT}${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
    })
  } catch {
    throw new DropboxApiError(`Could not reach Dropbox for ${endpoint}.`)
  }

  const text = await response.text()
  let parsed: unknown = undefined
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      // non-JSON response — leave parsed undefined, status check below still applies
    }
  }

  if (!response.ok) {
    const errorTag =
      parsed && typeof parsed === "object" && "error_summary" in parsed
        ? String((parsed as { error_summary?: unknown }).error_summary)
        : undefined
    throw new DropboxApiError(`Dropbox API request to ${endpoint} failed (HTTP ${response.status}).`, response.status, errorTag)
  }

  return parsed as T
}

interface DropboxGetCurrentAccountResponse {
  account_id: string
  name?: { display_name?: string }
  email?: string
  root_info?: {
    ".tag": string
    root_namespace_id: string
    home_namespace_id: string
    home_path?: string
  }
}

/**
 * Fetches the connected Dropbox account's display name/email/root_info via
 * users/get_current_account. This call is account-level, not path-based —
 * it must never be given a Dropbox-API-Path-Root header (there's nothing
 * for it to resolve against).
 */
export async function getDropboxAccount(accessToken: string): Promise<DropboxAccountInfo> {
  const account = await dropboxApiFetch<DropboxGetCurrentAccountResponse>(accessToken, "/users/get_current_account", null)

  const rootInfo: DropboxRootInfo | null = account.root_info
    ? {
        tag: account.root_info[".tag"],
        rootNamespaceId: account.root_info.root_namespace_id,
        homeNamespaceId: account.root_info.home_namespace_id,
        homePath: account.root_info.home_path ?? null,
      }
    : null

  return {
    accountId: account.account_id,
    displayName: account.name?.display_name ?? null,
    email: account.email ?? null,
    rootInfo,
  }
}

export interface DropboxApiContext {
  accessToken: string
  account: DropboxAccountInfo
  /**
   * Namespace to send as Dropbox-API-Path-Root for every subsequent
   * path-based call, or null when the account has no distinct root
   * namespace (root_namespace_id === home_namespace_id) — in that case
   * the default (home) namespace is already correct and no header is sent.
   */
  pathRootNamespaceId: string | null
}

/**
 * The single entry point every Printer Service System Dropbox file
 * operation should go through: mints an access token, reads the account's
 * root_info fresh (never cached across requests), and derives the correct
 * Dropbox-API-Path-Root namespace for this specific call — never a
 * hardcoded/persisted namespace ID. Falls back to the default (home)
 * namespace when the account has no distinct team root.
 */
export async function getDropboxApiContext(companyId: string): Promise<DropboxApiContext> {
  const accessToken = await getDropboxAccessToken(companyId)
  const account = await getDropboxAccount(accessToken)

  const pathRootNamespaceId =
    account.rootInfo && account.rootInfo.rootNamespaceId !== account.rootInfo.homeNamespaceId
      ? account.rootInfo.rootNamespaceId
      : null

  return { accessToken, account, pathRootNamespaceId }
}
