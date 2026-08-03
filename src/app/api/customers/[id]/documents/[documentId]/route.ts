import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccess, canUploadCustomerFile } from "@/lib/permissions"
import { getStorageProvider } from "@/lib/storage"
import { logActivity } from "@/lib/audit"
import { getCustomerDocumentTemporaryLink, DropboxError } from "@/lib/dropbox"
import type { Role } from "@/types"

/**
 * View/download. For LOCAL documents the list already links straight to the
 * static /uploads URL, so this only ever serves DROPBOX documents in
 * practice: it mints a fresh Dropbox temporary link (never cached — these
 * expire after a few hours) and redirects the browser to it, rather than
 * proxying the file's bytes through our own server.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canAccess(role, "customers", permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id: customerId, documentId } = await params

  const document = await prisma.customerDocument.findFirst({
    where: { id: documentId, customerId, customer: { companyId } },
  })
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  if (document.storageProvider !== "DROPBOX") {
    return NextResponse.json({ error: "Document is not stored in Dropbox" }, { status: 400 })
  }

  try {
    const link = await getCustomerDocumentTemporaryLink(companyId, document.storageKey)
    return NextResponse.redirect(link)
  } catch (error) {
    console.error("Customer document Dropbox temporary link failed:", error)
    const notFound = error instanceof DropboxError && /not_found/i.test(error.message)
    return NextResponse.json(
      { error: notFound ? "File not found in Dropbox" : "Failed to fetch document from Dropbox" },
      { status: notFound ? 404 : 502 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const role = session.user.role as Role
  const permissions = (session.user.modulePermissions as string[]) ?? []
  if (!canAccess(role, "customers", permissions) || !canUploadCustomerFile(role, permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id: customerId, documentId } = await params

  const document = await prisma.customerDocument.findFirst({
    where: { id: documentId, customerId, customer: { companyId } },
  })
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  // A Dropbox failure here (already deleted by hand, API hiccup, ...) must
  // never block cleaning up the DB record — deleting a document that's
  // already gone from Dropbox is still a successful delete from the user's
  // point of view. Only the folder itself (Customer/{ShortName}) is ever
  // protected from deletion — this only ever removes one file within it.
  const provider = getStorageProvider(document.storageProvider, companyId)
  try {
    await provider.delete(document.storageKey)
  } catch (error) {
    console.error("Customer document Dropbox delete failed (continuing to remove DB record):", error)
  }

  await prisma.customerDocument.delete({ where: { id: documentId } })

  await logActivity({
    companyId,
    entityType: "CustomerDocument",
    entityId: documentId,
    action: "DELETED",
    performedById: session.user.id as string,
    metadata: { customerId, fileName: document.originalFileName },
  })

  revalidatePath(`/customers/${customerId}`)
  return NextResponse.json({ success: true })
}
