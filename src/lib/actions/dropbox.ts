"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { canManageSettings } from "@/lib/permissions"
import { logActivity } from "@/lib/audit"
import {
  getDropboxApiContext,
  verifyDropboxTeamFolderExists,
  ensureDropboxRootStructure,
  deleteDropboxConnection,
  DropboxError,
  DropboxFolderError,
} from "@/lib/dropbox"
import type { Role } from "@/types"

/**
 * Every Dropbox mutation action re-checks permission server-side —
 * the Settings page only hides the buttons for unauthorized users, it
 * doesn't gate anything on its own.
 */
async function requireSettingsAccess(): Promise<{ error: string } | { companyId: string; userId: string }> {
  const session = await auth()
  if (!session?.user) return { error: "Unauthorized" }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canManageSettings(role, permissions)) return { error: "Forbidden" }
  return { companyId: session.user.companyId as string, userId: session.user.id as string }
}

/**
 * "Connection successful" requires two things, not just an authenticated
 * account: (1) the account is reachable at all, and (2) the configured
 * Team Folder is actually visible under the correctly-derived path root.
 * An account that authenticates fine but can't see the Team Folder (wrong
 * DROPBOX_ROOT_PATH, folder renamed/removed, access revoked, ...) must not
 * be reported as a healthy connection.
 */
export async function testDropboxConnection(): Promise<
  { error: string } | { success: true; accountName: string | null }
> {
  const access = await requireSettingsAccess()
  if ("error" in access) return access

  try {
    const { accessToken, account, pathRootNamespaceId } = await getDropboxApiContext(access.companyId)

    try {
      await verifyDropboxTeamFolderExists(accessToken, pathRootNamespaceId)
    } catch (error) {
      if (error instanceof DropboxFolderError) {
        return { error: "Dropbox connected, but configured Team Folder is not accessible." }
      }
      throw error
    }

    await logActivity({
      companyId: access.companyId,
      entityType: "DropboxConnection",
      entityId: account.accountId,
      action: "DROPBOX_CONNECTION_TESTED",
      performedById: access.userId,
    })

    return { success: true as const, accountName: account.displayName }
  } catch (error) {
    console.error("testDropboxConnection failed:", error instanceof DropboxError ? error.message : error)
    return { error: error instanceof DropboxError ? error.message : "Failed to test Dropbox connection." }
  }
}

export async function initializeDropboxFolders(): Promise<{ error: string } | { success: true }> {
  const access = await requireSettingsAccess()
  if ("error" in access) return access

  try {
    await ensureDropboxRootStructure(access.companyId)

    await logActivity({
      companyId: access.companyId,
      entityType: "DropboxConnection",
      entityId: access.companyId,
      action: "DROPBOX_FOLDERS_INITIALIZED",
      performedById: access.userId,
    })

    revalidatePath("/settings")
    return { success: true as const }
  } catch (error) {
    console.error("initializeDropboxFolders failed:", error instanceof DropboxError ? error.message : error)
    return { error: error instanceof DropboxError ? error.message : "Failed to initialize Dropbox folders." }
  }
}

/** Deletes only the local (encrypted) connection record — never touches any file or folder actually in Dropbox. */
export async function disconnectDropbox(): Promise<{ error: string } | { success: true }> {
  const access = await requireSettingsAccess()
  if ("error" in access) return access

  try {
    await deleteDropboxConnection(access.companyId)

    await logActivity({
      companyId: access.companyId,
      entityType: "DropboxConnection",
      entityId: access.companyId,
      action: "DROPBOX_DISCONNECTED",
      performedById: access.userId,
    })

    revalidatePath("/settings")
    return { success: true as const }
  } catch {
    return { error: "Failed to disconnect Dropbox." }
  }
}
