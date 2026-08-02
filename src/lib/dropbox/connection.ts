import { prisma } from "@/lib/prisma"
import { encryptToken, decryptToken } from "./token"
import { isDropboxConfigured, getDropboxEnvConfig } from "./env"
import type { DropboxConnectionStatus } from "./types"

/** Non-sensitive connection status for the Settings page — never exposes the encrypted refresh token. */
export async function getDropboxConnectionStatus(companyId: string): Promise<DropboxConnectionStatus> {
  const configured = isDropboxConfigured()
  const rootPath = configured ? getDropboxEnvConfig().rootPath : "/ENFB SYSTEM FILE Team Folder/Printer Service System"

  const connection = await prisma.dropboxConnection.findUnique({
    where: { companyId },
    select: { accountId: true, accountName: true, accountEmail: true, connectedAt: true, status: true },
  })

  const connected = Boolean(connection && connection.status === "CONNECTED")

  return {
    configured,
    connected,
    accountId: connected ? connection!.accountId : null,
    accountName: connected ? connection!.accountName : null,
    accountEmail: connected ? connection!.accountEmail : null,
    connectedAt: connected ? connection!.connectedAt : null,
    rootPath,
  }
}

/** Reads and decrypts the stored refresh token for a company's connection. Returns null if not connected. */
export async function getStoredRefreshToken(companyId: string): Promise<string | null> {
  const connection = await prisma.dropboxConnection.findUnique({
    where: { companyId },
    select: { encryptedRefreshToken: true, status: true },
  })
  if (!connection || connection.status !== "CONNECTED") return null
  return decryptToken(connection.encryptedRefreshToken)
}

export interface SaveConnectionParams {
  companyId: string
  refreshToken: string
  accountId: string
  accountName: string | null
  accountEmail: string | null
  createdById: string
}

/** Upserts the DropboxConnection row after a successful OAuth exchange. */
export async function saveDropboxConnection(params: SaveConnectionParams): Promise<void> {
  const encryptedRefreshToken = encryptToken(params.refreshToken)

  await prisma.dropboxConnection.upsert({
    where: { companyId: params.companyId },
    create: {
      companyId: params.companyId,
      accountId: params.accountId,
      accountName: params.accountName,
      accountEmail: params.accountEmail,
      encryptedRefreshToken,
      status: "CONNECTED",
      createdById: params.createdById,
    },
    update: {
      accountId: params.accountId,
      accountName: params.accountName,
      accountEmail: params.accountEmail,
      encryptedRefreshToken,
      status: "CONNECTED",
      connectedAt: new Date(),
    },
  })
}

/**
 * Disconnects Dropbox for a company — deletes the stored (encrypted)
 * refresh token / connection row entirely. Never touches Dropbox itself:
 * no files or folders are deleted, only the local link is removed.
 */
export async function deleteDropboxConnection(companyId: string): Promise<void> {
  await prisma.dropboxConnection.deleteMany({ where: { companyId } })
}
