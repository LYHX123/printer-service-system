import { readFile } from "fs/promises"
import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { auth } from "@/lib/auth"
import { getInvoiceForPdf } from "@/lib/data/invoices"
import { canAccess } from "@/lib/permissions"
import { InvoiceDocument } from "@/components/pdf/InvoiceDocument"
import { generateInvoicePdf, PdfConversionUnavailableError } from "@/lib/invoiceExcel"
import type { Role } from "@/types"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "invoice", session.user.modulePermissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id } = await params

  const invoice = await getInvoiceForPdf(id, companyId)
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const fileName = `${invoice.invoiceNumber}.pdf`

  // Primary: Excel Template Engine -> LibreOffice -> PDF.
  try {
    const pdfPath = await generateInvoicePdf(invoice)
    const buffer = await readFile(pdfPath)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    })
  } catch (error) {
    if (error instanceof PdfConversionUnavailableError) {
      console.warn(`[invoices/${id}/pdf] ${error.message}`)
    } else {
      console.warn(`[invoices/${id}/pdf] Template-engine PDF generation failed, using old PDF fallback:`, error)
    }
  }

  // Fallback: existing react-pdf generator, unchanged.
  const buffer = await renderToBuffer(<InvoiceDocument invoice={invoice} />)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}
