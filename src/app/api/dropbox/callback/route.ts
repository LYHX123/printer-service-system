import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth } from "@/lib/auth"
import { canManageSettings } from "@/lib/permissions"
import { logActivity } from "@/lib/audit"
import {
  DROPBOX_OAUTH_STATE_COOKIE,
  exchangeCodeForToken,
  getDropboxAccount,
  saveDropboxConnection,
  ensureDropboxRootStructure,
  getDropboxPublicOrigin,
  DropboxError,
} from "@/lib/dropbox"
import type { Role } from "@/types"

/**
 * Dropbox OAuth callback — exchanges the authorization code for a
 * refresh token, saves the (encrypted) connection, then initializes the
 * root folder structure. Never surfaces a token in the URL, page body, or
 * logs — only redirects back to /settings with a plain success/error flag.
 *
 * Every redirect below targets getPublicOrigin() (derived from the
 * configured DROPBOX_REDIRECT_URI), never `request.url`'s own origin —
 * behind Docker/Caddy in production, request.url reflects the container-
 * internal bind address (e.g. http://0.0.0.0:3000), not the public domain
 * the browser is actually talking to. Redirecting there would send the
 * user's browser to an address it can never reach.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)

  // Falls back to the (possibly-wrong) request origin only if the public
  // origin itself can't be determined (e.g. Dropbox env vars missing) —
  // better than a raw 500 for what should be an unreachable edge case in
  // practice, since the Connect button is disabled whenever Dropbox isn't
  // configured.
  function getPublicOrigin(): string {
    try {
      return getDropboxPublicOrigin()
    } catch (error) {
      console.error(
        "Dropbox callback: could not derive public origin from DROPBOX_REDIRECT_URI, falling back to request origin:",
        error instanceof DropboxError ? error.message : error
      )
      return url.origin
    }
  }

  function redirectWithError(message: string) {
    const settingsUrl = new URL("/settings", getPublicOrigin())
    settingsUrl.searchParams.set("dropboxError", message)
    return NextResponse.redirect(settingsUrl)
  }

  const session = await auth()
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", getPublicOrigin()))
  }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canManageSettings(role, permissions)) {
    return NextResponse.redirect(new URL("/dashboard", getPublicOrigin()))
  }

  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const oauthError = url.searchParams.get("error")

  const cookieStore = await cookies()
  const expectedState = cookieStore.get(DROPBOX_OAUTH_STATE_COOKIE)?.value
  cookieStore.delete(DROPBOX_OAUTH_STATE_COOKIE)

  if (oauthError) {
    return redirectWithError("Dropbox authorization was cancelled or denied.")
  }
  if (!code || !state) {
    return redirectWithError("Dropbox did not return the expected authorization response.")
  }
  if (!expectedState || state !== expectedState) {
    return redirectWithError("Dropbox authorization state mismatch — please try connecting again.")
  }

  const companyId = session.user.companyId as string
  const userId = session.user.id as string

  try {
    const token = await exchangeCodeForToken(code)
    const account = await getDropboxAccount(token.access_token)

    await saveDropboxConnection({
      companyId,
      refreshToken: token.refresh_token!,
      accountId: account.accountId,
      accountName: account.displayName,
      accountEmail: account.email,
      createdById: userId,
    })

    await logActivity({
      companyId,
      entityType: "DropboxConnection",
      entityId: account.accountId,
      action: "DROPBOX_CONNECTED",
      performedById: userId,
      metadata: { accountName: account.displayName },
    })

    // Folder initialization is best-effort here — the connection itself
    // already succeeded and was saved. If this fails (e.g. a transient
    // network blip), the user can retry via "Initialize Folders" on the
    // Settings page rather than losing the whole connection.
    try {
      await ensureDropboxRootStructure(companyId)
      await logActivity({
        companyId,
        entityType: "DropboxConnection",
        entityId: account.accountId,
        action: "DROPBOX_FOLDERS_INITIALIZED",
        performedById: userId,
      })
    } catch (folderError) {
      console.error(
        "Dropbox root folder initialization failed after connect:",
        folderError instanceof DropboxError ? folderError.message : folderError
      )
    }
  } catch (error) {
    console.error("Dropbox OAuth callback failed:", error instanceof DropboxError ? error.message : error)
    return redirectWithError(error instanceof DropboxError ? error.message : "Failed to connect Dropbox.")
  }

  const settingsUrl = new URL("/settings", getPublicOrigin())
  settingsUrl.searchParams.set("dropboxConnected", "1")
  return NextResponse.redirect(settingsUrl)
}
