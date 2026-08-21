import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccess } from "@/lib/permissions"
import { getDeliveryDocumentTemporaryLink, DropboxError } from "@/lib/dropbox"
import { redirectRelative } from "@/lib/http"
import type { Role } from "@/types"

const FILE_TYPE_MAP = { pdf: "PDF", xlsx: "XLSX" } as const

// The on-demand generation route is named "excel" (matching the Invoice/
// Quotation download architecture's own folder name), not "xlsx" — this map
// is what the fallback URL below must use instead of assuming the fileType
// param and the route segment are always the same string. Building the
// fallback straight from `fileTypeParam` (e.g. "/api/delivery/{id}/xlsx")
// was the actual 404: that route doesn't exist, only
// /api/delivery/[id]/excel does.
const FALLBACK_ROUTE_SEGMENT = { pdf: "pdf", xlsx: "excel" } as const

/**
 * Single stable link for the header's "Download PDF/Excel" buttons: if this
 * delivery has synced to Dropbox, redirect to a freshly-minted Dropbox
 * temporary link; otherwise fall back to the on-demand generation route
 * (/api/delivery/[id]/excel|pdf) unchanged. Mirrors the Invoice documents
 * route exactly.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileType: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "delivery", session.user.modulePermissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id: deliveryId, fileType: fileTypeParam } = await params

  const fileType = FILE_TYPE_MAP[fileTypeParam.toLowerCase() as keyof typeof FILE_TYPE_MAP]
  if (!fileType) {
    return NextResponse.json({ error: "Unknown file type" }, { status: 400 })
  }

  const delivery = await prisma.delivery.findFirst({ where: { id: deliveryId, companyId }, select: { id: true } })
  if (!delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 })
  }

  const document = await prisma.deliveryDocument.findFirst({
    where: { deliveryId, companyId, fileType },
    select: { storageKey: true, storageProvider: true },
  })

  const fallbackSegment = FALLBACK_ROUTE_SEGMENT[fileTypeParam.toLowerCase() as keyof typeof FALLBACK_ROUTE_SEGMENT]
  const fallbackPath = `/api/delivery/${deliveryId}/${fallbackSegment}`

  if (!document || document.storageProvider !== "DROPBOX") {
    return redirectRelative(fallbackPath)
  }

  try {
    const link = await getDeliveryDocumentTemporaryLink(companyId, document.storageKey)
    return NextResponse.redirect(link)
  } catch (error) {
    console.error("Delivery document Dropbox temporary link failed:", error)
    const notFound = error instanceof DropboxError && /not_found/i.test(error.message)
    if (notFound) {
      // Dropbox file is gone but a local regeneration still works fine —
      // never dead-end the user's download because of stale Dropbox state.
      return redirectRelative(fallbackPath)
    }
    return NextResponse.json({ error: "Failed to fetch document from Dropbox" }, { status: 502 })
  }
}
