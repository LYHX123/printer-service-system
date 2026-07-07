import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getQuotationForPdf } from "@/lib/data/quotations"
import { canAccess } from "@/lib/permissions"
import { renderQuotationPdf } from "@/lib/pdf-templates/renderQuotationPdf"
import type { Role } from "@/types"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!canAccess(session.user.role as Role, "quotations")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const companyId = session.user.companyId as string
  const { id } = await params

  const quotation = await getQuotationForPdf(id, companyId)
  if (!quotation) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
  }

  const buffer = await renderQuotationPdf(quotation, session.user.name ?? "")
  const fileName = `${quotation.customer.code}-${quotation.quotationNumber}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}
