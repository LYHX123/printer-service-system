import { getDropboxEnvConfig } from "./env"
import { DropboxAuthenticationError } from "./errors"
import type { DropboxTokenResponse } from "./types"

const AUTHORIZE_URL = "https://www.dropbox.com/oauth2/authorize"
const TOKEN_URL = "https://api.dropboxapi.com/oauth2/token"

/**
 * Builds the Dropbox OAuth authorize URL. redirect_uri always comes from
 * DROPBOX_REDIRECT_URI — never derived from the incoming request's host,
 * so it always matches exactly one of the two URIs actually registered in
 * the Dropbox App Console (local vs. production).
 */
export function buildAuthorizeUrl(state: string): string {
  const { appKey, redirectUri } = getDropboxEnvConfig()

  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set("client_id", appKey)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("token_access_type", "offline")
  url.searchParams.set("state", state)
  return url.toString()
}

async function postForm(body: URLSearchParams): Promise<DropboxTokenResponse> {
  let response: Response
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    })
  } catch {
    throw new DropboxAuthenticationError("Could not reach Dropbox to exchange the token — check network connectivity.")
  }

  if (!response.ok) {
    // Dropbox's error body may include the authorization code/token itself
    // in edge cases — deliberately not included in the thrown message.
    let errorTag = ""
    try {
      const body = (await response.json()) as { error?: string; error_description?: string }
      errorTag = body.error ?? ""
    } catch {
      // ignore — non-JSON error body
    }
    throw new DropboxAuthenticationError(
      `Dropbox token request failed (HTTP ${response.status}${errorTag ? `, ${errorTag}` : ""}).`
    )
  }

  return (await response.json()) as DropboxTokenResponse
}

/** Exchanges an OAuth authorization code for tokens. token_access_type=offline on the authorize step guarantees a refresh_token is returned. */
export async function exchangeCodeForToken(code: string): Promise<DropboxTokenResponse> {
  const { appKey, appSecret, redirectUri } = getDropboxEnvConfig()

  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    client_id: appKey,
    client_secret: appSecret,
    redirect_uri: redirectUri,
  })

  const token = await postForm(body)
  if (!token.refresh_token) {
    throw new DropboxAuthenticationError(
      "Dropbox did not return a refresh token. Re-authorize and ensure the app's OAuth flow requests offline access."
    )
  }
  return token
}

/** Exchanges a stored refresh token for a fresh short-lived access token. */
export async function refreshAccessToken(refreshToken: string): Promise<DropboxTokenResponse> {
  const { appKey, appSecret } = getDropboxEnvConfig()

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: appKey,
    client_secret: appSecret,
  })

  return postForm(body)
}
