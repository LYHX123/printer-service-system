import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccess } from "@/lib/permissions"
import { getQuotationDocumentTemporaryLink, DropboxError } from "@/lib/dropbox"
import type { Role } from "@/types"

const FILE_TYPE_MAP = { pdf: "PDF", xlsx: "XLSX" } as const

/**
 * Single stable link for the header's "Download PDF/Excel" buttons,
 * regardless of the quotation's sync state: prefers the Approve-time FINAL
 * document if one exists, else the highest (i.e. current) version; if
 * neither has synced to Dropbox yet, falls back to the existing on-demand
 * generation route unchanged (old quotations without any synced document
 * keep working exactly as before this feature).
 *
 * For a *specific* historical version's Download link, see the
 * documents/version/[documentId] route instead — this one is deliberately
 * "give me whatever's most current," never a specific version.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileType: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "quotations", session.user.modulePermissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id: quotationId, fileType: fileTypeParam } = await params

  const fileType = FILE_TYPE_MAP[fileTypeParam.toLowerCase() as keyof typeof FILE_TYPE_MAP]
  if (!fileType) {
    return NextResponse.json({ error: "Unknown file type" }, { status: 400 })
  }

  const quotation = await prisma.quotation.findFirst({ where: { id: quotationId, companyId }, select: { id: true } })
  if (!quotation) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
  }

  const document = await prisma.quotationDocument.findFirst({
    where: { quotationId, companyId, fileType },
    orderBy: [{ isFinal: "desc" }, { version: "desc" }],
    select: { storageKey: true, storageProvider: true },
  })

  const fallbackUrl = new URL(`/api/quotations/${quotationId}/${fileTypeParam.toLowerCase()}`, _request.url)

  if (!document || document.storageProvider !== "DROPBOX") {
    return NextResponse.redirect(fallbackUrl)
  }

  try {
    const link = await getQuotationDocumentTemporaryLink(companyId, document.storageKey)
    return NextResponse.redirect(link)
  } catch (error) {
    console.error("Quotation document Dropbox temporary link failed:", error)
    const notFound = error instanceof DropboxError && /not_found/i.test(error.message)
    if (notFound) {
      // Dropbox file is gone but a local regeneration still works fine — never
      // dead-end the user's download because of stale Dropbox state.
      return NextResponse.redirect(fallbackUrl)
    }
    return NextResponse.json({ error: "Failed to fetch document from Dropbox" }, { status: 502 })
  }
}
