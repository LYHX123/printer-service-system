import { readFile } from "fs/promises"
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getQuotationForPdf } from "@/lib/data/quotations"
import { canAccess } from "@/lib/permissions"
import { generateExcel, TemplateEngineError } from "@/lib/templateEngine"
import { buildQuotationExcelData } from "@/lib/templateData/quotation"
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

  let outputPath: string
  try {
    outputPath = await generateExcel("quotation", buildQuotationExcelData(quotation))
  } catch (error) {
    if (error instanceof TemplateEngineError) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    throw error
  }

  const buffer = await readFile(outputPath)
  const fileName = `${quotation.customer.code}-${quotation.quotationNumber}.xlsx`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  })
}
