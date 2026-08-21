import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { canAccess } from "@/lib/permissions"
import { getInvoiceDocumentTemporaryLink, DropboxError } from "@/lib/dropbox"
import { redirectRelative } from "@/lib/http"
import type { Role } from "@/types"

const FILE_TYPE_MAP = { pdf: "PDF", xlsx: "XLSX", etr: "ETR" } as const

// The on-demand generation route is named "excel" (not "xlsx") — see
// src/app/api/quotations/invoices/[id]/excel/route.ts. Building the
// fallback straight from `fileTypeParam` sent a "xlsx" download to a route
// that doesn't exist (/api/quotations/invoices/[id]/xlsx), 404ing even once
// the redirect origin itself was fixed. ETR has no fallback route at all.
const FALLBACK_ROUTE_SEGMENT = { pdf: "pdf", xlsx: "excel" } as const

/**
 * Single stable link for the header's "Download PDF/Excel" buttons: if this
 * invoice has synced to Dropbox, redirect to a freshly-minted Dropbox
 * temporary link; otherwise fall back to the existing on-demand generation
 * route unchanged (old invoices without a synced document keep working
 * exactly as before this feature). Authorization is purely module
 * permission + row ownership (company) — never gated on invoice status
 * (DRAFT/CONFIRMED/CANCELLED all download the same way, matching the
 * Quotation Dropbox download rules).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileType: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "invoice", session.user.modulePermissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id: invoiceId, fileType: fileTypeParam } = await params

  const fileType = FILE_TYPE_MAP[fileTypeParam.toLowerCase() as keyof typeof FILE_TYPE_MAP]
  if (!fileType) {
    return NextResponse.json({ error: "Unknown file type" }, { status: 400 })
  }

  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, companyId }, select: { id: true } })
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const document = await prisma.invoiceDocument.findFirst({
    where: { invoiceId, companyId, fileType },
    select: { storageKey: true, storageProvider: true },
  })

  // ETR is a pure user upload with nothing to regenerate — unlike PDF/XLSX
  // there is no fallback route, so a missing/non-Dropbox record is a clean
  // 404 rather than a redirect to a route that doesn't exist for this type.
  const isEtr = fileType === "ETR"
  const fallbackSegment = FALLBACK_ROUTE_SEGMENT[fileTypeParam.toLowerCase() as keyof typeof FALLBACK_ROUTE_SEGMENT]
  const fallbackPath = isEtr ? null : `/api/quotations/invoices/${invoiceId}/${fallbackSegment}`

  if (!document || document.storageProvider !== "DROPBOX") {
    if (fallbackPath) return redirectRelative(fallbackPath)
    return NextResponse.json({ error: "ETR not found" }, { status: 404 })
  }

  try {
    const link = await getInvoiceDocumentTemporaryLink(companyId, document.storageKey)
    return NextResponse.redirect(link)
  } catch (error) {
    console.error("Invoice document Dropbox temporary link failed:", error)
    const notFound = error instanceof DropboxError && /not_found/i.test(error.message)
    if (notFound && fallbackPath) {
      // Dropbox file is gone but a local regeneration still works fine — never
      // dead-end the user's download because of stale Dropbox state.
      return redirectRelative(fallbackPath)
    }
    return NextResponse.json(
      { error: notFound ? "ETR not found in Dropbox" : "Failed to fetch document from Dropbox" },
      { status: notFound ? 404 : 502 }
    )
  }
}
