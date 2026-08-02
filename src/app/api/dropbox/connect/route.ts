import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth } from "@/lib/auth"
import { canManageSettings } from "@/lib/permissions"
import {
  isDropboxConfigured,
  buildAuthorizeUrl,
  generateOAuthState,
  DROPBOX_OAUTH_STATE_COOKIE,
  DropboxConfigurationError,
} from "@/lib/dropbox"
import type { Role } from "@/types"

/**
 * Starts the Dropbox OAuth flow. Admin/Settings-permission only — never
 * exposes the App Secret or any token to the browser, only redirects to
 * Dropbox's own authorize page.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canManageSettings(role, permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!isDropboxConfigured()) {
    return NextResponse.json({ error: "Dropbox is not configured on this server." }, { status: 500 })
  }

  const state = generateOAuthState()

  let authorizeUrl: string
  try {
    authorizeUrl = buildAuthorizeUrl(state)
  } catch (error) {
    if (error instanceof DropboxConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    throw error
  }

  const cookieStore = await cookies()
  cookieStore.set(DROPBOX_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/api/dropbox",
  })

  return NextResponse.redirect(authorizeUrl)
}
