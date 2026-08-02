import { readFile } from "fs/promises"
import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { auth } from "@/lib/auth"
import { getQuotationForPdf } from "@/lib/data/quotations"
import { canAccess } from "@/lib/permissions"
import { QuotationDocument } from "@/components/pdf/QuotationDocument"
import { generateQuotationPdf, PdfConversionUnavailableError } from "@/lib/quotationExcel"
import type { Role } from "@/types"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "quotations", session.user.modulePermissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id } = await params

  const quotation = await getQuotationForPdf(id, companyId)
  if (!quotation) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
  }

  const fileName = `${quotation.customer.code}-${quotation.quotationNumber}.pdf`

  // Primary: Excel Template Engine -> LibreOffice -> PDF.
  try {
    const pdfPath = await generateQuotationPdf(quotation)
    const buffer = await readFile(pdfPath)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    if (error instanceof PdfConversionUnavailableError) {
      console.warn(`[quotations/${id}/pdf] ${error.message}`)
    } else {
      console.warn(`[quotations/${id}/pdf] Template-engine PDF generation failed, using old PDF fallback:`, error)
    }
  }

  // Fallback: existing react-pdf generator, unchanged.
  const buffer = await renderToBuffer(<QuotationDocument quotation={quotation} />)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}
