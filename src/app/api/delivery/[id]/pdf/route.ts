import { readFile } from "fs/promises"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getDeliveryForPdf } from "@/lib/data/deliveries"
import { canAccess } from "@/lib/permissions"
import { generateDeliveryPdf, PdfConversionUnavailableError } from "@/lib/deliveryExcel"
import type { Role } from "@/types"

/**
 * Excel Template Engine -> LibreOffice -> PDF, same path as Invoice/Quotation
 * PDF. Unlike Invoice, there is no legacy react-pdf fallback renderer here —
 * Delivery Note is a new module with a single PDF path, so an unavailable
 * LibreOffice install is surfaced as a clear error rather than silently
 * falling back to a different-looking document.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "delivery", session.user.modulePermissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id } = await params

  const delivery = await getDeliveryForPdf(id, companyId)
  if (!delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 })
  }

  const fileName = `${delivery.deliveryNumber}.pdf`

  try {
    const pdfPath = await generateDeliveryPdf(delivery)
    const buffer = await readFile(pdfPath)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    if (error instanceof PdfConversionUnavailableError) {
      return NextResponse.json({ error: "PDF conversion is not available in this environment." }, { status: 503 })
    }
    throw error
  }
}
