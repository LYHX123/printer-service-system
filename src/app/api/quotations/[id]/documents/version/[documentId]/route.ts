import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccess } from "@/lib/permissions"
import { getQuotationDocumentTemporaryLink, DropboxError } from "@/lib/dropbox"
import type { Role } from "@/types"

/**
 * Download link for one *specific* historical QuotationDocument row (a
 * particular version, or the FINAL snapshot) — used by the version-history
 * list on the Detail page. Deliberately has no "regenerate fresh" fallback
 * like the .../documents/[fileType] route: a historical version's Dropbox
 * file going missing must surface as an error, never silently substitute
 * today's live quotation data mislabeled as that old version.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "quotations", session.user.modulePermissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id: quotationId, documentId } = await params

  const document = await prisma.quotationDocument.findFirst({
    where: { id: documentId, quotationId, companyId },
    select: { storageKey: true, storageProvider: true },
  })
  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }
  if (document.storageProvider !== "DROPBOX") {
    return NextResponse.json({ error: "Document is not stored in Dropbox" }, { status: 400 })
  }

  try {
    const link = await getQuotationDocumentTemporaryLink(companyId, document.storageKey)
    return NextResponse.redirect(link)
  } catch (error) {
    console.error("Quotation version document Dropbox temporary link failed:", error)
    const notFound = error instanceof DropboxError && /not_found/i.test(error.message)
    return NextResponse.json(
      { error: notFound ? "File not found in Dropbox" : "Failed to fetch document from Dropbox" },
      { status: notFound ? 404 : 502 }
    )
  }
}
